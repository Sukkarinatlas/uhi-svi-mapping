import * as Cesium from 'cesium'

export class Measure {
  constructor(viewer) {
    this.viewer = viewer
    this.active = false
    this.points = []
    this.entities = []     // point dots (persist)
    this.dynamic = []      // polyline + labels (rebuilt each click)
    this.handler = null
    this.onStateChange = null
  }

  start() {
    if (this.active) return
    this.active = true
    this.points = []
    document.getElementById('measureHint')?.classList.remove('hidden')
    this.viewer.canvas.style.cursor = 'crosshair'
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas)

    this.handler.setInputAction((click) => {
      const cart = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
      if (!cart) return
      this.points.push(cart)
      this._addDot(cart)
      if (this.points.length > 1) this._redraw()
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.handler.setInputAction(() => this.stop(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    this.onStateChange?.(true)
  }

  stop() {
    if (!this.active) return
    this.active = false
    document.getElementById('measureHint')?.classList.add('hidden')
    this.viewer.canvas.style.cursor = 'default'
    if (this.handler) { this.handler.destroy(); this.handler = null }
    this.onStateChange?.(false)
  }

  clear() {
    this.stop()
    this.entities.forEach((e) => this.viewer.entities.remove(e))
    this.dynamic.forEach((e) => this.viewer.entities.remove(e))
    this.entities = []
    this.dynamic = []
    this.points = []
    this.viewer.scene.requestRender()
  }

  _addDot(cart) {
    const e = this.viewer.entities.add({
      position: cart,
      point: { pixelSize: 9, color: Cesium.Color.fromCssColorString('#328fff'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    })
    this.entities.push(e)
  }

  _redraw() {
    // rebuild polyline + label each click (don't stack)
    this.dynamic.forEach((e) => this.viewer.entities.remove(e))
    this.dynamic = []
    const line = this.viewer.entities.add({
      polyline: { positions: this.points.slice(), width: 3, material: Cesium.Color.fromCssColorString('#ff8f6b'), clampToGround: true },
    })
    this.dynamic.push(line)
    // cumulative distance label at last point
    let total = 0
    for (let i = 1; i < this.points.length; i++) {
      const a = Cesium.Cartographic.fromCartesian(this.points[i - 1])
      const b = Cesium.Cartographic.fromCartesian(this.points[i])
      total += new Cesium.EllipsoidGeodesic(a, b).surfaceDistance
    }
    const txt = total >= 1000 ? (total / 1000).toFixed(2) + ' กม.' : total.toFixed(0) + ' ม.'
    const lbl = this.viewer.entities.add({
      position: this.points[this.points.length - 1],
      label: {
        text: txt, font: '600 13px Noto Sans Thai', fillColor: Cesium.Color.WHITE,
        showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#0f172a'),
        backgroundPadding: new Cesium.Cartesian2(8, 5), pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY, style: Cesium.LabelStyle.FILL,
      },
    })
    this.dynamic.push(lbl)
  }
}
