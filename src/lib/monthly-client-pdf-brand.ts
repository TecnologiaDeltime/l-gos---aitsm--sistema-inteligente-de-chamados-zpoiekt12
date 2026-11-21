/**
 * Elementos de IDENTIDADE VISUAL da marca no PDF do Relatório Mensal:
 * capa escura (grafite #17181C com acentos âmbar #FCD34D/#D97706) e cards
 * de KPI. Desenho 100% vetorial via primitivas jsPDF — sem rasterização.
 */

export type CoverLine = { text: string; kind: 'header' | 'title' | 'subtitle' | 'sub' | 'footer' }

export interface KpiCardData {
  label: string
  value: string
  sub: string
}

type RGB = [number, number, number]

const DARK: RGB = [23, 24, 28] // #17181C
const AMBER: RGB = [217, 119, 6] // #D97706
const AMBER_LIGHT: RGB = [252, 211, 77] // #FCD34D
const AMBER_PALE: RGB = [254, 243, 226]
const INK: RGB = [31, 33, 38]
const GRAY: RGB = [107, 114, 128]
const WHITE: RGB = [255, 255, 255]
const COVER_MUTED: RGB = [156, 163, 175]

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

/* ------------------------------------------------------------------ */
/* Capa da marca                                                       */
/* ------------------------------------------------------------------ */

export function renderBrandCover(doc: any, lines: CoverLine[], contentW: number) {
  // Fundo grafite integral (sangria até as bordas da página).
  setFill(doc, DARK)
  doc.rect(0, 0, 210, 297, 'F')

  // Faixa de acento âmbar no topo e filete na base.
  setFill(doc, AMBER)
  doc.rect(0, 0, 210, 2.4, 'F')
  setFill(doc, AMBER_LIGHT)
  doc.rect(0, 297 - 1.6, 210, 1.6, 'F')

  const by = (k: CoverLine['kind']) => lines.filter((l) => l.kind === k)

  // Cabeçalho institucional (topo)
  let y = 52
  by('header').forEach((line) => {
    font(doc, 'bold', 10)
    setTextColor(doc, AMBER_LIGHT)
    doc
      .splitTextToSize(line.text.toUpperCase(), contentW)
      .forEach((t: string, i: number) => doc.text(t, 105, y + i * 5.5, { align: 'center' }))
    y += 5.5 * Math.max(1, doc.splitTextToSize(line.text, contentW).length) + 2
  })
  setStroke(doc, AMBER)
  doc.setLineWidth(0.8)
  doc.line(70, y + 2, 140, y + 2)

  // Título central
  let ty = 128
  by('title').forEach((line) => {
    font(doc, 'bold', 21)
    setTextColor(doc, WHITE)
    doc
      .splitTextToSize(line.text, contentW)
      .forEach((t: string, i: number) => doc.text(t, 105, ty + i * 10, { align: 'center' }))
    ty += 10 * Math.max(1, doc.splitTextToSize(line.text, contentW).length) + 4
  })

  // Cliente e período
  let sy = ty + 6
  by('subtitle').forEach((line) => {
    font(doc, 'bold', 13)
    setTextColor(doc, AMBER_LIGHT)
    doc
      .splitTextToSize(line.text, contentW)
      .forEach((t: string, i: number) => doc.text(t, 105, sy + i * 6.5, { align: 'center' }))
    sy += 6.5 * Math.max(1, doc.splitTextToSize(line.text, contentW).length) + 4
  })
  by('sub').forEach((line) => {
    font(doc, 'normal', 10.5)
    setTextColor(doc, COVER_MUTED)
    doc
      .splitTextToSize(line.text, contentW)
      .forEach((t: string, i: number) => doc.text(t, 105, sy + i * 5.5, { align: 'center' }))
    sy += 5.5 * Math.max(1, doc.splitTextToSize(line.text, contentW).length) + 2.5
  })

  // Rodapé ancorado (cidade/UF)
  let fy = 297 - 22
  by('footer')
    .slice()
    .reverse()
    .forEach((line) => {
      font(doc, 'normal', 10)
      setTextColor(doc, COVER_MUTED)
      doc.text(line.text, 105, fy, { align: 'center' })
      fy -= 6
    })
}

/* ------------------------------------------------------------------ */
/* Cards de KPI                                                        */
/* ------------------------------------------------------------------ */

export const KPI_ROW_HEADING = 'INDICADORES-CHAVE DO PERÍODO (VS. MÊS ANTERIOR)'
export const KPI_ROW_HEIGHT = 27 // mm por card (linha única de cards)
export const KPI_ROW_TOTAL = 12 + KPI_ROW_HEIGHT // cabeçalho + cards

/** Desenha a linha de cards de KPI a partir de (x, yTop). Retorna o novo y. */
export function renderKpiCards(
  doc: any,
  cards: KpiCardData[],
  x: number,
  yTop: number,
  width: number,
): number {
  // Cabeçalho da faixa
  font(doc, 'bold', 8.5)
  setTextColor(doc, AMBER)
  doc.text(KPI_ROW_HEADING, x, yTop + 1)
  setStroke(doc, AMBER_LIGHT)
  doc.setLineWidth(0.5)
  doc.line(x, yTop + 3, x + width, yTop + 3)

  const cy = yTop + 7.5
  const gap = 2.6
  const n = Math.max(1, cards.length)
  const cardW = (width - gap * (n - 1)) / n

  cards.forEach((card, i) => {
    const cx = x + i * (cardW + gap)
    // Card com fundo âmbar-claro suave e borda arredondada âmbar
    setFill(doc, AMBER_PALE)
    setStroke(doc, AMBER_LIGHT)
    doc.setLineWidth(0.35)
    doc.roundedRect(cx, cy, cardW, KPI_ROW_HEIGHT, 1.8, 1.8, 'FD')
    // Barra de destaque à esquerda
    setFill(doc, AMBER)
    doc.roundedRect(cx + 2.2, cy + 2.6, 1.1, KPI_ROW_HEIGHT - 5.2, 0.5, 0.5, 'F')

    const textW = cardW - 7

    // Rótulo — no máx. 2 linhas, faixa própria no topo do card.
    font(doc, 'bold', 5.6)
    setTextColor(doc, AMBER)
    const labelLines = doc.splitTextToSize(card.label, textW).slice(0, 2) as string[]
    labelLines.forEach((t, li) => doc.text(t, cx + 5, cy + 5.2 + li * 2.6))

    // Número grande — SHRINK-TO-FIT: reduz a fonte até caber em UMA linha
    // (nunca quebra nem invade a faixa do subtítulo).
    let valueSize = 14
    font(doc, 'bold', valueSize)
    while (valueSize > 8 && doc.getTextWidth(card.value) > textW) {
      valueSize -= 0.5
      font(doc, 'bold', valueSize)
    }
    setTextColor(doc, DARK)
    const valueY = cy + 15
    doc.text(card.value, cx + 5, valueY)

    // Subtítulo — faixa PRÓPRIA logo abaixo do número (fluxo vertical,
    // sem ancoragem ao fundo que colidia com valores altos/longos).
    font(doc, 'normal', 5.4)
    setTextColor(doc, GRAY)
    const subY = valueY + 3.6
    doc
      .splitTextToSize(card.sub, textW)
      .slice(0, 2)
      .forEach((t: string, si: number) => doc.text(t, cx + 5, subY + si * 2.4))
  })
  return cy + KPI_ROW_HEIGHT
}
