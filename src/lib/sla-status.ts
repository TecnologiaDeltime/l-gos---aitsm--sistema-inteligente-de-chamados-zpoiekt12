interface SlaTicketData {
  sla_paused?: boolean
  sla_response_deadline?: string
  sla_response_at?: string
  sla_response_start?: string
  sla_solution_deadline?: string
  sla_solution_at?: string
  resolution_date?: string
  created?: string
  status?: string
}

const IN_PROGRESS_STATUSES = new Set([
  'Em Atendimento',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Agendado',
  'Escalonado',
  'Resolvido',
  'Aguardando Validação',
  'Encerrado',
  'Reaberto',
])

function computePercent(deadline: string, created?: string): number {
  const now = Date.now()
  const dl = new Date(deadline).getTime()
  const c = created ? new Date(created).getTime() : now
  const total = dl - c
  const elapsed = now - c
  return total > 0 ? (elapsed / total) * 100 : 100
}

export function computeSlaResponseStatus(ticket: SlaTicketData): string {
  if (ticket.sla_paused) return 'Pausado'
  if (!ticket.sla_response_deadline) return 'Não definido'

  const deadline = new Date(ticket.sla_response_deadline).getTime()
  if (isNaN(deadline)) return 'Não definido'

  if (ticket.sla_response_at) {
    return new Date(ticket.sla_response_at).getTime() <= deadline ? 'Dentro do Prazo' : 'Violado'
  }

  if (ticket.sla_response_start && IN_PROGRESS_STATUSES.has(ticket.status || '')) {
    return 'Dentro do Prazo'
  }

  if (deadline < Date.now()) return 'Violado'

  const pct = computePercent(ticket.sla_response_deadline, ticket.created)
  if (pct < 50) return 'Dentro do Prazo'
  if (pct < 70) return 'Atenção'
  if (pct < 85) return 'Risco'
  return 'Crítico'
}

export function computeSlaSolutionStatus(ticket: SlaTicketData): string {
  if (ticket.sla_paused) return 'Pausado'
  if (!ticket.sla_solution_deadline) return 'Não definido'

  const deadline = new Date(ticket.sla_solution_deadline).getTime()
  if (isNaN(deadline)) return 'Não definido'

  const solutionTime = ticket.sla_solution_at
    ? new Date(ticket.sla_solution_at).getTime()
    : ticket.resolution_date
      ? new Date(ticket.resolution_date).getTime()
      : null

  if (solutionTime !== null && !isNaN(solutionTime)) {
    return solutionTime <= deadline ? 'Dentro do Prazo' : 'Violado'
  }

  if (ticket.status === 'Resolvido' || ticket.status === 'Encerrado') {
    return 'Dentro do Prazo'
  }

  if (deadline < Date.now()) return 'Violado'

  const pct = computePercent(ticket.sla_solution_deadline, ticket.created)
  if (pct < 50) return 'Dentro do Prazo'
  if (pct < 70) return 'Atenção'
  if (pct < 85) return 'Risco'
  return 'Crítico'
}

export function formatRemainingTime(deadline?: string): string {
  if (!deadline) return 'Não definido'
  const now = Date.now()
  const dl = new Date(deadline).getTime()
  if (isNaN(dl)) return 'Não definido'

  const diff = dl - now

  if (diff <= 0) {
    const overdue = Math.abs(diff)
    const days = Math.floor(overdue / 86400000)
    const hours = Math.floor((overdue % 86400000) / 3600000)
    const minutes = Math.floor((overdue % 3600000) / 60000)
    if (days > 0) return `Vencido há ${days}d ${hours}h`
    if (hours > 0) return `Vencido há ${hours}h ${minutes}min`
    return `Vencido há ${minutes}min`
  }

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)

  if (days > 0) return `${days}d ${hours}h restantes`
  if (hours > 0) return `${hours}h ${minutes}min restantes`
  return `${minutes}min restantes`
}

export function formatDeadline(deadline?: string): string {
  if (!deadline) return 'Não definido'
  const d = new Date(deadline)
  if (isNaN(d.getTime())) return 'Não definido'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
