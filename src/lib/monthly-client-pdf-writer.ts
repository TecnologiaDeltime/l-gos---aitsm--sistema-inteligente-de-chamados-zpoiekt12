/**
 * MOTOR DE LAYOUT — PDF RICO do Relatório Mensal do Cliente (LÓGOS AITSM).
 *
 * Conserta o bug reportado ("as escritas invadindo as imagens, ou saindo das
 * imagens, texto sem formatação") com um layout DETERMINÍSTICO:
 *
 *  1. Fonte única de verdade de medidas: cada PageItem carrega `advance` —
 *     o espaço exato (mm) que o item ocupa. O render usa SEMPRE `advance`
 *     para avançar o cursor; quem calcula `advance` é o mesmo layout que
 *     decide o que cabe na página. Nunca mais há divergência layout×render.
 *  2. Gráficos em blocos atômicos exclusivos: cada item de gráfico ocupa uma
 *     faixa própria (título → plot → rótulos → fonte), com `chartHeight`
 *     calculado pelas MESMAS constantes do desenho (drawMonthlyChart).
 *  3. Quebra de linha MEDIDA de verdade (doc.splitTextToSize com a fonte e
 *     a largura exatas em que a linha será desenhada).
 *  4. Justificação correta: o parágrafo é emitido de UMA VEZ com
 *     align:'justify' + maxWidth — jsPDF justifica todas as linhas menos a
 *     última (desenhar linha a linha tornava cada linha a "última" e o
 *     texto saía alinhado à esquerda, sem formatação).
 *  5. Paginação por blocos indivisíveis mantida (v0.0.491): parágrafos
 *     atravessam páginas apenas ENTRE linhas com mínimo de 2 linhas de cada
 *     lado; tabelas apenas ENTRE linhas de dados, repetindo o cabeçalho;
 *     títulos nunca órfãos; páginas vazias descartadas.
 */

import { buildMonthlyClientTextDom } from '@/lib/monthly-client-pdf-text'
import {
  buildMonthlyKpiCards,
  buildMonthlyChartSpecs,
  type MonthlyChartSpec,
} from '@/lib/monthly-client-rich-doc'
import { drawMonthlyChart, chartBlockMetrics } from '@/lib/monthly-client-pdf-charts'
import {
  renderBrandCover,
  renderKpiCards,
  KPI_ROW_TOTAL,
  type CoverLine,
  type KpiCardData,
} from '@/lib/monthly-client-pdf-brand'

const CDN_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'

type Progress = (stage: 'load' | 'compose' | 'download') => void

export interface ExportMonthlyClientTextPdfOptions {
  reportData: unknown
  monthKey: string
  onProgress?: Progress
}

declare global {
  interface Window {
    jspdf?: { jsPDF: any }
  }
}

const AMBER = '#D97706'
const GRAPHITE = '#17181C'

/* ------------------------------------------------------------------ */
/* Blocos extraídos do DOM textual                                     */
/* ------------------------------------------------------------------ */

type Block =
  | { type: 'cover'; lines: CoverLine[] }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'para'; text: string }
  | { type: 'note'; text: string }
  | {
      type: 'table'
      caption: string
      headers: string[]
      rows: string[][]
      source: string
    }

function hasClass(el: Element, cls: string): boolean {
  return el.classList.contains(cls)
}

function directText(wrap: Element, selector: string): string {
  const node = wrap.querySelector(selector)
  return node ? (node.textContent || '').trim() : ''
}

function parseAvoidBreak(wrap: Element): Block | null {
  const caption = directText(wrap, ':scope > p.abnt-caption-top')
  const table = wrap.querySelector(':scope > table.abnt-table')
  const source = directText(wrap, ':scope > p.abnt-source-bottom')
  const h4 = wrap.querySelector(':scope > h4')
  if (h4) return { type: 'h3', text: (h4.textContent || '').trim() }
  if (table) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
      (th.textContent || '').trim(),
    )
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
    )
    return { type: 'table', caption, headers, rows, source }
  }
  if (caption) return { type: 'note', text: caption }
  return null
}

function extractBlocks(container: HTMLElement): Block[] {
  const out: Block[] = []
  const walk = (parent: Element) => {
    Array.from(parent.children).forEach((child) => {
      if (child.tagName === 'STYLE') return
      if (hasClass(child, 'abnt-cover')) {
        const lines: CoverLine[] = []
        Array.from(child.querySelectorAll('p')).forEach((p) => {
          const text = (p.textContent || '').trim()
          if (!text) return
          const kind = hasClass(p, 'abnt-cover-header')
            ? 'header'
            : hasClass(p, 'abnt-cover-title')
              ? 'title'
              : hasClass(p, 'abnt-cover-subtitle')
                ? 'subtitle'
                : hasClass(p, 'abnt-cover-footer')
                  ? 'footer'
                  : 'sub'
          lines.push({ text, kind })
        })
        out.push({ type: 'cover', lines })
        return
      }
      if (hasClass(child, 'abnt-section')) {
        Array.from(child.children).forEach((secChild) => {
          if (hasClass(secChild, 'abnt-section-title') && secChild.tagName === 'H3') {
            out.push({ type: 'h2', text: (secChild.textContent || '').trim() })
            return
          }
          if (hasClass(secChild, 'abnt-paragraph')) {
            const text = (secChild.textContent || '').trim()
            if (text) out.push({ type: 'para', text })
            return
          }
          if (hasClass(secChild, 'abnt-avoid-break')) {
            const block = parseAvoidBreak(secChild)
            if (block) out.push(block)
            return
          }
          walk(secChild)
        })
        return
      }
      if (hasClass(child, 'abnt-avoid-break')) {
        const block = parseAvoidBreak(child)
        if (block) out.push(block)
        return
      }
      if (hasClass(child, 'abnt-paragraph')) {
        const text = (child.textContent || '').trim()
        if (text) out.push({ type: 'para', text })
        return
      }
      walk(child)
    })
  }
  walk(container)
  return out
}

/* ------------------------------------------------------------------ */
/* Métricas e constantes de layout                                     */
/* ------------------------------------------------------------------ */

// A4 com margens ABNT NBR 14724: esquerda 30 mm; superior/direita/inferior 20 mm.
const PAGE_W = 210
const PAGE_H = 297
const M_LEFT = 30
const M_RIGHT = 20
const M_TOP = 20
const M_BOTTOM = 20
const CONTENT_W = PAGE_W - M_LEFT - M_RIGHT
const CONTENT_BOTTOM = PAGE_H - M_BOTTOM
const HEADER_H = 14 // área do cabeçalho vetorial (páginas após a capa)

const BODY_SIZE = 12 // pt (padrão ABNT)
const TABLE_SIZE = 9 // pt
const H2_SIZE = 13
const H3_SIZE = 12

const PT_TO_MM = 25.4 / 72

const INDENT = 12.7 // recuo de 1,25 cm da primeira linha do parágrafo (ABNT)
const H2_GAP_AFTER = 3 // mm após título de seção
const H3_GAP_AFTER = 2.5 // mm após subtítulo
const PARA_GAP = 4 // mm após o bloco de parágrafo
const KPI_GAP_AFTER = 4 // mm após a faixa de KPI
const CHART_GAP_AFTER = 4 // mm após o bloco de gráfico
const TABLE_GAP_AFTER = 4 // mm após o bloco de tabela

interface PlacedLine {
  text: string
  x: number
  size: number
  style: 'normal' | 'bold' | 'italic' | 'bolditalic'
  justify: boolean
  width: number // largura disponível para justificar
}

/** Linhas do mesmo parágrafo que caem na MESMA página: um "parágrafo-partes". */
interface PlacedPara {
  lines: PlacedLine[]
  height: number
  gapAfter: number
}

interface PlacedTable {
  caption: string | null
  headers: string[][]
  headerH: number
  rows: string[][][]
  rowHeights: number[]
  colWidths: number[]
  source: string | null
  height: number
}

interface PlacedKpi {
  cards: KpiCardData[]
  height: number
}

interface PlacedChart {
  spec: MonthlyChartSpec
  height: number
}

type PageItem =
  | { kind: 'para'; paras: PlacedPara[]; advance: number } // soma exata de heights+gaps internos
  | { kind: 'table'; table: PlacedTable; advance: number }
  | { kind: 'kpi'; kpi: PlacedKpi; advance: number }
  | { kind: 'chart'; chart: PlacedChart; advance: number }

interface Page {
  isCover: boolean
  items: PageItem[]
}

/* ------------------------------------------------------------------ */
/* Utilidades de medida (fonte do próprio PDF)                         */
/* ------------------------------------------------------------------ */

function setFont(doc: any, style: PlacedLine['style'], size: number) {
  const font = style === 'bold' || style === 'bolditalic' ? 'times' : 'times'
  const variant =
    style === 'bold'
      ? 'bold'
      : style === 'italic'
        ? 'italic'
        : style === 'bolditalic'
          ? 'bolditalic'
          : 'normal'
  doc.setFont(font, variant)
  doc.setFontSize(size)
}

/** Quebra de linha MEDIDA de verdade com a fonte/largura exatas do desenho. */
function measureLines(
  doc: any,
  text: string,
  widthMm: number,
  size: number,
  style: PlacedLine['style'],
): string[] {
  setFont(doc, style, size)
  return doc.splitTextToSize(text, widthMm) as string[]
}

function lineH(sizePt: number): number {
  return sizePt * PT_TO_MM * 1.5
}

/* ------------------------------------------------------------------ */
/* Layout — coloca blocos em páginas; cada item sabe o seu `advance`   */
/* ------------------------------------------------------------------ */

function layout(
  doc: any,
  blocks: Block[],
  kpiCards: KpiCardData[],
  charts: Record<number, MonthlyChartSpec>,
): Page[] {
  const pages: Page[] = []
  let current: PageItem[] = []
  let y = M_TOP + HEADER_H
  let kpiPlaced = false

  const pushPage = (isCover = false) => {
    pages.push({ isCover, items: current })
    current = []
    y = M_TOP + HEADER_H
  }

  const remaining = () => CONTENT_BOTTOM - y

  const pushParaPart = (p: PlacedPara) => {
    current.push({ kind: 'para', paras: [p], advance: p.height + p.gapAfter })
  }

  blocks.forEach((block) => {
    switch (block.type) {
      case 'cover': {
        pushPage()
        pages.push({ isCover: true, items: [] })
        kpiPlaced = false
        return
      }
      case 'h2':
      case 'h3': {
        const size = block.type === 'h2' ? H2_SIZE : H3_SIZE
        const lines = measureLines(doc, block.text.toUpperCase(), CONTENT_W, size, 'bold')
        const h = lines.length * lineH(size)
        const gapAfter = block.type === 'h2' ? H2_GAP_AFTER : H3_GAP_AFTER
        // Título nunca órfão: exige espaço para título + ~3 linhas de texto.
        if (h + gapAfter + 3 * lineH(BODY_SIZE) > remaining()) pushPage()
        const placed: PlacedLine[] = lines.map((text, i) => ({
          text,
          x: M_LEFT,
          size,
          style: 'bold',
          justify: false,
          width: CONTENT_W,
        }))
        // Um "para" de uma linha só, sem justify, com gap próprio.
        pushParaPart({ lines: placed, height: h, gapAfter })
        y += h + gapAfter
        // Gráfico vetorial da seção "N." — bloco ATÔMICO exclusivo logo após
        // o título: se não couber no restante da página, move INTEIRO para a
        // próxima (nunca sobrepõe nada, nunca é cortado).
        const m = /^(\d+)\s*\./.exec(block.text.trim())
        if (m) {
          const spec = charts[Number(m[1])]
          if (spec) {
            const ch = chartBlockMetrics(spec).totalHeight
            if (ch > remaining()) pushPage()
            current.push({
              kind: 'chart',
              chart: { spec, height: ch },
              advance: ch + CHART_GAP_AFTER,
            })
            y += ch + CHART_GAP_AFTER
          }
        }
        return
      }
      case 'para':
      case 'note': {
        const isNote = block.type === 'note'
        const size = isNote ? BODY_SIZE - 1 : BODY_SIZE
        const style: PlacedLine['style'] = isNote ? 'italic' : 'normal'
        const bodyW = CONTENT_W - (isNote ? 0 : INDENT)
        const lines = measureLines(doc, block.text, bodyW, size, style)
        const lh = lineH(size)
        // Cards de KPI (Sumário Executivo) na primeira página de conteúdo:
        // bloco atômico — se não couber, abre página nova antes.
        if (!kpiPlaced) {
          if (KPI_ROW_TOTAL > remaining()) pushPage()
          current.push({
            kind: 'kpi',
            kpi: { cards: kpiCards, height: KPI_ROW_TOTAL },
            advance: KPI_ROW_TOTAL + KPI_GAP_AFTER,
          })
          y += KPI_ROW_TOTAL + KPI_GAP_AFTER
          kpiPlaced = true
        }
        if (lines.length === 0) return
        let idx = 0
        while (idx < lines.length) {
          const avail = Math.floor(remaining() / lh)
          if (avail < 2) {
            pushPage()
            continue
          }
          let take = Math.min(avail, lines.length - idx)
          // Controle de viúvas/órfãs: nunca deixar 1 linha isolada numa
          // página quando há mais linhas vindas; nunca levar menos de 2.
          const rest = lines.length - idx - take
          if (rest === 1 && take > 2) take -= 1
          if (take < 2 && lines.length - idx > 2) {
            pushPage()
            continue
          }
          const chunk = lines.slice(idx, idx + take)
          const isFirst = idx === 0 && !isNote
          const placed: PlacedLine[] = chunk.map((text, i) => ({
            text,
            x: isFirst && i === 0 ? M_LEFT + INDENT : M_LEFT,
            size,
            style,
            justify: !isNote,
            width: isFirst && i === 0 ? bodyW : CONTENT_W - (isNote ? 0 : INDENT),
          }))
          const isLast = idx + take >= lines.length
          pushParaPart({
            lines: placed,
            height: chunk.length * lh,
            gapAfter: isLast ? PARA_GAP : 0,
          })
          y += chunk.length * lh + (isLast ? PARA_GAP : 0)
          idx += take
          if (idx < lines.length) pushPage()
        }
        return
      }
      case 'table': {
        const { caption, headers, rows, source } = block
        // Larguras proporcionais ao maior conteúdo de cada coluna (medidas com a fonte da tabela).
        setFont(doc, 'normal', TABLE_SIZE)
        const weights = headers.map((h, c) => {
          let w = Math.max(4, doc.getTextWidth(h || '—'))
          rows.forEach((r) => {
            w = Math.max(w, doc.getTextWidth((r[c] || '—') as string))
          })
          return w
        })
        const sum = weights.reduce((a, b) => a + b, 0) || 1
        const minW = Math.min(24, CONTENT_W / 2)
        const colWidths = weights.map((w) => Math.max(minW, (CONTENT_W * w) / sum))
        // Garante que a soma não exceda a largura útil (normaliza se exceder).
        const wSum = colWidths.reduce((a, b) => a + b, 0)
        if (wSum > CONTENT_W) {
          const k = CONTENT_W / wSum
          for (let c = 0; c < colWidths.length; c++) colWidths[c] *= k
        }

        const cellLines = (text: string, width: number) =>
          measureLines(doc, text || '—', width - 3, TABLE_SIZE, 'normal')
        const headerCells = headers.map((h, c) => cellLines(h, colWidths[c]))
        const headerH = Math.max(...headerCells.map((l) => l.length)) * lineH(TABLE_SIZE) + 2.5

        const bodyRows = rows.length > 0 ? rows : [headers.map(() => '—')]
        const dataCells = bodyRows.map((r) => r.map((cell, c) => cellLines(cell, colWidths[c])))
        const rowHeights = dataCells.map(
          (cells) => Math.max(...cells.map((l) => l.length)) * lineH(TABLE_SIZE) + 1.5,
        )

        // Quebra as linhas de dados em grupos que caibam na página.
        const groups: { start: number; end: number }[] = []
        let start = 0
        let acc = 0
        const maxRowsH = () =>
          remaining() - headerH - (caption ? lineH(TABLE_SIZE) + 1 : 0) - (source ? 6 : 0)
        bodyRows.forEach((_, r) => {
          const rh = rowHeights[r]
          if (acc + rh > maxRowsH() && r > start) {
            groups.push({ start, end: r })
            start = r
            acc = 0
          }
          acc += rh
        })
        groups.push({ start, end: bodyRows.length })

        groups.forEach((g, gi) => {
          // Legenda + cabeçalho + ao menos 1 linha juntos.
          const need =
            headerH +
            (caption && gi === 0 ? lineH(TABLE_SIZE) + 1 : 0) +
            (source && gi === groups.length - 1 ? 6 : 0) +
            Math.min(rowHeights[g.start] ?? 0, remaining())
          if (need > remaining()) pushPage()

          const sliceRows = bodyRows.slice(g.start, g.end)
          const sliceCells = dataCells.slice(g.start, g.end)
          const sliceHeights = rowHeights.slice(g.start, g.end)
          const height =
            headerH +
            sliceHeights.reduce((a, b) => a + b, 0) +
            (caption && gi === 0 ? lineH(TABLE_SIZE) + 1 : 0) +
            (source && gi === groups.length - 1 ? 6 : 0)
          current.push({
            kind: 'table',
            table: {
              caption: caption && gi === 0 ? caption : null,
              headers: headerCells,
              headerH,
              rows: sliceCells,
              rowHeights: sliceHeights,
              colWidths,
              source: source && gi === groups.length - 1 ? source : null,
              height,
            },
            advance: height + TABLE_GAP_AFTER,
          })
          y += height + TABLE_GAP_AFTER
        })
        return
      }
    }
  })

  pushPage()
  // Remove páginas vazias acidentais (a capa é a primeira; páginas de
  // conteúdo sem itens — em branco — nunca entram no PDF final).
  return pages.filter((p) => p.isCover || p.items.length > 0)
}

/* ------------------------------------------------------------------ */
/* Render — consome os MESMOS avanços calculados no layout             */
/* ------------------------------------------------------------------ */

function renderTable(doc: any, table: PlacedTable, yTop: number): number {
  let y = yTop
  if (table.caption) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(TABLE_SIZE - 0.5)
    doc.setTextColor(23, 24, 28)
    doc.text(table.caption, M_LEFT, y)
    y += lineH(TABLE_SIZE) + 1
  }
  // Cabeçalho da marca (grafite com texto âmbar-claro)
  const headerBoxTop = y - lineH(TABLE_SIZE) + 1.5
  doc.setFillColor(23, 24, 28)
  doc.setDrawColor(217, 119, 6)
  doc.rect(M_LEFT, headerBoxTop, CONTENT_W, table.headerH - 1, 'FD')
  let x = M_LEFT
  table.headers.forEach((cellLines, c) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(TABLE_SIZE)
    doc.setTextColor(252, 211, 77)
    cellLines.forEach((t, i) => {
      doc.text(t, x + 1.5, y + i * lineH(TABLE_SIZE))
    })
    x += table.colWidths[c]
  })
  y += table.headerH
  // Linhas com zebra âmbar-claro
  table.rows.forEach((cells, r) => {
    const rh = table.rowHeights[r]
    const rowTop = y - lineH(TABLE_SIZE) + 1.5
    if (r % 2 === 1) {
      doc.setFillColor(253, 246, 234)
      doc.rect(M_LEFT, rowTop, CONTENT_W, rh, 'F')
    }
    doc.setDrawColor(217, 119, 6)
    doc.setLineWidth(0.2)
    doc.line(M_LEFT, rowTop, M_LEFT + CONTENT_W, rowTop)
    let cx = M_LEFT
    cells.forEach((cellLines, c) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(TABLE_SIZE)
      doc.setTextColor(31, 33, 38)
      cellLines.forEach((t, i) => {
        doc.text(t, cx + 1.5, y + i * lineH(TABLE_SIZE))
      })
      cx += table.colWidths[c]
    })
    y += rh
  })
  doc.line(M_LEFT, y - lineH(TABLE_SIZE) + 1.5, M_LEFT + CONTENT_W, y - lineH(TABLE_SIZE) + 1.5)
  // Colunas verticais (da primeira linha ao fechamento)
  let vx = M_LEFT
  const tableTop = yTop + (table.caption ? lineH(TABLE_SIZE) + 1 : 0) - lineH(TABLE_SIZE) + 1.5
  const tableBottom = y - lineH(TABLE_SIZE) + 1.5
  doc.line(vx, tableTop, vx, tableBottom)
  table.colWidths.forEach((w) => {
    vx += w
    doc.line(vx, tableTop, vx, tableBottom)
  })
  if (table.source) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(TABLE_SIZE - 1)
    doc.setTextColor(107, 114, 128)
    doc.text(table.source, M_LEFT, y + 1)
    y += 6
  }
  return y
}

/** Desenha os parágrafos de UMA página com jsPDF justify de verdade. */
function renderPara(doc: any, p: PlacedPara, yTop: number): number {
  let y = yTop
  p.lines.forEach((ln, i) => {
    setFont(doc, ln.style, ln.size)
    if (ln.justify) {
      // Última linha do parágrafo-partes NÃO se justifica (senão o jsPDF
      // estica uma linha curta até a margem). Todas as anteriores são
      // justificadas com maxWidth — é isso que alinha as duas margens.
      const isLastLine = i === p.lines.length - 1
      doc.text(ln.text, ln.x, y, {
        align: isLastLine ? 'left' : 'justify',
        maxWidth: ln.width,
      })
    } else {
      doc.text(ln.text, ln.x, y)
    }
    y += lineH(ln.size)
  })
  return y + p.gapAfter
}

function renderPageItems(doc: any, page: Page) {
  let y = M_TOP + HEADER_H
  page.items.forEach((item) => {
    if (item.kind === 'para') {
      item.paras.forEach((p) => {
        y = renderPara(doc, p, y)
      })
    } else if (item.kind === 'table') {
      y = renderTable(doc, item.table, y) + TABLE_GAP_AFTER
    } else if (item.kind === 'kpi') {
      y = renderKpiCards(doc, item.kpi.cards, M_LEFT, y, CONTENT_W) + KPI_GAP_AFTER
    } else if (item.kind === 'chart') {
      // Gráfico vetorial atômico: desenho e `advance` usam as MESMAS
      // constantes de chartBlockMetrics — faixa exclusiva do gráfico.
      const ch = chartBlockMetrics(item.chart.spec).totalHeight
      drawMonthlyChart(doc, item.chart.spec, M_LEFT, y, CONTENT_W)
      y += ch + CHART_GAP_AFTER
    }
  })
}

function renderChrome(
  doc: any,
  pageIndex: number,
  totalPages: number,
  companyLabel: string,
  periodLabel: string,
  isCover: boolean,
) {
  if (isCover) {
    // Rodapé discreto na capa escura
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text('Documento gerado por LÓGOS AITSM', PAGE_W / 2, PAGE_H - 6, { align: 'center' })
    return
  }
  // Cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(217, 119, 6)
  doc.text('RELATÓRIO MENSAL DE ATENDIMENTO', M_LEFT, M_TOP + 3)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(23, 24, 28)
  doc.setFontSize(7.5)
  const right = [companyLabel, periodLabel].filter(Boolean).join(' — ')
  if (right) doc.text(right, PAGE_W - M_RIGHT, M_TOP + 3, { align: 'right' })
  doc.setDrawColor(252, 211, 77)
  doc.setLineWidth(0.4)
  doc.line(M_LEFT, M_TOP + 5.5, PAGE_W - M_RIGHT, M_TOP + 5.5)
  // Rodapé
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  doc.text('Documento gerado por LÓGOS AITSM', M_LEFT, PAGE_H - M_BOTTOM + 6)
  doc.text(`Página ${pageIndex + 1} de ${totalPages}`, PAGE_W - M_RIGHT, PAGE_H - M_BOTTOM + 6, {
    align: 'right',
  })
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar ' + src)), {
        once: true,
      })
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.src = src
    s.addEventListener('load', () => {
      s.dataset.loaded = '1'
      resolve()
    })
    s.addEventListener('error', () => reject(new Error('Falha ao carregar ' + src)))
    document.head.appendChild(s)
  })
}

function slugify(text: string): string {
  const map: Record<string, string> = {
    à: 'a',
    á: 'a',
    â: 'a',
    ã: 'a',
    ä: 'a',
    è: 'e',
    é: 'e',
    ê: 'e',
    ë: 'e',
    ì: 'i',
    í: 'i',
    î: 'i',
    ï: 'i',
    ò: 'o',
    ó: 'o',
    ô: 'o',
    õ: 'o',
    ö: 'o',
    ù: 'u',
    ú: 'u',
    û: 'u',
    ü: 'u',
    ç: 'c',
    ñ: 'n',
  }
  return text
    .toLowerCase()
    .replace(/[àáâãäèéêëìíîïòóôõöùúûüçñ]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function exportMonthlyClientTextPdf(
  options: ExportMonthlyClientTextPdfOptions,
): Promise<string> {
  const { reportData, monthKey, onProgress } = options
  onProgress?.('load')

  if (!window.jspdf?.jsPDF) await loadScript(CDN_JSPDF)
  const JsPdfCtor = window.jspdf?.jsPDF
  if (!JsPdfCtor) {
    throw new Error(
      'Não foi possível carregar a biblioteca de geração de PDF (CDN indisponível). Verifique sua conexão e tente novamente.',
    )
  }

  onProgress?.('compose')

  // 1. Constrói o DOM textual (mesma fonte de dados da tela e do portal).
  const container = buildMonthlyClientTextDom(reportData, monthKey)
  container.style.position = 'fixed'
  container.style.left = '-30000px'
  container.style.top = '0'
  document.body.appendChild(container)
  try {
    const blocks = extractBlocks(container)
    if (blocks.length === 0) {
      throw new Error('Nenhum conteúdo textual disponível para exportar.')
    }

    // 2. Modelo rico: cards de KPI + specs de gráficos vetoriais.
    const kpiCards = buildMonthlyKpiCards(reportData)
    const charts = buildMonthlyChartSpecs(reportData)

    // 3. Layout/paginação em A4 (mede com a própria fonte do PDF).
    const doc = new JsPdfCtor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pages = layout(doc, blocks, kpiCards, charts)
    if (pages.length === 0) throw new Error('Falha ao montar as páginas do PDF.')

    const d = (reportData || {}) as {
      periodLabel?: string
      company?: { trade_name?: string; legal_name?: string }
    }
    const companyLabel = d.company?.trade_name || d.company?.legal_name || ''
    const periodLabel = d.periodLabel || monthKey

    doc.setProperties({
      title: `Relatório Mensal — ${companyLabel || 'Cliente'} (${periodLabel})`,
      subject: 'Relatório Mensal de Atendimento Técnico (rico, vetorial)',
      creator: 'LÓGOS AITSM',
    })

    const totalPages = pages.length
    pages.forEach((page, i) => {
      if (i > 0) doc.addPage()
      if (page.isCover) {
        const cover = blocks.find((b) => b.type === 'cover') as
          | { type: 'cover'; lines: CoverLine[] }
          | undefined
        if (cover) renderBrandCover(doc, cover.lines, CONTENT_W)
      } else {
        renderPageItems(doc, page)
      }
      renderChrome(doc, i, totalPages, companyLabel, periodLabel, page.isCover)
    })

    // 4. Download
    onProgress?.('download')
    const fileName = `relatorio-mensal-${slugify(companyLabel || 'cliente')}-${monthKey}.pdf`
    doc.save(fileName)
    return fileName
  } finally {
    container.remove()
  }
}

export { AMBER, GRAPHITE }
