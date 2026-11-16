// Serviço de alocação de operadores em clientes (v0.0.436)
import pb from '@/lib/pocketbase/client'

export interface OperatorAllocationRecurrence {
  days_of_week?: number[]
  weeks_of_month?: number[]
  months?: number[]
}

export interface OperatorAllocation {
  id: string
  operator: string
  company: string
  unit?: string
  allocation_type: 'permanente' | 'periodo'
  recurrence_json?: string
  start_date?: string
  end_date?: string
  active: boolean
  notes?: string
  created?: string
  updated?: string
  expand?: {
    operator?: { id: string; name: string; email?: string; avatar?: string }
    company?: { id: string; trade_name?: string; legal_name?: string }
    unit?: { id: string; name?: string }
  }
}

export const ALLOCATION_TYPE_LABELS: Record<string, string> = {
  permanente: 'Exclusiva / Permanente',
  periodo: 'Por Período (recorrência)',
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function formatRecurrence(allocation: OperatorAllocation): string {
  if (allocation.allocation_type === 'permanente') return 'Exclusiva — sempre'
  let out = ''
  try {
    const rec: OperatorAllocationRecurrence = allocation.recurrence_json
      ? JSON.parse(allocation.recurrence_json)
      : {}
    const parts: string[] = []
    if (rec.days_of_week && rec.days_of_week.length > 0) {
      parts.push(
        'Dias: ' +
          rec.days_of_week
            .slice()
            .sort((a, b) => a - b)
            .map((d) => WEEKDAY_LABELS[d] ?? String(d))
            .join(', '),
      )
    }
    if (rec.weeks_of_month && rec.weeks_of_month.length > 0) {
      parts.push(
        'Semana(s): ' +
          rec.weeks_of_month
            .slice()
            .sort((a, b) => a - b)
            .join(', '),
      )
    }
    if (rec.months && rec.months.length > 0) {
      const monthNames = [
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
      parts.push(
        'Meses: ' +
          rec.months
            .slice()
            .sort((a, b) => a - b)
            .map((m) => monthNames[m - 1] ?? String(m))
            .join(', '),
      )
    }
    out = parts.length > 0 ? parts.join(' · ') : 'Todo o período da vigência'
  } catch {
    out = 'Todo o período da vigência'
  }
  return out
}

export function listOperatorAllocations(
  operatorFilter?: string,
  companyFilter?: string,
): Promise<OperatorAllocation[]> {
  let filter = ''
  if (operatorFilter) filter += `operator="${operatorFilter}"`
  if (companyFilter) filter += (filter ? ' && ' : '') + `company="${companyFilter}"`
  return pb
    .collection('operator_allocations')
    .getFullList<OperatorAllocation>({ filter, sort: '-updated', expand: 'operator,company,unit' })
}

export function getOperatorAllocation(id: string): Promise<OperatorAllocation> {
  return pb
    .collection('operator_allocations')
    .getOne<OperatorAllocation>(id, { expand: 'operator,company,unit' })
}

export function createOperatorAllocation(
  data: Partial<OperatorAllocation>,
): Promise<OperatorAllocation> {
  return pb.collection('operator_allocations').create<OperatorAllocation>(data)
}

export function updateOperatorAllocation(
  id: string,
  data: Partial<OperatorAllocation>,
): Promise<OperatorAllocation> {
  return pb.collection('operator_allocations').update<OperatorAllocation>(id, data)
}

export async function deleteOperatorAllocation(id: string): Promise<void> {
  await pb.collection('operator_allocations').delete(id)
}

/** Avalia se uma alocação está vigente agora (cliente, semelhante à regra do hook de auto-assign). */
export function isAllocationActiveNow(allocation: OperatorAllocation, now = new Date()): boolean {
  if (!allocation.active) return false
  if (allocation.start_date) {
    const sd = new Date(allocation.start_date)
    if (!isNaN(sd.getTime()) && now < sd) return false
  }
  if (allocation.end_date) {
    const ed = new Date(allocation.end_date)
    if (!isNaN(ed.getTime())) {
      ed.setHours(23, 59, 59, 999)
      if (now > ed) return false
    }
  }
  if (allocation.allocation_type === 'permanente') return true
  let rec: OperatorAllocationRecurrence = {}
  try {
    rec = allocation.recurrence_json ? JSON.parse(allocation.recurrence_json) : {}
  } catch {
    return false
  }
  if (rec.days_of_week && rec.days_of_week.length > 0) {
    if (!rec.days_of_week.includes(now.getDay())) return false
  }
  if (rec.weeks_of_month && rec.weeks_of_month.length > 0) {
    const wom = Math.ceil(now.getDate() / 7)
    if (!rec.weeks_of_month.includes(wom)) return false
  }
  if (rec.months && rec.months.length > 0) {
    if (!rec.months.includes(now.getMonth() + 1)) return false
  }
  return true
}

/** Busca a alocação ativa de um operador (para a ficha do operador). */
export async function getActiveAllocationForOperator(
  operatorId: string,
): Promise<OperatorAllocation | null> {
  const all = await listOperatorAllocations(operatorId)
  const active = all.filter((a) => isAllocationActiveNow(a))
  if (active.length === 0) return null
  // Prioriza exclusiva/permanente
  const perm = active.find((a) => a.allocation_type === 'permanente')
  return perm ?? active[0]
}
