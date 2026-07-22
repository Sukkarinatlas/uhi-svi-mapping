import * as echarts from 'echarts'
import { PALETTES, UHI_LABELS_TH } from './config.js'

const AX = '#94a3b8'
const base = {
  textStyle: { fontFamily: 'Noto Sans Thai, Inter, sans-serif', color: '#cbd5e1' },
  grid: { left: 8, right: 12, top: 28, bottom: 6, containLabel: true },
  tooltip: { backgroundColor: 'rgba(15,23,42,.95)', borderColor: 'rgba(148,163,184,.2)', textStyle: { color: '#e2e8f0' } },
}
const instances = []
function make(el, opt) {
  const c = echarts.init(el, null, { renderer: 'canvas' })
  c.setOption(opt); instances.push(c); return c
}
export function resizeCharts() { instances.forEach((c) => c.resize()) }
function clearCharts() { instances.forEach((c) => c.dispose()); instances.length = 0 }

const fmt = (n) => Number(n).toLocaleString('th-TH')

function kpiTiles(s) {
  const tiles = [
    ['ประชากรรวม', fmt(s.pop_total), 'คน', '👥'],
    ['ความหนาแน่น', fmt(s.density), 'คน/ตร.กม.', '🏙️'],
    ['พื้นที่', fmt(s.area_km2), 'ตร.กม.', '📐'],
    ['LST เฉลี่ย', s.lst_mean.toFixed(1), '°C', '🌡️'],
  ]
  return `<div class="grid grid-cols-2 gap-3">${tiles.map(([l, v, u, i]) => `
    <div class="card !p-3">
      <div class="flex items-center justify-between"><span class="kpi-label">${l}</span><span>${i}</span></div>
      <div class="kpi-value mt-1">${v}</div><div class="text-[11px] text-slate-400">${u}</div>
    </div>`).join('')}</div>`
}

export function renderOverview(stats) {
  clearCharts()
  const s = stats.province
  const body = document.getElementById('dashBody')
  body.innerHTML = `
    ${kpiTiles(s)}
    <div class="card"><div class="text-sm font-semibold mb-1">การกระจายระดับเกาะความร้อน (UHI Class)</div><div id="c_uhi" style="height:200px"></div></div>
    <div class="card"><div class="text-sm font-semibold mb-1">ประชากรรายอำเภอ</div><div id="c_amp" style="height:240px"></div></div>
    <div class="card"><div class="text-sm font-semibold mb-1">ความหนาแน่น ปะทะ อุณหภูมิ (รายอำเภอ)</div><div id="c_sc" style="height:240px"></div></div>
    <div class="card"><div class="text-sm font-semibold mb-1">10 ตำบลหนาแน่นสุด (คน/ตร.กม.)</div><div id="c_den" style="height:260px"></div></div>
    <div class="card"><div class="text-sm font-semibold mb-1">10 ตำบลร้อนสุด (LST °C)</div><div id="c_hot" style="height:260px"></div></div>
    <p class="text-[11px] text-slate-500 px-1">* ${stats.age_note}</p>`

  // UHI class donut
  const cc = stats.uhi_class_counts
  make(document.getElementById('c_uhi'), {
    ...base, tooltip: { ...base.tooltip, trigger: 'item', formatter: '{b}: {c} px ({d}%)' },
    legend: { show: false },
    series: [{
      type: 'pie', radius: ['45%', '75%'], center: ['50%', '52%'],
      label: { color: '#cbd5e1', fontSize: 11 },
      data: UHI_LABELS_TH.map((n, i) => ({ name: n, value: cc[i] || 0, itemStyle: { color: PALETTES.uhi[i] } })),
    }],
  })

  // pop by amphoe (bar)
  const amp = stats.by_amphoe
  make(document.getElementById('c_amp'), {
    ...base, tooltip: { ...base.tooltip, trigger: 'axis', valueFormatter: fmt },
    xAxis: { type: 'value', axisLabel: { color: AX, formatter: (v) => (v / 1000) + 'k' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } },
    yAxis: { type: 'category', inverse: true, data: amp.map((a) => a.amphoe_th.replace('อำเภอ', '')), axisLabel: { color: AX, fontSize: 10 } },
    series: [{ type: 'bar', data: amp.map((a) => a.pop), itemStyle: { color: '#328fff', borderRadius: [0, 4, 4, 0] }, barWidth: '62%' }],
  })

  // scatter density vs lst
  make(document.getElementById('c_sc'), {
    ...base, tooltip: { ...base.tooltip, formatter: (p) => `${p.data[2]}<br>ความหนาแน่น ${fmt(p.data[0])}<br>LST ${p.data[1]}°C` },
    xAxis: { name: 'คน/ตร.กม.', nameTextStyle: { color: AX }, type: 'value', axisLabel: { color: AX }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } },
    yAxis: { name: '°C', nameTextStyle: { color: AX }, type: 'value', scale: true, axisLabel: { color: AX }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } },
    series: [{
      type: 'scatter', symbolSize: 12,
      data: amp.map((a) => [Math.round(a.density), a.lst, a.amphoe_th.replace('อำเภอ', '')]),
      itemStyle: { color: '#ff8f6b', opacity: 0.85, borderColor: '#fff', borderWidth: 0.5 },
    }],
  })

  const hbar = (el, rows, key, color, unit) => make(el, {
    ...base, tooltip: { ...base.tooltip, trigger: 'axis', valueFormatter: (v) => fmt(v) + ' ' + unit },
    xAxis: { type: 'value', axisLabel: { color: AX }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } },
    yAxis: { type: 'category', inverse: true, data: rows.map((r) => r.tambon_th.replace('ตำบล', '')), axisLabel: { color: AX, fontSize: 10 } },
    series: [{ type: 'bar', data: rows.map((r) => r[key]), itemStyle: { color, borderRadius: [0, 4, 4, 0] }, barWidth: '60%' }],
  })
  hbar(document.getElementById('c_den'), stats.top_density, 'density', '#f03b20', 'คน/ตร.กม.')
  hbar(document.getElementById('c_hot'), stats.top_hot, 'lst_mean', '#d7191c', '°C')
}

export function renderTambon(p, stats) {
  clearCharts()
  const s = stats.province
  const body = document.getElementById('dashBody')
  const densRank = [...stats.by_amphoe]
  body.innerHTML = `
    <div class="card">
      <div class="text-xs text-slate-400">${p.amphoe_th || ''}</div>
      <div class="text-xl font-bold">${p.tambon_th || p.tambon_en || 'ตำบล'}</div>
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div><div class="kpi-label">ประชากร</div><div class="kpi-value">${fmt(p.total_pop)}</div></div>
        <div><div class="kpi-label">ความหนาแน่น</div><div class="kpi-value">${fmt(Math.round(p.density))}</div><div class="text-[11px] text-slate-400">คน/ตร.กม.</div></div>
        <div><div class="kpi-label">พื้นที่</div><div class="kpi-value">${p.area_km2}</div><div class="text-[11px] text-slate-400">ตร.กม.</div></div>
        <div><div class="kpi-label">LST เฉลี่ย</div><div class="kpi-value">${p.lst_mean ?? '—'}</div><div class="text-[11px] text-slate-400">°C</div></div>
      </div>
    </div>
    <div class="card"><div class="text-sm font-semibold mb-1">โครงสร้างเพศ</div><div id="c_sex" style="height:180px"></div></div>
    <div class="card"><div class="text-sm font-semibold mb-1">เทียบกับค่าเฉลี่ยจังหวัด</div><div id="c_cmp" style="height:200px"></div></div>
    <button id="backOverview" class="btn-ghost w-full border border-white/10">← กลับภาพรวมจังหวัด</button>`

  make(document.getElementById('c_sex'), {
    ...base, tooltip: { ...base.tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{ type: 'pie', radius: ['40%', '72%'], label: { color: '#cbd5e1' },
      data: [{ name: 'ชาย', value: p.male, itemStyle: { color: '#3b82f6' } }, { name: 'หญิง', value: p.female, itemStyle: { color: '#ec4899' } }] }],
  })
  const provDensAvg = s.density, provLst = s.lst_mean
  make(document.getElementById('c_cmp'), {
    ...base, tooltip: { ...base.tooltip, trigger: 'axis' },
    legend: { textStyle: { color: AX }, top: 0 },
    xAxis: { type: 'category', data: ['ความหนาแน่น', 'LST'], axisLabel: { color: AX } },
    yAxis: [{ type: 'value', axisLabel: { color: AX }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } }],
    series: [
      { name: 'ตำบลนี้', type: 'bar', data: [Math.round(p.density), p.lst_mean], itemStyle: { color: '#ff8f6b', borderRadius: [4, 4, 0, 0] } },
      { name: 'เฉลี่ยจังหวัด', type: 'bar', data: [Math.round(provDensAvg), provLst], itemStyle: { color: '#475569', borderRadius: [4, 4, 0, 0] } },
    ],
  })
  document.getElementById('backOverview').onclick = () => renderOverview(stats)
}
