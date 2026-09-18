// Native HTML5 drag & drop for links (between/within groups) and board items (groups, breaks).
// Reports moves through callbacks; indices exclude the dragged element, matching model.moveLink/moveItem.

let drag = null; // { kind: 'link' | 'item', id, el }
let marker = null; // { el, cls }

function setMarker(el, cls) {
  if (marker && marker.el === el && marker.cls === cls) return;
  clearMarker();
  if (!el) return;
  el.classList.add(cls);
  marker = { el, cls };
}

function clearMarker() {
  if (marker) marker.el.classList.remove(marker.cls);
  marker = null;
}

// Index of the first element the pointer is "before" in a wrapping left-to-right flow.
function flowIndex(elements, x, y) {
  for (let i = 0; i < elements.length; i++) {
    const r = elements[i].getBoundingClientRect();
    if (y < r.top) return i;
    if (y <= r.bottom && x < r.left + r.width / 2) return i;
  }
  return elements.length;
}

function linkTarget(e) {
  const group = e.target.closest('.group');
  if (!group) return null;
  const list = group.querySelector('.links');
  const chips = [...group.querySelectorAll('.chip')].filter((c) => c !== drag.el);
  const index = group.dataset.collapsed ? chips.length : flowIndex(chips, e.clientX, e.clientY);
  return { groupId: group.dataset.itemId, index, before: chips[index] || null, list, group };
}

function itemTarget(board, e) {
  const items = [...board.children].filter((c) => c.dataset.itemId && c !== drag.el);
  const index = flowIndex(items, e.clientX, e.clientY);
  return { index, before: items[index] || null };
}

export function setupDnd(board, { onMoveLink, onMoveItem }) {
  board.addEventListener('dragstart', (e) => {
    if (!board.classList.contains('is-editing')) return;
    const chip = e.target.closest('.chip');
    const item = e.target.closest('.group, .break');
    const source = chip || item;
    if (!source) return;
    drag = chip ? { kind: 'link', id: chip.dataset.linkId, el: chip } : { kind: 'item', id: item.dataset.itemId, el: item };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => source.classList.add('is-dragging'));
    e.stopPropagation();
  });

  board.addEventListener('dragover', (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (drag.kind === 'link') {
      const t = linkTarget(e);
      if (!t) return clearMarker();
      if (t.before) setMarker(t.before, 'drop-before');
      else setMarker(t.group, 'drop-end');
    } else {
      const t = itemTarget(board, e);
      if (t.before) setMarker(t.before, 'drop-before');
      else setMarker(board, 'drop-end');
    }
  });

  board.addEventListener('drop', (e) => {
    if (!drag) return;
    e.preventDefault();
    const current = drag;
    if (current.kind === 'link') {
      const t = linkTarget(e);
      if (t) onMoveLink(current.id, t.groupId, t.index);
    } else {
      onMoveItem(current.id, itemTarget(board, e).index);
    }
    end();
  });

  function end() {
    drag?.el.classList.remove('is-dragging');
    drag = null;
    clearMarker();
  }
  board.addEventListener('dragend', end);
  board.addEventListener('dragleave', (e) => {
    if (!board.contains(e.relatedTarget)) clearMarker();
  });
}
