/**
 * Documento TEXTUAL (ABNT) do Relatório Mensal do Cliente — sem gráficos.
 *
 * Gera o DOM completo do relatório em texto bem redigido e tabelas ABNT,
 * com cálculos/percentuais/tendências escritos, a partir do mesmo
 * MonthlyClientReportData exibido na tela e liberado ao Portal do Cliente
 * (fidelidade garantida: mesma fonte de dados, mesmas seções e números).
 *
 * Consumido por src/lib/export-monthly-client-pdf.ts, que captura BLOCO a
 * BLOCO (cada .abnt-avoid-break / .abnt-paragraph) e pagina em A4 — como
 * agora só existem texto e tabelas, nenhum bloco é cortado no meio.
 */

import { formatHours } from '@/lib/duration'

/* ------------------------------------------------------------------ */
/* Helpers de formatação                                              */
/* ------------------------------------------------------------------ */

type AnyRec = Record<string, any>

const nf = (v: any, digits = 1): string => {
  const n = Number(v)
  if (!isFinite(n)) return '0'
  return n.toFixed(digits).replace('.', ',')
}

/** Percentual "parte/total" já em formato pt-BR com vírgula. */
const pctOf = (part: any, total: any): string => {
  const t = Number(total)
  if (!isFinite(t) || t <= 0) return '0,0'
  return nf((Number(part) / t) * 100)
}

const qty = (v: any): number => {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

const hrs = (v: any): string => formatHours(qty(v))

const fmtSignedHours = (v: number): string =>
  v < 0 ? `−${formatHours(Math.abs(v))}` : formatHours(v)

const mean = (arr: number[]): number =>
  arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

/* ------------------------------------------------------------------ */
/* Helpers de DOM                                                     */
/* ------------------------------------------------------------------ */

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined && text !== null) node.textContent = text
  return node
}

function para(text: string): HTMLElement {
  return el('p', 'abnt-paragraph', text)
}

function section(title: string, intro: string): HTMLElement {
  const sec = el('section', 'abnt-section')
  const head = el('div', 'abnt-avoid-break')
  head.appendChild(el('h3', 'abnt-section-title', title))
  head.appendChild(para(intro))
  sec.appendChild(head)
  return sec
}

/**
 * Tabela ABNT com legenda acima e fonte abaixo. Quebrada em partes de até
 * `chunkSize` linhas para nunca exceder a página útil (nenhum corte).
 */
function tableBlocks(
  caption: string,
  headers: string[],
  rows: string[][],
  source: string,
  chunkSize = 16,
): HTMLElement[] {
  const blocks: HTMLElement[] = []
  if (rows.length === 0) return blocks
  const chunks = Math.max(1, Math.ceil(rows.length / chunkSize))
  for (let c = 0; c < chunks; c++) {
    const part = rows.slice(c * chunkSize, (c + 1) * chunkSize)
    const wrap = el('div', 'abnt-avoid-break')
    wrap.appendChild(
      el(
        'p',
        'abnt-caption-top',
        chunks > 1 ? `${caption} — parte ${c + 1} de ${chunks}` : caption,
      ),
    )
    const table = el('table', 'abnt-table')
    const thead = el('thead', '')
    const trh = el('tr', '')
    headers.forEach((h) => trh.appendChild(el('th', '', h)))
    thead.appendChild(trh)
    table.appendChild(thead)
    const tbody = el('tbody', '')
    part.forEach((r) => {
      const tr = el('tr', '')
      r.forEach((cell) => tr.appendChild(el('td', '', cell)))
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    wrap.appendChild(table)
    wrap.appendChild(el('p', 'abnt-source-bottom', source))
    blocks.push(wrap)
  }
  return blocks
}

function emptyNote(text: string): HTMLElement {
  const wrap = el('div', 'abnt-avoid-break')
  wrap.appendChild(el('p', 'abnt-caption-top', text))
  return wrap
}

/* ------------------------------------------------------------------ */
/* Estilos do documento gerado (fonte serif, justificado, tabelas)    */
/* ------------------------------------------------------------------ */

const DOC_STYLE = `
.mpx-root {
  position: fixed; left: -30000px; top: 0; width: 1000px;
  background: #ffffff; color: #111827;
  font-family: 'Times New Roman', Times, serif;
  font-size: 13px; line-height: 1.55;
}
.mpx-root, .mpx-root * { box-sizing: border-box; color: #111827; }
.mpx-root .abnt-section-title {
  font-size: 16px; font-weight: 700; text-transform: uppercase;
  margin: 0 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px;
}
.mpx-root .abnt-paragraph {
  text-align: justify; text-indent: 40px; margin: 0 0 10px; font-size: 13px;
}
.mpx-root .abnt-caption-top { font-size: 11px; font-weight: 700; margin: 12px 0 4px; }
.mpx-root .abnt-source-bottom { font-size: 10px; font-style: italic; margin: 4px 0 14px; color: #444; }
.mpx-root table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 2px; }
.mpx-root th, .mpx-root td { border: 1px solid #555; padding: 4px 6px; text-align: left; vertical-align: top; }
.mpx-root th { background: #f1f5f9; font-weight: 700; }
.mpx-root .abnt-cover { padding: 110px 40px 60px; text-align: center; }
.mpx-root .abnt-cover-header { font-size: 15px; font-weight: 700; text-transform: uppercase; }
.mpx-root .abnt-cover-title { font-size: 20px; font-weight: 700; text-transform: uppercase; margin: 46px 0 10px; }
.mpx-root .abnt-cover-subtitle { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
.mpx-root .abnt-cover-sub { font-size: 13px; color: #333; margin-bottom: 4px; }
.mpx-root .abnt-cover-footer { font-size: 12px; margin-top: 60px; color: #333; }
`

/* ------------------------------------------------------------------ */
/* Montagem do documento                                              */
/* ------------------------------------------------------------------ */

interface ReportLike {
  periodLabel?: string
  company?: AnyRec
  contract?: AnyRec | null
  totalContractedHours?: number
  totalUsedHours?: number
  totalBalanceHours?: number
  totalUtilizationPercent?: number
  agreements?: AnyRec[]
  sectors?: AnyRec[]
  requesters?: AnyRec[]
  activities?: AnyRec[]
  study?: AnyRec
  assets?: AnyRec
  comparison?: AnyRec
}

export function buildMonthlyClientTextDom(reportData: unknown, monthKey: string): HTMLElement {
  const d = (reportData || {}) as ReportLike
  const period = d.periodLabel || monthKey
  const companyName = d.company?.trade_name || d.company?.legal_name || 'Cliente'

  const container = document.createElement('div')
  container.className = 'mpx-root'

  const styleNode = document.createElement('style')
  styleNode.textContent = DOC_STYLE
  container.appendChild(styleNode)

  /* ---------------- CAPA ---------------- */
  const cover = el('div', 'abnt-cover abnt-avoid-break')
  cover.appendChild(el('p', 'abnt-cover-header', 'ITSM DESK — GOVERNANÇA E OPERAÇÃO TÉCNICA'))
  cover.appendChild(el('p', 'abnt-cover-title', 'RELATÓRIO MENSAL DE ATENDIMENTO TÉCNICO'))
  cover.appendChild(el('p', 'abnt-cover-subtitle', companyName))
  cover.appendChild(el('p', 'abnt-cover-sub', `Período de referência: ${period}`))
  if (d.contract?.number) {
    cover.appendChild(
      el('p', 'abnt-cover-sub', `Contrato de Prestação de Serviços: nº ${d.contract.number}`),
    )
  }
  cover.appendChild(
    el(
      'p',
      'abnt-cover-footer',
      `${d.company?.address_city || 'São Paulo'} — ${d.company?.address_state || 'SP'}`,
    ),
  )
  container.appendChild(cover)

  /* ---------------- SEÇÃO 1: HORAS POR ACORDO ---------------- */
  const agreements = d.agreements || []
  const totC = qty(d.totalContractedHours)
  const totU = qty(d.totalUsedHours)
  const totB = qty(d.totalBalanceHours)
  const totP = qty(d.totalUtilizationPercent)

  const sec1 = section(
    '1. Horas por Acordo de Atendimento',
    'Esta seção compara as horas contratadas na distribuição formal do acordo de atendimento ' +
      '(Nível 1, Nível 2, Nível 3, Consultoria, Backoffice, Administrativo e acordos ' +
      'personalizados) com as horas efetivamente utilizadas pela equipe técnica no mês de ' +
      `${period}. O percentual de utilização de cada nível é obtido pela divisão das horas ` +
      'utilizadas pelas horas contratadas, multiplicada por cem.',
  )
  container.appendChild(sec1)

  if (agreements.length === 0 && totC === 0 && totU === 0) {
    sec1.appendChild(
      emptyNote('Não foram registradas horas contratadas nem horas utilizadas no período.'),
    )
  } else {
    sec1.appendChild(
      para(
        `No período de referência (${period}), a franquia total contratada foi de ` +
          `${formatHours(totC)} e o consumo apurado foi de ${formatHours(totU)}, o que ` +
          `corresponde a ${nf(totP)}% da franquia contratada ` +
          `(${formatHours(totU)} ÷ ${formatHours(totC)} × 100). O saldo contratual do mês é de ` +
          `${fmtSignedHours(totB)}${totB < 0 ? ', indicando consumo excedente à franquia' : ', disponível para as demandas do período'}.`,
      ),
    )
    const detail = agreements
      .map(
        (ag) =>
          `${ag.name}: contratado ${hrs(ag.contractedHours)}, utilizado ${hrs(ag.usedHours)} ` +
          `(${qty(ag.contractedHours) > 0 ? nf(qty(ag.percentUsed)) + '%' : 'sem franquia definida'} do nível), ` +
          `saldo ${fmtSignedHours(qty(ag.balanceHours))}`,
      )
      .join('; ')
    if (detail) {
      sec1.appendChild(
        para(`O detalhamento por acordo/nível de atendimento é o seguinte: ${detail}.`),
      )
    }
    const over = agreements
      .filter((ag) => qty(ag.contractedHours) > 0 && qty(ag.percentUsed) > 80)
      .sort((a, b) => qty(b.percentUsed) - qty(a.percentUsed))
    if (over.length > 0) {
      sec1.appendChild(
        para(
          `Destacaram-se por consumo mais elevado da franquia: ` +
            over
              .map((ag) => `${ag.name} (${nf(qty(ag.percentUsed))}% da franquia consumida)`)
              .join(', ') +
            '. Recomenda-se monitoramento próximo desses níveis para evitar consumo excedente no próximo ciclo.',
        ),
      )
    }
    tableBlocks(
      'Quadro 1 – Demonstrativo analítico de consumo e saldos por nível de atendimento',
      ['Acordo / Nível', 'Contratado', 'Utilizado', 'Saldo', '% Utilização'],
      [
        ...agreements.map((ag) => [
          String(ag.name ?? ''),
          hrs(ag.contractedHours),
          hrs(ag.usedHours),
          fmtSignedHours(qty(ag.balanceHours)),
          qty(ag.contractedHours) > 0 ? `${nf(qty(ag.percentUsed))}%` : '—',
        ]),
        [
          'TOTAL CONSOLIDADO',
          formatHours(totC),
          formatHours(totU),
          fmtSignedHours(totB),
          totC > 0 ? `${nf(totP)}%` : '—',
        ],
      ],
      'Fonte: Módulo de Contratos e Gestão de Tempo do Lógos AITSM.',
    ).forEach((b) => sec1.appendChild(b))
  }

  /* ---------------- SEÇÃO 2: SETORES ---------------- */
  const sectors = (d.sectors || []).filter((s) => qty(s.usedHours) > 0 || qty(s.ticketCount) > 0)
  const sec2 = section(
    '2. Horas Utilizadas por Setor',
    'Esta seção demonstra a distribuição da carga de suporte técnico entre as diferentes áreas ' +
      'e departamentos da organização no período apurado, identificando os setores com maior ' +
      'consumo de esforço técnico e volume de chamados.',
  )
  container.appendChild(sec2)
  if (sectors.length === 0) {
    sec2.appendChild(
      emptyNote(
        'Não foram registrados chamados vinculados a setores específicos no mês selecionado.',
      ),
    )
  } else {
    const totalH = sectors.reduce((acc, s) => acc + qty(s.usedHours), 0)
    const totalT = sectors.reduce((acc, s) => acc + qty(s.ticketCount), 0)
    sec2.appendChild(
      para(
        `A carga de suporte do período distribuiu-se entre os departamentos da seguinte forma: ` +
          sectors
            .map(
              (s) =>
                `${s.name} (${qty(s.ticketCount)} chamado(s); ${hrs(s.usedHours)}; ` +
                `${nf(qty(s.percentTotal))}% do esforço total)`,
            )
            .join('; ') +
          '.',
      ),
    )
    const sorted = [...sectors].sort((a, b) => qty(b.usedHours) - qty(a.usedHours))
    const top3 = sorted.slice(0, 3)
    const top3Pct = top3.reduce((acc, s) => acc + qty(s.percentTotal), 0)
    sec2.appendChild(
      para(
        `O maior ponto de concentração de esforço técnico foi o setor ${sorted[0]?.name ?? '—'}, ` +
          `com ${hrs(sorted[0]?.usedHours)} (${nf(qty(sorted[0]?.percentTotal))}% do total). Os três ` +
          `departamentos mais demandados concentram ${nf(top3Pct)}% do esforço técnico do mês, ` +
          `em um total apurado de ${formatHours(totalH)} e ${totalT} chamado(s) setoriais.`,
      ),
    )
    tableBlocks(
      'Quadro 2 – Detalhamento de demandas e horas por departamento',
      ['Departamento / Setor', 'Nº de Chamados', 'Horas Utilizadas', '% do Total'],
      sectors.map((s) => [
        String(s.name ?? ''),
        String(qty(s.ticketCount)),
        hrs(s.usedHours),
        `${nf(qty(s.percentTotal))}%`,
      ]),
      'Fonte: Apuração por centro de custo/departamento — Lógos AITSM.',
    ).forEach((b) => sec2.appendChild(b))
  }

  /* ---------------- SEÇÃO 3: SOLICITANTES ---------------- */
  const requesters = d.requesters || []
  const sec3 = section(
    '3. Horas Utilizadas por Usuário Solicitante',
    'Esta seção identifica os colaboradores que mais demandaram suporte no mês, permitindo ' +
      'avaliar necessidades de capacitação individual, substituição de equipamentos com ' +
      'incidentes recorrentes ou apoio a projetos específicos.',
  )
  container.appendChild(sec3)
  if (requesters.length === 0) {
    sec3.appendChild(emptyNote('Sem registros de solicitantes no mês selecionado.'))
  } else {
    sec3.appendChild(
      para(
        `O ranking dos principais solicitantes de suporte no período é: ` +
          requesters
            .slice(0, 6)
            .map(
              (r, i) =>
                `${i + 1}º) ${r.name} — ${qty(r.ticketCount)} chamado(s), ${hrs(r.usedHours)} ` +
                `(${nf(qty(r.percentTotal))}% do total de horas)`,
            )
            .join('; ') +
          '.',
      ),
    )
    tableBlocks(
      'Quadro 3 – Consolidação de horas e chamados por colaborador solicitante',
      ['Solicitante', 'Setor', 'E-mail', 'Chamados', 'Horas', '% do Total'],
      requesters
        .slice(0, 15)
        .map((r) => [
          String(r.name ?? ''),
          String(r.sectorName ?? '—'),
          String(r.email ?? '—'),
          String(qty(r.ticketCount)),
          hrs(r.usedHours),
          `${nf(qty(r.percentTotal))}%`,
        ]),
      'Fonte: Registros de abertura de chamados e apontamentos técnicos (Lógos AITSM).',
    ).forEach((b) => sec3.appendChild(b))
  }

  /* ---------------- SEÇÃO 4: ATIVIDADES ---------------- */
  const activities = d.activities || []
  const sec4 = section(
    '4. Atividades Mais Requisitadas no Mês',
    'Esta seção mapeia os tipos de serviços e incidentes mais frequentes do catálogo de ' +
      'atividades de TIC, classificando o volume de aberturas e o tempo dedicado à resolução ' +
      'de cada natureza de demanda técnica.',
  )
  container.appendChild(sec4)
  if (activities.length === 0) {
    sec4.appendChild(emptyNote('Sem registros de atividades catalogadas para o período.'))
  } else {
    sec4.appendChild(
      para(
        `As atividades mais requisitadas no período foram: ` +
          activities
            .slice(0, 8)
            .map(
              (a) =>
                `${a.name} (${a.categoryName ?? '—'}): ${qty(a.ticketCount)} chamado(s), ` +
                `${hrs(a.usedHours)}, ${nf(qty(a.percentTotal))}% do volume`,
            )
            .join('; ') +
          '.',
      ),
    )
    tableBlocks(
      'Quadro 4 – Detalhamento das atividades demandadas e tempo consumido',
      ['Atividade / Subcategoria', 'Categoria Macro', 'Chamados', 'Horas Dedicadas', '% do Volume'],
      activities.map((a) => [
        String(a.name ?? ''),
        String(a.categoryName ?? '—'),
        String(qty(a.ticketCount)),
        hrs(a.usedHours),
        `${nf(qty(a.percentTotal))}%`,
      ]),
      'Fonte: Catálogo de Atividades e Categorias do ITSM (Lógos AITSM).',
    ).forEach((b) => sec4.appendChild(b))
  }

  /* ---------------- SEÇÃO 5: ESTUDO / DIAGNÓSTICO ---------------- */
  const study = d.study || {}
  const sec5 = section(
    '5. Estudo e Diagnóstico: Onde Mais se Requer Atendimento Técnico',
    'Esta seção consolida a análise técnica do período, apontando os pontos de concentração ' +
      'de demanda e as recomendações de melhoria contínua do serviço.',
  )
  container.appendChild(sec5)
  const analysisText = String(study.analysisText ?? '').trim()
  if (analysisText) {
    analysisText
      .split(/\n{1,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => sec5.appendChild(para(t)))
  }
  const avgTicket =
    study.avgTicketHours !== undefined && study.avgTicketHours !== null
      ? qty(study.avgTicketHours)
      : qty(study.totalTickets) > 0
        ? totU / qty(study.totalTickets)
        : 0
  sec5.appendChild(
    para(
      `Síntese indicativa do período: o maior ponto de concentração de esforço técnico foi o ` +
        `setor ${study.topSector?.name ?? '—'}, com ${hrs(study.topSector?.hours)} ` +
        `(${nf(qty(study.topSector?.pct))}% do esforço total). O principal solicitante foi ` +
        `${study.topRequester?.name ?? '—'}, com ${qty(study.topRequester?.ticketCount)} chamado(s) e ` +
        `${hrs(study.topRequester?.hours)} consumidas. O nível de atendimento mais acionado foi ` +
        `${study.topAgreement?.name ?? '—'}, com ${hrs(study.topAgreement?.hours)}. A média de horas ` +
        `por chamado foi de ${formatHours(avgTicket)}, obtida pela divisão das ${formatHours(totU)} ` +
        `utilizadas pelos ${qty(study.totalTickets)} chamado(s) registrado(s) no mês.`,
    ),
  )
  const recommendations: string[] = Array.isArray(study.recommendations)
    ? study.recommendations.map((r: any) => String(r)).filter((r: string) => r.trim())
    : []
  if (recommendations.length > 0) {
    const recHead = el('div', 'abnt-avoid-break')
    recHead.appendChild(
      el(
        'h4',
        'abnt-section-title abnt-rec-title',
        '5.1. Recomendações Técnicas e Plano de Melhoria',
      ),
    )
    sec5.appendChild(recHead)
    recommendations.forEach((rec, i) => {
      sec5.appendChild(para(`Recomendação ${i + 1} — ${rec}`))
    })
  }

  /* ---------------- SEÇÃO 6: ATIVOS ---------------- */
  const assets = d.assets || {}
  const entered = qty(assets.enteredCount)
  const exited = qty(assets.exitedCount)
  const active = qty(assets.activeCount)
  const totalScope = qty(assets.totalInScope)
  const delta = entered - exited
  const sec6 = section(
    '6. Movimentação de Ativos no Período (Entradas e Saídas)',
    'Esta seção registra o fluxo de equipamentos computacionais (desktops, notebooks, tablets ' +
      'e celulares) integrados ao parque da empresa e os desativados, descartados ou ' +
      'encaminhados para manutenção durante o período de referência.',
  )
  container.appendChild(sec6)
  sec6.appendChild(
    para(
      `No período (${period}) foram registradas ${entered} entrada(s) de ativos e ${exited} ` +
        `saída(s) (baixas, descartes ou manutenção), resultando em variação líquida de ` +
        `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} ativo(s) — cálculo: ${entered} entradas − ` +
        `${exited} saídas. O parque em operação no cliente totaliza ${active} ativo(s), sobre uma ` +
        `base histórica de ${totalScope} ativo(s) cadastrado(s) no CMDB.`,
    ),
  )
  const byType: AnyRec[] = Array.isArray(assets.byType) ? assets.byType : []
  if (byType.length > 0) {
    sec6.appendChild(
      para(
        `A composição do parque de ativos por categoria é a seguinte: ` +
          byType
            .map(
              (t) =>
                `${t.type}: ${qty(t.total)} ativo(s) no total, sendo ${qty(t.entered)} entrada(s) e ` +
                `${qty(t.exited)} saída(s) no mês`,
            )
            .join('; ') +
          '.',
      ),
    )
  }
  const enteredList: AnyRec[] = Array.isArray(assets.enteredList) ? assets.enteredList : []
  const exitedList: AnyRec[] = Array.isArray(assets.exitedList) ? assets.exitedList : []
  if (enteredList.length === 0) {
    sec6.appendChild(emptyNote(`Nenhum novo ativo cadastrado ou incorporado no mês de ${period}.`))
  } else {
    tableBlocks(
      'Quadro 5 – Lista de ativos com entrada registrada no mês',
      ['Identificação', 'Tipo', 'Marca / Modelo', 'Responsável', 'Status', 'Data de Entrada'],
      enteredList.map((eq) => [
        String(eq.name ?? ''),
        String(eq.device_type ?? ''),
        `${eq.manufacturer ?? ''} ${eq.model && eq.model !== '—' ? eq.model : ''}`.trim(),
        String(eq.responsible_user ?? ''),
        String(eq.status ?? ''),
        String(eq.date ?? ''),
      ]),
      'Fonte: CMDB Lógos AITSM.',
    ).forEach((b) => sec6.appendChild(b))
  }
  if (exitedList.length > 0) {
    tableBlocks(
      'Quadro 6 – Lista de ativos desativados, descartados ou em manutenção no mês',
      ['Identificação', 'Tipo', 'Marca / Modelo', 'Último Responsável', 'Status', 'Data'],
      exitedList.map((eq) => [
        String(eq.name ?? ''),
        String(eq.device_type ?? ''),
        `${eq.manufacturer ?? ''} ${eq.model && eq.model !== '—' ? eq.model : ''}`.trim(),
        String(eq.responsible_user ?? ''),
        String(eq.status ?? ''),
        String(eq.date ?? ''),
      ]),
      'Fonte: CMDB Lógos AITSM.',
    ).forEach((b) => sec6.appendChild(b))
  }

  /* ---------------- SEÇÃO 7: COMPARATIVO 6 MESES ---------------- */
  const comparison = d.comparison || {}
  const items: AnyRec[] = Array.isArray(comparison.items) ? comparison.items : []
  const sec7 = section(
    '7. Comparativo com Meses Anteriores',
    'Esta seção apresenta a análise evolutiva do consumo de horas técnicas e do fluxo de ' +
      'abertura e resolução de chamados ao longo dos últimos seis meses, permitindo ' +
      'diagnosticar a tendência de demanda, a estabilidade das operações e os períodos de ' +
      'pico técnico da organização.',
  )
  container.appendChild(sec7)
  const summaryText = String(comparison.summaryText ?? '').trim()
  if (summaryText) {
    summaryText
      .split(/\n{1,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => sec7.appendChild(para(t)))
  }
  if (!comparison.hasData || items.length === 0) {
    sec7.appendChild(emptyNote('Sem dados de consumo nos últimos 6 meses para este cliente.'))
  } else {
    const series = items.map(
      (it) =>
        `${it.label}: ${qty(it.chamadosAbertos)} chamado(s) aberto(s), ` +
        `${qty(it.chamadosResolvidos)} resolvido(s), ${hrs(it.horasUtilizadasDecimal)} utilizadas`,
    )
    sec7.appendChild(para(`A série histórica dos últimos meses é: ${series.join('; ')}.`))
    const withPrev = items.map((it, i) => {
      const h = qty(it.horasUtilizadasDecimal)
      if (i === 0) return null
      const prev = qty(items[i - 1].horasUtilizadasDecimal)
      if (prev <= 0) return null
      return { label: it.label, varPct: ((h - prev) / prev) * 100 }
    })
    const varParts = withPrev
      .filter(Boolean)
      .map(
        (v) =>
          `${v!.label} apresentou variação de ${v!.varPct >= 0 ? '+' : '−'}${nf(Math.abs(v!.varPct))}% ` +
          `em relação ao mês anterior`,
      )
    if (varParts.length > 0) {
      sec7.appendChild(para(`${varParts.join('; ')}.`))
    }
    const peak = items.reduce(
      (best, it) => (qty(it.horasUtilizadasDecimal) > qty(best.horasUtilizadasDecimal) ? it : best),
      items[0],
    )
    const peakOpen = items.reduce(
      (best, it) => (qty(it.chamadosAbertos) > qty(best.chamadosAbertos) ? it : best),
      items[0],
    )
    const avgHours = mean(items.map((it) => qty(it.horasUtilizadasDecimal)))
    const half = Math.ceil(items.length / 2)
    const firstHalf = mean(items.slice(0, half).map((it) => qty(it.horasUtilizadasDecimal)))
    const lastHalf = mean(items.slice(-half).map((it) => qty(it.horasUtilizadasDecimal)))
    const trendPct = firstHalf > 0 ? ((lastHalf - firstHalf) / firstHalf) * 100 : 0
    const trendLabel =
      trendPct > 5
        ? `tendência de alta de ${nf(trendPct)}%`
        : trendPct < -5
          ? `tendência de queda de ${nf(Math.abs(trendPct))}%`
          : 'tendência estável (variação inferior a 5%)'
    sec7.appendChild(
      para(
        `No recorte de ${items.length} meses, o pico de consumo ocorreu em ${peak.label}, com ` +
          `${hrs(peak.horasUtilizadasDecimal)}; o maior volume de aberturas ocorreu em ` +
          `${peakOpen.label}, com ${qty(peakOpen.chamadosAbertos)} chamado(s). A média mensal de ` +
          `horas utilizadas foi de ${formatHours(avgHours)} (soma das horas do período ÷ ` +
          `${items.length} meses). Comparando a média da primeira metade da série ` +
          `(${formatHours(firstHalf)}) com a da segunda metade (${formatHours(lastHalf)}), o ` +
          `comportamento indica ${trendLabel} no consumo de horas técnicas.`,
      ),
    )
    tableBlocks(
      'Quadro 7 – Evolução mensal de chamados e horas nos últimos 6 meses',
      ['Mês', 'Chamados Abertos', 'Chamados Resolvidos', 'Horas Utilizadas'],
      items.map((it) => [
        String(it.label ?? '') + (it.isReferenceMonth ? ' (mês de referência)' : ''),
        String(qty(it.chamadosAbertos)),
        String(qty(it.chamadosResolvidos)),
        hrs(it.horasUtilizadasDecimal),
      ]),
      'Fonte: Histórico de chamados e apontamentos do Lógos AITSM.',
    ).forEach((b) => sec7.appendChild(b))
  }

  return container
}
