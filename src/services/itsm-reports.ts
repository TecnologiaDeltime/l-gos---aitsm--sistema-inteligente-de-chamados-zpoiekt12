import pb from '@/lib/pocketbase/client'
import { getMonthRange } from '@/services/client-hours'

export interface ReportFilterParams {
  filterMode?: 'month' | 'custom'
  monthKey?: string
  startDate?: string
  endDate?: string
  companyId?: string
  operatorId?: string
  branchId?: string
  sectorId?: string
  status?: string
  activityId?: string
}

export interface TicketReportRow {
  ticketId: string
  ticketNumber: string
  companyId: string
  companyName: string
  branchId: string
  branchName: string
  sectorId: string
  sectorName: string
  createdAt: string
  activityId: string
  activityName: string
  title: string
  status: string
  accompanimentSeconds: number
  resolutionDate?: string
  assetName: string
  operatorId: string
  operatorName: string
  solution: string
}

export interface TicketInteractionReportRow {
  interactionId: string
  ticketId: string
  ticketNumber: string
  companyId: string
  companyName: string
  branchId: string
  branchName: string
  sectorId: string
  sectorName: string
  ticketCreatedAt: string
  interactionCreatedAt: string
  activityId: string
  activityName: string
  title: string
  status: string
  durationSeconds: number
  resolutionDate?: string
  assetName: string
  operatorId: string
  operatorName: string
  solution: string
  interactionContent: string
  interactionOrigin: string
  interactionType: string
  hourType: string
}

export interface WorkedHoursReportRow {
  ticketId: string
  ticketNumber: string
  companyId: string
  companyName: string
  branchId: string
  branchName: string
  sectorId: string
  sectorName: string
  createdAt: string
  activityId: string
  activityName: string
  title: string
  status: string
  workedSeconds: number
  cronoInteractionsCount: number
  resolutionDate?: string
  assetName: string
  operatorId: string
  operatorName: string
  solution: string
}

export interface AuxiliaryFilterOptions {
  companies: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string; companyId: string }>
  sectors: Array<{ id: string; name: string; companyId: string }>
  operators: Array<{ id: string; name: string }>
  activities: Array<{ id: string; name: string }>
  statuses: string[]
}

export const TICKET_REPORT_STATUSES = [
  'Novo',
  'Aberto',
  'Pendente',
  'Em Atendimento',
  'Aguardando Solicitante',
  'Aguardando Terceiro',
  'Resolvido',
  'Cancelado',
  'Encerrado',
]

/**
 * Converte segundos em formato HH:MM:SS formatado e legível.
 */
export function formatSecondsToHMS(seconds: number): string {
  const sec = Math.max(0, Math.round(seconds || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/**
 * Carrega opções de preenchimento dos selects de filtro.
 */
export async function getReportFilterOptions(): Promise<AuxiliaryFilterOptions> {
  const [companies, units, depts, users, categories] = await Promise.all([
    pb
      .collection('companies')
      .getFullList({ sort: 'trade_name' })
      .catch(() => []),
    pb
      .collection('company_units')
      .getFullList({ sort: 'name' })
      .catch(() => []),
    pb
      .collection('company_departments')
      .getFullList({ sort: 'name' })
      .catch(() => []),
    pb
      .collection('users')
      .getFullList({ filter: 'role != "cliente"', sort: 'name' })
      .catch(() => []),
    pb
      .collection('tkt_categories')
      .getFullList({ sort: 'name' })
      .catch(() => []),
  ])

  return {
    companies: companies.map((c: any) => ({
      id: c.id,
      name: c.trade_name || c.legal_name || 'Sem nome',
    })),
    branches: units.map((u: any) => ({
      id: u.id,
      name: u.name || 'Filial sem nome',
      companyId: u.company || '',
    })),
    sectors: depts.map((d: any) => ({
      id: d.id,
      name: d.name || 'Setor sem nome',
      companyId: d.company || '',
    })),
    operators: users.map((u: any) => ({
      id: u.id,
      name: u.name || u.email || 'Operador',
    })),
    activities: categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name || 'Atividade',
    })),
    statuses: TICKET_REPORT_STATUSES,
  }
}

function resolveDateRange(filters: ReportFilterParams): { startIso: string; endIso: string } {
  if (filters.filterMode === 'custom' && filters.startDate && filters.endDate) {
    return {
      startIso: `${filters.startDate} 00:00:00.000Z`,
      endIso: `${filters.endDate} 23:59:59.999Z`,
    }
  }

  const range = getMonthRange(filters.monthKey)
  return {
    startIso: `${range.start}.000Z`,
    endIso: `${range.end}.999Z`,
  }
}

/**
 * 1. RELATÓRIO DE CHAMADOS
 * Linha a linha com Ticket, Cliente, Filial, Setor, Data de abertura, Atividade,
 * título, status, Total de Horas de Acompanhamento, Data de Resolução, Ativo, Operador, Solução.
 * Filtros: Cliente, Período, Operador, Filial, Setor, Status, Atividade.
 */
export async function getTicketReport(
  filters: ReportFilterParams,
): Promise<{ rows: TicketReportRow[]; totalAccompanimentSeconds: number }> {
  const { startIso, endIso } = resolveDateRange(filters)

  const filterParts: string[] = [`created >= "${startIso}"`, `created <= "${endIso}"`]

  if (filters.companyId && filters.companyId !== 'all') {
    filterParts.push(`company = "${filters.companyId}"`)
  }
  if (filters.operatorId && filters.operatorId !== 'all') {
    filterParts.push(`assigned_to = "${filters.operatorId}"`)
  }
  if (filters.branchId && filters.branchId !== 'all') {
    filterParts.push(`unit = "${filters.branchId}"`)
  }
  if (filters.sectorId && filters.sectorId !== 'all') {
    filterParts.push(`department = "${filters.sectorId}"`)
  }
  if (filters.status && filters.status !== 'all') {
    filterParts.push(`status = "${filters.status}"`)
  }
  if (filters.activityId && filters.activityId !== 'all') {
    filterParts.push(
      `(category = "${filters.activityId}" || subcategory = "${filters.activityId}")`,
    )
  }

  const tickets = await pb.collection('tickets').getFullList({
    filter: filterParts.join(' && '),
    sort: '-created',
    expand: 'company,unit,department,category,subcategory,equipment,configuration_item,assigned_to',
  })

  let totalAccSeconds = 0

  const rows: TicketReportRow[] = tickets.map((t: any) => {
    const company = t.expand?.company
    const companyName = company?.trade_name || company?.legal_name || '—'

    const unit = t.expand?.unit
    const branchName = unit?.name || '—'

    const dept = t.expand?.department
    const sectorName = dept?.name || '—'

    const subcategory = t.expand?.subcategory
    const category = t.expand?.category
    const activityName = subcategory?.name || category?.name || '—'

    const equipment = t.expand?.equipment
    const ci = t.expand?.configuration_item
    let assetName = '—'
    if (equipment?.name) {
      assetName = equipment.name + (equipment.hostname ? ` (${equipment.hostname})` : '')
    } else if (ci?.name) {
      assetName = ci.name + (ci.type ? ` [${ci.type}]` : '')
    }

    const assigned = t.expand?.assigned_to
    const operatorName = assigned?.name || assigned?.email || 'Não atribuído'

    const accSec = Math.max(0, Math.round(Number(t.accompaniment_seconds) || 0))
    totalAccSeconds += accSec

    return {
      ticketId: t.id,
      ticketNumber: t.number || '—',
      companyId: t.company || '',
      companyName,
      branchId: t.unit || '',
      branchName,
      sectorId: t.department || '',
      sectorName,
      createdAt: t.created,
      activityId: t.subcategory || t.category || '',
      activityName,
      title: t.title || 'Sem título',
      status: t.status || '—',
      accompanimentSeconds: accSec,
      resolutionDate: t.resolution_date || undefined,
      assetName,
      operatorId: t.assigned_to || '',
      operatorName,
      solution: t.solution || '',
    }
  })

  return { rows, totalAccompanimentSeconds: totalAccSeconds }
}

/**
 * 2. RELATÓRIO DE INTERAÇÕES NOS CHAMADOS (LOGS DE ACOMPANHAMENTO)
 * Linha a linha com todas as interações de log lançadas (origin != 'Cronômetro'),
 * permitindo controlar cada tempo lançado dentro de cada log.
 * Mesmos campos do chamado + campos da interação.
 * Filtros: Cliente, Período, Operador, Filial, Setor, Status, Atividade.
 */
export async function getTicketInteractionsReport(
  filters: ReportFilterParams,
): Promise<{ rows: TicketInteractionReportRow[]; totalInteractionSeconds: number }> {
  const { startIso, endIso } = resolveDateRange(filters)

  // Filtra as interações no período pela data da interação (created) e origin != Cronômetro
  const filterParts: string[] = [
    `created >= "${startIso}"`,
    `created <= "${endIso}"`,
    `origin != "Cronômetro"`,
  ]

  if (filters.operatorId && filters.operatorId !== 'all') {
    filterParts.push(`author = "${filters.operatorId}"`)
  }

  const interactions = await pb.collection('ticket_interactions').getFullList({
    filter: filterParts.join(' && '),
    sort: '-created',
    expand:
      'author,ticket,ticket.company,ticket.unit,ticket.department,ticket.category,ticket.subcategory,ticket.equipment,ticket.configuration_item,ticket.assigned_to',
  })

  let totalSec = 0
  const rows: TicketInteractionReportRow[] = []

  for (const it of interactions as any[]) {
    const ticket = it.expand?.ticket
    if (!ticket) continue

    // Filtros de chamado adicionais (aplicados em memória para dados expandidos)
    if (filters.companyId && filters.companyId !== 'all' && ticket.company !== filters.companyId) {
      continue
    }
    if (filters.branchId && filters.branchId !== 'all' && ticket.unit !== filters.branchId) {
      continue
    }
    if (filters.sectorId && filters.sectorId !== 'all' && ticket.department !== filters.sectorId) {
      continue
    }
    if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) {
      continue
    }
    if (filters.activityId && filters.activityId !== 'all') {
      const matchAct =
        ticket.category === filters.activityId || ticket.subcategory === filters.activityId
      if (!matchAct) continue
    }

    const company = ticket.expand?.company
    const companyName = company?.trade_name || company?.legal_name || '—'

    const unit = ticket.expand?.unit
    const branchName = unit?.name || '—'

    const dept = ticket.expand?.department
    const sectorName = dept?.name || '—'

    const subcategory = ticket.expand?.subcategory
    const category = ticket.expand?.category
    const activityName = subcategory?.name || category?.name || '—'

    const equipment = ticket.expand?.equipment
    const ci = ticket.expand?.configuration_item
    let assetName = '—'
    if (equipment?.name) {
      assetName = equipment.name + (equipment.hostname ? ` (${equipment.hostname})` : '')
    } else if (ci?.name) {
      assetName = ci.name + (ci.type ? ` [${ci.type}]` : '')
    }

    // Operador da interação (autor do log) ou operador atribuído ao chamado
    const author = it.expand?.author
    const assigned = ticket.expand?.assigned_to
    const operatorName =
      author?.name || author?.email || assigned?.name || assigned?.email || 'Operador'
    const operatorId = it.author || ticket.assigned_to || ''

    const durationMin = Number(it.duration_minutes) || 0
    const durationSeconds = Math.round(durationMin * 60)
    totalSec += durationSeconds

    rows.push({
      interactionId: it.id,
      ticketId: ticket.id,
      ticketNumber: ticket.number || '—',
      companyId: ticket.company || '',
      companyName,
      branchId: ticket.unit || '',
      branchName,
      sectorId: ticket.department || '',
      sectorName,
      ticketCreatedAt: ticket.created,
      interactionCreatedAt: it.created,
      activityId: ticket.subcategory || ticket.category || '',
      activityName,
      title: ticket.title || 'Sem título',
      status: ticket.status || '—',
      durationSeconds,
      resolutionDate: ticket.resolution_date || undefined,
      assetName,
      operatorId,
      operatorName,
      solution: ticket.solution || '',
      interactionContent: it.content || '',
      interactionOrigin: it.origin || 'Manual',
      interactionType: it.type || 'Público',
      hourType: it.hour_type || '—',
    })
  }

  return { rows, totalInteractionSeconds: totalSec }
}

/**
 * 3. RELATÓRIO DE INTERAÇÕES HORAS TRABALHADAS (PLAY/PAUSE)
 * Linha a linha por chamado mostrando o Total de Horas Trabalhadas
 * (acumulado de play/pause, origin = 'Cronômetro' ou tickets.operator_worked_seconds).
 * Filtros: Cliente, Período, Operador, Filial, Setor, Status, Atividade.
 */
export async function getWorkedHoursReport(
  filters: ReportFilterParams,
): Promise<{ rows: WorkedHoursReportRow[]; totalWorkedSeconds: number }> {
  const { startIso, endIso } = resolveDateRange(filters)

  // 1. Busca interações de cronômetro no período
  const cronoFilterParts: string[] = [
    `created >= "${startIso}"`,
    `created <= "${endIso}"`,
    `origin = "Cronômetro"`,
  ]

  if (filters.operatorId && filters.operatorId !== 'all') {
    cronoFilterParts.push(`author = "${filters.operatorId}"`)
  }

  const cronoInteractions = await pb.collection('ticket_interactions').getFullList({
    filter: cronoFilterParts.join(' && '),
    sort: '-created',
    expand:
      'author,ticket,ticket.company,ticket.unit,ticket.department,ticket.category,ticket.subcategory,ticket.equipment,ticket.configuration_item,ticket.assigned_to',
  })

  // Agrupa segundos de cronômetro por ticketId no período selecionado
  const ticketCronoMap = new Map<
    string,
    {
      workedSeconds: number
      count: number
      ticketRecord: any
      operatorsSet: Set<string>
    }
  >()

  for (const it of cronoInteractions as any[]) {
    const ticket = it.expand?.ticket
    if (!ticket) continue

    const durationMin = Number(it.duration_minutes) || 0
    const sec = Math.round(durationMin * 60)

    let entry = ticketCronoMap.get(ticket.id)
    if (!entry) {
      entry = {
        workedSeconds: 0,
        count: 0,
        ticketRecord: ticket,
        operatorsSet: new Set<string>(),
      }
      ticketCronoMap.set(ticket.id, entry)
    }

    entry.workedSeconds += sec
    entry.count += 1
    const authorName = it.expand?.author?.name || it.expand?.author?.email
    if (authorName) entry.operatorsSet.add(authorName)
  }

  // Se nenhum cronômetro bateu no período, também busca chamados abertos no período que possuem operator_worked_seconds > 0
  // garantindo compatibilidade com chamados onde o timer foi registrado diretamente
  const ticketFilterParts: string[] = [
    `created >= "${startIso}"`,
    `created <= "${endIso}"`,
    `operator_worked_seconds > 0`,
  ]

  if (filters.companyId && filters.companyId !== 'all') {
    ticketFilterParts.push(`company = "${filters.companyId}"`)
  }
  if (filters.operatorId && filters.operatorId !== 'all') {
    ticketFilterParts.push(`assigned_to = "${filters.operatorId}"`)
  }
  if (filters.branchId && filters.branchId !== 'all') {
    ticketFilterParts.push(`unit = "${filters.branchId}"`)
  }
  if (filters.sectorId && filters.sectorId !== 'all') {
    ticketFilterParts.push(`department = "${filters.sectorId}"`)
  }
  if (filters.status && filters.status !== 'all') {
    ticketFilterParts.push(`status = "${filters.status}"`)
  }
  if (filters.activityId && filters.activityId !== 'all') {
    ticketFilterParts.push(
      `(category = "${filters.activityId}" || subcategory = "${filters.activityId}")`,
    )
  }

  const directTickets = await pb.collection('tickets').getFullList({
    filter: ticketFilterParts.join(' && '),
    sort: '-created',
    expand: 'company,unit,department,category,subcategory,equipment,configuration_item,assigned_to',
  })

  for (const t of directTickets as any[]) {
    if (!ticketCronoMap.has(t.id)) {
      ticketCronoMap.set(t.id, {
        workedSeconds: Math.round(Number(t.operator_worked_seconds) || 0),
        count: 1,
        ticketRecord: t,
        operatorsSet: new Set<string>(
          t.expand?.assigned_to?.name ? [t.expand?.assigned_to?.name] : [],
        ),
      })
    }
  }

  let totalWorkedSeconds = 0
  const rows: WorkedHoursReportRow[] = []

  for (const [ticketId, data] of ticketCronoMap.entries()) {
    const ticket = data.ticketRecord

    // Aplicar filtros de chamado adicionais
    if (filters.companyId && filters.companyId !== 'all' && ticket.company !== filters.companyId) {
      continue
    }
    if (filters.branchId && filters.branchId !== 'all' && ticket.unit !== filters.branchId) {
      continue
    }
    if (filters.sectorId && filters.sectorId !== 'all' && ticket.department !== filters.sectorId) {
      continue
    }
    if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) {
      continue
    }
    if (filters.activityId && filters.activityId !== 'all') {
      const matchAct =
        ticket.category === filters.activityId || ticket.subcategory === filters.activityId
      if (!matchAct) continue
    }
    if (
      filters.operatorId &&
      filters.operatorId !== 'all' &&
      ticket.assigned_to !== filters.operatorId
    ) {
      // Se filtramos por operador específico e o ticket não é dele nem ele foi autor dos cronômetros
      const isAuthor = Array.from(data.operatorsSet).some(() => true)
      if (!isAuthor && ticket.assigned_to !== filters.operatorId) continue
    }

    const company = ticket.expand?.company
    const companyName = company?.trade_name || company?.legal_name || '—'

    const unit = ticket.expand?.unit
    const branchName = unit?.name || '—'

    const dept = ticket.expand?.department
    const sectorName = dept?.name || '—'

    const subcategory = ticket.expand?.subcategory
    const category = ticket.expand?.category
    const activityName = subcategory?.name || category?.name || '—'

    const equipment = ticket.expand?.equipment
    const ci = ticket.expand?.configuration_item
    let assetName = '—'
    if (equipment?.name) {
      assetName = equipment.name + (equipment.hostname ? ` (${equipment.hostname})` : '')
    } else if (ci?.name) {
      assetName = ci.name + (ci.type ? ` [${ci.type}]` : '')
    }

    const assigned = ticket.expand?.assigned_to
    const opNames = Array.from(data.operatorsSet).join(', ')
    const operatorName = opNames || assigned?.name || assigned?.email || 'Não atribuído'

    totalWorkedSeconds += data.workedSeconds

    rows.push({
      ticketId,
      ticketNumber: ticket.number || '—',
      companyId: ticket.company || '',
      companyName,
      branchId: ticket.unit || '',
      branchName,
      sectorId: ticket.department || '',
      sectorName,
      createdAt: ticket.created,
      activityId: ticket.subcategory || ticket.category || '',
      activityName,
      title: ticket.title || 'Sem título',
      status: ticket.status || '—',
      workedSeconds: data.workedSeconds,
      cronoInteractionsCount: data.count,
      resolutionDate: ticket.resolution_date || undefined,
      assetName,
      operatorId: ticket.assigned_to || '',
      operatorName,
      solution: ticket.solution || '',
    })
  }

  // Ordenar por maior volume de horas trabalhadas
  rows.sort((a, b) => b.workedSeconds - a.workedSeconds)

  return { rows, totalWorkedSeconds }
}
