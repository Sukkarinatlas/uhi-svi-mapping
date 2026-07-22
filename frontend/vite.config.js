import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import { resolve } from 'path'

// Project pages are served from https://<user>.github.io/<repo>/ , so the
// production base must be the repo name. Dev keeps '/' for a clean localhost.
const REPO = 'uhi-svi-mapping'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [cesium()],
  server: { host: true, port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        map: resolve(__dirname, 'map.html'),
      },
    },
  },
}))
