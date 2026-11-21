/**
 * Escritor de PDF 100% VETORIAL do Relatório Mensal do Cliente (ABNT).
 *
 * A pedido do cliente ("não utilize gráficos, faça um PDF textual"), o PDF
 * NÃO contém nenhum gráfico nem rasterização (sem html2canvas/canvas): o
 * documento é construído como TEXTO e TABELAS nativos do jsPDF, a partir do
 * mesmo MonthlyClientReportData exibido na tela e no Portal do Cliente —
 * fidelidade garantida por usar a mesma fonte de dados.
 *
 * Paginação (zero corte de conteúdo):
 *  - margens ABNT (sup/dir 20 mm, inf 20 mm, esq 30 mm);
 *  - parágrafos justificados, quebrados apenas ENTRE linhas (nunca no meio
 *    de uma linha; controle de viúvas/órfãs com mínimo de 2 linhas);
 *  - tabelas quebradas apenas ENTRE linhas, repetindo o cabeçalho;
 *  - legenda de quadro nunca fica sozinha: exige legenda + cabeçalho + ao
 *    menos 1 linha de dados na mesma página;
 *  - título de seção nunca fica órfão no fim da página;
 *  - capa em página própria; cabeçalho/rodapé vetoriais com paginação
 *    "Página X de Y" em todas as páginas (numeração iniciada após a capa).
 */

import { buildMonthlyClientTextDom } from '@/lib/monthly-client-pdf-text'

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
/* Modelo de blocos extraído do DOM textual                            */
/* ------------------------------------------------------------------ */

type CoverLine = { text: string; kind: 'header' | 'title' | 'subtitle' | 'sub' | 'footer' }

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
/* Layout                                                              */
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

interface PlacedLine {
  text: string
  x: number
  size: number
  style: 'normal' | 'bold' | 'italic' | 'bolditalic'
  justify: boolean
  width: number // largura disponível para justificar
  gapAfterMm: number
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

type PageItem =
  | { kind: 'lines'; lines: PlacedLine[]; height: number }
  | { kind: 'table'; table: PlacedTable }

interface Page {
  isCover: boolean
  items: PageItem[]
}

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

function measureLines(doc: any, text: string, widthMm: number, size: number): string[] {
  setFont(doc, 'normal', size)
  return doc.splitTextToSize(text, widthMm) as string[]
}

function lineH(sizePt: number): number {
  return sizePt * PT_TO_MM * 1.5
}

function buildCover(lines: CoverLine[]): Page {
  return { isCover: true, items: [] }
}

function coverLineStyle(kind: CoverLine['kind']): { size: number; style: PlacedLine['style'] } {
  switch (kind) {
    case 'header':
      return { size: 14, style: 'bold' }
    case 'title':
      return { size: 16, style: 'bold' }
    case 'subtitle':
      return { size: 14, style: 'bold' }
    case 'footer':
      return { size: 11, style: 'normal' }
    default:
      return { size: 12, style: 'normal' }
  }
}

/**
 * Converte os blocos em páginas. Cada bloco é colocado respeitando o
 * espaço restante; parágrafos podem atravessar páginas apenas ENTRE
 * linhas (mínimo 2 linhas de cada lado quando possível); tabelas
 * atravessam apenas ENTRE linhas de dados, repetindo o cabeçalho.
 */
function layout(doc: any, blocks: Block[]): Page[] {
  const pages: Page[] = []
  let current: PageItem[] = []
  let y = M_TOP + HEADER_H

  const pushPage = (isCover = false) => {
    pages.push({ isCover, items: current })
    current = []
    y = M_TOP + HEADER_H
  }

  const remaining = () => CONTENT_BOTTOM - y
  const gapBlocks = 4 // mm entre blocos

  blocks.forEach((block) => {
    switch (block.type) {
      case 'cover': {
        pushPage()
        pages.push(buildCover(block.lines))
        return
      }
      case 'h2':
      case 'h3': {
        const size = block.type === 'h2' ? H2_SIZE : H3_SIZE
        const lines = measureLines(doc, block.text.toUpperCase(), CONTENT_W, size)
        const h = lines.length * lineH(size) + 2
        // Título nunca órfão: exige espaço para título + ~3 linhas de texto.
        if (h + 3 * lineH(BODY_SIZE) > remaining()) pushPage()
        const placed: PlacedLine[] = lines.map((text, i) => ({
          text,
          x: M_LEFT,
          size,
          style: 'bold',
          justify: false,
          width: CONTENT_W,
          gapAfterMm: i === lines.length - 1 ? 3 : 0,
        }))
        current.push({ kind: 'lines', lines: placed, height: h })
        y += h
        return
      }
      case 'para':
      case 'note': {
        const isNote = block.type === 'note'
        const size = isNote ? BODY_SIZE - 1 : BODY_SIZE
        const style: PlacedLine['style'] = isNote ? 'italic' : 'normal'
        const lines = measureLines(doc, block.text, CONTENT_W - (isNote ? 0 : 12.7), size)
        const lh = lineH(size)
        let idx = 0
        while (idx < lines.length) {
          const avail = Math.floor(remaining() / lh)
          if (avail < 2) {
            pushPage()
            continue
          }
          let take = Math.min(avail, lines.length - idx)
          // Controle de viúvas/órfãs: se sobrar 1 linha para a próxima
          // página, antecipa (ou empurra) para manter >=2 de cada lado.
          const rest = lines.length - idx - take
          if (rest === 1 && take > 2) take -= 1
          if (take < 2 && lines.length - idx > 2) {
            pushPage()
            continue
          }
          const chunk = lines.slice(idx, idx + take)
          const placed: PlacedLine[] = chunk.map((text, i) => ({
            text,
            x: idx === 0 && i === 0 && !isNote ? M_LEFT + 12.7 : M_LEFT,
            size,
            style,
            justify: !isNote,
            width: CONTENT_W - (idx === 0 && i === 0 && !isNote ? 12.7 : 0),
            gapAfterMm: idx + take >= lines.length ? gapBlocks : 0,
          }))
          const height = chunk.length * lh
          current.push({ kind: 'lines', lines: placed, height })
          y += height
          idx += take
          if (idx < lines.length) pushPage()
        }
        return
      }
      case 'table': {
        const { caption, headers, rows, source } = block
        // Larguras proporcionais ao maior conteúdo de cada coluna.
        setFont(doc, 'normal', TABLE_SIZE)
        const weights = headers.map((h, c) => {
          let w = Math.max(4, (h || '').length)
          rows.forEach((r) => {
            w = Math.max(w, ((r[c] || '') as string).length)
          })
          return Math.min(w, 60)
        })
        const sum = weights.reduce((a, b) => a + b, 0)
        const colWidths = weights.map((w) => Math.max(18, (CONTENT_W * w) / sum))

        const cellLines = (text: string, width: number) =>
          measureLines(doc, text || '—', width - 3, TABLE_SIZE)
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
          })
          y += height + 2
        })
        return
      }
    }
  })

  pushPage()
  // Remove páginas vazias acidentais (exceto a capa).
  return pages.filter((p, i) => i === 0 || p.isCover || p.items.length > 0)
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function renderCover(doc: any, lines: CoverLine[]) {
  let y = 60
  lines.forEach((line) => {
    const { size, style } = coverLineStyle(line.kind)
    setFont(doc, style, size)
    const spacing =
      line.kind === 'title' ? 16 : line.kind === 'subtitle' ? 10 : line.kind === 'header' ? 10 : 6
    const split = doc.splitTextToSize(line.text, CONTENT_W) as string[]
    split.forEach((t, i) => {
      doc.text(t, PAGE_W / 2, y + i * lineH(size), { align: 'center' })
    })
    y += split.length * lineH(size) + spacing
    if (line.kind === 'header') y += 60 // título desce (ABNT: terço superior)
    if (line.kind === 'footer') {
      y = PAGE_H - M_BOTTOM - 10 // cidade/UF ancorada no pé da capa
      doc.setFontSize(11)
    }
  })
}

function renderTable(doc: any, table: PlacedTable, yTop: number): number {
  let y = yTop
  if (table.caption) {
    setFont(doc, 'bold', TABLE_SIZE)
    doc.text(table.caption, M_LEFT, y)
    y += lineH(TABLE_SIZE) + 1
  }
  // Cabeçalho
  doc.setFillColor(238, 238, 238)
  doc.setDrawColor(85, 85, 85)
  doc.rect(M_LEFT, y - lineH(TABLE_SIZE) + 1.5, CONTENT_W, headerBoxH(table.headerH), 'FD')
  let x = M_LEFT
  table.headers.forEach((cellLines, c) => {
    setFont(doc, 'bold', TABLE_SIZE)
    cellLines.forEach((t, i) => {
      doc.text(t, x + 1.5, y + i * lineH(TABLE_SIZE))
    })
    x += table.colWidths[c]
  })
  y += table.headerH
  // Linhas
  table.rows.forEach((cells, r) => {
    const rh = table.rowHeights[r]
    doc.setDrawColor(85, 85, 85)
    doc.setLineWidth(0.2)
    doc.line(M_LEFT, y - lineH(TABLE_SIZE) + 1.5, M_LEFT + CONTENT_W, y - lineH(TABLE_SIZE) + 1.5)
    let cx = M_LEFT
    cells.forEach((cellLines, c) => {
      setFont(doc, 'normal', TABLE_SIZE)
      cellLines.forEach((t, i) => {
        doc.text(t, cx + 1.5, y + i * lineH(TABLE_SIZE))
      })
      cx += table.colWidths[c]
    })
    y += rh
  })
  doc.line(M_LEFT, y - lineH(TABLE_SIZE) + 1.5, M_LEFT + CONTENT_W, y - lineH(TABLE_SIZE) + 1.5)
  // Colunas verticais
  let vx = M_LEFT
  doc.line(
    vx,
    yTop + (table.caption ? lineH(TABLE_SIZE) + 1 : 0) - lineH(TABLE_SIZE) + 1.5,
    vx,
    y - lineH(TABLE_SIZE) + 1.5,
  )
  table.colWidths.forEach((w) => {
    vx += w
    doc.line(
      vx,
      yTop + (table.caption ? lineH(TABLE_SIZE) + 1 : 0) - lineH(TABLE_SIZE) + 1.5,
      vx,
      y - lineH(TABLE_SIZE) + 1.5,
    )
  })
  if (table.source) {
    setFont(doc, 'italic', TABLE_SIZE - 1)
    doc.text(table.source, M_LEFT, y + 1)
    y += 6
  }
  return y
}

function headerBoxH(headerH: number): number {
  return headerH - 1
}

function renderPageItems(doc: any, page: Page) {
  let y = M_TOP + HEADER_H
  page.items.forEach((item) => {
    if (item.kind === 'lines') {
      item.lines.forEach((ln) => {
        setFont(doc, ln.style, ln.size)
        if (ln.justify) {
          doc.text(ln.text, ln.x, y, { align: 'justify', maxWidth: ln.width })
        } else {
          doc.text(ln.text, ln.x, y)
        }
        y += lineH(ln.size) + (ln.gapAfterMm || 0)
      })
    } else {
      y = renderTable(doc, item.table, y) + 2
    }
  })
}

function renderChrome(
  doc: any,
  pageIndex: number,
  totalPages: number,
  companyLabel: string,
  periodLabel: string,
) {
  if (pageIndex === 0) {
    // Rodapé discreto na capa
    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text('Documento gerado por LÓGOS AITSM', PAGE_W / 2, PAGE_H - M_BOTTOM + 6, {
      align: 'center',
    })
    return
  }
  // Cabeçalho
  doc.setFont('times', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(AMBER)
  doc.text('RELATÓRIO MENSAL DE ATENDIMENTO', M_LEFT, M_TOP + 3)
  doc.setFont('times', 'normal')
  doc.setTextColor(GRAPHITE)
  doc.setFontSize(7.5)
  const right = [companyLabel, periodLabel].filter(Boolean).join(' — ')
  if (right) doc.text(right, PAGE_W - M_RIGHT, M_TOP + 3, { align: 'right' })
  doc.setDrawColor(AMBER)
  doc.setLineWidth(0.4)
  doc.line(M_LEFT, M_TOP + 5.5, PAGE_W - M_RIGHT, M_TOP + 5.5)
  // Rodapé
  doc.setFont('times', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
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

    // 2. Layout/paginação em A4 (mede com a própria fonte do PDF).
    const doc = new JsPdfCtor({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pages = layout(doc, blocks)
    if (pages.length === 0) throw new Error('Falha ao montar as páginas do PDF.')

    const d = (reportData || {}) as {
      periodLabel?: string
      company?: { trade_name?: string; legal_name?: string }
    }
    const companyLabel = d.company?.trade_name || d.company?.legal_name || ''
    const periodLabel = d.periodLabel || monthKey

    doc.setProperties({
      title: `Relatório Mensal — ${companyLabel || 'Cliente'} (${periodLabel})`,
      subject: 'Relatório Mensal de Atendimento Técnico (ABNT, textual)',
      creator: 'LÓGOS AITSM',
    })

    const totalPages = pages.length
    pages.forEach((page, i) => {
      if (i > 0) doc.addPage()
      if (page.isCover) {
        const cover = blocks.find((b) => b.type === 'cover') as
          | { type: 'cover'; lines: CoverLine[] }
          | undefined
        if (cover) renderCover(doc, cover.lines)
      } else {
        renderPageItems(doc, page)
      }
      renderChrome(doc, i, totalPages, companyLabel, periodLabel)
    })

    // 3. Download
    onProgress?.('download')
    const fileName = `relatorio-mensal-${slugify(companyLabel || 'cliente')}-${monthKey}.pdf`
    doc.save(fileName)
    return fileName
  } finally {
    container.remove()
  }
}
