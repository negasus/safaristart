// Link icons. Inside the extension they are downloaded by the native handler
// (pages can't read cross-origin image bytes), normalized to a 64px PNG and cached
// in storage by host. As a plain page they are loaded from Google's service directly.
import { hostOf, normalizeUrl } from './model.js';
import { loadIcons, saveIcons } from './store.js';

const LOCAL_HOST = /^(localhost|127\.|10\.|192\.168\.|\[?::1\]?$)|\.local$/;
const SIZE = 64;
const MISS_TTL = 3 * 24 * 60 * 60 * 1000; // retry sites without an icon after 3 days

const runtime = [globalThis.browser, globalThis.chrome].find((b) => b?.runtime?.sendNativeMessage)?.runtime || null;

let native = Boolean(runtime);
let cache = {};
let onChange = () => {};
let redrawQueued = false;
let writes = Promise.resolve();
const pending = new Map(); // host -> Promise<src>

class NativeUnavailable extends Error {}

export function faviconUrl(url) {
  const host = hostOf(url);
  if (!host || LOCAL_HOST.test(host)) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${SIZE}`;
}

// Loads the cache; cb is called (once per frame) when icons arrive.
export async function initIcons(cb) {
  onChange = cb;
  try {
    cache = (await loadIcons()) || {};
  } catch (loadErr) {
    console.error('SafariStart: failed to load icon cache', loadErr);
  }
}

export function canRefreshIcons() {
  return native;
}

function notify() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    onChange();
  });
}

// Re-reads storage before writing so tabs don't drop each other's entries.
function persist(host, entry) {
  cache = { ...cache, [host]: entry };
  writes = writes.then(async () => {
    const stored = (await loadIcons()) || {};
    await saveIcons({ ...stored, [host]: entry });
  }).catch((saveErr) => console.error('SafariStart: failed to save icon cache', saveErr));
  return writes;
}

// ---------- download ----------

async function nativeFetch(url) {
  let res;
  try {
    res = await runtime.sendNativeMessage('com.negasus.safaristart', { action: 'fetch', url });
  } catch (nativeErr) {
    throw new NativeUnavailable(String(nativeErr));
  }
  if (!res || typeof res.ok !== 'boolean') throw new NativeUnavailable('unexpected native response');
  if (!res.ok || res.status < 200 || res.status >= 300) return null;
  const bytes = Uint8Array.from(atob(res.body || ''), (c) => c.charCodeAt(0));
  return { bytes, type: (res.type || '').split(';')[0].trim().toLowerCase(), url: res.url || url };
}

function imageType(file) {
  if (file.type.startsWith('image/')) return file.type;
  const path = new URL(file.url).pathname.toLowerCase();
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.png')) return 'image/png';
  return file.type === 'text/html' ? '' : 'application/octet-stream';
}

// Decodes any image the browser understands and redraws it as a square PNG data URL.
function normalize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || SIZE;
      const h = img.naturalHeight || SIZE;
      const scale = Math.min(SIZE / w, SIZE / h);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (SIZE - w * scale) / 2, (SIZE - h * scale) / 2, w * scale, h * scale);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('not an image'));
    img.src = src;
  });
}

async function tryImage(url) {
  if (url.startsWith('data:')) return normalize(url).catch(() => '');
  const file = await nativeFetch(url);
  if (!file || !file.bytes.length) return '';
  const type = imageType(file);
  if (!type) return '';
  const blobUrl = URL.createObjectURL(new Blob([file.bytes], { type }));
  try {
    return await normalize(blobUrl);
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

// Icons declared by the page itself, best first.
function declaredIcons(page) {
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(page.bytes), 'text/html');
  const base = new URL(doc.querySelector('base[href]')?.getAttribute('href') || page.url, page.url);
  const found = [];
  for (const link of doc.querySelectorAll('link[rel][href]')) {
    const rel = link.getAttribute('rel').toLowerCase().split(/\s+/);
    const touch = rel.some((r) => r.startsWith('apple-touch-icon'));
    if (!touch && !rel.includes('icon')) continue;
    let href;
    try {
      href = new URL(link.getAttribute('href'), base).href;
    } catch {
      continue;
    }
    const sizes = (link.getAttribute('sizes') || '').toLowerCase();
    const isSvg = /\.svg(\?|$)/i.test(href) || link.getAttribute('type') === 'image/svg+xml';
    const size = sizes === 'any' || isSvg ? 1000 : Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    found.push({ href, score: size || (touch ? 180 : 16) });
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.href);
}

async function discover(pageUrl) {
  const { origin, hostname } = new URL(pageUrl);
  if (!LOCAL_HOST.test(hostname)) {
    const src = await tryImage(faviconUrl(pageUrl));
    if (src) return src;
  }
  const candidates = [];
  const page = await nativeFetch(`${origin}/`);
  if (page?.type.includes('html')) candidates.push(...declaredIcons(page));
  candidates.push(`${origin}/favicon.ico`);
  for (const url of new Set(candidates)) {
    const src = await tryImage(url);
    if (src) return src;
  }
  return '';
}

// Resolves with the icon's data URL, or '' when none was found.
// A forced refresh keeps the old cached icon if the new lookup finds nothing.
function fetchIcon(url, { force = false } = {}) {
  const host = hostOf(url);
  if (!host || !native) return Promise.resolve('');
  if (pending.has(host)) return pending.get(host);
  const job = discover(url)
    .then(async (src) => {
      if (src || !force || !cache[host]?.src) await persist(host, { src, at: Date.now() });
      notify();
      return src;
    })
    .catch((fetchErr) => {
      if (fetchErr instanceof NativeUnavailable) {
        native = false;
        notify();
      }
      console.error('SafariStart: failed to fetch icon for', host, fetchErr);
      return '';
    })
    .finally(() => pending.delete(host));
  pending.set(host, job);
  return job;
}

export const refreshIcon = (url) => fetchIcon(url, { force: true });

// ---------- DOM ----------

function hueOf(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function letterIcon(link) {
  const el = document.createElement('span');
  el.className = 'fav fav-letter';
  const source = link.title || hostOf(link.url) || '?';
  el.textContent = [...source.trim()][0]?.toUpperCase() || '?';
  el.style.setProperty('--fav-hue', String(hueOf(hostOf(link.url) || source)));
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function imageIcon(src, link, lazy) {
  const img = document.createElement('img');
  img.className = 'fav';
  img.src = src;
  img.alt = '';
  img.width = 16;
  img.height = 16;
  if (lazy) img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', () => img.replaceWith(letterIcon(link)), { once: true });
  return img;
}

export function iconFor(link) {
  const host = hostOf(link.url);
  if (!host) return letterIcon(link);
  if (!native) {
    const src = faviconUrl(link.url);
    return src ? imageIcon(src, link, true) : letterIcon(link);
  }
  const entry = cache[host];
  if (entry?.src) return imageIcon(entry.src, link, false);
  if (!entry || Date.now() - entry.at > MISS_TTL) fetchIcon(link.url);
  return letterIcon(link);
}

// Editor row: current icon plus a button that downloads it again for the URL in the form.
export function iconField(link) {
  const wrap = document.createElement('div');
  wrap.className = 'field field-icon';
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = 'Icon';
  const row = document.createElement('div');
  row.className = 'field-icon-row';
  const preview = document.createElement('span');
  preview.className = 'field-icon-preview';
  preview.append(iconFor(link));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Refresh icon';
  const status = document.createElement('span');
  status.className = 'field-icon-status';
  status.setAttribute('role', 'status');

  button.addEventListener('click', async () => {
    const current = { ...link, url: normalizeUrl(button.form?.elements.url?.value || '') || link.url };
    button.disabled = true;
    status.textContent = 'Loading…';
    const src = await refreshIcon(current.url);
    preview.replaceChildren(iconFor(current));
    status.textContent = src ? 'Updated' : 'No icon found';
    button.disabled = false;
  });

  row.append(preview, button, status);
  wrap.append(caption, row);
  return wrap;
}
