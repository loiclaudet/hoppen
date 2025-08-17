// Register GLSL as dependencies for HMR tracking
import '../vertex.glsl?raw'
import '../fragment.glsl?raw'

const canvas = document.getElementById('shader-canvas')
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
if (!gl) {
  alert('WebGL is not supported by your browser.')
  throw new Error('WebGL not supported')
}

let rafId
let program
let timeLocation
let resolutionLocation
let mouseLocation

let disposePromise = init()

if (import.meta.hot) {
  import.meta.hot.accept(async () => {
    const dispose = await disposePromise
    dispose && dispose()
    disposePromise = init()
  })
}

function createShader(gl, source, type) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' })
  return r.ok ? r.text() : ''
}

function getProjectBasePath() {
  // '/projects/<name>/index.html' => '/projects/<name>'
  const parts = window.location.pathname.split('/')
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  if (parts.length > 0) parts.pop() // remove file name
  const base = parts.join('/') || '/'
  return base
}

async function init() {
  // Load fresh shader sources each time (ensures single-save HMR)
  const base = getProjectBasePath()
  const [vertexShaderSource, fragmentShaderSource] = await Promise.all([
    fetchText(`${base}/vertex.glsl`),
    fetchText(`${base}/fragment.glsl`),
  ])
  const vs = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
  const fs = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)
  program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program))
    throw new Error('Program linking failed')
  }
  gl.useProgram(program)
  timeLocation = gl.getUniformLocation(program, 'u_time')
  resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
  mouseLocation = gl.getUniformLocation(program, 'u_mouse')
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  let mouseX = 0
  let mouseY = 0
  const devicePixelRatio = Math.min(window.devicePixelRatio, 2)
  const wH = window.innerHeight

  resize()
  render()

  window.addEventListener('resize', resize)

  window.addEventListener('mousemove', event => {
    mouseX = event.clientX * devicePixelRatio
    mouseY = (wH - event.clientY) * devicePixelRatio // flip Y coordinate for WebGL
  })

  return () => {
    if (rafId) cancelAnimationFrame(rafId)
  }

  function render() {
    const t = performance.now() * 0.001
    gl.uniform1f(timeLocation, t)
    gl.uniform2f(mouseLocation, mouseX, mouseY)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    rafId = requestAnimationFrame(render)
  }

  function resize() {
    canvas.width = Math.floor(window.innerWidth * devicePixelRatio)
    canvas.height = Math.floor(window.innerHeight * devicePixelRatio)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
  }
}
