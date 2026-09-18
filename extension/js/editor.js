// Modal form built from a field list. openEditor resolves with the values, or null on cancel.
import { COLORS, VIEWS, WIDTHS } from './model.js';

const COLOR_NAMES = {
  gray: 'Серый', red: 'Красный', orange: 'Оранжевый', yellow: 'Жёлтый',
  green: 'Зелёный', teal: 'Бирюзовый', blue: 'Синий', purple: 'Фиолетовый',
};
const WIDTH_NAMES = { s: 'Узкая', m: 'Средняя', l: 'Широкая', full: 'Во всю строку' };
const VIEW_NAMES = { chips: 'Список', tiles: 'Плитки' };

const dialog = document.getElementById('editor');
const form = dialog.querySelector('form');
const titleEl = dialog.querySelector('.editor-title');
const fieldsEl = dialog.querySelector('.editor-fields');
const submitBtn = dialog.querySelector('button[type="submit"]');

let resolveCurrent = null;

function textField(f) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = f.label;
  const input = document.createElement('input');
  input.name = f.name;
  input.type = 'text';
  input.value = f.value ?? '';
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (f.placeholder) input.placeholder = f.placeholder;
  if (f.required) input.required = true;
  wrap.append(caption, input);
  return wrap;
}

function choiceField(f, options, names, className) {
  const set = document.createElement('fieldset');
  set.className = `field ${className}`;
  set.style.setProperty('--choices', String(options.length));
  const legend = document.createElement('legend');
  legend.className = 'field-label';
  legend.textContent = f.label;
  set.append(legend);
  for (const opt of options) {
    const label = document.createElement('label');
    label.className = 'choice';
    label.dataset.value = opt;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = f.name;
    input.value = opt;
    input.checked = opt === f.value;
    const text = document.createElement('span');
    text.textContent = names[opt];
    label.append(input, text);
    set.append(label);
  }
  return set;
}

function buildField(f) {
  if (f.type === 'color') return choiceField(f, COLORS, COLOR_NAMES, 'field-colors');
  if (f.type === 'width') return choiceField(f, WIDTHS, WIDTH_NAMES, 'field-segmented');
  if (f.type === 'view') return choiceField(f, VIEWS, VIEW_NAMES, 'field-segmented');
  return textField(f);
}

function finish(values) {
  const resolve = resolveCurrent;
  resolveCurrent = null;
  if (dialog.open) dialog.close();
  resolve?.(values);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  finish(Object.fromEntries(data.entries()));
});
dialog.querySelector('[data-editor-cancel]').addEventListener('click', () => finish(null));
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  finish(null);
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) finish(null);
});

export function openEditor({ title, submitLabel, fields }) {
  if (resolveCurrent) finish(null);
  titleEl.textContent = title;
  submitBtn.textContent = submitLabel;
  fieldsEl.replaceChildren(...fields.map(buildField));
  dialog.showModal();
  const first = fieldsEl.querySelector('input[type="text"]');
  first?.focus();
  first?.select();
  return new Promise((resolve) => {
    resolveCurrent = resolve;
  });
}

export function isEditorOpen() {
  return dialog.open;
}
