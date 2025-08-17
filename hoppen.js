#!/usr/bin/env node
import { fileURLToPath } from 'url'
import path from 'path'
import fse from 'fs-extra'
import prompts from 'prompts'
import { createServer } from 'vite'
import { load as cheerioLoad } from 'cheerio'
import prettier from 'prettier'
import { WORKSPACE_DIR, CDNS, GSAP_PLUGINS, PRETTIER_OPTS } from './constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

main().catch(err => {
  console.error(err)
  process.exit(1)
})

async function main() {
  const [, , cmd] = process.argv
  if (!cmd || cmd === 'create') {
    await createProject()
  } else if (cmd === 'start') {
    const targetName = process.argv[3]
    await startExistingProject(targetName)
  } else {
    console.log('Usage: hoppen [create] | hoppen start [projectName]')
  }
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

function buildBaseHtml(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="@@internal/reset.css" />
    <link rel="stylesheet" href="style.css" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⧉</text></svg>">
  </head>
  <body>
  </body>
</html>`
}

function getFeatureFlags(selected) {
  const features = new Set(selected || [])
  return {
    includeGSAP: features.has('gsap'),
    includeShaders: features.has('shaders'),
    includeThree: features.has('three'),
    includeLenis: features.has('lenis'),
    includeR3F: features.has('r3f'),
  }
}

async function setupShaders(projectDir, $) {
  const shadersHtmlPath = path.join(__dirname, 'template', 'shaders.html')
  if (!(await fse.pathExists(shadersHtmlPath))) {
    throw new Error(`Missing template shaders.html at ${shadersHtmlPath}`)
  }
  const shadersHtml = await fse.readFile(shadersHtmlPath, 'utf8')
  const $$ = cheerioLoad(shadersHtml)
  const canvas = $$('canvas#shader-canvas').first()
  if (canvas.length) {
    $('body').append(`\n    ${cheerioLoad('<body></body>')('body').append(canvas.clone()).html()}`)
  } else {
    $('body').append('\n    <canvas id="shader-canvas"></canvas>')
  }

  const templateDir = path.join(__dirname, 'template')
  if (await fse.pathExists(path.join(templateDir, 'shaders.css'))) {
    const css = await fse.readFile(path.join(templateDir, 'shaders.css'), 'utf8')
    await outputFormatted(path.join(projectDir, 'style.css'), css, 'css')
  } else {
    await writeIfMissingFormatted(path.join(projectDir, 'style.css'), '', 'css')
  }

  const vSrc = $$('script[type="x-shader/x-vertex"]#vertex-shader').text().trim()
  const fSrc = $$('script[type="x-shader/x-fragment"]#fragment-shader').text().trim()
  const vOut = await formatContent(vSrc, 'glsl')
  const fOut = await formatContent(fSrc, 'glsl')
  await fse.outputFile(path.join(projectDir, 'vertex.glsl'), vOut)
  await fse.outputFile(path.join(projectDir, 'fragment.glsl'), fOut)

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
  const shadersPlainSrc = path.join(templateDir, 'shaders.js')
  if (await fse.pathExists(shadersPlainSrc)) {
    await fse.copy(shadersPlainSrc, path.join(internalDir, 'shaders.js'))
  }

  await outputFormatted(path.join(projectDir, 'main.js'), '', 'babel')
}

async function ensureStyleAndReset(projectDir) {
  await writeIfMissingFormatted(path.join(projectDir, 'style.css'), '', 'css')
  const internalDir = path.join(projectDir, '@@internal')
  await fse.ensureDir(internalDir)
  const resetCssSrc = path.join(__dirname, 'template', 'reset.css')
  if (await fse.pathExists(resetCssSrc)) {
    await fse.copy(resetCssSrc, path.join(internalDir, 'reset.css'))
  }
}

function buildLibrariesHtml({ includeGSAP, gsapPlugins, includeLenis, includeR3F }) {
  const libs = []
  if (includeGSAP) libs.push(`<script src="${CDNS.GSAP}"></script>`)
  if (includeGSAP && Array.isArray(gsapPlugins)) {
    gsapPlugins.forEach(id => {
      const plugin = GSAP_PLUGINS.find(p => p.id === id)
      if (plugin) libs.push(`<script src="${plugin.src}"></script>`)
    })
  }
  if (includeLenis) {
    libs.push(`<script src="${CDNS.LENIS}"></script>`)
  }
  if (includeR3F) {
    // No UMD libs needed; r3f template uses ESM imports
  }
  return libs.length ? `\n    ${libs.join('\n    ')}` : ''
}

function getMainEntryFilename(includeR3F) {
  return includeR3F ? 'main.jsx' : 'main.js'
}

function appendAppEntries($, mainEntryFilename, includeShaders) {
  if (includeShaders) {
    $('body').append('\n    <script type="module" src="@@internal/shaders-hmr.js"></script>')
  }
  $('body').append(`\n    <script type="module" src="${mainEntryFilename}"></script>`)
}

async function ensureCodepenPrefill(projectDir, $) {
  const internalDir = path.join(projectDir, '@@internal')
  await fse.ensureDir(internalDir)
  const prefillSrc = path.join(__dirname, 'template', 'codepen-prefill.js')
  if (await fse.pathExists(prefillSrc)) {
    await fse.copy(prefillSrc, path.join(internalDir, 'codepen-prefill.js'))
  }
  $('body').append('\n    <script type="module" src="@@internal/codepen-prefill.js"></script>')
}

async function writeMainEntryFromTemplates(
  projectDir,
  { includeR3F, includeThree, includeShaders }
) {
  const mainFilename = getMainEntryFilename(includeR3F)
  const mainPath = path.join(projectDir, mainFilename)
  if (includeR3F) {
    const r3fTemplatePath = path.join(__dirname, 'template', 'r3f.jsx')
    if (!(await fse.pathExists(r3fTemplatePath))) {
      throw new Error(`Missing template r3f.jsx at ${r3fTemplatePath}`)
    }
    const r3fTemplate = await fse.readFile(r3fTemplatePath, 'utf8')
    await outputFormatted(mainPath, r3fTemplate, 'babel')
    return mainFilename
  }
  if (includeThree) {
    const threeTemplatePath = path.join(__dirname, 'template', 'threejs.js')
    if (!(await fse.pathExists(threeTemplatePath))) {
      throw new Error(`Missing template threejs.js at ${threeTemplatePath}`)
    }
    const threeTemplate = await fse.readFile(threeTemplatePath, 'utf8')
    await outputFormatted(mainPath, threeTemplate, 'babel')
    return mainFilename
  }
  if (!includeShaders) {
    await writeIfMissingFormatted(mainPath, '', 'babel')
  }
  return mainFilename
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
        { title: 'gsap', value: 'gsap' },
        { title: 'three.js', value: 'three' },
        { title: 'r3f', value: 'r3f' },
        { title: 'shaders', value: 'shaders' },
        { title: 'lenis', value: 'lenis' },
      ],
    },
    {
      type: (_, values) => (values.features?.includes('gsap') ? 'multiselect' : null),
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

  const { includeGSAP, includeShaders, includeThree, includeLenis, includeR3F } = getFeatureFlags(
    response.features
  )

  let html = buildBaseHtml('Hoppen')
  let $ = cheerioLoad(html)

  if (includeShaders) {
    await setupShaders(projectDir, $)
  } else {
    await ensureStyleAndReset(projectDir)
  }

  if (!includeThree && !includeShaders && !includeR3F) {
    // add project title heading to prevent blank page
    $('body').append(`\n    <h1>${response.projectName}</h1>`)
  }

  const libsHtml = buildLibrariesHtml({
    includeGSAP,
    gsapPlugins: response.gsapPlugins,
    includeLenis,
    includeR3F,
  })
  if (libsHtml) $('body').append(libsHtml)

  const mainEntryFilename = getMainEntryFilename(includeR3F)
  appendAppEntries($, mainEntryFilename, includeShaders)

  await ensureCodepenPrefill(projectDir, $)

  await writeMainEntryFromTemplates(projectDir, { includeR3F, includeThree, includeShaders })

  $('title').text(response.projectName)
  const htmlOut = $.html()
  await outputFormatted(path.join(projectDir, 'index.html'), htmlOut, 'html')

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

async function ensureBaseDirs() {
  await fse.ensureDir(WORKSPACE_DIR)
}

function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
