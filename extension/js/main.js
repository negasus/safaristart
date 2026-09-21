import * as M from './model.js';
import { load, save, onExternalChange } from './store.js';
import { render } from './render.js';
import { setupDnd } from './dnd.js';
import { openEditor, isEditorOpen } from './editor.js';
import { setupSearch } from './search.js';

const board = document.getElementById('board');
const searchInput = document.getElementById('search');
const editToggle = document.querySelector('[data-action="toggle-edit"]');

const EDIT_KEY = 'safaristart.editMode';

let state = M.emptyBoard();
const ui = { editMode: readEditMode(), query: '', selectedId: null };

function readEditMode() {
  try {
    return localStorage.getItem(EDIT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEditMode(on) {
  try {
    localStorage.setItem(EDIT_KEY, on ? '1' : '0');
  } catch {
    // Edit mode just won't be remembered.
  }
}

function matches() {
  return ui.query.trim() ? M.filterLinks(state, ui.query) : null;
}

function draw() {
  const found = matches();
  if (found && !found.some((l) => l.id === ui.selectedId)) ui.selectedId = found[0]?.id ?? null;
  if (!found) ui.selectedId = null;
  document.body.classList.toggle('is-editing', ui.editMode);
  editToggle.textContent = ui.editMode ? 'Done' : 'Edit';
  editToggle.setAttribute('aria-pressed', String(ui.editMode));
  render(board, state, { ...ui, matches: found ? new Set(found.map((l) => l.id)) : null });
}

function commit(next) {
  if (next === state) return;
  state = next;
  draw();
  save(state).catch((saveErr) => console.error('SafariStart: failed to save board', saveErr));
}

// ---------- dialogs ----------

async function editGroup(group) {
  const values = await openEditor({
    title: group ? 'Group' : 'New group',
    submitLabel: group ? 'Save' : 'Create',
    fields: [
      { name: 'title', label: 'Name', value: group?.title ?? '', required: true },
      { name: 'color', type: 'color', label: 'Color', value: group?.color ?? 'blue' },
      { name: 'width', type: 'width', label: 'Width', value: group?.width ?? 'm' },
      { name: 'view', type: 'view', label: 'Link style', value: group?.view ?? 'chips' },
    ],
  });
  if (!values) return;
  const props = { title: values.title.trim(), color: values.color, width: values.width, view: values.view };
  commit(group ? M.updateItem(state, group.id, props) : M.createGroup(state, props));
}

async function editLink(groupId, link) {
  const values = await openEditor({
    title: link ? 'Link' : 'New link',
    submitLabel: link ? 'Save' : 'Add',
    fields: [
      { name: 'url', label: 'URL', value: link?.url ?? '', placeholder: 'example.com', required: true },
      { name: 'title', label: 'Name', value: link?.title ?? '', placeholder: 'Taken from the URL' },
    ],
  });
  if (!values || !values.url.trim()) return;
  commit(link ? M.updateLink(state, link.id, values) : M.addLink(state, groupId, values));
}

async function editBreak(item) {
  const values = await openEditor({
    title: item ? 'Break' : 'New break',
    submitLabel: item ? 'Save' : 'Add',
    fields: [{ name: 'label', label: 'Label (optional)', value: item?.label ?? '' }],
  });
  if (!values) return;
  const label = values.label.trim();
  commit(item ? M.updateItem(state, item.id, { label }) : M.addBreak(state, { label }));
}

// ---------- clicks ----------

const itemById = (id) => state.items.find((it) => it.id === id);

const actions = {
  'toggle-edit'() {
    ui.editMode = !ui.editMode;
    writeEditMode(ui.editMode);
    draw();
  },
  'add-group'() {
    if (!ui.editMode) {
      ui.editMode = true;
      writeEditMode(true);
      draw();
    }
    editGroup(null);
  },
  'add-break'() {
    editBreak(null);
  },
  toggle(d) {
    commit(M.toggleCollapsed(state, d.groupId));
  },
  'edit-group'(d) {
    editGroup(itemById(d.itemId));
  },
  'edit-break'(d) {
    editBreak(itemById(d.itemId));
  },
  'remove-item'(d) {
    const item = itemById(d.itemId);
    if (!item) return;
    const count = item.type === 'group' ? M.linkCount(item) : 0;
    if (count && !confirm(`Delete group “${item.title}” and its ${count === 1 ? 'link' : `${count} links`}?`)) return;
    commit(M.removeItem(state, item.id));
  },
  'add-link'(d) {
    editLink(d.groupId, null);
  },
  'add-separator'(d) {
    commit(M.addSeparator(state, d.groupId, {}));
  },
  'remove-link'(d) {
    commit(M.removeLink(state, d.linkId));
  },
};

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-action]');
  if (trigger && actions[trigger.dataset.action]) {
    e.preventDefault();
    actions[trigger.dataset.action](trigger.dataset);
    return;
  }
  // In edit mode a click on a link edits it instead of navigating.
  const chipLink = ui.editMode && e.target.closest('.chip-link');
  if (chipLink) {
    e.preventDefault();
    const found = M.findLink(state, chipLink.closest('.chip').dataset.linkId);
    if (found) editLink(found.group.id, found.link);
  }
});

// ---------- drag & drop ----------

setupDnd(board, {
  onMoveLink: (linkId, groupId, index) => commit(M.moveLink(state, linkId, groupId, index)),
  onMoveItem: (itemId, index) => commit(M.moveItem(state, itemId, index)),
});

// ---------- search ----------

setupSearch(searchInput, {
  isBlocked: isEditorOpen,
  onQuery(q) {
    ui.query = q;
    ui.selectedId = null;
    draw();
  },
  onMove(delta) {
    const found = matches();
    if (!found || !found.length) return;
    const i = found.findIndex((l) => l.id === ui.selectedId);
    ui.selectedId = found[(i + delta + found.length) % found.length].id;
    draw();
    board.querySelector('.chip.is-selected')?.scrollIntoView({ block: 'nearest' });
  },
  onOpen({ newTab }) {
    const found = M.findLink(state, ui.selectedId);
    if (!found) return;
    if (newTab) window.open(found.link.url, '_blank');
    else window.location.href = found.link.url;
  },
});

// ---------- boot ----------

onExternalChange((raw) => {
  const next = raw ? M.migrate(raw) : M.emptyBoard();
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  draw();
});

(async () => {
  let raw;
  try {
    raw = await load();
  } catch (loadErr) {
    // Keep stored data untouched: show an empty board without saving it.
    console.error('SafariStart: failed to load board', loadErr);
    draw();
    return;
  }
  if (raw == null) {
    state = M.demoBoard();
    save(state).catch((saveErr) => console.error('SafariStart: failed to save board', saveErr));
  } else {
    state = M.migrate(raw);
  }
  draw();
})();
