import React, { useRef } from 'https://esm.sh/react@18.3.1'
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client'
import {
  Canvas,
  useFrame,
} from 'https://esm.sh/@react-three/fiber@8.17.10?deps=react@18.3.1,react-dom@18.3.1,three@latest'

function SpinningBox() {
  const meshRef = useRef(null)
  useFrame(state => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    meshRef.current.rotation.x = t * 0.5
    meshRef.current.rotation.y = t
  })
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshNormalMaterial />
    </mesh>
  )
}

function App() {
  return (
    <Canvas camera={{ fov: 70, position: [0, 0, 1] }} style={{ width: '100vw', height: '100vh' }}>
      <SpinningBox />
    </Canvas>
  )
}

const root = createRoot(
  document.getElementById('root') ??
    (() => {
      const el = document.createElement('div')
      el.id = 'root'
      document.body.appendChild(el)
      return el
    })()
)

root.render(<App />)
