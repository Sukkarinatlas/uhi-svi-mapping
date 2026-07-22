// ---- palettes (match the GEE script) ----
export const PALETTES = {
  lst:   ['#040274', '#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'],
  utfvi: ['#313695', '#74add1', '#fee090', '#f46d43', '#a50026'],
  uhi:   ['#1a9850', '#66bd63', '#fee08b', '#fdae61', '#f46d43', '#d73027'],
  dens:  ['#ffffcc', '#fed976', '#fd8d3c', '#f03b20', '#bd0026'],
}
export const UHI_LABELS = ['None', 'Weak', 'Middle', 'Strong', 'Stronger', 'Strongest']
export const UHI_LABELS_TH = ['ไม่มี', 'อ่อน', 'ปานกลาง', 'สูง', 'สูงมาก', 'รุนแรงสุด']

// density choropleth breaks (persons/km²)
export const DENS_BREAKS = [0, 500, 1500, 3000, 6000, Infinity]

// raster overlay layers (georeferenced PNG produced from Landsat).
// paths are relative to the app base (import.meta.env.BASE_URL) — see asset() in main.js
export const RASTER_LAYERS = [
  { id: 'uhi',   name: 'ระดับเกาะความร้อน (UHI Class)', file: 'data/uhi/UHI_Class.png', on: true,  kind: 'class', legendKey: 'uhi' },
  { id: 'utfvi', name: 'ดัชนี UTFVI',                    file: 'data/uhi/UTFVI.png',    on: false, kind: 'grad',  legendKey: 'utfvi', range: [-0.02, 0.03] },
  { id: 'lst',   name: 'อุณหภูมิพื้นผิว LST (°C)',        file: 'data/uhi/LST.png',      on: false, kind: 'grad',  legendKey: 'lst',   range: [25, 45] },
]

// basemaps
export const BASEMAPS = {
  osm:    { name: 'OSM Street',  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', sub: ['a', 'b', 'c'], credit: '© OpenStreetMap' },
  topo:   { name: 'OpenTopoMap', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: ['a', 'b', 'c'], credit: '© OpenTopoMap (CC-BY-SA)' },
  dark:   { name: 'Carto Dark',  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', sub: ['a', 'b', 'c', 'd'], credit: '© CARTO © OSM' },
  sphere: { name: 'Sphere Hybrid', url: 'https://basemap.sphere.gistda.or.th/tiles/sphere_hybrid/EPSG3857/{z}/{x}/{y}.jpeg?key=49A139F836BA43118391567554D8E8BF', sub: null, credit: '© GISTDA Sphere' },
}

export const CHONBURI_VIEW = { lon: 101.13, lat: 13.15, height: 130000 }
