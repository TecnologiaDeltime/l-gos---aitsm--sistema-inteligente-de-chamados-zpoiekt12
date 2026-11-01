import pb from '@/lib/pocketbase/client'
import { TicketRecord } from '@/services/tickets'

export interface PortalSectorConsumption {
  sectorId: string
  sectorName: string
  hours: number
  ticketCount: number
  percent: number
}

export interface PortalMonthlyHoursHistory {
  monthKey: string
  label: string
  contractedHours: number
  consumedHours: number
  balanceHours: number
  percentUsed: number
  ticketsOpened: number
  ticketsClosed: number
}

export interface PortalTopActivity {
  id: string
  name: string
  categoryName: string
  ticketCount: number
  hours: number
}

export interface PortalTopRequester {
  name: string
  email: string
  sectorName: string
  ticketCount: number
  hours: number
}

export interface PortalDashboardMetrics {
  totalTicketsOpened: number
  totalTicketsClosed: number
  totalTicketsPending: number
  resolutionRate: number
  currentMonthConsumedHours: number
  currentMonthContractedHours: number
  currentMonthBalanceHours: number
  sectors: PortalSectorConsumption[]
  last3Months: PortalMonthlyHoursHistory[]
  top10Activities: PortalTopActivity[]
  top10Requesters: PortalTopRequester[]
}

const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

/**
 * Busca todas as métricas analíticas requeridas para o Dashboard do Portal do Cliente
 * amarradas estritamente à empresa do cliente (ou empresa no Modo Suporte).
 */
export async function getClientPortalDashboardMetrics(
  companyId: string,
  targetMonth?: number,
  targetYear?: number,
): Promise<PortalDashboardMetrics> {
  if (!companyId) {
    return {
      totalTicketsOpened: 0,
      totalTicketsClosed: 0,
      totalTicketsPending: 0,
      resolutionRate: 0,
      currentMonthConsumedHours: 0,
      currentMonthContractedHours: 0,
      currentMonthBalanceHours: 0,
      sectors: [],
      last3Months: [],
      top10Activities: [],
      top10Requesters: [],
    }
  }

  const now = new Date()
  const selectedYear = targetYear || now.getFullYear()
  const selectedMonth = targetMonth || now.getMonth() + 1 // 1..12

  // Período selecionado (Início e Fim do mês filtrado)
  const filterMonthStartIso = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0).toISOString()
  const filterMonthEndIso = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString()

  // Calcula os últimos 3 meses terminando no mês filtrado
  const months3: {
    month: number
    year: number
    monthKey: string
    label: string
    startIso: string
    endIso: string
  }[] = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date(selectedYear, selectedMonth - 1 - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const mKey = `${y}-${String(m).padStart(2, '0')}`
    const label = `${MONTH_NAMES_SHORT[m - 1]}/${y}`
    const startIso = new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString()
    const endIso = new Date(y, m, 0, 23, 59, 59, 999).toISOString()
    months3.push({ month: m, year: y, monthKey: mKey, label, startIso, endIso })
  }

  const oldestStartIso = months3[0].startIso
  const newestEndIso = months3[months3.length - 1].endIso

  // 1. Busca chamados da empresa, departamentos, categorias e contratos em paralelo
  const [tickets, depts, categories, contracts, contractPeriods] = await Promise.all([
    pb
      .collection('tickets')
      .getFullList<TicketRecord>({
        filter: `company = "${companyId}"`,
        sort: '-created',
        expand: 'department,category,subcategory',
      })
      .catch(() => [] as TicketRecord[]),
    pb
      .collection('company_departments')
      .getFullList({
        filter: `company = "${companyId}"`,
      })
      .catch(() => [] as any[]),
    pb
      .collection('tkt_categories')
      .getFullList({ sort: 'name' })
      .catch(() => [] as any[]),
    pb
      .collection('contracts')
      .getFullList({
        filter: `company = "${companyId}" && status = "Ativo"`,
        sort: '-created',
      })
      .catch(() => [] as any[]),
    pb
      .collection('contract_periods')
      .getFullList({
        filter: `contract.company = "${companyId}"`,
        sort: '-created',
      })
      .catch(() => [] as any[]),
  ])

  // Mapas de apoio
  const deptMap = new Map<string, string>()
  depts.forEach((d) => deptMap.set(d.id, d.name))

  const catMap = new Map<string, any>()
  categories.forEach((c) => catMap.set(c.id, c))

  const ticketMap = new Map<string, TicketRecord>()
  tickets.forEach((t) => ticketMap.set(t.id, t))

  // 2. Busca interações com minutos lançados nos últimos 3 meses (e todas da empresa para totalizadores)
  let interactions: any[] = []
  try {
    interactions = await pb.collection('ticket_interactions').getFullList({
      filter: `ticket.company = "${companyId}" && created >= "${oldestStartIso}" && created <= "${newestEndIso}"`,
      fields: 'ticket,duration_minutes,hour_type,billing_status,created',
    })
  } catch (err) {
    console.warn('Erro ao carregar interações do portal:', err)
  }

  // Horas contratadas mensais padrão
  const monthlyContractedDefault = Number(contracts[0]?.monthly_hours || 0)

  // 3. Chamados e Totais para o período filtrado (se criados no período do mês filtrado)
  const ticketsInPeriod = tickets.filter((t) => {
    const c = t.created || ''
    return c >= filterMonthStartIso && c <= filterMonthEndIso
  })

  // Se houver chamados no período, calcula os KPIs do período;
  // Se não houver chamados criados no período, exibe 0 para o mês filtrado com precisão analítica.
  const totalOpened = ticketsInPeriod.length
  const totalClosed = ticketsInPeriod.filter(
    (t) => t.status === 'Resolvido' || t.status === 'Fechado' || t.status === 'Encerrado',
  ).length
  const totalPending = totalOpened - totalClosed
  const resolutionRate = totalOpened > 0 ? Math.round((totalClosed / totalOpened) * 100) : 0

  // 4. Consumo por mês nos últimos 3 meses
  const last3Months: PortalMonthlyHoursHistory[] = months3.map((mObj) => {
    // Acha período contratual se houver
    const pMatch = contractPeriods.find((p: any) => {
      if (!p.period_start) return false
      const pd = new Date(p.period_start)
      return pd.getUTCFullYear() === mObj.year && pd.getUTCMonth() + 1 === mObj.month
    })
    const contracted = pMatch ? Number(pMatch.contracted_hours || 0) : monthlyContractedDefault

    // Interações desse mês
    const monthInters = interactions.filter((i) => {
      const c = i.created || ''
      if (c < mObj.startIso || c > mObj.endIso) return false
      if (
        i.billing_status === 'Não Faturável' ||
        i.hour_type === 'Não Faturável' ||
        i.hour_type === 'Cortesia'
      ) {
        return false
      }
      return true
    })

    const consumedMin = monthInters.reduce(
      (acc, curr) => acc + (Number(curr.duration_minutes) || 0),
      0,
    )
    const consumed = Math.round((consumedMin / 60) * 10) / 10
    const balance = Math.round((contracted - consumed) * 10) / 10
    const pct = contracted > 0 ? Math.round((consumed / contracted) * 100) : 0

    // Chamados abertos no mês
    const openedInMonth = tickets.filter((t) => {
      const c = t.created || ''
      return c >= mObj.startIso && c <= mObj.endIso
    }).length

    // Chamados fechados/resolvidos no mês
    const closedInMonth = tickets.filter((t) => {
      const isClosed =
        t.status === 'Resolvido' || t.status === 'Fechado' || t.status === 'Encerrado'
      if (!isClosed) return false
      const resDate = t.resolution_date || t.closure_date || t.updated || ''
      if (resDate >= mObj.startIso && resDate <= mObj.endIso) return true
      // fallback: se criado no mês e status é fechado
      return (t.created || '') >= mObj.startIso && (t.created || '') <= mObj.endIso
    }).length

    return {
      monthKey: mObj.monthKey,
      label: mObj.label,
      contractedHours: contracted,
      consumedHours: consumed,
      balanceHours: balance,
      percentUsed: pct,
      ticketsOpened: openedInMonth,
      ticketsClosed: closedInMonth,
    }
  })

  // Mês corrente é o último de last3Months
  const currentMonthData = last3Months[last3Months.length - 1]

  // 5. Utilização/consumo da franquia POR SETOR no mês selecionado
  // Filtra interações do mês selecionado
  const selectedMonthInters = interactions.filter((i) => {
    const c = i.created || ''
    return c >= filterMonthStartIso && c <= filterMonthEndIso
  })

  const sectorMap = new Map<string, { name: string; minutes: number; ticketIds: Set<string> }>()

  selectedMonthInters.forEach((inter) => {
    if (
      inter.billing_status === 'Não Faturável' ||
      inter.hour_type === 'Não Faturável' ||
      inter.hour_type === 'Cortesia'
    ) {
      return
    }
    const minutes = Number(inter.duration_minutes) || 0
    if (minutes <= 0) return

    const ticket = ticketMap.get(inter.ticket)
    const deptId = ticket?.department || 'sem_setor'
    const deptName = ticket?.department
      ? deptMap.get(ticket.department) ||
        (ticket.expand?.department as any)?.name ||
        'Setor não identificado'
      : 'Sem setor definido'

    const existing = sectorMap.get(deptId) || {
      name: deptName,
      minutes: 0,
      ticketIds: new Set<string>(),
    }
    existing.minutes += minutes
    if (ticket?.id) existing.ticketIds.add(ticket.id)
    sectorMap.set(deptId, existing)
  })

  // Adiciona chamados do período ao mapa de setores
  ticketsInPeriod.forEach((t) => {
    const deptId = t.department || 'sem_setor'
    const deptName = t.department
      ? deptMap.get(t.department) || (t.expand?.department as any)?.name || 'Setor não identificado'
      : 'Sem setor definido'
    const existing = sectorMap.get(deptId) || {
      name: deptName,
      minutes: 0,
      ticketIds: new Set<string>(),
    }
    existing.ticketIds.add(t.id)
    sectorMap.set(deptId, existing)
  })

  const totalSectorMinutes = Array.from(sectorMap.values()).reduce((s, v) => s + v.minutes, 0)
  const sectors: PortalSectorConsumption[] = Array.from(sectorMap.entries())
    .map(([id, val]) => {
      const hours = Math.round((val.minutes / 60) * 10) / 10
      const pct =
        totalSectorMinutes > 0
          ? Math.round((val.minutes / totalSectorMinutes) * 100)
          : val.ticketIds.size > 0 && tickets.length > 0
            ? Math.round((val.ticketIds.size / tickets.length) * 100)
            : 0

      return {
        sectorId: id,
        sectorName: val.name,
        hours,
        ticketCount: val.ticketIds.size,
        percent: pct,
      }
    })
    .sort((a, b) => b.hours - a.hours || b.ticketCount - a.ticketCount)

  // 6. Top 10 de atividades mais requisitadas no período
  const activityMap = new Map<
    string,
    { id: string; name: string; categoryName: string; tickets: Set<string>; minutes: number }
  >()

  const relevantTickets = ticketsInPeriod.length > 0 ? ticketsInPeriod : tickets
  relevantTickets.forEach((t) => {
    const subCat = t.subcategory ? catMap.get(t.subcategory) : null
    const mainCat = t.category ? catMap.get(t.category) : null
    const actId = subCat?.id || mainCat?.id || 'geral'
    const actName = subCat?.name || mainCat?.name || t.service || 'Suporte Geral'
    const catName = mainCat?.name || (subCat ? 'Subatividade' : 'Diversos')

    const act = activityMap.get(actId) || {
      id: actId,
      name: actName,
      categoryName: catName,
      tickets: new Set<string>(),
      minutes: 0,
    }
    act.tickets.add(t.id)
    activityMap.set(actId, act)
  })

  // Adiciona minutos lançados às atividades (das interações do período selecionado)
  const relevantInters = selectedMonthInters.length > 0 ? selectedMonthInters : interactions
  relevantInters.forEach((inter) => {
    const t = ticketMap.get(inter.ticket)
    if (!t) return
    const subCat = t.subcategory ? catMap.get(t.subcategory) : null
    const mainCat = t.category ? catMap.get(t.category) : null
    const actId = subCat?.id || mainCat?.id || 'geral'
    const act = activityMap.get(actId)
    if (act) {
      act.minutes += Number(inter.duration_minutes) || 0
    }
  })

  const top10Activities: PortalTopActivity[] = Array.from(activityMap.values())
    .map((val) => ({
      id: val.id,
      name: val.name,
      categoryName: val.categoryName,
      ticketCount: val.tickets.size,
      hours: Math.round((val.minutes / 60) * 10) / 10,
    }))
    .sort((a, b) => b.ticketCount - a.ticketCount || b.hours - a.hours)
    .slice(0, 10)

  // 7. Top 10 de colaboradores (solicitantes) que mais solicitaram no período
  const requesterMap = new Map<
    string,
    { name: string; email: string; sectorName: string; tickets: Set<string>; minutes: number }
  >()

  relevantTickets.forEach((t) => {
    const name =
      t.requester_name?.trim() || t.requester_email?.trim() || 'Colaborador não identificado'
    const email = t.requester_email?.trim() || ''
    const key = (email || name).toLowerCase()
    const deptName = t.department
      ? deptMap.get(t.department) || (t.expand?.department as any)?.name || 'Sem setor'
      : 'Sem setor'

    const req = requesterMap.get(key) || {
      name,
      email,
      sectorName: deptName,
      tickets: new Set<string>(),
      minutes: 0,
    }
    req.tickets.add(t.id)
    requesterMap.set(key, req)
  })

  relevantInters.forEach((inter) => {
    const t = ticketMap.get(inter.ticket)
    if (!t) return
    const name =
      t.requester_name?.trim() || t.requester_email?.trim() || 'Colaborador não identificado'
    const email = t.requester_email?.trim() || ''
    const key = (email || name).toLowerCase()
    const req = requesterMap.get(key)
    if (req) {
      req.minutes += Number(inter.duration_minutes) || 0
    }
  })

  const top10Requesters: PortalTopRequester[] = Array.from(requesterMap.values())
    .map((val) => ({
      name: val.name,
      email: val.email,
      sectorName: val.sectorName,
      ticketCount: val.tickets.size,
      hours: Math.round((val.minutes / 60) * 10) / 10,
    }))
    .sort((a, b) => b.ticketCount - a.ticketCount || b.hours - a.hours)
    .slice(0, 10)

  return {
    totalTicketsOpened: totalOpened,
    totalTicketsClosed: totalClosed,
    totalTicketsPending: totalPending,
    resolutionRate,
    currentMonthConsumedHours: currentMonthData?.consumedHours || 0,
    currentMonthContractedHours: currentMonthData?.contractedHours || 0,
    currentMonthBalanceHours: currentMonthData?.balanceHours || 0,
    sectors,
    last3Months,
    top10Activities,
    top10Requesters,
  }
}
