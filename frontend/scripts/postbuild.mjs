// Fix for vite-plugin-cesium: with a non-root `base` it copies Cesium's static
// assets to `dist/<base>/cesium` but the injected <script>/<link> tags point to
// `<base>/cesium` (i.e. dist/cesium). Move the assets up so the paths resolve.
import { existsSync, renameSync, rmSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const dist = resolve('dist')
const target = join(dist, 'cesium')

if (existsSync(target)) {
  console.log('[postbuild] dist/cesium already correct')
} else if (existsSync(dist)) {
  let moved = false
  for (const name of readdirSync(dist)) {
    const p = join(dist, name)
    if (name !== 'cesium' && statSync(p).isDirectory() && existsSync(join(p, 'cesium'))) {
      renameSync(join(p, 'cesium'), target)
      rmSync(p, { recursive: true, force: true })
      console.log(`[postbuild] moved ${name}/cesium -> dist/cesium`)
      moved = true
      break
    }
  }
  if (!moved) console.warn('[postbuild] WARNING: no cesium assets found to relocate')
}
