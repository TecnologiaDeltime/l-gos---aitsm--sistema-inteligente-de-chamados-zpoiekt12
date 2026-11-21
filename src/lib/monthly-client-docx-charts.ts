/**
 * Elementos de IDENTIDADE VISUAL da marca no DOCX do Relatório Mensal:
 * cards de KPI (tabela de 1 célula por card, sombreada, número grande) e
 * gráficos como "barras em célula" (célula sombreada proporcionalmente ao
 * valor — nativo do Word, 100% editável, SEM ChartRun/gráficos nativos que
 * são frágeis entre versões e divergiriam dos números).
 *
 * Paleta da marca (temas oficiais): grafite #17181C, âmbar #D97706 e âmbar
 * claro #FCD34D. Nenhuma cor azul. Times New Roman em todo o documento.
 */

import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'

import type { MonthlyChartSpec, MonthlyKpiCard } from '@/lib/monthly-client-rich-doc'

export const BRAND_DARK = '17181C'
export const BRAND_AMBER = 'D97706'
export const BRAND_AMBER_LIGHT = 'FCD34D'
export const BRAND_AMBER_PALE = 'FDF6EA'
export const BRAND_TRACK = 'F3F4F6'
export const BRAND_SLATE = '374151'
export const BRAND_INK = '1F2126'
export const BRAND_GRAY = '6B7280'

const FONT = 'Times New Roman'
// Largura útil da página A4 com margens 3/2 cm: 21 - 3 - 2 = 16 cm = 9072 twips.
const USABLE_W = 9072

function run(text: string, opts?: { bold?: boolean; italics?: boolean; size?: number; color?: string }) {
  return new TextRun({
    text,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? 24,
    font: FONT,
    color: opts?.color ?? BRAND_INK,
  })
}

function emptyPara(): Paragraph {
  return new Paragraph({ children: [run('', { size: 2 })], spacing: { after: 0, line: 240 } })
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const CARD_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

/* ------------------------------------------------------------------ */
/* Cards de KPI — uma tabela, um card por célula                       */
/* ------------------------------------------------------------------ */

export function buildDocxKpiHeading(): Paragraph {
  return new Paragraph({
    children: [run('RESUMO EXECUTIVO DO PERÍODO', { bold: true, size: 20, color: BRAND_AMBER })],
    spacing: { before: 120, after: 60 },
  })
}

/** Uma tabela de UMA linha com UMA célula por card (cada célula = 1 card). */
export function buildDocxKpiCards(cards: MonthlyKpiCard[]): Table[] {
  if (cards.length === 0) return []
  const gap = 120 // twips entre cards
  const cellW = Math.floor((USABLE_W - gap * (cards.length - 1)) / cards.length)

  const cells = cards.map((card, i) => {
    const width = i === cards.length - 1 ? USABLE_W - (cellW + gap) * (cards.length - 1) : cellW
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { fill: BRAND_AMBER_PALE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: BRAND_AMBER_LIGHT },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_AMBER_LIGHT },
        left: { style: BorderStyle.SINGLE, size: 6, color: BRAND_AMBER_LIGHT },
        right: { style: BorderStyle.SINGLE, size: 6, color: BRAND_AMBER_LIGHT },
      },
      margins: { top: 100, bottom: 100, left: 140, right: 100 },
      children: [
        new Paragraph({
          children: [run(card.label, { bold: true, size: 13, color: BRAND_AMBER })],
          spacing: { after: 40, line: 240 },
        }),
        new Paragraph({
          children: [run(card.value, { bold: true, size: 34, color: BRAND_DARK })],
          spacing: { after: 40, line: 240 },
        }),
        new Paragraph({
          children: [run(card.sub, { size: 13, color: BRAND_GRAY })],
          spacing: { after: 0, line: 240 },
        }),
      ],
    })
  })

  return [
    new Table({
      width: { size: USABLE_W, type: WidthType.DXA },
      borders: CARD_BORDERS,
      rows: [new TableRow({ children: cells })],
    }),
    // Respiro após os cards (parágrafo fino; tabelas não têm espaçamento próprio).
    new Paragraph({ children: [run('', { size: 8 })], spacing: { after: 0, line: 160 } }),
  ]
}

/* ------------------------------------------------------------------ */
/* Gráficos — "barras em célula" (nativo e editável)                   */
/* ------------------------------------------------------------------ */

interface BarRowSpec {
  label: string
  value: number
  max: number
  color: string
  valueText: string
}

function barRow(r: BarRowSpec, indent: boolean): TableRow {
  const labelPct = 30
  const valuePct = 18
  const barPct = 52
  const share = r.max > 0 ? Math.max(r.value > 0 ? 0.6 : 0, (r.value / r.max) * barPct) : 0
  const trackPct = Math.max(0, barPct - share)

  const labelWidth = Math.round((USABLE_W * labelPct) / 100)
  const valueWidth = Math.round((USABLE_W * valuePct) / 100)
  const barWidth = Math.round((USABLE_W * share) / 100)
  const trackWidth = Math.round((USABLE_W * trackPct) / 100)

  const cells: TableCell[] = [
    new TableCell({
      width: { size: labelWidth, type: WidthType.DXA },
      margins: { top: 20, bottom: 20, left: indent ? 200 : 40, right: 60 },
      children: [
        new Paragraph({
          children: [run(r.label, { size: 18 })],
          spacing: { after: 0, line: 240 },
        }),
      ],
    }),
  ]
  if (barWidth > 0) {
    cells.push(
      new TableCell({
        width: { size: barWidth, type: WidthType.DXA },
        shading: { fill: r.color },
        margins: { top: 20, bottom: 20, left: 0, right: 0 },
        children: [emptyPara()],
      }),
    )
  }
  if (trackWidth > 0) {
    cells.push(
      new TableCell({
        width: { size: trackWidth, type: WidthType.DXA },
        shading: { fill: BRAND_TRACK },
        margins: { top: 20, bottom: 20, left: 0, right: 0 },
        children: [emptyPara()],
      }),
    )
  }
  cells.push(
    new TableCell({
      width: { size: valueWidth, type: WidthType.DXA },
      margins: { top: 20, bottom: 20, left: 60, right: 40 },
      children: [
        new Paragraph({
          children: [run(r.valueText, { bold: true, size: 18 })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0, line: 240 },
        }),
      ],
    }),
  )

  return new TableRow({ children: cells })
}

function chartCaption(text: string): Paragraph {
  return new Paragraph({
    children: [run(text, { bold: true, size: 20 })],
    spacing: { before: 160, after: 60 },
  })
}

function chartSource(text: string): Paragraph {
  return new Paragraph({
    children: [run(text, { italics: true, size: 17, color: BRAND_GRAY })],
    spacing: { before: 60, after: 200 },
  })
}

const CHART_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
  insideVertical: NO_BORDER,
}

function chartTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: USABLE_W, type: WidthType.DXA },
    borders: CHART_BORDERS,
    rows,
  })
}

const fmtH = (v: number): string => `${v.toFixed(1).replace('.', ',')} h`

/** Converte um spec de gráfico em tabela(s) nativas do Word (barras em célula). */
export function buildDocxChart(spec: MonthlyChartSpec): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [chartCaption(spec.caption)]

  if (spec.kind === 'bars') {
    const max = Math.max(1, ...spec.categories.flatMap((c) => [c.a, c.b]))
    const rows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: Math.round((USABLE_W * 30) / 100), type: WidthType.DXA },
            margins: { top: 20, bottom: 20, left: 40, right: 60 },
            children: [
              new Paragraph({
                children: [
                  run('■ ', { size: 16, color: BRAND_SLATE }),
                  run(spec.seriesA, { bold: true, size: 18 }),
                  run('   ', { size: 18 }),
                  run('■ ', { size: 16, color: BRAND_AMBER }),
                  run(spec.seriesB, { bold: true, size: 18 }),
                ],
                spacing: { after: 0, line: 240 },
              }),
            ],
          }),
          new TableCell({
            width: { size: Math.round((USABLE_W * 70) / 100), type: WidthType.DXA },
            children: [emptyPara()],
          }),
        ],
      }),
    ]
    spec.categories.forEach((cat) => {
      rows.push(
        barRow({ label: cat.label, value: cat.a, max, color: BRAND_SLATE, valueText: fmtH(cat.a) }, false),
      )
      rows.push(
        barRow({ label: `${spec.seriesB} — ${cat.label}`, value: cat.b, max, color: BRAND_AMBER, valueText: fmtH(cat.b) }, true),
      )
    })
    out.push(chartTable(rows))
  } else if (spec.kind === 'hbars') {
    const max = Math.max(1, ...spec.items.map((i) => i.value))
    out.push(
      chartTable(
        spec.items.map((item) =>
          barRow(
            { label: item.label, value: item.value, max, color: BRAND_AMBER, valueText: fmtH(item.value) },
            false,
          ),
        ),
      ),
    )
  } else if (spec.kind === 'donut') {
    const total = spec.items.reduce((a, b) => a + b.value, 0)
    const max = Math.max(1, total)
    const rows = spec.items.map((item, i) =>
      barRow(
        {
          label: item.label,
          value: item.value,
          max,
          color: i % 2 === 0 ? BRAND_AMBER : BRAND_SLATE,
          valueText: `${Math.round(item.value)} (${total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)`,
        },
        false,
      ),
    )
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: Math.round((USABLE_W * 30) / 100), type: WidthType.DXA },
            margins: { top: 40, bottom: 20, left: 40, right: 60 },
            children: [
              new Paragraph({
                children: [run(`${spec.centerLabel} ${spec.centerSub}`, { bold: true, size: 20 })],
                spacing: { after: 0, line: 240 },
              }),
            ],
          }),
          new TableCell({
            width: { size: Math.round((USABLE_W * 70) / 100), type: WidthType.DXA },
            children: [emptyPara()],
          }),
        ],
      }),
    )
    out.push(chartTable(rows))
  } else {
    // kind === 'area': evolução mensal — barra para horas, chamados no valor.
    const max = Math.max(1, ...spec.points.map((p) => p.hours))
    const rows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: Math.round((USABLE_W * 30) / 100), type: WidthType.DXA },
            margins: { top: 20, bottom: 20, left: 40, right: 60 },
            children: [
              new Paragraph({
                children: [
                  run('■ ', { size: 16, color: BRAND_AMBER }),
                  run(spec.seriesHours, { bold: true, size: 18 }),
                  run('   ', { size: 18 }),
                  run('● ', { size: 16, color: BRAND_DARK }),
                  run(spec.seriesTickets, { bold: true, size: 18 }),
                ],
                spacing: { after: 0, line: 240 },
              }),
            ],
          }),
          new TableCell({
            width: { size: Math.round((USABLE_W * 70) / 100), type: WidthType.DXA },
            children: [emptyPara()],
          }),
        ],
      }),
    ]
    spec.points.forEach((p) => {
      rows.push(
        barRow(
          {
            label: p.label,
            value: p.hours,
            max,
            color: BRAND_AMBER,
            valueText: `${fmtH(p.hours)} · ${Math.round(p.tickets)} chamado(s)`,
          },
          false,
        ),
      )
    })
    out.push(chartTable(rows))
  }

  out.push(chartSource(spec.source))
  return out
}
