// A very small hyperscript helper. No framework, no build step -- the whole
// point of this project is that you open index.html and it runs.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  add(el, children);
  return el;
}

function add(el, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  add(f, children);
  return f;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  add(el, children);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** A table built from column definitions. */
export function table(columns, rows, opts = {}) {
  const thead = h('thead', {}, h('tr', {},
    columns.map((c) => h('th', { class: c.num ? 'num' : '', style: c.width ? { width: c.width } : null }, c.label))));
  const tbody = h('tbody', {},
    rows.map((row, i) => {
      const tr = h('tr', {
        class: [opts.rowClass?.(row, i), opts.onRow ? 'clickable' : ''].filter(Boolean).join(' '),
        onclick: opts.onRow ? () => opts.onRow(row, i) : null,
      }, columns.map((c) => {
        const value = c.render ? c.render(row, i) : row[c.key];
        return h('td', { class: c.num ? 'num' : '' }, value);
      }));
      return tr;
    }));
  return h('table', { class: 'table' }, thead, tbody);
}

/** Colour-coded overall rating badge. */
export function ovrBadge(value) {
  const v = Math.round(value);
  const tier = v >= 88 ? 'elite' : v >= 80 ? 'great' : v >= 73 ? 'good' : v >= 65 ? 'avg' : 'poor';
  return h('span', { class: `ovr ovr--${tier}` }, v);
}

export function bar(fraction, color) {
  return h('div', { class: 'bar' },
    h('div', { class: 'bar__fill', style: { width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: color || '' } }));
}

export function statRow(label, value, cls = '') {
  return h('div', { class: 'stat-row' },
    h('span', { class: 'stat-row__label' }, label),
    h('span', { class: `stat-row__value ${cls}` }, value));
}

export function panel(title, body, actions = []) {
  return h('section', { class: 'panel' },
    h('header', { class: 'panel__head' },
      h('span', { class: 'panel__title' }, title),
      actions.length ? h('div', { class: 'panel__actions' }, actions) : null),
    h('div', { class: 'panel__body' }, body));
}

export function panelFlush(title, body, actions = []) {
  return h('section', { class: 'panel' },
    h('header', { class: 'panel__head' },
      h('span', { class: 'panel__title' }, title),
      actions.length ? h('div', { class: 'panel__actions' }, actions) : null),
    h('div', { class: 'panel__body panel__body--flush' }, body));
}

export function btn(label, onclick, opts = {}) {
  return h('button', {
    class: ['btn', opts.variant ? `btn--${opts.variant}` : '', opts.small ? 'btn--sm' : '', opts.block ? 'btn--block' : '', opts.class ?? ''].filter(Boolean).join(' '),
    onclick,
    disabled: opts.disabled,
    title: opts.title,
  }, label);
}

export function chip(label, opts = {}) {
  return h('span', {
    class: ['chip', opts.on ? 'is-on' : '', opts.variant ? `chip--${opts.variant}` : ''].filter(Boolean).join(' '),
    title: opts.title,
    onclick: opts.onclick,
    style: opts.onclick ? { cursor: 'pointer' } : null,
  }, label);
}

export function empty(text) {
  return h('div', { class: 'empty' }, text);
}

// --- Modal ------------------------------------------------------------------

let modalHost = null;

export function modal({ title, body, actions = [], onClose }) {
  closeModal();
  const backdrop = h('div', {
    class: 'modal-backdrop',
    onclick: (e) => { if (e.target === backdrop) closeModal(); },
  },
  h('div', { class: 'modal' },
    h('header', { class: 'modal__head' },
      h('span', { class: 'modal__title' }, title),
      h('span', { class: 'spacer' }),
      btn('Close', () => closeModal(), { small: true })),
    h('div', { class: 'modal__body' }, body),
    actions.length ? h('footer', { class: 'modal__foot' }, actions) : null));
  modalHost = backdrop;
  modalHost.__onClose = onClose;
  document.body.appendChild(backdrop);
  return backdrop;
}

export function closeModal() {
  if (!modalHost) return;
  modalHost.__onClose?.();
  modalHost.remove();
  modalHost = null;
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// --- Toasts -----------------------------------------------------------------

let toastHost = null;

export function toast(text, variant = '') {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host' });
    document.body.appendChild(toastHost);
  }
  const el = h('div', { class: `toast ${variant ? `toast--${variant}` : ''}` }, text);
  toastHost.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, 3400);
}
