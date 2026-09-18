// State -> DOM. Full re-render; interactions are handled by delegation in main.js.
import { iconFor } from './favicon.js';

const ICONS = {
  pencil: '<path d="M10.5 3.5l2 2L6 12H4v-2z"/>',
  close: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  grip: '<circle cx="6" cy="4.5" r=".9"/><circle cx="10" cy="4.5" r=".9"/><circle cx="6" cy="8" r=".9"/><circle cx="10" cy="8" r=".9"/><circle cx="6" cy="11.5" r=".9"/><circle cx="10" cy="11.5" r=".9"/>',
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) if (dv != null) node.dataset[dk] = dv;
    }
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

function icon(name) {
  const span = el('span', { class: 'icon', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 16 16">${ICONS[name]}</svg>`;
  return span;
}

function iconButton(name, label, action, dataset = {}) {
  return el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, dataset: { action, ...dataset } }, icon(name));
}

function renderLink(link, ui) {
  const a = el('a', { class: 'chip-link', href: link.url, draggable: ui.editMode ? 'false' : null, title: link.url },
    iconFor(link),
    el('span', { class: 'chip-title' }, link.title));
  const li = el('li', {
    class: `chip${ui.selectedId === link.id ? ' is-selected' : ''}`,
    dataset: { linkId: link.id },
    draggable: ui.editMode ? 'true' : null,
  }, a);
  if (ui.editMode) li.append(iconButton('close', `Удалить ярлык «${link.title}»`, 'remove-link', { linkId: link.id }));
  return li;
}

function renderGroup(group, ui) {
  const searching = ui.matches != null;
  const links = searching ? group.links.filter((l) => ui.matches.has(l.id)) : group.links;
  if (searching && links.length === 0) return null;
  const collapsed = group.collapsed && !searching;
  const bodyId = `body-${group.id}`;

  const tab = el('header', { class: 'group-tab' },
    ui.editMode ? el('span', { class: 'grip' }, icon('grip')) : null,
    el('button', {
      type: 'button', class: 'tab-toggle', 'aria-expanded': String(!collapsed), 'aria-controls': bodyId,
      dataset: { action: 'toggle', groupId: group.id }, disabled: searching || null,
    },
    el('span', { class: 'tab-title' }, group.title || 'Без названия'),
    collapsed ? el('span', { class: 'tab-count' }, String(group.links.length)) : null),
    ui.editMode ? iconButton('pencil', 'Изменить группу', 'edit-group', { itemId: group.id }) : null,
    ui.editMode ? iconButton('close', 'Удалить группу', 'remove-item', { itemId: group.id }) : null);

  const body = el('div', { class: 'group-body', id: bodyId, hidden: collapsed || null });
  if (links.length) body.append(el('ul', { class: 'links', dataset: { groupId: group.id } }, ...links.map((l) => renderLink(l, ui))));
  else body.append(el('ul', { class: 'links is-empty', dataset: { groupId: group.id } }));
  if (ui.editMode) {
    body.append(el('button', { type: 'button', class: 'add-link', dataset: { action: 'add-link', groupId: group.id } }, icon('plus'), 'Ярлык'));
  } else if (!links.length) {
    body.append(el('p', { class: 'group-empty' }, 'Ярлыков пока нет. Нажмите «Правка», чтобы добавить.'));
  }

  return el('section', {
    class: 'group',
    'aria-label': group.title || 'Без названия',
    dataset: { itemId: group.id, color: group.color, width: group.width, collapsed: collapsed ? 'true' : null },
    draggable: ui.editMode ? 'true' : null,
  }, tab, body);
}

function renderBreak(item, ui) {
  if (ui.matches != null) return null;
  if (!item.label && !ui.editMode) return el('div', { class: 'break', role: 'presentation', dataset: { itemId: item.id } });
  const label = ui.editMode
    ? el('button', { type: 'button', class: 'break-label', dataset: { action: 'edit-break', itemId: item.id } }, item.label || 'Перенос строки')
    : el('h2', { class: 'break-label' }, item.label);
  return el('div', {
    class: `break${item.label ? ' has-label' : ''}`,
    dataset: { itemId: item.id },
    draggable: ui.editMode ? 'true' : null,
  },
  ui.editMode ? el('span', { class: 'grip' }, icon('grip')) : null,
  label,
  el('span', { class: 'break-rule', 'aria-hidden': 'true' }),
  ui.editMode ? iconButton('close', 'Удалить разрыв', 'remove-item', { itemId: item.id }) : null);
}

function renderEmpty(ui) {
  if (ui.matches != null) return el('p', { class: 'board-empty' }, 'Ничего не найдено.');
  return el('div', { class: 'board-empty' },
    el('p', {}, 'Здесь пока пусто. Создайте первую группу и добавьте в неё ярлыки.'),
    el('button', { type: 'button', class: 'btn btn-primary', dataset: { action: 'add-group' } }, 'Создать группу'));
}

export function render(root, state, ui) {
  const nodes = state.items
    .map((it) => (it.type === 'group' ? renderGroup(it, ui) : renderBreak(it, ui)))
    .filter(Boolean);
  const hasGroups = nodes.some((n) => n.classList.contains('group'));
  root.classList.toggle('is-editing', ui.editMode);
  root.replaceChildren(...(hasGroups || (ui.editMode && nodes.length) ? nodes : [renderEmpty(ui)]));
}
