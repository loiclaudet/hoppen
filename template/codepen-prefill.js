// CodePen Prefill helper (module)
const formHtml = `
  <form id="codepen-prefill-form" action="https://codepen.io/pen/define" method="POST" target="_blank" style="position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;">
    <input type="hidden" name="data" id="codepen-data" />
    <button type="button" id="open-codepen" aria-label="Open in CodePen" title="Open in CodePen" style="all: unset; cursor: pointer; width: 44px; height: 44px; border-radius: 999px; background: rgba(0,0,0,0.7); color: #fff; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(6px);">⧉</button>
  </form>
`;

function ensureForm() {
  if (!document.getElementById('codepen-prefill-form')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = formHtml;
    document.body.appendChild(wrapper.firstElementChild);
  }
}

function fetchText(url) {
  return fetch(url)
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '');
}

// Minimal CSS extractor: prefers __vite__css if present
function extractViteCss(txt) {
  if (!txt) return '';
  const marker = '__vite__css';
  const idx = txt.indexOf(marker);
  if (idx === -1) return txt;
  const q = txt.indexOf('"', idx);
  if (q === -1) return '';
  let i = q + 1;
  let out = '';
  let escaped = false;
  for (; i < txt.length; i++) {
    const ch = txt.charAt(i);
    if (escaped) {
      if (ch === 'n') out += '\n';
      else if (ch === 'r') out += '\r';
      else if (ch === 't') out += '\t';
      else out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      break;
    }
    out += ch;
  }
  return out;
}

async function collectCss() {
  const raw = await fetchText('style.css');
  const css = extractViteCss(raw);
  return css ? `/* style.css */\n${css}` : '';
}

async function collectJs() {
  // JS handling will be refined later per iteration
  const js = await fetchText('main.js');
  return js ? `/* main.js */\n${js}` : '';
}

async function onClick() {
  ensureForm();
  const input = document.getElementById('codepen-data');
  const form = document.getElementById('codepen-prefill-form');
  if (!input || !form) return;
  const [css, js] = await Promise.all([collectCss(), collectJs()]);
  input.value = JSON.stringify({
    title: document.title || 'Hoppen Pen',
    css,
    js,
    editors: '111',
  });
  form.submit();
}

function init() {
  ensureForm();
  const btn = document.getElementById('open-codepen');
  if (btn) btn.addEventListener('click', () => onClick().catch(console.error));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
