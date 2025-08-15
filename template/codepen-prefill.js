// CodePen Prefill helper (module)
const formHtml = `
  <form id="codepen-prefill-form" action="https://codepen.io/pen/define" method="POST" target="_blank" style="position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;">
    <input type="hidden" name="data" id="codepen-data" />
    <button type="button" id="open-codepen" aria-label="Open in CodePen" title="Open in CodePen" style="all: unset; cursor: pointer; width: 44px; height: 44px; border-radius: 999px; background: rgba(0,0,0,0.7); color: #fff; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(6px); font-size: 1.25rem; font-weight: 600;">⧉</button>
  </form>
`

function ensureForm() {
  if (!document.getElementById('codepen-prefill-form')) {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = formHtml
    document.body.appendChild(wrapper.firstElementChild)
  }
}

function fetchText(url) {
  return fetch(url)
    .then(r => (r.ok ? r.text() : ''))
    .catch(() => '')
}

// Minimal CSS extractor: prefers __vite__css if present
function extractViteCss(txt) {
  if (!txt) return ''
  const marker = '__vite__css'
  const idx = txt.indexOf(marker)
  if (idx === -1) return txt
  const q = txt.indexOf('"', idx)
  if (q === -1) return ''
  let i = q + 1
  let out = ''
  let escaped = false
  for (; i < txt.length; i++) {
    const ch = txt.charAt(i)
    if (escaped) {
      if (ch === 'n') out += '\n'
      else if (ch === 'r') out += '\r'
      else if (ch === 't') out += '\t'
      else out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      break
    }
    out += ch
  }
  return out
}

async function collectCss() {
  const [resetRaw, styleRaw] = await Promise.all([
    fetchText('@@internal/reset.css').catch(() => ''),
    fetchText('style.css').catch(() => ''),
  ])
  const reset = extractViteCss(resetRaw || '')
  const css = extractViteCss(styleRaw || '')
  const parts = []
  if (reset) parts.push(`/* reset.css */\n${reset}`)
  if (css) parts.push(`/* style.css */\n${css}`)
  return parts.join('\n\n')
}

async function detectShaders() {
  // Consider shaders present if GLSL files exist or a shader canvas is present
  try {
    const res = await fetch('vertex.glsl', { method: 'HEAD', cache: 'no-store' })
    if (res && res.ok) return true
  } catch (_) {}
  return !!document.getElementById('shader-canvas')
}

async function collectJs() {
  const hasShaders = await detectShaders()
  const parts = []
  if (hasShaders) {
    const plain = await fetch('@@internal/shaders.js')
      .then(r => (r.ok ? r.text() : ''))
      .then(t =>
        t
          .replace(/^[ \t]*\/\/\#.*$/gm, '')
          .replace(/\/\*[\s\S]*?sourceMappingURL[\s\S]*?\*\//gm, '')
      )
      .catch(() => '')
    if (plain) parts.push(`/* shaders.js */\n${plain}`)
  }
  const custom = await fetchText('main.js')
    .then(t =>
      t.replace(/^[ \t]*\/\/\#.*$/gm, '').replace(/\/\*[\s\S]*?sourceMappingURL[\s\S]*?\*\//gm, '')
    )
    .catch(() => '')
  if (custom) parts.push(`/* main.js */\n${custom}`)
  return parts.join('\n\n')
}

async function onClick() {
  ensureForm()
  const input = document.getElementById('codepen-data')
  const form = document.getElementById('codepen-prefill-form')
  if (!input || !form) return
  const [css, js, html] = await Promise.all([
    collectCss(),
    collectJs(),
    (async () => {
      // Prefer raw HTML from server (extension-free), then parse and prune local entries
      try {
        const res = await fetch(location.pathname, { cache: 'no-store' })
        const txt = await res.text()
        const doc = new DOMParser().parseFromString(txt, 'text/html')
        const rm = sel => doc.querySelectorAll(sel).forEach(el => el.remove())
        rm('#codepen-prefill-form')
        rm('script[type="module"][src="/template/codepen-prefill.js"]')
        rm('script[type="module"][src="@@internal/codepen-prefill.js"]')
        rm('script[type="module"][src="@@internal/shaders-hmr.js"]')
        rm('script[type="module"][src="main.js"]')
        // Build shader tags from GLSL files
        const [v, f] = await Promise.all([fetchText('vertex.glsl'), fetchText('fragment.glsl')])
        const shaderTags = `${v ? `\n    <script type=\"x-shader/x-vertex\" id=\"vertex-shader\">\n${v}\n    </script>` : ''}${f ? `\n    <script type=\"x-shader/x-fragment\" id=\"fragment-shader\">\n${f}\n    </script>` : ''}`
        if (doc.body) doc.body.insertAdjacentHTML('beforeend', shaderTags)
        return doc.body && doc.body.innerHTML ? doc.body.innerHTML.trim() : ''
      } catch (_) {
        // Fallback to current DOM (may include extension nodes)
        const clone = document.body.cloneNode(true)
        const rm = sel => clone.querySelectorAll(sel).forEach(el => el.remove())
        rm('#codepen-prefill-form')
        rm('script[type="module"][src="/template/codepen-prefill.js"]')
        rm('script[type="module"][src="@@internal/codepen-prefill.js"]')
        rm('script[type="module"][src="@@internal/shaders-hmr.js"]')
        rm('script[type="module"][src="main.js"]')
        // Build shader tags from GLSL files
        const [v, f] = await Promise.all([fetchText('vertex.glsl'), fetchText('fragment.glsl')])
        const shaderTags = `${v ? `\n    <script type=\"x-shader/x-vertex\" id=\"vertex-shader\">\n${v}\n    </script>` : ''}${f ? `\n    <script type=\"x-shader/x-fragment\" id=\"fragment-shader\">\n${f}\n    </script>` : ''}`
        clone.insertAdjacentHTML('beforeend', shaderTags)
        return clone.innerHTML.trim()
      }
    })(),
  ])
  input.value = JSON.stringify({
    title: document.title || 'Hoppen Pen',
    html,
    css,
    // Prefer plain runtime when shaders are present to avoid Vite imports in CodePen
    js: js || (await fetchText('shaders.js').then(t => (t ? `/* shaders.js */\n${t}` : ''))),
    editors: '111',
  })
  form.submit()
}

function init() {
  ensureForm()
  const btn = document.getElementById('open-codepen')
  if (btn) btn.addEventListener('click', () => onClick().catch(console.error))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
