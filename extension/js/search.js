// Search field wiring: typing anywhere focuses it, arrows move the selection, Enter opens it.
// Selection and filtering live in main.js; this module only translates keys into callbacks.

function isTypingTarget(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function setupSearch(input, { onQuery, onMove, onOpen, isBlocked }) {
  input.addEventListener('input', () => onQuery(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onOpen({ newTab: e.metaKey || e.ctrlKey });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (input.value) {
        input.value = '';
        onQuery('');
      } else {
        input.blur();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (isBlocked() || isTypingTarget(document.activeElement)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key.length === 1 && e.key !== ' ') {
      // Focus before the default action so the character lands in the field.
      input.focus();
    }
  });
}
