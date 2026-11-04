import pb from '@/lib/pocketbase/client'

export interface ClientConsumptionAgentRecord {
  id: string
  company: string
  enabled: boolean
  deviation_high_pct: number
  deviation_low_pct: number
  learning_window_months: number
  learned_average_hours: number
  learned_average_seconds: number
  learned_reference_period: string
  learned_history_json?: string
  last_evaluation_at?: string
  current_period_consumed_hours?: number
  current_period_deviation_pct?: number
  current_status?: 'normal' | 'high' | 'low' | 'no_data' | 'disabled'
  last_alerted_key?: string
  last_alerted_at?: string
  created?: string
  updated?: string
  expand?: {
    company?: {
      id: string
      trade_name?: string
      legal_name?: string
      code?: string
    }
  }
}

export interface ConsumptionHistoryItem {
  monthKey: string
  year: number
  month: number
  consumedHours: number
}

export interface EvaluateAgentResponse {
  success: boolean
  evaluatedCount: number
  results: Array<{
    companyId: string
    companyName: string
    status: string
    currentConsumed?: number
    averageHours?: number
    deviationPct?: number
    notified?: boolean
    message?: string
  }>
}

/**
 * Busca todas as configurações e aprendizados do agente para todos os clientes
 */
export async function getAllClientConsumptionAgents(): Promise<ClientConsumptionAgentRecord[]> {
  try {
    const records = await pb.collection('client_consumption_agents').getFullList({
      sort: '-updated',
      expand: 'company',
    })
    return records as unknown as ClientConsumptionAgentRecord[]
  } catch (err) {
    console.error('Erro ao buscar agentes de consumo:', err)
    return []
  }
}

/**
 * Busca a configuração/aprendizado do agente para uma empresa específica
 */
export async function getClientConsumptionAgentByCompany(
  companyId: string,
): Promise<ClientConsumptionAgentRecord | null> {
  try {
    const record = await pb
      .collection('client_consumption_agents')
      .getFirstListItem(`company = "${companyId}"`, {
        expand: 'company',
      })
    return record as unknown as ClientConsumptionAgentRecord
  } catch (err: unknown) {
    // Se não encontrou (404), retorna null sem erro
    const pbErr = err as { status?: number }
    if (pbErr.status === 404) return null
    console.error('Erro ao buscar agente para empresa:', companyId, err)
    return null
  }
}

/**
 * Salva ou atualiza a configuração do agente para um cliente
 */
export async function saveClientConsumptionAgent(data: {
  id?: string
  company: string
  enabled: boolean
  deviation_high_pct: number
  deviation_low_pct: number
  learning_window_months: number
}): Promise<ClientConsumptionAgentRecord> {
  const payload = {
    company: data.company,
    enabled: data.enabled,
    deviation_high_pct: Number(data.deviation_high_pct),
    deviation_low_pct: Number(data.deviation_low_pct),
    learning_window_months: Number(data.learning_window_months),
  }

  if (data.id) {
    const updated = await pb.collection('client_consumption_agents').update(data.id, payload, {
      expand: 'company',
    })
    return updated as unknown as ClientConsumptionAgentRecord
  }

  // Verifica se já existe por garantia antes de criar
  const existing = await getClientConsumptionAgentByCompany(data.company)
  if (existing) {
    const updated = await pb.collection('client_consumption_agents').update(existing.id, payload, {
      expand: 'company',
    })
    return updated as unknown as ClientConsumptionAgentRecord
  }

  const created = await pb.collection('client_consumption_agents').create(payload, {
    expand: 'company',
  })
  return created as unknown as ClientConsumptionAgentRecord
}

/**
 * Dispara a execução manual de avaliação do agente (para todos ou para uma empresa específica)
 */
export async function triggerConsumptionAgentEvaluation(params?: {
  companyId?: string
  forceAlert?: boolean
}): Promise<EvaluateAgentResponse> {
  try {
    const res = await pb.send('/backend/v1/custom/consumption-agent/evaluate', {
      method: 'POST',
      body: params || {},
    })
    return res as EvaluateAgentResponse
  } catch (err) {
    console.error('Erro ao disparar avaliação do agente de consumo:', err)
    throw err
  }
}
