import '../style.css'
import * as Cesium from 'cesium'
import { BASEMAPS, RASTER_LAYERS, PALETTES, DENS_BREAKS, UHI_LABELS_TH, CHONBURI_VIEW } from './config.js'
import { renderOverview, renderTambon, resizeCharts } from './charts.js'
import { Measure } from './measure.js'
import { buildLegend } from './legend.js'

Cesium.Ion.defaultAccessToken = undefined // no ion assets used

function fatal(msg) {
  const l = document.getElementById('loading')
  if (l) { l.style.display = 'grid'; l.innerHTML = `<div class="text-center text-red-300 p-6 max-w-lg"><div class="text-lg font-semibold mb-2">เกิดข้อผิดพลาด</div><pre class="text-xs text-slate-400 whitespace-pre-wrap text-left">${msg}</pre></div>` }
}
window.addEventListener('error', (e) => fatal((e.error && e.error.stack) || e.message))
window.addEventListener('unhandledrejection', (e) => fatal((e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)))

// ---------------------------------------------------------------- viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayer: false,
  baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
  navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
  infoBox: false, selectionIndicator: false, requestRenderMode: false,
  contextOptions: { webgl: { preserveDrawingBuffer: true } },
})
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1020')
viewer.scene.skyAtmosphere.show = true
viewer.scene.globe.enableLighting = false
viewer.scene.fog.enabled = true

const toWin = Cesium.SceneTransforms.worldToWindowCoordinates || Cesium.SceneTransforms.wgs84ToWindowCoordinates

// resolve a data path against the app base (works on localhost AND GitHub Pages subpath)
const asset = (p) => import.meta.env.BASE_URL + p

// ---------------------------------------------------------------- basemap
let baseLayer = null
function makeBaseProvider(key) {
  const b = BASEMAPS[key]
  return new Cesium.UrlTemplateImageryProvider({
    url: b.url, subdomains: b.sub || undefined,
    credit: b.credit, maximumLevel: 19,
  })
}
function setBasemap(key) {
  const layers = viewer.imageryLayers
  const provider = makeBaseProvider(key)
  const newBase = new Cesium.ImageryLayer(provider)
  layers.add(newBase, 0)
  if (baseLayer) layers.remove(baseLayer, true)
  baseLayer = newBase
}
setBasemap('osm')
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(CHONBURI_VIEW.lon, CHONBURI_VIEW.lat, CHONBURI_VIEW.height),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
})

// ---------------------------------------------------------------- state
const state = { rasters: {}, popDS: null, provDS: null, poiDS: null, stats: null, tambonIndex: [], selectedCarto: null, extrude: false }

// ---------------------------------------------------------------- raster overlays
async function addRaster(cfg, meta) {
  const b = meta.bounds
  const provider = await Cesium.SingleTileImageryProvider.fromUrl(asset(cfg.file), {
    rectangle: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north),
  })
  const layer = new Cesium.ImageryLayer(provider)
  layer.show = cfg.on
  layer.alpha = 0.8
  viewer.imageryLayers.add(layer)
  state.rasters[cfg.id] = { layer, cfg }
}

// ---------------------------------------------------------------- population choropleth
function densColor(d) {
  const i = DENS_BREAKS.findIndex((b, k) => d >= DENS_BREAKS[k] && d < DENS_BREAKS[k + 1])
  return PALETTES.dens[Math.max(0, i)]
}
async function addPopulation() {
  const ds = await Cesium.GeoJsonDataSource.load(asset('data/chonburi_tambons.geojson'), { clampToGround: false })
  viewer.dataSources.add(ds)
  ds.show = true
  state.popDS = ds
  ds.entities.values.forEach((ent) => {
    const p = ent.properties
    const dens = p.density?.getValue() ?? 0
    const col = Cesium.Color.fromCssColorString(densColor(dens)).withAlpha(0.72)
    if (ent.polygon) {
      ent.polygon.material = col
      ent.polygon.outline = true
      ent.polygon.outlineColor = Cesium.Color.fromCssColorString('#0b1020').withAlpha(0.6)
      ent.polygon.height = 0
      ent.polygon.arcType = Cesium.ArcType.GEODESIC
    }
    state.tambonIndex.push({
      name: `${p.tambon_th?.getValue() || ''} · ${(p.amphoe_th?.getValue() || '').replace('อำเภอ', '')}`,
      tambon: p.tambon_th?.getValue() || '', ent,
    })
  })
}
function setPopExtrude(on) {
  state.extrude = on
  if (!state.popDS) return
  state.popDS.entities.values.forEach((ent) => {
    const dens = ent.properties.density?.getValue() ?? 0
    if (ent.polygon) {
      ent.polygon.extrudedHeight = on ? dens * 2.2 : undefined
      ent.polygon.height = 0
    }
  })
  viewer.scene.requestRender()
}
function setPopOpacity(a) {
  if (!state.popDS) return
  state.popDS.entities.values.forEach((ent) => {
    const dens = ent.properties.density?.getValue() ?? 0
    if (ent.polygon) ent.polygon.material = Cesium.Color.fromCssColorString(densColor(dens)).withAlpha(a)
  })
}

// ---------------------------------------------------------------- province boundaries (national)
async function addProvinces() {
  const ds = await Cesium.GeoJsonDataSource.load(asset('data/provinces.geojson'), { clampToGround: false })
  viewer.dataSources.add(ds); ds.show = false; state.provDS = ds
  ds.entities.values.forEach((ent) => {
    if (ent.polygon) {
      ent.polygon.material = Cesium.Color.TRANSPARENT
      ent.polygon.outline = true
      ent.polygon.outlineColor = Cesium.Color.fromCssColorString('#8ee6ff').withAlpha(0.7)
      ent.polygon.height = 0
    }
  })
}

// ---------------------------------------------------------------- POI
async function addPOI() {
  const rows = await (await fetch(asset('data/poi_raw.json'))).json()
  const ds = new Cesium.CustomDataSource('poi')
  rows.forEach((r) => {
    const lon = +r.Longitude, lat = +r.Latitude
    if (!lon || !lat) return
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: { pixelSize: 8, color: Cesium.Color.fromCssColorString('#ffd166'), outlineColor: Cesium.Color.fromCssColorString('#0b1020'), outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: r.NAMT || '', font: '500 11px Noto Sans Thai', fillColor: Cesium.Color.WHITE, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#0f172a').withAlpha(0.85), pixelOffset: new Cesium.Cartesian2(0, -16), scale: 0.9, disableDepthTestDistance: Number.POSITIVE_INFINITY, translucencyByDistance: new Cesium.NearFarScalar(50000, 1, 200000, 0) },
    })
  })
  viewer.dataSources.add(ds); ds.show = false; state.poiDS = ds
}

// ---------------------------------------------------------------- layer list UI
function layerCard({ id, name, on, legendHTML, hasExtrude }) {
  return `
  <div class="rounded-xl bg-white/5 border border-white/10 p-3">
    <label class="flex items-center gap-2.5 cursor-pointer">
      <input type="checkbox" data-layer="${id}" ${on ? 'checked' : ''} class="accent-brand-500 h-4 w-4"/>
      <span class="text-sm font-medium flex-1">${name}</span>
    </label>
    <div class="mt-2 flex items-center gap-2">
      <span class="text-[11px] text-slate-400">ความทึบ</span>
      <input type="range" min="0" max="100" value="${id === 'pop' ? 72 : 80}" data-opacity="${id}" class="flex-1"/>
    </div>
    ${hasExtrude ? `<label class="mt-2 flex items-center gap-2 text-[12px] text-slate-300 cursor-pointer"><input type="checkbox" data-extrude class="accent-brand-500"/> แสดงแบบ 3D (ยกสูงตามความหนาแน่น)</label>` : ''}
    <div class="mt-2">${legendHTML}</div>
  </div>`
}
function buildLayerList() {
  const el = document.getElementById('layerList')
  const cards = []
  RASTER_LAYERS.forEach((r) => cards.push(layerCard({ id: r.id, name: r.name, on: r.on, legendHTML: buildLegend(r) })))
  cards.push(layerCard({ id: 'pop', name: 'ความหนาแน่นประชากรรายตำบล', on: true, hasExtrude: true, legendHTML: buildLegend({ legendKey: 'dens' }) }))
  cards.push(layerCard({ id: 'prov', name: 'ขอบเขตจังหวัด (ทั้งประเทศ)', on: false, legendHTML: '' }))
  cards.push(layerCard({ id: 'poi', name: 'จุดสนใจ (POI)', on: false, legendHTML: '' }))
  el.innerHTML = cards.join('')

  el.querySelectorAll('input[data-layer]').forEach((c) => c.addEventListener('change', (e) => toggleLayer(e.target.dataset.layer, e.target.checked)))
  el.querySelectorAll('input[data-opacity]').forEach((s) => s.addEventListener('input', (e) => setLayerOpacity(e.target.dataset.opacity, +e.target.value / 100)))
  el.querySelector('input[data-extrude]')?.addEventListener('change', (e) => { setPopExtrude(e.target.checked); if (e.target.checked) tiltTo(true) })
}
function toggleLayer(id, on) {
  if (state.rasters[id]) state.rasters[id].layer.show = on
  else if (id === 'pop') state.popDS.show = on
  else if (id === 'prov') state.provDS.show = on
  else if (id === 'poi') state.poiDS.show = on
  viewer.scene.requestRender()
}
function setLayerOpacity(id, a) {
  if (state.rasters[id]) state.rasters[id].layer.alpha = a
  else if (id === 'pop') setPopOpacity(a)
  viewer.scene.requestRender()
}

// ---------------------------------------------------------------- popup + selection
const popup = document.getElementById('popup')
function showPopup(props, carto) {
  state.selectedCarto = carto
  document.getElementById('popupTitle').textContent = props.tambon_th || props.tambon_en || 'พื้นที่'
  const rows = [
    ['อำเภอ', props.amphoe_th || '—'],
    ['ประชากร', (props.total_pop ?? 0).toLocaleString('th-TH') + ' คน'],
    ['ชาย / หญิง', `${(props.male ?? 0).toLocaleString('th-TH')} / ${(props.female ?? 0).toLocaleString('th-TH')}`],
    ['ความหนาแน่น', Math.round(props.density ?? 0).toLocaleString('th-TH') + ' คน/ตร.กม.'],
    ['พื้นที่', (props.area_km2 ?? 0) + ' ตร.กม.'],
    ['LST เฉลี่ย', (props.lst_mean ?? '—') + ' °C'],
  ]
  document.getElementById('popupBody').innerHTML = rows.map(([k, v]) =>
    `<div class="flex justify-between gap-3"><span class="text-slate-400">${k}</span><span class="font-medium text-right">${v}</span></div>`).join('')
  popup.classList.remove('hidden')
  popup.style.opacity = '1'
  updatePopupPosition()
}
function hidePopup() {
  state.selectedCarto = null
  popup.classList.add('hidden')
}
function updatePopupPosition() {
  // never touch display here — visibility is controlled solely by the `hidden` class
  if (popup.classList.contains('hidden') || !state.selectedCarto) return
  const win = toWin(viewer.scene, state.selectedCarto)
  if (!win) { popup.style.opacity = '0'; return }
  popup.style.opacity = '1'
  popup.style.left = win.x + 'px'
  popup.style.top = win.y + 'px'
}
viewer.scene.postRender.addEventListener(updatePopupPosition)
document.getElementById('popupClose').addEventListener('click', hidePopup)

function readProps(ent) {
  const o = {}
  if (!ent.properties) return o
  ent.properties.propertyNames.forEach((n) => { o[n] = ent.properties[n]?.getValue() })
  return o
}
const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)
clickHandler.setInputAction((click) => {
  if (measure.active) return
  const picked = viewer.scene.pick(click.position)
  if (Cesium.defined(picked) && picked.id && picked.id.properties && picked.id.properties.tambon_th) {
    const props = readProps(picked.id)
    const carto = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid)
    showPopup(props, carto)
    openDash(); renderTambon(props, state.stats)
  } else {
    hidePopup()
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK)

// ---------------------------------------------------------------- province select + search
function fillProvinceSelect() {
  const sel = document.getElementById('provinceSelect')
  // data exists only for Chon Buri -> the selector offers Chon Buri only
  const chon = state.provDS.entities.values.find((e) => e.properties.prov_code?.getValue() === '20')
  sel.innerHTML = '<option value="20" selected>จังหวัดชลบุรี</option>'
  sel.addEventListener('change', () => {
    if (sel.value === '20' && chon) {
      viewer.flyTo(chon, { duration: 1.4, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-55), 0) })
    }
  })
}
function setupSearch() {
  const box = document.getElementById('searchBox')
  const res = document.getElementById('searchResults')
  box.addEventListener('input', () => {
    const q = box.value.trim()
    if (!q) { res.classList.add('hidden'); return }
    const hits = state.tambonIndex.filter((t) => t.name.includes(q)).slice(0, 12)
    if (!hits.length) { res.classList.add('hidden'); return }
    res.innerHTML = hits.map((h, i) => `<button data-i="${state.tambonIndex.indexOf(h)}" class="w-full text-left px-3 py-2 hover:bg-white/10 text-sm border-b border-white/5">${h.name}</button>`).join('')
    res.classList.remove('hidden')
    res.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const t = state.tambonIndex[+b.dataset.i]
      res.classList.add('hidden'); box.value = t.tambon
      viewer.flyTo(t.ent, { duration: 1.2 }).then(() => {
        const props = readProps(t.ent)
        const c = t.ent.polygon ? Cesium.BoundingSphere.fromPoints(t.ent.polygon.hierarchy.getValue().positions).center : null
        showPopup(props, c); openDash(); renderTambon(props, state.stats)
      })
    })
  })
  document.addEventListener('click', (e) => { if (!e.target.closest('#searchBox') && !e.target.closest('#searchResults')) res.classList.add('hidden') })
}

// ---------------------------------------------------------------- dashboard
const dash = document.getElementById('dashboard')
function openDash() { dash.classList.remove('translate-x-full'); setTimeout(resizeCharts, 320) }
function closeDash() { dash.classList.add('translate-x-full') }
document.getElementById('dashBtn').onclick = () => { openDash(); document.getElementById('dashTitle').textContent = 'ภาพรวมจังหวัดชลบุรี'; renderOverview(state.stats) }
document.getElementById('closeDash').onclick = closeDash

// ---------------------------------------------------------------- toolbar
function tiltTo(oblique) {
  const c = CHONBURI_VIEW
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(c.lon, c.lat - (oblique ? 0.5 : 0), oblique ? 90000 : c.height),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(oblique ? -45 : -90), roll: 0 }, duration: 1.2,
  })
}
let oblique = false
const tiltBtn = document.getElementById('tiltBtn')
tiltBtn.onclick = () => { oblique = !oblique; tiltBtn.classList.toggle('active', oblique); tiltTo(oblique) }
document.getElementById('homeBtn').onclick = () => { oblique = false; tiltBtn.classList.remove('active'); goHome() }
function goHome() {
  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(CHONBURI_VIEW.lon, CHONBURI_VIEW.lat, CHONBURI_VIEW.height), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }, duration: 1.2 })
}

const measure = new Measure(viewer)
const measureBtn = document.getElementById('measureBtn')
// keep the button state in sync even when the user finishes with a double-click
measure.onStateChange = (active) => measureBtn.classList.toggle('active', active)
measureBtn.onclick = () => {
  if (measure.active) measure.stop()
  else { hidePopup(); measure.start() }
}
document.getElementById('clearBtn').onclick = () => measure.clear()

// ESC = cancel measuring / close popup
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (measure.active) measure.clear()
  hidePopup()
})

document.getElementById('printBtn').onclick = () => {
  viewer.render()
  const img = viewer.canvas.toDataURL('image/png')
  const legends = document.getElementById('layerList').innerHTML
  const w = window.open('', '_blank')
  w.document.write(`<html><head><title>UHI·SVI Map — พิมพ์</title>
    <style>body{font-family:'Noto Sans Thai',sans-serif;margin:0;padding:18px;color:#111}
    h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:0 0 12px;font-size:12px}
    img{width:100%;border:1px solid #ddd;border-radius:8px}</style></head>
    <body><h1>Urban Heat Island &amp; Social Vulnerability — จังหวัดชลบุรี</h1>
    <p>LST: Landsat 8/9 (มี.ค.–พ.ค. 2025) · ประชากร: DOPA ธ.ค. 2568 · พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</p>
    <img src="${img}"/></body></html>`)
  w.document.close(); setTimeout(() => w.print(), 500)
}

// ---------------------------------------------------------------- panels
document.getElementById('collapseLeft').onclick = () => { document.getElementById('leftPanel').classList.add('-translate-x-[110%]'); document.getElementById('showLeft').classList.remove('hidden') }
document.getElementById('showLeft').onclick = () => { document.getElementById('leftPanel').classList.remove('-translate-x-[110%]'); document.getElementById('showLeft').classList.add('hidden') }
document.getElementById('basemapSelect').onchange = (e) => setBasemap(e.target.value)

function showToast(msg) {
  const t = document.createElement('div')
  t.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[70] glass rounded-full px-4 py-2 text-sm'
  t.textContent = msg; document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}
window.addEventListener('resize', resizeCharts)

// ---------------------------------------------------------------- boot
async function boot() {
  const meta = await (await fetch(asset('data/uhi/uhi_meta.json'))).json()
  state.stats = await (await fetch(asset('data/stats.json'))).json()
  for (const r of RASTER_LAYERS) await addRaster(r, meta)
  await addPopulation()
  await addProvinces()
  await addPOI()
  buildLayerList()
  fillProvinceSelect()
  setupSearch()
  goHome()
  renderOverview(state.stats)
  if (new URLSearchParams(location.search).has('dash')) openDash()
  document.getElementById('loading').style.display = 'none'
}
boot().catch((e) => { console.error(e); document.getElementById('loading').innerHTML = `<div class="text-center text-red-300 p-6">โหลดข้อมูลไม่สำเร็จ<br><span class="text-xs text-slate-400">${e.message}</span></div>` })
