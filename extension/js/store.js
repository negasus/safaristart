// Persistence: browser.storage.local inside the extension, localStorage when opened as a plain page.

const KEY = 'board';
const ext = [globalThis.browser, globalThis.chrome].find((b) => b?.storage?.local) || null;

export async function load() {
  if (ext) {
    const result = await ext.storage.local.get(KEY);
    return result[KEY] ?? null;
  }
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function save(state) {
  if (ext) {
    await ext.storage.local.set({ [KEY]: state });
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(state));
}

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
