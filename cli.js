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
  const useStyleHref = 'style.css'
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
        await outputFormatted(path.join(projectDir, 'style.css'), css, 'css')
      } else {
        await writeIfMissingFormatted(path.join(projectDir, 'style.css'), '', 'css')
      }
      // Create GLSL files from template inline scripts for IDE features (and HMR via Vite ?raw)
      const vSrc = $$('script[type="x-shader/x-vertex"]#vertex-shader').text().trim()
      const fSrc = $$('script[type="x-shader/x-fragment"]#fragment-shader').text().trim()
      const vOut = await formatContent(vSrc || 'precision mediump float;\n', 'glsl')
      const fOut = await formatContent(fSrc || 'precision mediump float;\n', 'glsl')
      await fse.outputFile(path.join(projectDir, 'vertex.glsl'), vOut)
      await fse.outputFile(path.join(projectDir, 'fragment.glsl'), fOut)
      // No JS wrappers; Vite will serve ?raw for HMR via imports inside the shared runner

      // Do not inline shader script tags in HTML; keep GLSL only in files

      // Copy HMR runner into hidden internal folder for correct import resolution
      const internalDir = path.join(projectDir, '@@internal')
      await fse.ensureDir(internalDir)
      const shadersHmrSrc = path.join(templateDir, 'shaders-hmr.js')
      if (await fse.pathExists(shadersHmrSrc)) {
        await fse.copy(shadersHmrSrc, path.join(internalDir, 'shaders-hmr.js'))
      }
      // Ensure an empty main.js for user custom code (exported to CodePen)
      await outputFormatted(path.join(projectDir, 'main.js'), '', 'babel')
    } else {
      // fallback minimal shaders container
      $('body').append('<canvas id="shader-canvas"></canvas>')
      await writeIfMissingFormatted(path.join(projectDir, 'style.css'), '', 'css')
      // Fallback: minimal runner expecting inline shader tags
      const basicRunner = `const canvas = document.getElementById('shader-canvas');\nconst gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');\nif (!gl) { alert('WebGL not supported'); throw new Error('WebGL not supported'); }\nconst vsSrc = document.getElementById('vertex-shader')?.textContent || '';\nconst fsSrc = document.getElementById('fragment-shader')?.textContent || '';\nfunction createShader(gl, source, type){ const s=gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); gl.deleteShader(s); return null;} return s;}\nconst vs = createShader(gl, vsSrc, gl.VERTEX_SHADER);\nconst fs = createShader(gl, fsSrc, gl.FRAGMENT_SHADER);\nconst program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if(!gl.getProgramParameter(program, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(program)); throw new Error('Link failed'); } gl.useProgram(program);\nconst timeLocation = gl.getUniformLocation(program, 'u_time'); const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');\nconst vertices = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW); const loc = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);\nfunction resize(){ const dpr = Math.min(window.devicePixelRatio||1,2); canvas.width = Math.floor(window.innerWidth*dpr); canvas.height = Math.floor(window.innerHeight*dpr); gl.viewport(0,0,canvas.width,canvas.height); gl.uniform2f(resolutionLocation, canvas.width, canvas.height);} window.addEventListener('resize', resize); resize();\nfunction render(){ const t = performance.now()*0.001; gl.uniform1f(timeLocation, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); requestAnimationFrame(render);} render();\n`
      await outputFormatted(path.join(projectDir, 'main.js'), basicRunner, 'babel')
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

  // App script entries
  if (includeShaders) {
    $('body').append('\n    <script type="module" src="@@internal/shaders-hmr.js"></script>')
    $('body').append('\n    <script type="module" src="main.js"></script>')
  } else {
    $('body').append('\n    <script type="module" src="main.js"></script>')
  }

  // Include CodePen Prefill helper from repository path (not copied into project)
  $('body').append('\n    <script type="module" src="/template/codepen-prefill.js"></script>')

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
