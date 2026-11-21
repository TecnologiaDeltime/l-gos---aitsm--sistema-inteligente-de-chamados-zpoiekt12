/**
 * Modelo "rico" do Relatório Mensal do Cliente — fonte única para o PDF
 * vetorial (cards de KPI + especificações de gráficos) e para o DOCX
 * (cards de KPI como tabelas destacadas).
 *
 * Derivado DIRETAMENTE de MonthlyClientReportData (mesma fonte de dados da
 * tela e do portal), garantindo zero divergência de números entre PDF, DOCX
 * e visualização.
 */

import { formatHours } from '@/lib/duration'

type AnyRec = Record<string, any>

const qty = (v: any): number => (isFinite(Number(v)) ? Number(v) : 0)

const nf = (v: any, digits = 1): string => {
  const n = Number(v)
  return isFinite(n) ? n.toFixed(digits).replace('.', ',') : '0'
}

export interface MonthlyKpiCard {
  label: string
  value: string
  sub: string
}

/** Cards do Resumo Executivo (franquia, consumo, saldo, chamados do mês). */
export function buildMonthlyKpiCards(reportData: unknown): MonthlyKpiCard[] {
  const d = (reportData || {}) as AnyRec
  const totC = qty(d.totalContractedHours)
  const totU = qty(d.totalUsedHours)
  const totB = qty(d.totalBalanceHours)
  const totP = qty(d.totalUtilizationPercent)
  if (totC === 0 && totU === 0) return []

  const cards: MonthlyKpiCard[] = [
    { label: 'FRANQUIA CONTRATADA', value: formatHours(totC), sub: 'horas do contrato no mês' },
    {
      label: 'HORAS UTILIZADAS',
      value: formatHours(totU),
      sub: totC > 0 ? `${nf(totP)}% da franquia` : 'consumo apurado',
    },
    {
      label: 'SALDO CONTRATUAL',
      value: `${totB < 0 ? '−' : ''}${formatHours(Math.abs(totB))}`,
      sub: totB < 0 ? 'consumo excedente à franquia' : 'disponível no mês',
    },
  ]

  const comparison = (d.comparison || {}) as AnyRec
  const items: AnyRec[] = Array.isArray(comparison.items) ? comparison.items : []
  const ref = items.find((i) => i.isReferenceMonth) || items[items.length - 1]
  if (ref) {
    cards.push({
      label: 'CHAMADOS NO MÊS',
      value: String(qty(ref.chamadosAbertos)),
      sub: `${qty(ref.chamadosResolvidos)} resolvido(s) no período`,
    })
  }
  return cards
}

/* ------------------------------------------------------------------ */
/* Especificações de gráficos (consumidas pelo PDF vetorial)           */
/* ------------------------------------------------------------------ */

export type MonthlyChartSpec =
  | {
      kind: 'bars'
      caption: string
      source: string
      seriesA: string
      seriesB: string
      categories: { label: string; a: number; b: number }[]
    }
  | {
      kind: 'hbars'
      caption: string
      source: string
      valueLabel: string
      items: { label: string; value: number }[]
    }
  | {
      kind: 'donut'
      caption: string
      source: string
      centerLabel: string
      centerSub: string
      items: { label: string; value: number }[]
    }
  | {
      kind: 'area'
      caption: string
      source: string
      seriesHours: string
      seriesTickets: string
      points: { label: string; hours: number; tickets: number }[]
    }

/** Gráficos indexados pelo número da seção ("1.", "2.", ...). */
export function buildMonthlyChartSpecs(reportData: unknown): Record<number, MonthlyChartSpec> {
  const d = (reportData || {}) as AnyRec
  const out: Record<number, MonthlyChartSpec> = {}

  // 1 — Contratado × Utilizado por acordo
  const agreements: AnyRec[] = d.agreements || []
  if (agreements.length > 0) {
    out[1] = {
      kind: 'bars',
      caption: 'Figura 1 – Contratado × Utilizado por acordo de atendimento',
      source: 'Fonte: Módulo de Contratos e Gestão de Tempo do Lógos AITSM.',
      seriesA: 'Contratado',
      seriesB: 'Utilizado',
      categories: agreements.map((a) => ({
        label: String(a.name ?? ''),
        a: qty(a.contractedHours),
        b: qty(a.usedHours),
      })),
    }
  }

  // 2 — Horas por setor
  const sectors: AnyRec[] = (d.sectors || [])
    .filter((s) => qty(s.usedHours) > 0)
    .sort((a, b) => qty(b.usedHours) - qty(a.usedHours))
    .slice(0, 8)
  if (sectors.length > 0) {
    out[2] = {
      kind: 'hbars',
      caption: 'Figura 2 – Horas técnicas consumidas por setor/departamento',
      source: 'Fonte: Apuração por centro de custo/departamento — Lógos AITSM.',
      valueLabel: 'horas',
      items: sectors.map((s) => ({ label: String(s.name ?? ''), value: qty(s.usedHours) })),
    }
  }

  // 3 — Horas por solicitante
  const requesters: AnyRec[] = (d.requesters || [])
    .filter((r) => qty(r.usedHours) > 0)
    .sort((a, b) => qty(b.usedHours) - qty(a.usedHours))
    .slice(0, 6)
  if (requesters.length > 0) {
    out[3] = {
      kind: 'hbars',
      caption: 'Figura 3 – Principais solicitantes por horas consumidas',
      source: 'Fonte: Registros de abertura de chamados e apontamentos técnicos (Lógos AITSM).',
      valueLabel: 'horas',
      items: requesters.map((r) => ({ label: String(r.name ?? ''), value: qty(r.usedHours) })),
    }
  }

  // 4 — Atividades mais requisitadas
  const activities: AnyRec[] = (d.activities || [])
    .filter((a) => qty(a.usedHours) > 0 || qty(a.ticketCount) > 0)
    .sort((a, b) => qty(b.usedHours) - qty(a.usedHours))
    .slice(0, 6)
  if (activities.length > 0) {
    out[4] = {
      kind: 'hbars',
      caption: 'Figura 4 – Atividades mais requisitadas por horas dedicadas',
      source: 'Fonte: Catálogo de Atividades e Categorias do ITSM (Lógos AITSM).',
      valueLabel: 'horas',
      items: activities.map((a) => ({ label: String(a.name ?? ''), value: qty(a.usedHours) })),
    }
  }

  // 6 — Movimentação de ativos (donut)
  const assets = (d.assets || {}) as AnyRec
  const active = qty(assets.activeCount)
  const donutItems = [
    { label: 'Entradas no mês', value: qty(assets.enteredCount) },
    { label: 'Saídas / baixas', value: qty(assets.exitedCount) },
    {
      label: 'Em operação (sem movimentação)',
      value: Math.max(0, active - qty(assets.enteredCount)),
    },
  ].filter((i) => i.value > 0)
  if (donutItems.length > 0) {
    out[6] = {
      kind: 'donut',
      caption: 'Figura 5 – Composição do parque de ativos no período',
      source: 'Fonte: CMDB Lógos AITSM.',
      centerLabel: String(active),
      centerSub: 'ativos em operação',
      items: donutItems,
    }
  }

  // 7 — Evolução 6 meses (área + linha)
  const comparison = (d.comparison || {}) as AnyRec
  const cmpItems: AnyRec[] = Array.isArray(comparison.items) ? comparison.items : []
  if (comparison.hasData && cmpItems.length > 1) {
    out[7] = {
      kind: 'area',
      caption: 'Figura 6 – Evolução de horas e chamados nos últimos 6 meses',
      source: 'Fonte: Histórico de chamados e apontamentos do Lógos AITSM.',
      seriesHours: 'Horas utilizadas',
      seriesTickets: 'Chamados abertos',
      points: cmpItems.map((it) => ({
        label: String(it.label ?? '').slice(0, 6),
        hours: qty(it.horasUtilizadasDecimal),
        tickets: qty(it.chamadosAbertos),
      })),
    }
  }

  return out
}
