interface SlaContractData {
  sla_response_time?: number
  sla_solution_time?: number
  service_hours_start?: string
  service_hours_end?: string
  service_days?: string
}

function parseServiceDays(serviceDays?: string): Set<number> {
  if (!serviceDays || serviceDays === 'Seg-Sex') return new Set([1, 2, 3, 4, 5])
  if (serviceDays === 'Seg-Sáb') return new Set([1, 2, 3, 4, 5, 6])
  if (serviceDays === 'Todos') return new Set([0, 1, 2, 3, 4, 5, 6])
  return new Set([1, 2, 3, 4, 5])
}

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null
  const parts = time.split(':').map(Number)
  if (parts.some(isNaN)) return null
  return parts[0] * 60 + (parts[1] || 0)
}

export function calculateSlaDeadline(
  contract: SlaContractData,
  slaMinutes: number,
  fromDate: Date = new Date(),
): string {
  if (!slaMinutes || slaMinutes <= 0) return fromDate.toISOString()

  const workingDays = parseServiceDays(contract.service_days)
  const startMin = parseTimeToMinutes(contract.service_hours_start) ?? 8 * 60
  const endMin = parseTimeToMinutes(contract.service_hours_end) ?? 18 * 60
  const minutesPerDay = endMin - startMin

  if (minutesPerDay <= 0) {
    return new Date(fromDate.getTime() + slaMinutes * 60000).toISOString()
  }

  let remaining = slaMinutes
  const deadline = new Date(fromDate)
  const currentMin = deadline.getHours() * 60 + deadline.getMinutes()

  if (!workingDays.has(deadline.getDay()) || currentMin >= endMin) {
    do {
      deadline.setDate(deadline.getDate() + 1)
    } while (!workingDays.has(deadline.getDay()))
    deadline.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
  } else if (currentMin < startMin) {
    deadline.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
  }

  while (remaining > 0) {
    const nowMin = deadline.getHours() * 60 + deadline.getMinutes()
    const availableToday = endMin - nowMin
    if (remaining <= availableToday) {
      const newMin = nowMin + remaining
      deadline.setHours(Math.floor(newMin / 60), newMin % 60, 0, 0)
      remaining = 0
    } else {
      remaining -= availableToday
      do {
        deadline.setDate(deadline.getDate() + 1)
      } while (!workingDays.has(deadline.getDay()))
      deadline.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
    }
  }

  return deadline.toISOString()
}

export function calculateSlaDeadlines(contract: SlaContractData) {
  return {
    sla_response_deadline: calculateSlaDeadline(contract, contract.sla_response_time || 30),
    sla_solution_deadline: calculateSlaDeadline(contract, contract.sla_solution_time || 240),
  }
}
