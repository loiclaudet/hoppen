import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 2187,
    open: true,
  },
  appType: 'mpa',
})
