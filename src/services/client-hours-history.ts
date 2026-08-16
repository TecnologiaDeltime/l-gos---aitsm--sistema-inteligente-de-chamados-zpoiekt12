import { getContracts } from '@/services/contracts'
import { getContractPeriods } from '@/services/contract-periods'
import { parseDurationToSeconds } from '@/lib/duration'

export interface MonthlyHoursData {
  month: string
  monthKey: string
  /** Consumido em SEGUNDOS (preciso). */
  consumed: number
  /** Contratado em SEGUNDOS (preciso). */
  contracted: number
  percentage: number
}

const MONTH_NAMES = [
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

export async function getClientHoursHistory(companyId: string): Promise<MonthlyHoursData[]> {
  const contracts = await getContracts()
  const companyContractIds = contracts
    .filter((c: any) => c.company === companyId)
    .map((c: any) => c.id)

  if (companyContractIds.length === 0) return []

  const periods = await getContractPeriods()
  const companyPeriods = periods.filter((p) => companyContractIds.includes(p.contract))

  const now = new Date()
  // Soma em SEGUNDOS (via parseDurationToSeconds) para garantir precisão total.
  // Aceita valores legados em número puro (ex.: 96 → 96:00:00).
  const monthsMap = new Map<string, { consumed: number; contracted: number }>()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthsMap.set(key, { consumed: 0, contracted: 0 })
  }

  companyPeriods.forEach((p) => {
    if (!p.period_start) return
    const periodDate = new Date(p.period_start)
    if (isNaN(periodDate.getTime())) return
    const key = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`
    if (monthsMap.has(key)) {
      const existing = monthsMap.get(key)!
      existing.consumed += parseDurationToSeconds(p.consumed_hours) ?? 0
      existing.contracted += parseDurationToSeconds(p.contracted_hours) ?? 0
    }
  })

  const result: MonthlyHoursData[] = []
  monthsMap.forEach((val, key) => {
    const [year, month] = key.split('-')
    const monthIdx = parseInt(month) - 1
    result.push({
      month: `${MONTH_NAMES[monthIdx]}/${year.slice(2)}`,
      monthKey: key,
      consumed: val.consumed,
      contracted: val.contracted,
      percentage: val.contracted > 0 ? (val.consumed / val.contracted) * 100 : 0,
    })
  })

  return result
}
