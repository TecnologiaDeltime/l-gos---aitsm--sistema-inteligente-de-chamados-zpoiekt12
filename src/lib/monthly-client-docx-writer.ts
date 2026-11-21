/**
 * Escritor de DOCX (Microsoft Word) EDITÁVEL do Relatório Mensal do Cliente.
 *
 * Conteúdo IDÊNTICO ao do PDF textual ABNT: usa o MESMO DOM fonte produzido
 * por buildMonthlyClientTextDom (mesma fonte de dados, mesmos textos, mesmos
 * cálculos, mesmas tabelas) e converte cada bloco em elementos nativos do
 * Word — texto corrido editável, NADA de imagens/rasterização.
 *
 * Estilo ABNT NBR 14724:
 *  - fonte Times New Roman 12pt; títulos em negrito; texto JUSTIFICADO;
 *  - margens: superior/esquerda 3 cm; inferior/direita 2 cm;
 *  - tabelas como tabelas REAIS do Word (cabeçalho em negrito, bordas),
 *    legenda acima ("Quadro N — ...") e fonte abaixo (itálico);
 *  - download direto via blob (sem janela de impressão, sem backend).
 *
 * A biblioteca "docx" é instalada a partir do import (package.json gerenciado
 * pela plataforma).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { buildMonthlyClientTextDom } from '@/lib/monthly-client-pdf-text'

type Progress = (stage: 'load' | 'compose' | 'download') => void

export interface ExportMonthlyClientDocxOptions {
  reportData: unknown
  monthKey: string
  onProgress?: Progress
}

/* ------------------------------------------------------------------ */
/* Modelo de blocos (extraído do mesmo DOM textual do PDF)             */
/* ------------------------------------------------------------------ */

type CoverLine = { text: string; kind: 'header' | 'title' | 'subtitle' | 'sub' | 'footer' }

type Block =
  | { type: 'cover'; lines: CoverLine[] }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'para'; text: string }
  | { type: 'note'; text: string }
  | { type: 'table'; caption: string; headers: string[]; rows: string[][]; source: string }

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
/* Conversão blocos → elementos do Word                                */
/* ------------------------------------------------------------------ */

const FONT = 'Times New Roman'
const BODY_TWIPS = 24 // 12 pt (2 × 12 half-points)
const NOTE_TWIPS = 20 // 10 pt (fonte das tabelas)
const H2_TWIPS = 28 // 14 pt
const LINE = 360 // 1,5 cm de espaçamento (1.5 line = 360 twips em 240-based)

const CELL_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '555555',
}
const TABLE_BORDERS = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER,
  insideHorizontal: CELL_BORDER,
  insideVertical: CELL_BORDER,
}

function textRun(text: string, opts?: { bold?: boolean; italics?: boolean; size?: number }) {
  return new TextRun({
    text,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? BODY_TWIPS,
    font: FONT,
    color: '111827',
  })
}

function paraBlock(text: string, opts?: { indentFirstLine?: boolean }) {
  return new Paragraph({
    children: [textRun(text)],
    alignment: AlignmentType.JUSTIFIED,
    indent: opts?.indentFirstLine ? { firstLine: 709 } : undefined, // ~1,25 cm
    spacing: { after: 160, line: LINE },
  })
}

function noteBlock(text: string) {
  return new Paragraph({
    children: [textRun(text, { italics: true, size: NOTE_TWIPS })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: LINE },
  })
}

function headingBlock(text: string, level: 'h2' | 'h3') {
  const size = level === 'h2' ? H2_TWIPS : BODY_TWIPS
  return new Paragraph({
    children: [textRun(level === 'h2' ? text.toUpperCase() : text, { bold: true, size })],
    alignment: level === 'h2' ? AlignmentType.LEFT : AlignmentType.LEFT,
    spacing: { before: 240, after: 160, line: LINE },
    ...(level === 'h2' ? { heading: HeadingLevel.HEADING_2 } : {}),
  })
}

function coverLineParagraph(line: CoverLine): Paragraph {
  const sizeByKind: Record<CoverLine['kind'], number> = {
    header: 28,
    title: 32,
    subtitle: 28,
    sub: 24,
    footer: 22,
  }
  const size = sizeByKind[line.kind]
  const spacingAfter = line.kind === 'title' ? 320 : line.kind === 'header' ? 400 : 120
  return new Paragraph({
    children: [
      textRun(line.kind === 'sub' || line.kind === 'footer' ? line.text : line.text, {
        bold: line.kind !== 'sub' && line.kind !== 'footer',
        size,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: spacingAfter, line: LINE },
  })
}

function buildDocxTable(block: Extract<Block, { type: 'table' }>): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []

  if (block.caption) {
    out.push(
      new Paragraph({
        children: [textRun(block.caption, { bold: true, size: NOTE_TWIPS + 2 })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 160, after: 80 },
      }),
    )
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: block.headers.map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [textRun(h || '—', { bold: true, size: NOTE_TWIPS })],
              spacing: { after: 0 },
            }),
          ],
          shading: { fill: 'EEEEEE' },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
        }),
    ),
  })

  const bodyRows = block.rows.map(
    (r) =>
      new TableRow({
        children: block.headers.map(
          (_, c) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [textRun(r[c] || '—', { size: NOTE_TWIPS })],
                  spacing: { after: 0 },
                }),
              ],
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
            }),
        ),
      }),
  )

  out.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [headerRow, ...bodyRows],
    }),
  )

  if (block.source) {
    out.push(
      new Paragraph({
        children: [textRun(block.source, { italics: true, size: NOTE_TWIPS })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 80, after: 240 },
      }),
    )
  }

  return out
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

export async function exportMonthlyClientDocx(
  options: ExportMonthlyClientDocxOptions,
): Promise<string> {
  const { reportData, monthKey, onProgress } = options
  onProgress?.('load')

  onProgress?.('compose')

  // 1. Constrói o MESMO DOM textual do PDF (mesma fonte de dados).
  const container = buildMonthlyClientTextDom(reportData, monthKey)
  document.body.appendChild(container)
  try {
    const blocks = extractBlocks(container)
    if (blocks.length === 0) {
      throw new Error('Nenhum conteúdo textual disponível para exportar.')
    }

    // 2. Converte os blocos em elementos nativos do Word.
    const children: (Paragraph | Table)[] = []
    for (const block of blocks) {
      switch (block.type) {
        case 'cover':
          block.lines.forEach((line) => children.push(coverLineParagraph(line)))
          // Página nova após a capa
          children.push(
            new Paragraph({
              children: [textRun('', { size: 2 })],
              pageBreakBefore: true,
              spacing: { after: 0 },
            }),
          )
          break
        case 'h2':
        case 'h3':
          children.push(headingBlock(block.text, block.type))
          break
        case 'para':
          children.push(paraBlock(block.text, { indentFirstLine: true }))
          break
        case 'note':
          children.push(noteBlock(block.text))
          break
        case 'table':
          buildDocxTable(block).forEach((piece) => children.push(piece))
          break
      }
    }

    const d = (reportData || {}) as {
      periodLabel?: string
      company?: { trade_name?: string; legal_name?: string }
    }
    const companyLabel = d.company?.trade_name || d.company?.legal_name || 'Cliente'
    const periodLabel = d.periodLabel || monthKey

    // 3. Documento ABNT: Times New Roman 12, justificado, margens 3/2 cm.
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: FONT, size: BODY_TWIPS, color: '111827' },
            paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1701, // 3 cm (1 cm = 567 twips)
                left: 1701,
                bottom: 1134, // 2 cm
                right: 1134,
              },
            },
          },
          children,
        },
      ],
    })

    // 4. Gera o blob e baixa direto (sem janela de impressão, sem backend).
    onProgress?.('download')
    const blob = await Packer.toBlob(doc)
    const fileName = `relatorio-mensal-${slugify(companyLabel || 'cliente')}-${monthKey}.docx`
    downloadBlob(blob, fileName)
    return fileName
  } finally {
    container.remove()
  }
}
