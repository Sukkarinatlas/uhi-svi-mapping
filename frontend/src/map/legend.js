import { PALETTES, UHI_LABELS_TH, DENS_BREAKS } from './config.js'

function gradientBar(colors) {
  return `background:linear-gradient(90deg,${colors.join(',')})`
}

export function buildLegend(layer) {
  const key = layer.legendKey
  if (key === 'lst') {
    return `<div class="legend-bar" style="${gradientBar(PALETTES.lst)}"></div>
      <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>25°C</span><span>35°C</span><span>≥45°C</span></div>`
  }
  if (key === 'utfvi') {
    return `<div class="legend-bar" style="${gradientBar(PALETTES.utfvi)}"></div>
      <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>เย็น</span><span>0</span><span>ร้อนจัด</span></div>`
  }
  if (key === 'uhi') {
    return `<div class="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">${UHI_LABELS_TH.map((n, i) =>
      `<div class="flex items-center gap-1.5 text-[11px]"><span class="h-3 w-3 rounded" style="background:${PALETTES.uhi[i]}"></span>${n}</div>`).join('')}</div>`
  }
  if (key === 'dens') {
    const labels = ['<500', '500–1.5k', '1.5k–3k', '3k–6k', '≥6k']
    return `<div class="grid grid-cols-1 gap-1 mt-1">${labels.map((l, i) =>
      `<div class="flex items-center gap-1.5 text-[11px]"><span class="h-3 w-3 rounded" style="background:${PALETTES.dens[i]}"></span>${l} คน/ตร.กม.</div>`).join('')}</div>`
  }
  return ''
}
