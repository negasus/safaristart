// Pure board state functions. No DOM access; every function returns a new state.

export const VERSION = 1;
export const WIDTHS = ['s', 'm', 'l', 'full'];
export const VIEWS = ['chips', 'tiles'];
export const COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'];

const newId = () => globalThis.crypto.randomUUID();

export function emptyBoard() {
  return { version: VERSION, items: [] };
}

export function demoBoard() {
  let s = emptyBoard();
  s = createGroup(s, { title: 'Избранное', color: 'blue' });
  const gid = s.items[0].id;
  s = addLink(s, gid, { title: 'GitHub', url: 'https://github.com' });
  s = addLink(s, gid, { title: 'Hacker News', url: 'https://news.ycombinator.com' });
  return s;
}

function insertAt(list, index, value) {
  const i = index == null ? list.length : Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), value, ...list.slice(i)];
}

function mapGroups(state, fn) {
  return { ...state, items: state.items.map((it) => (it.type === 'group' ? fn(it) : it)) };
}

function makeGroup(props) {
  return {
    type: 'group',
    id: props.id || newId(),
    title: typeof props.title === 'string' ? props.title : '',
    color: COLORS.includes(props.color) ? props.color : 'gray',
    width: WIDTHS.includes(props.width) ? props.width : 'm',
    view: VIEWS.includes(props.view) ? props.view : 'chips',
    collapsed: props.collapsed === true,
    links: [],
  };
}

function makeLink(props) {
  const url = normalizeUrl(props.url || '');
  const title = typeof props.title === 'string' && props.title.trim() ? props.title.trim() : hostOf(url) || url;
  return { id: props.id || newId(), title, url };
}

function makeBreak(props) {
  return { type: 'break', id: props.id || newId(), label: typeof props.label === 'string' ? props.label : '' };
}

export function createGroup(state, props, index) {
  return { ...state, items: insertAt(state.items, index, makeGroup(props)) };
}

export function addBreak(state, props, index) {
  return { ...state, items: insertAt(state.items, index, makeBreak(props)) };
}

export function updateItem(state, itemId, patch) {
  return { ...state, items: state.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) };
}

export function removeItem(state, itemId) {
  return { ...state, items: state.items.filter((it) => it.id !== itemId) };
}

export function toggleCollapsed(state, groupId) {
  return mapGroups(state, (g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g));
}

export function addLink(state, groupId, props, index) {
  const link = makeLink(props);
  return mapGroups(state, (g) => (g.id === groupId ? { ...g, links: insertAt(g.links, index, link) } : g));
}

export function updateLink(state, linkId, patch) {
  const next = { ...patch };
  if ('url' in next) next.url = normalizeUrl(next.url);
  return mapGroups(state, (g) => ({
    ...g,
    links: g.links.map((l) => {
      if (l.id !== linkId) return l;
      const merged = { ...l, ...next };
      if (!merged.title || !merged.title.trim()) merged.title = hostOf(merged.url) || merged.url;
      return merged;
    }),
  }));
}

export function removeLink(state, linkId) {
  return mapGroups(state, (g) => ({ ...g, links: g.links.filter((l) => l.id !== linkId) }));
}

export function findLink(state, linkId) {
  for (const it of state.items) {
    if (it.type !== 'group') continue;
    const link = it.links.find((l) => l.id === linkId);
    if (link) return { group: it, link };
  }
  return null;
}

// toIndex is the position in the list with the moved item already removed.
export function moveItem(state, itemId, toIndex) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return state;
  const rest = state.items.filter((it) => it.id !== itemId);
  return { ...state, items: insertAt(rest, toIndex, item) };
}

// toIndex is the position in the target group's links with the moved link already removed.
export function moveLink(state, linkId, toGroupId, toIndex) {
  const found = findLink(state, linkId);
  const target = state.items.find((it) => it.id === toGroupId && it.type === 'group');
  if (!found || !target) return state;
  const without = removeLink(state, linkId);
  return mapGroups(without, (g) => (g.id === toGroupId ? { ...g, links: insertAt(g.links, toIndex, found.link) } : g));
}

export function filterLinks(state, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const result = [];
  for (const it of state.items) {
    if (it.type !== 'group') continue;
    for (const l of it.links) {
      const hay = `${l.title} ${l.url}`.toLowerCase();
      if (tokens.every((t) => hay.includes(t))) result.push(l);
    }
  }
  return result;
}

export function normalizeUrl(input) {
  const s = String(input).trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(mailto|tel):/i.test(s)) return s;
  return `https://${s}`;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !Array.isArray(raw.items)) {
    return emptyBoard();
  }
  const items = [];
  for (const it of raw.items) {
    if (!it || typeof it !== 'object') continue;
    if (it.type === 'group') {
      const g = makeGroup(it);
      g.links = (Array.isArray(it.links) ? it.links : [])
        .filter((l) => l && typeof l === 'object' && typeof l.url === 'string')
        .map(makeLink);
      items.push(g);
    } else if (it.type === 'break') {
      items.push(makeBreak(it));
    }
  }
  return { version: VERSION, items };
}
