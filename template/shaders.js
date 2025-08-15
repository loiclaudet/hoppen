;(function () {
  'use strict'

  const canvas = document.getElementById('shader-canvas')
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

  if (!gl) {
    alert('WebGL is not supported by your browser.')
    throw new Error('WebGL not supported')
  }

  const vertexShaderSource = document.getElementById('vertex-shader')?.innerHTML || ''
  const fragmentShaderSource = document.getElementById('fragment-shader')?.innerHTML || ''

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

  const vertexShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
  const fragmentShader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)

  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program))
    throw new Error('Program linking failed')
  }

  gl.useProgram(program)

  const timeLocation = gl.getUniformLocation(program, 'u_time')
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  const vertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  function resizeCanvas() {
    const devicePixelRatio = Math.min(window.devicePixelRatio, 2)
    canvas.width = window.innerWidth * devicePixelRatio
    canvas.height = window.innerHeight * devicePixelRatio

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
  }

  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()

  function render() {
    const time = performance.now() * 0.001
    gl.uniform1f(timeLocation, time)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    requestAnimationFrame(render)
  }

  render()
})()
