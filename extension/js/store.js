// Persistence: browser.storage.local inside the extension, localStorage when opened as a plain page.

const KEY = 'board';
const ICONS_KEY = 'icons';
const ext = [globalThis.browser, globalThis.chrome].find((b) => b?.storage?.local) || null;

async function read(key) {
  if (ext) {
    const result = await ext.storage.local.get(key);
    return result[key] ?? null;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function write(key, value) {
  if (ext) {
    await ext.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export const load = () => read(KEY);
export const save = (state) => write(KEY, state);

// Favicon cache: { [host]: { src: dataUrl or '' when none was found, at: timestamp } }.
export const loadIcons = () => read(ICONS_KEY);
export const saveIcons = (icons) => write(ICONS_KEY, icons);

// Calls cb with the new raw value when another tab changes the board.
export function onExternalChange(cb) {
  if (ext) {
    ext.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[KEY]) cb(changes[KEY].newValue ?? null);
    });
    return;
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    try {
      cb(e.newValue ? JSON.parse(e.newValue) : null);
    } catch {
      cb(null);
    }
  });
}
