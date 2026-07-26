export function isSlaCompliant(slaStatus?: string): boolean {
  return slaStatus === 'Dentro do Prazo' || slaStatus === 'Atenção'
}

export function isResponseSlaMet(t: any): boolean {
  if (t.sla_response_at && t.sla_response_deadline) {
    return new Date(t.sla_response_at).getTime() <= new Date(t.sla_response_deadline).getTime()
  }
  return isSlaCompliant(t.sla_status)
}

export function isSolutionSlaMet(t: any): boolean {
  if (t.sla_solution_at && t.sla_solution_deadline) {
    return new Date(t.sla_solution_at).getTime() <= new Date(t.sla_solution_deadline).getTime()
  }
  return isSlaCompliant(t.sla_status)
}

export function getResponseMinutes(t: any): number | null {
  if (t.sla_response_at && t.created) {
    return Math.round(
      (new Date(t.sla_response_at).getTime() - new Date(t.created).getTime()) / 60000,
    )
  }
  return null
}

export function getSolutionMinutes(t: any): number | null {
  const end = t.sla_solution_at || t.resolution_date
  if (end && t.created) {
    return Math.round((new Date(end).getTime() - new Date(t.created).getTime()) / 60000)
  }
  return null
}

export function buildDateFilter(start: string, end: string, companyId?: string): string {
  const parts = [`created >= '${start} 00:00:00.000Z'`, `created <= '${end} 23:59:59.999Z'`]
  if (companyId && companyId !== 'all') parts.push(`company = '${companyId}'`)
  return parts.join(' && ')
}

export function slaPctColor(pct: number): string {
  if (pct < 50) return 'text-red-600 font-bold'
  if (pct < 80) return 'text-amber-600 font-semibold'
  return 'text-green-600 font-semibold'
}

export function slaRowBg(pct: number): string {
  if (pct < 50) return 'bg-red-50'
  if (pct < 80) return 'bg-amber-50'
  return ''
}

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function avg(nums: number[]): number {
  return nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0
}

export interface SlaTechRow {
  techId: string
  techName: string
  total: number
  responseMet: number
  responsePct: number
  solutionMet: number
  solutionPct: number
  avgResponseMin: number
  avgSolutionMin: number
}

export function computeSlaByTechnician(tickets: any[], users: any[]): SlaTechRow[] {
  const names = new Map(users.map((u) => [u.id, u.name || u.email || 'N/A']))
  const groups = new Map<string, any[]>()
  tickets.forEach((t) => {
    if (!t.assigned_to) return
    const arr = groups.get(t.assigned_to) || []
    arr.push(t)
    groups.set(t.assigned_to, arr)
  })
  return Array.from(groups.entries())
    .map(([techId, tks]) => {
      const total = tks.length
      const responseMet = tks.filter(isResponseSlaMet).length
      const solutionMet = tks.filter(isSolutionSlaMet).length
      return {
        techId,
        techName: names.get(techId) || 'N/A',
        total,
        responseMet,
        responsePct: total ? (responseMet / total) * 100 : 0,
        solutionMet,
        solutionPct: total ? (solutionMet / total) * 100 : 0,
        avgResponseMin: avg(tks.map(getResponseMinutes).filter((v): v is number => v !== null)),
        avgSolutionMin: avg(tks.map(getSolutionMinutes).filter((v): v is number => v !== null)),
      }
    })
    .sort((a, b) => b.total - a.total)
}

export interface SlaActivityRow {
  mainActivity: string
  subactivity: string
  subcategoryId: string
  total: number
  responseMet: number
  responsePct: number
  solutionMet: number
  solutionPct: number
}

export function computeSlaByActivity(tickets: any[], categories: any[]): SlaActivityRow[] {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string, any[]>()
  tickets.forEach((t) => {
    const subId =
      t.subcategory || (t.category && catMap.get(t.category)?.parent ? t.category : null)
    if (!subId) return
    const arr = groups.get(subId) || []
    arr.push(t)
    groups.set(subId, arr)
  })
  return Array.from(groups.entries())
    .map(([subId, tks]) => {
      const cat = catMap.get(subId)
      const parent = cat?.parent ? catMap.get(cat.parent) : null
      const total = tks.length
      return {
        mainActivity: parent?.name || cat?.name || 'N/A',
        subactivity: cat?.name || 'N/A',
        subcategoryId: subId,
        total,
        responseMet: tks.filter(isResponseSlaMet).length,
        responsePct: total ? (tks.filter(isResponseSlaMet).length / total) * 100 : 0,
        solutionMet: tks.filter(isSolutionSlaMet).length,
        solutionPct: total ? (tks.filter(isSolutionSlaMet).length / total) * 100 : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export interface RecurrentRow {
  mainActivity: string
  subactivity: string
  subcategoryId: string
  total: number
  pctOfTotal: number
  avgResponseMin: number
  avgSolutionMin: number
  previousCount: number
  trend: 'up' | 'down' | 'stable'
}

export function computeRecurrentActivities(
  curr: any[],
  prev: any[],
  categories: any[],
): RecurrentRow[] {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const getSubId = (t: any): string | null => {
    if (t.subcategory) return t.subcategory
    if (t.category && catMap.get(t.category)?.parent) return t.category
    return null
  }
  const currGroups = new Map<string, any[]>()
  curr.forEach((t) => {
    const id = getSubId(t)
    if (!id) return
    const a = currGroups.get(id) || []
    a.push(t)
    currGroups.set(id, a)
  })
  const prevCounts = new Map<string, number>()
  prev.forEach((t) => {
    const id = getSubId(t)
    if (!id) return
    prevCounts.set(id, (prevCounts.get(id) || 0) + 1)
  })
  const totalAll = curr.length
  return Array.from(currGroups.entries())
    .map(([subId, tks]) => {
      const cat = catMap.get(subId)
      const parent = cat?.parent ? catMap.get(cat.parent) : null
      const total = tks.length
      const prevCount = prevCounts.get(subId) || 0
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (prevCount > 0) {
        const ratio = total / prevCount
        trend = ratio > 1.1 ? 'up' : ratio < 0.9 ? 'down' : 'stable'
      } else if (total > 0) trend = 'up'
      return {
        mainActivity: parent?.name || cat?.name || 'N/A',
        subactivity: cat?.name || 'N/A',
        subcategoryId: subId,
        total,
        pctOfTotal: totalAll ? (total / totalAll) * 100 : 0,
        avgResponseMin: avg(tks.map(getResponseMinutes).filter((v): v is number => v !== null)),
        avgSolutionMin: avg(tks.map(getSolutionMinutes).filter((v): v is number => v !== null)),
        previousCount: prevCount,
        trend,
      }
    })
    .sort((a, b) => b.total - a.total)
}
