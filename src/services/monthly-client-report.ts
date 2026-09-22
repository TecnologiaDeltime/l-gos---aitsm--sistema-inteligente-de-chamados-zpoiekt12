import pb from '@/lib/pocketbase/client'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getContracts, type ContractRecord, CONTRACT_HOURS_LEVELS } from '@/services/contracts'
import { getCategories, type CategoryRecord } from '@/services/categories'
import { getQueues, type QueueRecord } from '@/services/queues'
import { getMonthRange } from '@/services/client-hours'

export interface AgreementUsageItem {
  key: string
  name: string
  contractedHours: number
  usedHours: number
  balanceHours: number
  percentUsed: number
}

export interface SectorUsageItem {
  id: string
  name: string
  ticketCount: number
  usedHours: number
  percentTotal: number
}

export interface RequesterUsageItem {
  name: string
  email: string
  sectorName: string
  ticketCount: number
  usedHours: number
  percentTotal: number
}

export interface ActivityDemandItem {
  id: string
  name: string
  categoryName: string
  ticketCount: number
  usedHours: number
  percentTotal: number
}

export interface TechnicalStudyData {
  topSector?: { name: string; hours: number; ticketCount: number; pct: number }
  topRequester?: { name: string; hours: number; ticketCount: number; pct: number }
  topAgreement?: { name: string; hours: number; pct: number }
  topActivity?: { name: string; ticketCount: number; hours: number }
  totalHoursUsed: number
  totalTickets: number
  avgTicketHours: number
  analysisText: string
  recommendations: string[]
}

export interface AssetMovementSummary {
  enteredCount: number
  exitedCount: number
  activeCount: number
  totalInScope: number
  enteredList: {
    id: string
    name: string
    device_type: string
    manufacturer: string
    model: string
    responsible_user: string
    status: string
    date: string
  }[]
  exitedList: {
    id: string
    name: string
    device_type: string
    manufacturer: string
    model: string
    responsible_user: string
    status: string
    date: string
  }[]
  byType: { type: string; total: number; entered: number; exited: number }[]
}

export interface MonthlyClientReportData {
  company: CompanyRecord
  monthKey: string
  periodLabel: string
  contract: ContractRecord | null
  totalContractedHours: number
  totalUsedHours: number
  totalBalanceHours: number
  totalUtilizationPercent: number
  agreements: AgreementUsageItem[]
  sectors: SectorUsageItem[]
  requesters: RequesterUsageItem[]
  activities: ActivityDemandItem[]
  study: TechnicalStudyData
  assets: AssetMovementSummary
}

export async function fetchMonthlyClientReportData(
  companyId: string,
  monthKey: string,
): Promise<MonthlyClientReportData> {
  const { start, end } = getMonthRange(monthKey)

  // 1. Busca empresa, contratos, categorias, filas e departamentos
  const [companies, contracts, categories, queues, depts] = await Promise.all([
    getCompanies(),
    getContracts(`company = "${companyId}"`).catch(() => [] as ContractRecord[]),
    getCategories().catch(() => [] as CategoryRecord[]),
    getQueues().catch(() => [] as QueueRecord[]),
    pb
      .collection('company_departments')
      .getFullList({
        filter: `company = "${companyId}"`,
      })
      .catch(() => [] as any[]),
  ])

  const company = companies.find((c) => c.id === companyId)
  if (!company) {
    throw new Error('Empresa não encontrada.')
  }

  // Contrato ativo preferencial
  const activeContract =
    contracts.find((c) => (c.status || '').toLowerCase() === 'ativo') || contracts[0] || null

  // 2. Busca chamados da empresa
  // Traz tickets relacionados à empresa (podem ter sido criados ou atendidos no período)
  const tickets = await pb
    .collection('tickets')
    .getFullList({
      filter: `company = "${companyId}"`,
      sort: '-created',
      expand: 'department,category,subcategory,queue',
    })
    .catch(() => [] as any[])

  const ticketIds = tickets.map((t) => t.id)
  const ticketMap = new Map<string, any>()
  tickets.forEach((t) => ticketMap.set(t.id, t))

  // 3. Busca interações com horas no período selecionado
  const allInteractions: any[] = []
  if (ticketIds.length > 0) {
    const batchSize = 50
    for (let i = 0; i < ticketIds.length; i += batchSize) {
      const batch = ticketIds.slice(i, i + batchSize)
      const ticketFilter = batch.map((id) => `ticket = "${id}"`).join(' || ')
      const inters = await pb
        .collection('ticket_interactions')
        .getFullList({
          filter: `(${ticketFilter}) && created >= "${start}" && created <= "${end}"`,
          sort: 'created',
        })
        .catch(() => [] as any[])
      allInteractions.push(...inters)
    }
  }

  // Mapeamentos auxiliares
  const deptMap = new Map<string, string>()
  depts.forEach((d) => deptMap.set(d.id, d.name))

  const catMap = new Map<string, CategoryRecord>()
  categories.forEach((c) => catMap.set(c.id, c))

  const queueMap = new Map<string, QueueRecord>()
  queues.forEach((q) => queueMap.set(q.id, q))

  // Agrupamentos de horas
  // SEÇÃO 1: Acordo de Atendimento (Nível)
  // Mapeamento de fila -> nível do contrato
  // e mapeamento direto de acordos configurados no contrato
  const agreementHoursUsed = new Map<string, number>()
  const sectorHoursUsed = new Map<string, { name: string; hours: number; ticketIds: Set<string> }>()
  const requesterHoursUsed = new Map<
    string,
    { name: string; email: string; sectorName: string; hours: number; ticketIds: Set<string> }
  >()
  const activityHoursUsed = new Map<
    string,
    { id: string; name: string; categoryName: string; hours: number; ticketIds: Set<string> }
  >()

  let totalUsedMinutes = 0

  allInteractions.forEach((inter) => {
    const minutes = Number(inter.duration_minutes) || 0
    if (minutes <= 0) return
    totalUsedMinutes += minutes

    const ticket = ticketMap.get(inter.ticket)
    const queue = ticket?.queue ? queueMap.get(ticket.queue) : null

    // Nível de acordo do ticket
    let agreementKey = 'outros'
    if (queue?.level) {
      const lvl = queue.level.trim()
      if (lvl === 'Nível 1') agreementKey = 'hours_level1'
      else if (lvl === 'Nível 2') agreementKey = 'hours_level2'
      else if (lvl === 'Nível 3') agreementKey = 'hours_level3'
      else if (lvl === 'Consultoria') agreementKey = 'hours_consultoria'
      else if (lvl === 'Backoffice') agreementKey = 'hours_backoffice'
      else if (lvl === 'Administrativo') agreementKey = 'hours_administrativo'
      else agreementKey = `custom_${lvl.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    }
    agreementHoursUsed.set(agreementKey, (agreementHoursUsed.get(agreementKey) || 0) + minutes)

    // Setor
    const deptId = ticket?.department || 'sem_setor'
    const deptName = ticket?.department
      ? deptMap.get(ticket.department) ||
        ticket.expand?.department?.name ||
        'Setor não identificado'
      : 'Sem setor definido'
    const secObj = sectorHoursUsed.get(deptId) || {
      name: deptName,
      hours: 0,
      ticketIds: new Set<string>(),
    }
    secObj.hours += minutes
    if (ticket?.id) secObj.ticketIds.add(ticket.id)
    sectorHoursUsed.set(deptId, secObj)

    // Solicitante
    const reqEmail = ticket?.requester_email || ''
    const reqName = ticket?.requester_name || 'Solicitante não identificado'
    const reqKey = reqEmail ? reqEmail.toLowerCase() : reqName.toLowerCase()
    const reqObj = requesterHoursUsed.get(reqKey) || {
      name: reqName,
      email: reqEmail,
      sectorName: deptName,
      hours: 0,
      ticketIds: new Set<string>(),
    }
    reqObj.hours += minutes
    if (ticket?.id) reqObj.ticketIds.add(ticket.id)
    requesterHoursUsed.set(reqKey, reqObj)

    // Atividade (subcategoria ou categoria do ticket)
    const subCat = ticket?.subcategory ? catMap.get(ticket.subcategory) : null
    const mainCat = ticket?.category ? catMap.get(ticket.category) : null
    const actId = subCat?.id || mainCat?.id || 'outras'
    const actName = subCat?.name || mainCat?.name || ticket?.service || 'Geral / Outros'
    const catName = mainCat?.name || (subCat ? 'Subatividade' : 'Diversos')
    const actObj = activityHoursUsed.get(actId) || {
      id: actId,
      name: actName,
      categoryName: catName,
      hours: 0,
      ticketIds: new Set<string>(),
    }
    actObj.hours += minutes
    if (ticket?.id) actObj.ticketIds.add(ticket.id)
    activityHoursUsed.set(actId, actObj)
  })

  // Se não houver interações com minutos lançados mas houver tickets criados no período,
  // contabiliza contagem de tickets para atividades, setores e solicitantes
  const ticketsInPeriod = tickets.filter((t) => {
    const c = t.created || ''
    return c >= start && c <= end
  })

  if (allInteractions.length === 0 && ticketsInPeriod.length > 0) {
    ticketsInPeriod.forEach((ticket) => {
      // Setor
      const deptId = ticket.department || 'sem_setor'
      const deptName = ticket.department
        ? deptMap.get(ticket.department) ||
          ticket.expand?.department?.name ||
          'Setor não identificado'
        : 'Sem setor definido'
      const secObj = sectorHoursUsed.get(deptId) || {
        name: deptName,
        hours: 0,
        ticketIds: new Set<string>(),
      }
      secObj.ticketIds.add(ticket.id)
      sectorHoursUsed.set(deptId, secObj)

      // Solicitante
      const reqEmail = ticket.requester_email || ''
      const reqName = ticket.requester_name || 'Solicitante não identificado'
      const reqKey = reqEmail ? reqEmail.toLowerCase() : reqName.toLowerCase()
      const reqObj = requesterHoursUsed.get(reqKey) || {
        name: reqName,
        email: reqEmail,
        sectorName: deptName,
        hours: 0,
        ticketIds: new Set<string>(),
      }
      reqObj.ticketIds.add(ticket.id)
      requesterHoursUsed.set(reqKey, reqObj)

      // Atividade
      const subCat = ticket.subcategory ? catMap.get(ticket.subcategory) : null
      const mainCat = ticket.category ? catMap.get(ticket.category) : null
      const actId = subCat?.id || mainCat?.id || 'outras'
      const actName = subCat?.name || mainCat?.name || ticket.service || 'Geral / Outros'
      const catName = mainCat?.name || (subCat ? 'Subatividade' : 'Diversos')
      const actObj = activityHoursUsed.get(actId) || {
        id: actId,
        name: actName,
        categoryName: catName,
        hours: 0,
        ticketIds: new Set<string>(),
      }
      actObj.ticketIds.add(ticket.id)
      activityHoursUsed.set(actId, actObj)
    })
  }

  // Monta tabela de acordos de atendimento
  const agreements: AgreementUsageItem[] = []
  let totalContractedHours = 0

  if (activeContract) {
    CONTRACT_HOURS_LEVELS.forEach((level) => {
      // Verifica se o nível não foi removido pelo usuário
      const isRemoved =
        Array.isArray(activeContract.removed_levels) &&
        activeContract.removed_levels.includes(level.key)
      if (isRemoved) return

      const contracted = Number((activeContract as any)[level.key]) || 0
      const usedMin = agreementHoursUsed.get(level.key) || 0
      const usedHours = Math.round((usedMin / 60) * 100) / 100
      const balance = Math.round((contracted - usedHours) * 100) / 100
      const pct = contracted > 0 ? Math.round((usedHours / contracted) * 1000) / 10 : 0

      totalContractedHours += contracted
      agreements.push({
        key: level.key,
        name: level.label,
        contractedHours: contracted,
        usedHours,
        balanceHours: balance,
        percentUsed: pct,
      })
    })

    // Custom agreements
    if (Array.isArray(activeContract.custom_agreements)) {
      activeContract.custom_agreements.forEach((ca) => {
        if (!ca || !ca.active) return
        const contracted = Number(ca.hours) || 0
        const cKey = `custom_${(ca.name || ca.slug).toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        const usedMin = agreementHoursUsed.get(cKey) || agreementHoursUsed.get(ca.slug) || 0
        const usedHours = Math.round((usedMin / 60) * 100) / 100
        const balance = Math.round((contracted - usedHours) * 100) / 100
        const pct = contracted > 0 ? Math.round((usedHours / contracted) * 1000) / 10 : 0

        totalContractedHours += contracted
        agreements.push({
          key: ca.slug,
          name: ca.name || ca.slug,
          contractedHours: contracted,
          usedHours,
          balanceHours: balance,
          percentUsed: pct,
        })
      })
    }
  } else {
    // Sem contrato, lista os níveis padrão com 0 contratado
    CONTRACT_HOURS_LEVELS.forEach((level) => {
      const usedMin = agreementHoursUsed.get(level.key) || 0
      const usedHours = Math.round((usedMin / 60) * 100) / 100
      agreements.push({
        key: level.key,
        name: level.label,
        contractedHours: 0,
        usedHours,
        balanceHours: -usedHours,
        percentUsed: 0,
      })
    })
  }

  // Se o total contratado deu 0 mas monthly_hours está preenchido, usa monthly_hours como contratado geral
  if (totalContractedHours === 0 && activeContract?.monthly_hours) {
    totalContractedHours = Number(activeContract.monthly_hours) || 0
  }

  const totalUsedHours = Math.round((totalUsedMinutes / 60) * 100) / 100
  const totalBalanceHours = Math.round((totalContractedHours - totalUsedHours) * 100) / 100
  const totalUtilizationPercent =
    totalContractedHours > 0 ? Math.round((totalUsedHours / totalContractedHours) * 1000) / 10 : 0

  // Seções agrupadas
  // 1. Setores
  const sectors: SectorUsageItem[] = Array.from(sectorHoursUsed.entries())
    .map(([id, val]) => {
      const usedHours = Math.round((val.hours / 60) * 100) / 100
      const pct = totalUsedHours > 0 ? Math.round((usedHours / totalUsedHours) * 1000) / 10 : 0
      return {
        id,
        name: val.name,
        ticketCount: val.ticketIds.size,
        usedHours,
        percentTotal: pct,
      }
    })
    .sort((a, b) => b.usedHours - a.usedHours || b.ticketCount - a.ticketCount)

  // 2. Solicitantes
  const requesters: RequesterUsageItem[] = Array.from(requesterHoursUsed.values())
    .map((val) => {
      const usedHours = Math.round((val.hours / 60) * 100) / 100
      const pct = totalUsedHours > 0 ? Math.round((usedHours / totalUsedHours) * 1000) / 10 : 0
      return {
        name: val.name,
        email: val.email,
        sectorName: val.sectorName,
        ticketCount: val.ticketIds.size,
        usedHours,
        percentTotal: pct,
      }
    })
    .sort((a, b) => b.usedHours - a.usedHours || b.ticketCount - a.ticketCount)

  // 3. Atividades
  const activities: ActivityDemandItem[] = Array.from(activityHoursUsed.values())
    .map((val) => {
      const usedHours = Math.round((val.hours / 60) * 100) / 100
      const pct = totalUsedHours > 0 ? Math.round((usedHours / totalUsedHours) * 1000) / 10 : 0
      return {
        id: val.id,
        name: val.name,
        categoryName: val.categoryName,
        ticketCount: val.ticketIds.size,
        usedHours,
        percentTotal: pct,
      }
    })
    .sort((a, b) => b.ticketCount - a.ticketCount || b.usedHours - a.usedHours)

  // 4. Seção 6: Movimentação de Ativos (equipments)
  const allEquipments = await pb
    .collection('equipments')
    .getFullList({
      filter: `company = "${companyId}"`,
      sort: '-created',
    })
    .catch(() => [] as any[])

  const enteredEquipments = allEquipments.filter((eq) => {
    const c = eq.created || ''
    return c >= start && c <= end
  })

  // Status de saída / desativação
  const exitStatuses = ['Descartado', 'Inativo', 'Em Manutenção']
  const exitedEquipments = allEquipments.filter((eq) => {
    if (!exitStatuses.includes(eq.status)) return false
    // Se o equipamento foi atualizado dentro do período para um status de saída
    const u = eq.updated || ''
    return u >= start && u <= end
  })

  const activeEquipmentsCount = allEquipments.filter((eq) => eq.status === 'Ativo').length

  const assetTypeMap = new Map<string, { total: number; entered: number; exited: number }>()
  allEquipments.forEach((eq) => {
    const t = eq.device_type || eq.type || 'Dispositivo'
    const cur = assetTypeMap.get(t) || { total: 0, entered: 0, exited: 0 }
    cur.total += 1
    if (enteredEquipments.some((e) => e.id === eq.id)) cur.entered += 1
    if (exitedEquipments.some((e) => e.id === eq.id)) cur.exited += 1
    assetTypeMap.set(t, cur)
  })

  const assets: AssetMovementSummary = {
    enteredCount: enteredEquipments.length,
    exitedCount: exitedEquipments.length,
    activeCount: activeEquipmentsCount,
    totalInScope: allEquipments.length,
    enteredList: enteredEquipments.map((eq) => ({
      id: eq.id,
      name: eq.name || eq.hostname || 'Ativo',
      device_type: eq.device_type || eq.type || 'Dispositivo',
      manufacturer: eq.manufacturer || '—',
      model: eq.model || '—',
      responsible_user: eq.responsible_user || eq.owner || '—',
      status: eq.status || 'Ativo',
      date: eq.created ? new Date(eq.created).toLocaleDateString('pt-BR') : '—',
    })),
    exitedList: exitedEquipments.map((eq) => ({
      id: eq.id,
      name: eq.name || eq.hostname || 'Ativo',
      device_type: eq.device_type || eq.type || 'Dispositivo',
      manufacturer: eq.manufacturer || '—',
      model: eq.model || '—',
      responsible_user: eq.responsible_user || eq.owner || '—',
      status: eq.status || 'Inativo',
      date: eq.updated ? new Date(eq.updated).toLocaleDateString('pt-BR') : '—',
    })),
    byType: Array.from(assetTypeMap.entries()).map(([type, val]) => ({
      type,
      ...val,
    })),
  }

  // 5. Seção 5: Estudo de Onde Mais Requer Atendimento Técnico (Análise Gerada)
  const topSector = sectors[0]
  const topRequester = requesters[0]
  const topAgreement = [...agreements].sort((a, b) => b.usedHours - a.usedHours)[0]
  const topActivity = activities[0]

  const totalTicketsInPeriod = ticketsInPeriod.length || tickets.length
  const avgTicketHours =
    totalTicketsInPeriod > 0 ? Math.round((totalUsedHours / totalTicketsInPeriod) * 100) / 100 : 0

  // Gera texto analítico detalhado
  const lines: string[] = []
  const recs: string[] = []

  const companyName = company.trade_name || company.legal_name

  lines.push(
    `No período analisado, o cliente ${companyName} registrou um volume total de ${totalUsedHours.toFixed(
      1,
    )} horas de suporte técnico distribuídas em ${totalTicketsInPeriod} atendimento(s).`,
  )

  if (topSector && topSector.usedHours > 0) {
    lines.push(
      `O setor com maior concentração de demanda técnica foi o "${topSector.name}", respondendo por ${topSector.usedHours.toFixed(
        1,
      )}h (${topSector.percentTotal.toFixed(1)}% do total apurado) e ${topSector.ticketCount} chamado(s).`,
    )
  }

  if (topRequester && topRequester.usedHours > 0) {
    lines.push(
      `No nível individual de colaboradores, o usuário com maior requisição de horas foi ${topRequester.name}${
        topRequester.sectorName ? ` (${topRequester.sectorName})` : ''
      }, somando ${topRequester.usedHours.toFixed(1)}h em ${topRequester.ticketCount} solicitação(ões).`,
    )
  }

  if (topActivity) {
    lines.push(
      `A atividade de catálogo mais demandada no mês foi "${topActivity.name}" (${topActivity.categoryName}), com ${
        topActivity.ticketCount
      } ocorrência(s)${topActivity.usedHours > 0 ? ` e ${topActivity.usedHours.toFixed(1)}h consumidas` : ''}.`,
    )
  }

  if (topAgreement && topAgreement.usedHours > 0) {
    lines.push(
      `Quanto à especialidade técnica (acordo de atendimento), o nível mais acionado foi o "${topAgreement.name}", com consumo de ${topAgreement.usedHours.toFixed(
        1,
      )}h${
        topAgreement.contractedHours > 0
          ? ` frente a ${topAgreement.contractedHours.toFixed(1)}h contratadas (${topAgreement.percentUsed.toFixed(1)}% de utilização)`
          : ''
      }.`,
    )
  }

  // Recomendações
  if (topSector && topSector.percentTotal > 40) {
    recs.push(
      `Realizar diagnóstico preventivo de infraestrutura e softwares específicos no setor "${topSector.name}" devido à alta concentração de incidentes (${topSector.percentTotal.toFixed(0)}%).`,
    )
  }
  if (topActivity && topActivity.name.toLowerCase().includes('lento')) {
    recs.push(
      `Avaliar plano de upgrade de memória RAM ou migração para unidades SSD nos computadores com queixas recorrentes de lentidão.`,
    )
  }
  if (totalUtilizationPercent > 90) {
    recs.push(
      `Atenção à franquia de horas contratadas: o consumo atingiu ${totalUtilizationPercent.toFixed(1)}%, recomendando-se revisão contratual ou contratação de pacote complementar.`,
    )
  } else if (totalUtilizationPercent > 0 && totalUtilizationPercent < 50) {
    recs.push(
      `O aproveitamento do contrato está em ${totalUtilizationPercent.toFixed(1)}%, indicando margem disponível para atendimentos preventivos, melhorias e treinamentos aos usuários.`,
    )
  }
  if (assets.enteredCount > 0) {
    recs.push(
      `Assegurar a padronização e instalação dos softwares homologados nos ${assets.enteredCount} novo(s) ativo(s) incorporados no período.`,
    )
  }
  if (recs.length === 0) {
    recs.push(
      'Manter rotina de manutenção preventiva e monitoramento contínuo dos ativos para manter a estabilidade operacional.',
    )
    recs.push(
      'Estimular a equipe a utilizar o catálogo de serviços para padronização no registro e triagem das demandas.',
    )
  }

  const study: TechnicalStudyData = {
    topSector: topSector
      ? {
          name: topSector.name,
          hours: topSector.usedHours,
          ticketCount: topSector.ticketCount,
          pct: topSector.percentTotal,
        }
      : undefined,
    topRequester: topRequester
      ? {
          name: topRequester.name,
          hours: topRequester.usedHours,
          ticketCount: topRequester.ticketCount,
          pct: topRequester.percentTotal,
        }
      : undefined,
    topAgreement: topAgreement
      ? {
          name: topAgreement.name,
          hours: topAgreement.usedHours,
          pct: topAgreement.percentUsed,
        }
      : undefined,
    topActivity: topActivity
      ? {
          name: topActivity.name,
          ticketCount: topActivity.ticketCount,
          hours: topActivity.usedHours,
        }
      : undefined,
    totalHoursUsed: totalUsedHours,
    totalTickets: totalTicketsInPeriod,
    avgTicketHours,
    analysisText: lines.join(' '),
    recommendations: recs,
  }

  const [y, m] = monthKey.split('-')
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  const periodLabel = `${monthNames[parseInt(m, 10) - 1]} de ${y}`

  return {
    company,
    monthKey,
    periodLabel,
    contract: activeContract,
    totalContractedHours,
    totalUsedHours,
    totalBalanceHours,
    totalUtilizationPercent,
    agreements,
    sectors,
    requesters,
    activities,
    study,
    assets,
  }
}
