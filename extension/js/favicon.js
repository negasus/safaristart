import { hostOf } from './model.js';

const LOCAL_HOST = /^(localhost|127\.|10\.|192\.168\.|\[?::1\]?$)|\.local$/;

export function faviconUrl(url) {
  const host = hostOf(url);
  if (!host || LOCAL_HOST.test(host)) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

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

export function iconFor(link) {
  const src = faviconUrl(link.url);
  if (!src) return letterIcon(link);
  const img = document.createElement('img');
  img.className = 'fav';
  img.src = src;
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', () => img.replaceWith(letterIcon(link)), { once: true });
  return img;
}
