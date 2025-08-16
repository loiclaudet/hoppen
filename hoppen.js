#!/usr/bin/env node
import { fileURLToPath } from 'url'
import path from 'path'
import fse from 'fs-extra'
import prompts from 'prompts'
import { createServer } from 'vite'
import { load as cheerioLoad } from 'cheerio'
import prettier from 'prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WORKSPACE_DIR = process.cwd()

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
  await fse.ensureDir(WORKSPACE_DIR)
}

function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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
    <link rel="stylesheet" href="@@internal/reset.css" />
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
        { title: 'Lenis', value: 'lenis' },
        { title: 'r3f', value: 'r3f' },
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
  const projectDir = path.join(WORKSPACE_DIR, safeName)
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

  const features = new Set(response.features || [])
  const includeGSAP = features.has('gsap')
  const includeShaders = features.has('shaders')
  const includeThree = features.has('three')
  const includeLenis = features.has('lenis')
  const includeR3F = features.has('r3f')

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

      // Copy HMR runner and reset.css into hidden internal folder for correct import resolution
      const internalDir = path.join(projectDir, '@@internal')
      await fse.ensureDir(internalDir)
      const shadersHmrSrc = path.join(templateDir, 'shaders-hmr.js')
      if (await fse.pathExists(shadersHmrSrc)) {
        await fse.copy(shadersHmrSrc, path.join(internalDir, 'shaders-hmr.js'))
      }
      const resetCssSrc = path.join(__dirname, 'template', 'reset.css')
      if (await fse.pathExists(resetCssSrc)) {
        await fse.copy(resetCssSrc, path.join(internalDir, 'reset.css'))
      }
      // Also include plain runtime for CodePen export
      const shadersPlainSrc = path.join(templateDir, 'shaders.js')
      if (await fse.pathExists(shadersPlainSrc)) {
        await fse.copy(shadersPlainSrc, path.join(internalDir, 'shaders.js'))
      }
      // Ensure an empty main.js for user custom code (exported to CodePen)
      await outputFormatted(path.join(projectDir, 'main.js'), '', 'babel')
    } else {
      throw new Error(`Missing template shaders.html at ${shadersHtmlPath}`)
    }
  } else {
    // non-shaders: ensure style file exists; defer main.js creation to later logic
    await writeIfMissingFormatted(path.join(projectDir, 'style.css'), '', 'css')
    // Ensure internal folder reset.css is available for consistent export
    const internalDir = path.join(projectDir, '@@internal')
    await fse.ensureDir(internalDir)
    const resetCssSrc = path.join(__dirname, 'template', 'reset.css')
    if (await fse.pathExists(resetCssSrc)) {
      await fse.copy(resetCssSrc, path.join(internalDir, 'reset.css'))
    }
  }

  if (!includeThree && !includeShaders) {
    // add project title heading to prevent blank page
    $('body').append(`\n    <h1>${response.projectName}</h1>`)
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
  if (includeLenis) {
    libs.push(
      `<script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@latest/dist/lenis.min.js"></script>`
    )
  }
  if (includeR3F) {
    // React + ReactDOM UMD globals
    libs.push(
      `<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>`
    )
    libs.push(
      `<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>`
    )
    // three UMD global (THREE)
    libs.push(`<script src="https://unpkg.com/three@latest/build/three.min.js"></script>`)
    // Optionally include drei helpers (UMD not guaranteed). Skipping to avoid runtime issues.
  }

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

  // Include CodePen Prefill helper inside internal folder.
  {
    const internalDir = path.join(projectDir, '@@internal')
    await fse.ensureDir(internalDir)
    const prefillSrc = path.join(__dirname, 'template', 'codepen-prefill.js')
    if (await fse.pathExists(prefillSrc)) {
      await fse.copy(prefillSrc, path.join(internalDir, 'codepen-prefill.js'))
    }
    $('body').append('\n    <script type="module" src="@@internal/codepen-prefill.js"></script>')
  }

  // Ensure main.js exists and includes THREE import when selected
  const mainPath = path.join(projectDir, 'main.js')
  if (includeThree) {
    const threeTemplatePath = path.join(__dirname, 'template', 'threejs.js')
    if (!(await fse.pathExists(threeTemplatePath))) {
      throw new Error(`Missing template threejs.js at ${threeTemplatePath}`)
    }
    const threeTemplate = await fse.readFile(threeTemplatePath, 'utf8')
    await outputFormatted(mainPath, threeTemplate, 'babel')
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
    root: WORKSPACE_DIR,
    server: {
      port: 2187,
      open: `/${path.basename(projectDir)}/index.html`,
      fs: { allow: [__dirname, WORKSPACE_DIR] },
    },
  })
  await server.listen()
  const info = server.resolvedUrls
  console.log('\u001b[32mDev server running:\u001b[0m', info.local[0])
}

// Removed copyCommand in favor of CodePen Prefill workflow (added progressively)

async function startExistingProject(targetName) {
  await ensureBaseDirs()
  const entries = await fse.readdir(WORKSPACE_DIR)
  if (entries.length === 0) {
    console.log('No projects found. Run "hoppen create" first.')
    process.exit(1)
  }
  const withStatsFull = await Promise.all(
    entries.map(async name => {
      const dir = path.join(WORKSPACE_DIR, name)
      const indexPath = path.join(dir, 'index.html')
      const internalPath = path.join(dir, '@@internal')
      let mtimeMs
      let birthtimeMs
      if ((await fse.pathExists(dir)) && (await fse.stat(dir)).isDirectory()) {
        const hasIndex = await fse.pathExists(indexPath)
        const hasInternal = await fse.pathExists(internalPath)
        if (!hasInternal || !hasIndex) {
          return null
        }
        if (hasIndex) {
          const stat = await fse.stat(indexPath)
          mtimeMs = stat.mtimeMs
          birthtimeMs = stat.birthtimeMs
        } else {
          const stat = await fse.stat(dir)
          mtimeMs = stat.mtimeMs
          birthtimeMs = stat.birthtimeMs
        }
        return { name, dir, mtimeMs, birthtimeMs, hasIndex }
      } else {
        return null
      }
    })
  )
  const withStats = withStatsFull.filter(Boolean)

  // If a targetName was provided, try to start it directly
  if (targetName) {
    const match = withStats.find(e => e.name === targetName)
    if (!match) {
      console.error(`Project '${targetName}' not found in ${WORKSPACE_DIR}.`)
      console.log('Available projects:', withStats.map(e => e.name).join(', '))
      process.exit(1)
    }
    await startServer(match.dir)
    return
  }

  // show latest first
  withStats.sort((a, b) => a.birthtimeMs - b.birthtimeMs).reverse()
  const { project } = await prompts({
    type: 'select',
    name: 'project',
    message: 'Choose a project to start',
    initial: 0,
    choices: withStats.map(e => ({ title: e.name, value: e.name })),
  })
  const chosen = withStats.find(e => e.name === project) || withStats[0]
  await startServer(chosen.dir)
}

async function main() {
  const [, , cmd] = process.argv
  if (!cmd || cmd === 'create') {
    // Default to create when no subcommand is provided
    await createProject()
  } else if (cmd === 'start') {
    const targetName = process.argv[3]
    await startExistingProject(targetName)
  } else {
    console.log('Usage: hoppen [create] | hoppen start [projectName]')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
