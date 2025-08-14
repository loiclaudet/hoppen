#!/usr/bin/env node
import { fileURLToPath } from 'url'
import path from 'path'
// import fs from 'fs'
import fse from 'fs-extra'
import prompts from 'prompts'
import { createServer } from 'vite'
import { load as cheerioLoad } from 'cheerio'
import prettier from 'prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECTS_DIR = path.join(__dirname, 'projects')

const GSAP_CDN = 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/gsap.min.js'
const GSAP_PLUGINS = [
  {
    name: 'ScrollTrigger',
    id: 'ScrollTrigger',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/ScrollTrigger.min.js',
  },
  {
    name: 'ScrollSmoother',
    id: 'ScrollSmoother',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/ScrollSmoother.min.js',
  },
  {
    name: 'Draggable',
    id: 'Draggable',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/Draggable.min.js',
  },
  {
    name: 'SplitText',
    id: 'SplitText',
    src: 'https://cdn.jsdelivr.net/npm/gsap@latest/dist/SplitText.min.js',
  },
]

async function ensureBaseDirs() {
  await fse.ensureDir(PROJECTS_DIR)
}

function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function writeFileIfMissing(filePath, contents) {
  if (!(await fse.pathExists(filePath))) {
    await fse.outputFile(filePath, contents)
  }
}

const PRETTIER_OPTS = {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 100,
  bracketSpacing: true,
  arrowParens: 'always',
  htmlWhitespaceSensitivity: 'css',
  endOfLine: 'lf',
}

async function formatContent(source, parser) {
  if (parser === 'glsl') {
    try {
      const glslPlugin = await import('prettier-plugin-glsl')
      return await prettier.format(source, {
        ...PRETTIER_OPTS,
        parser: 'glsl',
        plugins: [glslPlugin.default || glslPlugin],
      })
    } catch (e) {
      // Fallback: return source unchanged if plugin missing
      return source
    }
  }
  return await prettier.format(source, { ...PRETTIER_OPTS, parser })
}

async function outputFormatted(filePath, source, parser) {
  const formatted = await formatContent(source, parser)
  await fse.outputFile(filePath, formatted)
}

async function writeIfMissingFormatted(filePath, source, parser) {
  if (!(await fse.pathExists(filePath))) {
    await outputFormatted(filePath, source, parser)
  }
}

// removed ensureGlslTidiness per user request

function buildBaseHtml({ title = 'Hoppen', useStyleHref }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="../../reset.css" />
    ${useStyleHref ? `<link rel=\"stylesheet\" href=\"${useStyleHref}\" />` : ''}
  </head>
  <body>
  </body>
</html>`
}

async function createProject() {
  await ensureBaseDirs()

  const response = await prompts([
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      validate: val => (val && val.trim().length > 0 ? true : 'Please provide a name'),
    },
    {
      type: 'multiselect',
      name: 'features',
      message: 'Select features to include',
      hint: 'Space to select. Enter to confirm',
      choices: [
        { title: 'GSAP', value: 'gsap' },
        { title: 'Shaders skeleton', value: 'shaders' },
        { title: 'THREE.js', value: 'three' },
      ],
    },
    {
      type: (prev, values) => (values.features?.includes('gsap') ? 'multiselect' : null),
      name: 'gsapPlugins',
      message: 'Select optional GSAP plugins',
      hint: 'Space to select. Enter to confirm',
      choices: GSAP_PLUGINS.map(p => ({ title: p.name, value: p.id })),
    },
  ])

  const safeName = toKebabCase(response.projectName)
  const projectDir = path.join(PROJECTS_DIR, safeName)
  if (await fse.pathExists(projectDir)) {
    const overwrite = await prompts({
      type: 'confirm',
      name: 'ok',
      message: `Project '${safeName}' exists. Overwrite?`,
      initial: false,
    })
    if (!overwrite.ok) process.exit(1)
    await fse.remove(projectDir)
  }

  // Use root reset.css via ../../reset.css reference; no copy/symlink

  const features = new Set(response.features || [])
  const includeGSAP = features.has('gsap')
  const includeShaders = features.has('shaders')
  const includeThree = features.has('three')

  // Prepare HTML scaffold
  const useStyleHref = includeShaders ? 'shaders.css' : 'style.css'
  let html = buildBaseHtml({ title: 'Hoppen', useStyleHref })
  let $ = cheerioLoad(html)

  // Body content from shaders skeleton if selected
  if (includeShaders) {
    const shadersHtmlPath = path.join(__dirname, 'template', 'shaders.html')
    if (await fse.pathExists(shadersHtmlPath)) {
      const shadersHtml = await fse.readFile(shadersHtmlPath, 'utf8')
      const $$ = cheerioLoad(shadersHtml)
      // Extract only the canvas; do not inline shaders in HTML
      const canvas = $$('canvas#shader-canvas').first()
      if (canvas.length) {
        $('body').append(
          `\n    ${cheerioLoad('<body></body>')('body').append(canvas.clone()).html()}`
        )
      } else {
        $('body').append('\n    <canvas id="shader-canvas"></canvas>')
      }
      // copy shaders assets from template folder
      const templateDir = path.join(__dirname, 'template')
      if (await fse.pathExists(path.join(templateDir, 'shaders.css'))) {
        const css = await fse.readFile(path.join(templateDir, 'shaders.css'), 'utf8')
        await outputFormatted(path.join(projectDir, 'shaders.css'), css, 'css')
      } else {
        await writeIfMissingFormatted(path.join(projectDir, 'shaders.css'), '', 'css')
      }
      // Create GLSL files from template inline scripts if available
      const vSrc = $$('script[type="x-shader/x-vertex"]').text().trim()
      const fSrc = $$('script[type="x-shader/x-fragment"]').text().trim()
      const vOut = await formatContent(vSrc || 'precision mediump float;\n', 'glsl')
      const fOut = await formatContent(fSrc || 'precision mediump float;\n', 'glsl')
      await fse.outputFile(path.join(projectDir, 'vertex.glsl'), vOut)
      await fse.outputFile(path.join(projectDir, 'fragment.glsl'), fOut)
      // Generate shaders.js as ES module importing raw GLSL with HMR support
      const generatedShaderJs = `const canvas = document.getElementById('shader-canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
if (!gl) {
  alert('WebGL is not supported by your browser.');
  throw new Error('WebGL not supported');
}

let rafId;
let program;
let timeLocation;
let resolutionLocation;

async function loadShaders() {
  const [vertexShaderSource, fragmentShaderSource] = await Promise.all([
    import('./vertex.glsl?raw').then((m) => m.default),
    import('./fragment.glsl?raw').then((m) => m.default),
  ]);
  return { vertexShaderSource, fragmentShaderSource };
}

function createShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

async function init() {
  const { vertexShaderSource, fragmentShaderSource } = await loadShaders();

  const vertexShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program));
    throw new Error('Program linking failed');
  }
  gl.useProgram(program);

  timeLocation = gl.getUniformLocation(program, 'u_time');
  resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function render() {
    const time = performance.now() * 0.001;
    gl.uniform1f(timeLocation, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    rafId = requestAnimationFrame(render);
  }
  render();
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
  };
}

let disposePromise = init();

if (import.meta.hot) {
  import.meta.hot.accept(async () => {
    // Wait previous render loop to be cancelled before reinit
    const dispose = await disposePromise;
    dispose && dispose();
    disposePromise = init();
  });
}
`
      await outputFormatted(path.join(projectDir, 'shaders.js'), generatedShaderJs, 'babel')
    } else {
      // fallback minimal shaders container
      $('body').append('<canvas id="shader-canvas"></canvas>')
      await writeIfMissingFormatted(path.join(projectDir, 'shaders.css'), '', 'css')
      // Create empty GLSL files and a basic loader
      await outputFormatted(
        path.join(projectDir, 'vertex.glsl'),
        'precision mediump float;\n',
        'glsl'
      )
      await outputFormatted(
        path.join(projectDir, 'fragment.glsl'),
        'precision mediump float;\nvoid main(){ gl_FragColor = vec4(1.0); }\n',
        'glsl'
      )
      const basicLoader = `// Add your shader loader or logic here\n`
      await outputFormatted(path.join(projectDir, 'shaders.js'), basicLoader, 'babel')
    }
  } else {
    // non-shaders: ensure style file exists; defer main.js creation to later logic
    await writeIfMissingFormatted(path.join(projectDir, 'style.css'), '', 'css')
    $('body').append('')
  }

  // Libraries
  const libs = []
  if (includeGSAP) libs.push(`<script src="${GSAP_CDN}"></script>`)
  if (includeGSAP && Array.isArray(response.gsapPlugins)) {
    response.gsapPlugins.forEach(id => {
      const plugin = GSAP_PLUGINS.find(p => p.id === id)
      if (plugin) libs.push(`<script src="${plugin.src}"></script>`)
    })
  }
  // THREE is handled via ESM imports in main.js

  // Insert libraries before app scripts
  const libsHtml = `\n    ${libs.join('\n    ')}`
  if (libs.length) {
    $('body').append(libsHtml)
  }

  // App scripts ordering
  if (includeShaders) {
    $('body').append('\n    <script type="module" src="shaders.js"></script>')
  }
  // Include module entry if not shaders-only OR when THREE is selected
  if (!includeShaders || includeThree) {
    $('body').append('\n    <script type="module" src="main.js"></script>')
  }

  // Minimal CodePen Prefill floating button (title only for now)
  $('body').append(`
    <form id="codepen-prefill-form" action="https://codepen.io/pen/define" method="POST" target="_blank" style="position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;">
      <input type="hidden" name="data" id="codepen-data" />
      <button type="button" id="open-codepen" aria-label="Open in CodePen" title="Open in CodePen" style="all: unset; cursor: pointer; width: 44px; height: 44px; border-radius: 999px; background: rgba(0,0,0,0.7); color: #fff; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(6px);">⧉</button>
    </form>
    <script>
      (function(){
        var btn = document.getElementById('open-codepen');
        if(!btn) return;
        btn.addEventListener('click', function(){
          var input = document.getElementById('codepen-data');
          var form = document.getElementById('codepen-prefill-form');
          if(!input || !form) return;
          input.value = JSON.stringify({ title: document.title || 'Hoppen Pen' });
          form.submit();
        });
      })();
    </script>
  `)

  // Ensure main.js exists and includes THREE import when selected
  const mainPath = path.join(projectDir, 'main.js')
  if (includeThree) {
    let current = ''
    if (await fse.pathExists(mainPath)) {
      current = await fse.readFile(mainPath, 'utf8')
    }
    if (!/three\.module\.js/.test(current)) {
      const seed =
        `import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js'\n\n` +
        current +
        `\nconsole.log('THREE revision:', THREE.REVISION)`
      await outputFormatted(mainPath, seed, 'babel')
    }
  } else if (!includeShaders) {
    // No shaders and no three: ensure empty module entry
    await writeIfMissingFormatted(mainPath, '', 'babel')
  }
  // Set project title and write formatted HTML
  $('title').text(response.projectName)
  const htmlOut = $.html()
  await outputFormatted(path.join(projectDir, 'index.html'), htmlOut, 'html')

  // Start dev server with Vite serving the projectDir
  await startServer(projectDir)
}

async function startServer(projectDir) {
  const server = await createServer({
    root: __dirname,
    server: {
      port: 2187,
      open: `/projects/${path.basename(projectDir)}/index.html`,
      fs: { allow: [__dirname] },
    },
    appType: 'mpa',
  })
  await server.listen()
  const info = server.resolvedUrls
  console.log('\u001b[32mDev server running:\u001b[0m', info.local[0])
}

// Removed copyCommand in favor of CodePen Prefill workflow (added progressively)

async function main() {
  const [, , cmd] = process.argv
  if (cmd === 'create') {
    await createProject()
  } else {
    console.log('Usage: hoppen create')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
