/**
 * Gráficos VETORIAIS do Relatório Mensal do Cliente (PDF).
 *
 * Desenhados exclusivamente com primitivas do jsPDF (retângulos, linhas,
 * polígonos via doc.lines e círculos) — NENHUMA rasterização (sem
 * html2canvas/canvas/imagem), o que torna o PDF imune aos bugs históricos
 * de captura (rótulos piscando, achatamento, corte de imagem).
 *
 * Paleta da marca (temas oficiais): âmbar #D97706, âmbar claro #FCD34D e
 * grafite #17181C. Nenhuma cor azul.
 *
 * Cada especificação vem de buildMonthlyChartSpecs (monthly-client-rich-doc),
 * garantindo os mesmos números da tela, do PDF textual e do DOCX.
 */

import type { MonthlyChartSpec } from '@/lib/monthly-client-rich-doc'

type RGB = [number, number, number]

const AMBER: RGB = [217, 119, 6]
const AMBER_DEEP: RGB = [180, 83, 9]
const AMBER_PALE: RGB = [254, 240, 214]
const AMBER_LIGHT: RGB = [252, 211, 77]
const DARK: RGB = [23, 24, 28]
const SLATE: RGB = [55, 65, 81]
const GRAY: RGB = [107, 114, 128]
const GRID: RGB = [229, 231, 235]
const TRACK: RGB = [243, 244, 246]

const PALETTE: RGB[] = [
  AMBER,
  DARK,
  AMBER_DEEP,
  [120, 53, 15],
  [146, 64, 14],
  SLATE,
  AMBER_LIGHT,
  [31, 41, 55],
]

const nf = (v: number, d = 1): string => (isFinite(v) ? v.toFixed(d).replace('.', ',') : '0')
const fmtHours = (v: number): string => `${nf(v)} h`
const fmtInt = (v: number): string => String(Math.round(v))

/** Altura total (mm) do bloco do gráfico: legenda + plot + rótulos + fonte. */
export function chartHeight(spec: MonthlyChartSpec): number {
  switch (spec.kind) {
    case 'bars':
      return 86
    case 'hbars':
      return 9 + spec.items.length * 7.5 + 12
    case 'donut':
      return 72
    case 'area':
      return 84
  }
}

function setFill(doc: any, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2])
}

function setStroke(doc: any, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2])
}

function setTextColor(doc: any, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2])
}

function font(doc: any, style: 'normal' | 'bold' | 'italic', size: number) {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
}

/** Reduz o texto até caber na largura (mm) com a fonte corrente. */
function fitText(doc: any, text: string, maxW: number): string {
  let t = text || ''
  if (doc.getTextWidth(t) <= maxW) return t
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
  return t + '…'
}

function caption(doc: any, spec: MonthlyChartSpec, x: number, y: number) {
  font(doc, 'bold', 8.5)
  setTextColor(doc, DARK)
  doc.text(spec.caption, x, y)
}

function source(doc: any, spec: MonthlyChartSpec, x: number, y: number) {
  font(doc, 'italic', 7)
  setTextColor(doc, GRAY)
  doc.text(spec.source, x, y)
}

function legendEntry(doc: any, x: number, y: number, color: RGB, label: string): number {
  setFill(doc, color)
  doc.rect(x, y - 2.2, 2.6, 2.6, 'F')
  font(doc, 'normal', 7.5)
  setTextColor(doc, DARK)
  doc.text(label, x + 3.8, y)
  return x + 3.8 + doc.getTextWidth(label) + 7
}

function drawWedge(
  doc: any,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  color: RGB,
) {
  if (a1 - a0 >= Math.PI * 2 - 0.001) {
    setFill(doc, color)
    doc.circle(cx, cy, r, 'F')
    return
  }
  const steps = Math.max(2, Math.ceil(((a1 - a0) / Math.PI) * 12))
  const pts: [number, number][] = [[cx, cy]]
  for (let s = 0; s <= steps; s++) {
    const a = a0 + (a1 - a0) * (s / steps)
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  const deltas: [number, number][] = []
  for (let i = 1; i < pts.length; i++) {
    deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])
  }
  setFill(doc, color)
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true)
}

function fillPolygon(doc: any, pts: [number, number][], color: RGB) {
  const deltas: [number, number][] = []
  for (let i = 1; i < pts.length; i++) {
    deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])
  }
  setFill(doc, color)
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true)
}

function drawPolyline(doc: any, pts: [number, number][], color: RGB, width: number) {
  setStroke(doc, color)
  doc.setLineWidth(width)
  for (let i = 1; i < pts.length; i++) {
    doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
  }
}

/** Desenha o gráfico a partir de (x, yTop) com a largura dada. Retorna o novo y. */
export function drawMonthlyChart(
  doc: any,
  spec: MonthlyChartSpec,
  x: number,
  yTop: number,
  width: number,
): number {
  caption(doc, spec, x, yTop + 1)

  if (spec.kind === 'bars') {
    const capH = 7
    const plotH = 52
    const labelH = 8
    const srcH = 5
    const plotX = x + 14
    const plotW = width - 16
    const baseY = yTop + capH + plotH
    const maxV = Math.max(1, ...spec.categories.flatMap((c) => [c.a, c.b])) * 1.15

    for (let k = 0; k <= 4; k++) {
      const gy = baseY - (plotH * k) / 4
      setStroke(doc, GRID)
      doc.setLineWidth(0.15)
      doc.line(plotX, gy, plotX + plotW, gy)
      font(doc, 'normal', 6.5)
      setTextColor(doc, GRAY)
      doc.text(fmtHours((maxV * k) / 4), plotX - 1.5, gy + 1, { align: 'right' })
    }

    // Legenda (duas séries)
    let lx = plotX
    lx = legendEntry(doc, lx, yTop + capH + 4.5, SLATE, spec.seriesA)
    legendEntry(doc, lx, yTop + capH + 4.5, AMBER, spec.seriesB)

    const n = spec.categories.length
    const gw = plotW / Math.max(1, n)
    const barW = Math.min(9, gw * 0.3)
    spec.categories.forEach((cat, i) => {
      const cx0 = plotX + i * gw + (gw - 2 * barW - 2) / 2
      const hA = (cat.a / maxV) * plotH
      const hB = (cat.b / maxV) * plotH
      setFill(doc, SLATE)
      doc.rect(cx0, baseY - hA, barW, hA, 'F')
      setFill(doc, AMBER)
      doc.rect(cx0 + barW + 2, baseY - hB, barW, hB, 'F')
      font(doc, 'bold', 6)
      setTextColor(doc, DARK)
      if (cat.a > 0) doc.text(fmtHours(cat.a), cx0 + barW / 2, baseY - hA - 1, { align: 'center' })
      if (cat.b > 0)
        doc.text(fmtHours(cat.b), cx0 + barW * 1.5 + 2, baseY - hB - 1, { align: 'center' })
      font(doc, 'normal', 6.5)
      setTextColor(doc, DARK)
      doc.text(fitText(doc, cat.label, gw), plotX + i * gw + gw / 2, baseY + 4.5, {
        align: 'center',
      })
    })

    setStroke(doc, SLATE)
    doc.setLineWidth(0.3)
    doc.line(plotX, baseY, plotX + plotW, baseY)

    source(doc, spec, x, baseY + labelH + 2)
    return baseY + labelH + srcH
  }

  if (spec.kind === 'hbars') {
    const capH = 7
    const rowH = 7.5
    const srcH = 5
    const labelW = Math.min(48, width * 0.32)
    const trackX = x + labelW + 3
    const trackW = width - labelW - 18
    const maxV = Math.max(1, ...spec.items.map((i) => i.value))

    spec.items.forEach((item, i) => {
      const y = yTop + capH + i * rowH + 3
      font(doc, 'normal', 7)
      setTextColor(doc, DARK)
      doc.text(fitText(doc, item.label, labelW), x, y)
      setFill(doc, TRACK)
      doc.rect(trackX, y - 3.1, trackW, 4.6, 'F')
      const bw = Math.max(0, (item.value / maxV) * trackW)
      if (bw > 0) {
        setFill(doc, PALETTE[i % PALETTE.length])
        doc.rect(trackX, y - 3.1, bw, 4.6, 'F')
      }
      font(doc, 'bold', 6.5)
      setTextColor(doc, DARK)
      doc.text(fmtHours(item.value), x + width, y, { align: 'right' })
    })

    const endY = yTop + capH + spec.items.length * rowH + 4
    source(doc, spec, x, endY)
    return endY + srcH
  }

  if (spec.kind === 'donut') {
    const capH = 7
    const srcH = 5
    const cx = x + 30
    const cy = yTop + capH + 26
    const r = 21
    const total = spec.items.reduce((a, b) => a + b.value, 0) || 1

    let angle = -Math.PI / 2
    spec.items.forEach((item, i) => {
      const share = item.value / total
      const next = angle + share * Math.PI * 2
      drawWedge(doc, cx, cy, r, angle, next, PALETTE[i % PALETTE.length])
      angle = next
    })
    setFill(doc, [255, 255, 255])
    doc.circle(cx, cy, 12.5, 'F')
    font(doc, 'bold', 12)
    setTextColor(doc, DARK)
    doc.text(spec.centerLabel, cx, cy + 0.5, { align: 'center' })
    font(doc, 'normal', 5.5)
    setTextColor(doc, GRAY)
    doc.text(fitText(doc, spec.centerSub, 24), cx, cy + 4.5, { align: 'center' })

    let ly = yTop + capH + 8
    spec.items.forEach((item, i) => {
      setFill(doc, PALETTE[i % PALETTE.length])
      doc.rect(x + 62, ly - 2.2, 2.6, 2.6, 'F')
      font(doc, 'normal', 7.5)
      setTextColor(doc, DARK)
      doc.text(fitText(doc, item.label, 62), x + 66.5, ly)
      font(doc, 'bold', 7)
      setTextColor(doc, GRAY)
      doc.text(`${fmtInt(item.value)} (${nf((item.value / total) * 100)}%)`, x + width, ly, {
        align: 'right',
      })
      ly += 7
    })

    source(doc, spec, x, yTop + capH + 52)
    return yTop + capH + 52 + srcH
  }

  // kind === 'area': evolução de horas (área) e chamados (linha)
  const capH = 7
  const plotH = 50
  const labelH = 8
  const srcH = 5
  const plotX = x + 14
  const plotW = width - 16
  const baseY = yTop + capH + plotH
  const n = spec.points.length
  const maxH = Math.max(1, ...spec.points.map((p) => p.hours)) * 1.15
  const maxT = Math.max(1, ...spec.points.map((p) => p.tickets)) * 1.15

  for (let k = 0; k <= 4; k++) {
    const gy = baseY - (plotH * k) / 4
    setStroke(doc, GRID)
    doc.setLineWidth(0.15)
    doc.line(plotX, gy, plotX + plotW, gy)
    font(doc, 'normal', 6.5)
    setTextColor(doc, GRAY)
    doc.text(fmtHours((maxH * k) / 4), plotX - 1.5, gy + 1, { align: 'right' })
  }

  let lx = plotX
  lx = legendEntry(doc, lx, yTop + capH + 4.5, AMBER, spec.seriesHours)
  legendEntry(doc, lx, yTop + capH + 4.5, DARK, spec.seriesTickets)

  const px = (i: number) => (n > 1 ? plotX + (plotW * i) / (n - 1) : plotX + plotW / 2)
  const hourPts = spec.points.map(
    (p, i) => [px(i), baseY - (p.hours / maxH) * plotH] as [number, number],
  )
  const ticketPts = spec.points.map(
    (p, i) => [px(i), baseY - (p.tickets / maxT) * plotH] as [number, number],
  )

  const areaPts: [number, number][] = [
    [hourPts[0][0], baseY],
    ...hourPts,
    [hourPts[n - 1][0], baseY],
  ]
  fillPolygon(doc, areaPts, AMBER_PALE)
  drawPolyline(doc, hourPts, AMBER, 0.7)
  drawPolyline(doc, ticketPts, DARK, 0.6)
  ticketPts.forEach(([tx, ty]) => {
    setFill(doc, DARK)
    doc.circle(tx, ty, 0.8, 'F')
  })

  font(doc, 'normal', 6.5)
  setTextColor(doc, DARK)
  spec.points.forEach((p, i) => {
    doc.text(p.label, px(i), baseY + 4.5, { align: 'center' })
  })

  setStroke(doc, SLATE)
  doc.setLineWidth(0.3)
  doc.line(plotX, baseY, plotX + plotW, baseY)

  source(doc, spec, x, baseY + labelH + 2)
  return baseY + labelH + srcH
}
