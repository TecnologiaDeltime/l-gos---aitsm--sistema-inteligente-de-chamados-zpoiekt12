/**
 * Resolução e apuração de SLAs do sistema de chamados (ITSM).
 *
 * Precedência de configuração (conforme especificação):
 * 1. Atividade do catálogo (tkt_categories - sla_response_minutes / sla_solution_minutes)
 * 2. Cliente (companies - sla_response_minutes / sla_solution_minutes)
 * 3. Contrato / Padrão do sistema (contracts ou fallback global 30min resp / 240min sol)
 *
 * Tratamento de pausas:
 * O tempo apurado e o prazo de solução desconsideram os períodos em que o ticket
 * esteve pausado (armazenados em sla_pauses e somados em ticket.sla_pause_total_minutes).
 */

export interface SlaResolutionInput {
  activity?: {
    sla_response_minutes?: number | null
    sla_solution_minutes?: number | null
    name?: string
  } | null
  client?: {
    sla_response_minutes?: number | null
    sla_solution_minutes?: number | null
    trade_name?: string
  } | null
  contract?: {
    sla_response_time?: number | null
    sla_solution_time?: number | null
  } | null
}

export interface EffectiveSla {
  responseMinutes: number
  solutionMinutes: number
  source: 'activity' | 'client' | 'contract' | 'default'
  sourceLabel: string
}

export const DEFAULT_SLA_RESPONSE_MINUTES = 30
export const DEFAULT_SLA_SOLUTION_MINUTES = 240

export function resolveEffectiveSla(input: SlaResolutionInput): EffectiveSla {
  // 1. Atividade do catálogo
  const actResp = input.activity?.sla_response_minutes
  const actSol = input.activity?.sla_solution_minutes
  if ((actResp && actResp > 0) || (actSol && actSol > 0)) {
    return {
      responseMinutes: actResp && actResp > 0 ? actResp : DEFAULT_SLA_RESPONSE_MINUTES,
      solutionMinutes: actSol && actSol > 0 ? actSol : DEFAULT_SLA_SOLUTION_MINUTES,
      source: 'activity',
      sourceLabel: `Atividade: ${input.activity?.name || 'Catálogo'}`,
    }
  }

  // 2. Cliente
  const cliResp = input.client?.sla_response_minutes
  const cliSol = input.client?.sla_solution_minutes
  if ((cliResp && cliResp > 0) || (cliSol && cliSol > 0)) {
    return {
      responseMinutes: cliResp && cliResp > 0 ? cliResp : DEFAULT_SLA_RESPONSE_MINUTES,
      solutionMinutes: cliSol && cliSol > 0 ? cliSol : DEFAULT_SLA_SOLUTION_MINUTES,
      source: 'client',
      sourceLabel: `Cliente: ${input.client?.trade_name || 'Configuração do Cliente'}`,
    }
  }

  // 3. Contrato
  const contResp = input.contract?.sla_response_time
  const contSol = input.contract?.sla_solution_time
  if ((contResp && contResp > 0) || (contSol && contSol > 0)) {
    return {
      responseMinutes: contResp && contResp > 0 ? contResp : DEFAULT_SLA_RESPONSE_MINUTES,
      solutionMinutes: contSol && contSol > 0 ? contSol : DEFAULT_SLA_SOLUTION_MINUTES,
      source: 'contract',
      sourceLabel: 'Contrato',
    }
  }

  // 4. Padrão do sistema
  return {
    responseMinutes: DEFAULT_SLA_RESPONSE_MINUTES,
    solutionMinutes: DEFAULT_SLA_SOLUTION_MINUTES,
    source: 'default',
    sourceLabel: 'Padrão do Sistema',
  }
}

/**
 * Calcula os prazos de SLA (deadlines) a partir da data de abertura (ou referência),
 * considerando os minutos de resposta e de solução e eventuais minutos de pausa acumulados.
 */
export function computeDeadlinesFromMinutes(
  responseMinutes: number,
  solutionMinutes: number,
  openedAt: Date = new Date(),
  pauseTotalMinutes: number = 0,
) {
  const startMs = openedAt.getTime()
  const responseDeadlineMs = startMs + responseMinutes * 60000
  // O prazo de solução é estendido pelo total de minutos pausados
  const solutionDeadlineMs = startMs + (solutionMinutes + (pauseTotalMinutes || 0)) * 60000

  return {
    sla_response_deadline: new Date(responseDeadlineMs).toISOString(),
    sla_solution_deadline: new Date(solutionDeadlineMs).toISOString(),
  }
}

/**
 * Recalcula o prazo final de solução adicionando a nova duração de pausa (em minutos).
 */
export function extendSolutionDeadlineByPause(
  currentDeadline: string | undefined,
  pauseMinutes: number,
  created?: string,
  targetSolutionMinutes?: number,
): string {
  if (currentDeadline) {
    const prevMs = new Date(currentDeadline).getTime()
    if (!isNaN(prevMs)) {
      return new Date(prevMs + pauseMinutes * 60000).toISOString()
    }
  }
  const baseMs = created ? new Date(created).getTime() : Date.now()
  const targetMs = (targetSolutionMinutes || DEFAULT_SLA_SOLUTION_MINUTES) * 60000
  return new Date(baseMs + targetMs + pauseMinutes * 60000).toISOString()
}

/**
 * Calcula o tempo líquido decorrido (em minutos) para o SLA de solução,
 * descontando todos os minutos de pausa.
 */
export function computeNetSolutionElapsedMinutes(
  openedAt: string | Date,
  closedAt: string | Date = new Date(),
  pauseTotalMinutes: number = 0,
): number {
  const startMs = typeof openedAt === 'string' ? new Date(openedAt).getTime() : openedAt.getTime()
  const endMs = typeof closedAt === 'string' ? new Date(closedAt).getTime() : closedAt.getTime()
  const grossMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000))
  const netMinutes = Math.max(0, grossMinutes - (pauseTotalMinutes || 0))
  return netMinutes
}
