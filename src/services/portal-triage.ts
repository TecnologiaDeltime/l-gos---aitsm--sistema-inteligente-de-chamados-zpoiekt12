import pb from '@/lib/pocketbase/client'

/**
 * portal-triage.ts — serviço de triagem automática por IA do Portal do Cliente.
 *
 * Configuração persistida em system_settings (key=global):
 *  - portal_auto_triage_enabled  (bool)
 *  - portal_triage_default_queue (relation -> queues)
 *  - portal_triage_min_confidence (number 0..1)
 *
 * Disparo: POST /backend/v1/ai/portal-triage { ticketId } (hook pb_hooks).
 * Agente nativo: portal-ticket-triage-agent (migração 0141, $ai.agents.define).
 */

export interface PortalTriageSettings {
  portal_auto_triage_enabled: boolean
  portal_triage_default_queue: string
  portal_triage_min_confidence: number
}

export interface PortalTriageResult {
  applied: boolean
  reason?: string
  confidence?: number
  activity?: string
  category?: string
  subcategory?: string
  queue?: string
  debug?: string[]
}

export interface PortalTriageHistoryItem {
  id: string
  ticket_id: string
  ticket_number?: string
  ticket_title?: string
  title?: string
  suggested_category_id?: string
  suggested_category_name?: string
  suggested_subcategory_id?: string
  suggested_subcategory_name?: string
  queue_id?: string
  queue_name?: string
  confidence?: number
  reason?: string
  applied: boolean
  source?: string
  match_method?: string
  operator_corrected?: boolean
  final_category_id?: string
  final_category_name?: string
  final_subcategory_id?: string
  final_subcategory_name?: string
  corrected_at?: string
  corrected_by?: string
  correction_seconds?: number
  created: string
  updated?: string
}

export interface PortalTriageMetricsSummary {
  periodDays: number
  totalTriages: number
  appliedCount: number
  appliedPct: number
  defaultQueueCount: number
  defaultQueuePct: number
  correctedCount: number
  correctedPct: number
  accuracyPct: number // % que permaneceu sem correção pelo operador
  avgConfidence: number
  avgCorrectionMinutes: number
  lowConfidenceCount: number
  confidenceBuckets: {
    high: number // >= 80%
    medium: number // 60% a 79%
    low: number // < 60%
  }
  topCorrectedActivities: Array<{
    categoryName: string
    categoryId: string
    totalSuggested: number
    correctedCount: number
    errorRatePct: number
    finalCategoriesSummary: Record<string, number>
  }>
  topAccurateActivities: Array<{
    categoryName: string
    categoryId: string
    totalSuggested: number
    accurateCount: number
    accuracyRatePct: number
  }>
}

export const DEFAULT_TRIAGE_SETTINGS: PortalTriageSettings = {
  portal_auto_triage_enabled: true,
  portal_triage_default_queue: '',
  portal_triage_min_confidence: 0.4,
}

export interface TriageSuggestionResult {
  category_id: string
  category_name: string
  subcategory_id?: string
  subcategory_name?: string
  queue_id?: string
  queue_name?: string
  confidence: number
  reason: string
  match_method?: string
  min_confidence?: number
}

/** Carrega as configurações de triagem do portal (system_settings, key=global). */
export const getPortalTriageSettings = async (): Promise<
  (PortalTriageSettings & { id?: string }) | null
> => {
  const records = await pb.collection('system_settings').getList<any>(1, 1, {
    filter: 'key = "global"',
  })
  if (records.items.length === 0) return null
  const item = records.items[0]
  return {
    id: item.id,
    portal_auto_triage_enabled: item.portal_auto_triage_enabled ?? true,
    portal_triage_default_queue: item.portal_triage_default_queue || '',
    portal_triage_min_confidence:
      typeof item.portal_triage_min_confidence === 'number' && item.portal_triage_min_confidence > 0
        ? item.portal_triage_min_confidence
        : 0.4,
  }
}

/** Salva as configurações de triagem (cria o registro global se ainda não existir). */
export const savePortalTriageSettings = async (
  settings: PortalTriageSettings,
  existingId?: string | null,
): Promise<void> => {
  const payload = {
    portal_auto_triage_enabled: settings.portal_auto_triage_enabled,
    portal_triage_default_queue: settings.portal_triage_default_queue,
    portal_triage_min_confidence: Math.max(
      0,
      Math.min(1, Number(settings.portal_triage_min_confidence) || 0.4),
    ),
  }
  if (existingId) {
    await pb.collection('system_settings').update(existingId, payload)
  } else {
    const records = await pb.collection('system_settings').getList<any>(1, 1, {
      filter: 'key = "global"',
    })
    if (records.items.length > 0) {
      await pb.collection('system_settings').update(records.items[0].id, payload)
    } else {
      await pb.collection('system_settings').create({ key: 'global', ...payload })
    }
  }
}

/**
 * Dispara a triagem por IA de um chamado recém-aberto pelo Portal.
 * Fire-and-forget: nunca lança; falhas são apenas logadas no console.
 */
export const triggerPortalTriage = async (ticketId: string): Promise<PortalTriageResult | null> => {
  try {
    const res = await pb.send<PortalTriageResult>('/backend/v1/ai/portal-triage', {
      method: 'POST',
      body: { ticketId },
    })
    return res ?? null
  } catch (err) {
    console.warn('[portal-triage] falha ao disparar triagem automática:', err)
    return null
  }
}

/**
 * Disparo explícito fire-and-forget: chama triggerPortalTriage sem esperar o retorno.
 * Garante que a abertura do chamado no portal nunca seja atrasada ou bloqueada.
 */
export const triggerPortalTriageFireAndForget = (ticketId: string): void => {
  if (!ticketId) return
  void triggerPortalTriage(ticketId).catch((err) => {
    console.warn('[portal-triage] erro em background:', err)
  })
}

/**
 * Busca histórico de triagens da IA.
 * Se ticketId for fornecido, filtra pelo chamado. Caso contrário, traz os registros mais recentes.
 */
export const getPortalTriageHistory = async (
  ticketId?: string,
  limit: number = 30,
): Promise<PortalTriageHistoryItem[]> => {
  try {
    let filter = 'id != ""'
    if (ticketId) filter += ` && ticket_id = "${ticketId}"`
    const recs = await pb
      .collection('portal_triage_history')
      .getList<PortalTriageHistoryItem>(1, limit, {
        filter,
        sort: '-created',
      })
    return recs.items
  } catch (err) {
    // Fallback: rota customizada se SDK direto falhar
    try {
      const queryParams = new URLSearchParams()
      if (ticketId) queryParams.set('ticketId', ticketId)
      if (limit) queryParams.set('limit', String(limit))

      const url = `/backend/v1/ai/portal-triage/history?${queryParams.toString()}`
      const res = await pb.send<{ items: PortalTriageHistoryItem[]; total: number }>(url, {
        method: 'GET',
      })
      return res?.items || []
    } catch (routeErr) {
      console.warn('[portal-triage] falha ao buscar histórico de triagem:', routeErr)
      return []
    }
  }
}

/**
 * Registra a correção manual feita pelo operador na ficha do chamado.
 * Vincula ao último registro de triagem do chamado em questão.
 */
/**
 * Consulta a IA para sugerir categoria e subcategoria com base no título e descrição fornecidos.
 * Utilizado interativamente antes da criação do chamado (por exemplo, no diálogo de Chamado Filho).
 */
export async function suggestTriageForText(params: {
  title: string
  description?: string
}): Promise<TriageSuggestionResult | null> {
  const cleanTitle = (params.title || '').trim()
  const cleanDesc = (params.description || '').trim()

  if (!cleanTitle && !cleanDesc) {
    return null
  }

  try {
    const res = await pb.send<TriageSuggestionResult>('/backend/v1/ai/portal-triage/suggest', {
      method: 'POST',
      body: {
        title: cleanTitle,
        description: cleanDesc,
      },
    })
    return res || null
  } catch (err) {
    console.warn('[portal-triage] Erro ao obter sugestão da IA:', err)
    return null
  }
}

/**
 * Registra no histórico portal_triage_history a triagem de um chamado filho recém-criado,
 * incluindo a sugestão da IA e se o operador aceitou ou corrigiu a categoria/subcategoria.
 */
export async function recordChildTicketTriage(params: {
  ticketId: string
  ticketNumber: string
  title: string
  suggestion: TriageSuggestionResult
  applied: boolean
  chosenCategoryId: string
  chosenCategoryName: string
  chosenSubcategoryId?: string
  chosenSubcategoryName?: string
  operatorId?: string
}): Promise<string | null> {
  try {
    const isDifferent =
      Boolean(params.suggestion.category_id) &&
      (params.chosenCategoryId !== params.suggestion.category_id ||
        Boolean(
          params.chosenSubcategoryId &&
          params.chosenSubcategoryId !== (params.suggestion.subcategory_id || ''),
        ))

    const now = new Date().toISOString()

    const recordData: Record<string, any> = {
      ticket_id: params.ticketId,
      ticket_number: params.ticketNumber,
      ticket_title: params.title,
      suggested_category_id: params.suggestion.category_id || '',
      suggested_category_name: params.suggestion.category_name || '',
      suggested_subcategory_id: params.suggestion.subcategory_id || '',
      suggested_subcategory_name: params.suggestion.subcategory_name || '',
      queue_id: params.suggestion.queue_id || '',
      queue_name: params.suggestion.queue_name || '',
      confidence: params.suggestion.confidence || 0,
      reason: params.suggestion.reason || '',
      applied: params.applied,
      source: 'child_ticket',
      match_method: params.suggestion.match_method || 'agent',
      operator_corrected: isDifferent,
      final_category_id: params.chosenCategoryId || '',
      final_category_name: params.chosenCategoryName || '',
      final_subcategory_id: params.chosenSubcategoryId || '',
      final_subcategory_name: params.chosenSubcategoryName || '',
    }

    if (isDifferent) {
      recordData.corrected_at = now
      recordData.corrected_by = params.operatorId || pb.authStore.model?.id || ''
      recordData.correction_seconds = 0
    }

    const createdRecord = await pb.collection('portal_triage_history').create(recordData)
    return createdRecord.id
  } catch (err) {
    console.warn('[portal-triage] Erro ao registrar triagem de chamado filho no histórico:', err)
    return null
  }
}

export async function recordOperatorCorrection(params: {
  ticketId: string
  finalCategoryId: string
  finalCategoryName: string
  finalSubcategoryId?: string
  finalSubcategoryName?: string
  operatorId?: string
}): Promise<boolean> {
  try {
    if (!params.ticketId) return false

    // Buscar a última triagem associada a este chamado
    const historyList = await pb.collection('portal_triage_history').getList(1, 1, {
      filter: `ticket_id = "${params.ticketId}"`,
      sort: '-created',
    })

    if (historyList.items.length === 0) {
      return false
    }

    const latest = historyList.items[0]
    const suggestedCatId = latest.suggested_category_id || ''
    const suggestedSubcatId = latest.suggested_subcategory_id || ''

    // Se a categoria e subcategoria finais forem iguais às sugeridas pela IA,
    // não conta como erro/correção (ou pode ser confirmação da IA).
    const isDifferent =
      params.finalCategoryId !== suggestedCatId ||
      Boolean(params.finalSubcategoryId && params.finalSubcategoryId !== suggestedSubcatId)

    const now = new Date()
    const createdAt = latest.created ? new Date(latest.created) : now
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 1000))

    await pb.collection('portal_triage_history').update(latest.id, {
      operator_corrected: isDifferent,
      final_category_id: params.finalCategoryId,
      final_category_name: params.finalCategoryName,
      final_subcategory_id: params.finalSubcategoryId || '',
      final_subcategory_name: params.finalSubcategoryName || '',
      corrected_at: now.toISOString(),
      corrected_by: params.operatorId || pb.authStore.model?.id || '',
      correction_seconds: diffSeconds,
    })

    return true
  } catch (err) {
    console.warn('Falha ao registrar correção de triagem pelo operador:', err)
    return false
  }
}

/**
 * Calcula as métricas agregadas de satisfação e acurácia da IA no período especificado.
 */
export async function getPortalTriageMetrics(
  periodDays: number = 30,
): Promise<PortalTriageMetricsSummary> {
  const cutoffDate = new Date()
  if (periodDays > 0) {
    cutoffDate.setDate(cutoffDate.getDate() - periodDays)
  }
  const cutoffIso = cutoffDate.toISOString().replace('T', ' ')

  const filter = periodDays > 0 ? `created >= "${cutoffIso}"` : ''

  let allTriages: PortalTriageHistoryItem[] = []
  try {
    const res = await pb.collection('portal_triage_history').getFullList({
      filter: filter || undefined,
      sort: '-created',
    })
    allTriages = res.map((r: any) => ({
      id: r.id,
      ticket_id: r.ticket_id,
      ticket_number: r.ticket_number,
      ticket_title: r.ticket_title || r.title,
      suggested_category_id: r.suggested_category_id,
      suggested_category_name: r.suggested_category_name,
      suggested_subcategory_id: r.suggested_subcategory_id,
      suggested_subcategory_name: r.suggested_subcategory_name,
      queue_id: r.queue_id,
      queue_name: r.queue_name,
      confidence: typeof r.confidence === 'number' ? r.confidence : 0,
      reason: r.reason,
      applied: Boolean(r.applied),
      source: r.source,
      match_method: r.match_method,
      operator_corrected: Boolean(r.operator_corrected),
      final_category_id: r.final_category_id,
      final_category_name: r.final_category_name,
      final_subcategory_id: r.final_subcategory_id,
      final_subcategory_name: r.final_subcategory_name,
      corrected_at: r.corrected_at,
      corrected_by: r.corrected_by,
      correction_seconds: r.correction_seconds || 0,
      created: r.created,
      updated: r.updated,
    }))
  } catch (err) {
    console.warn('Erro ao carregar lista de triagens para métricas:', err)
  }

  const total = allTriages.length
  if (total === 0) {
    return {
      periodDays,
      totalTriages: 0,
      appliedCount: 0,
      appliedPct: 0,
      defaultQueueCount: 0,
      defaultQueuePct: 0,
      correctedCount: 0,
      correctedPct: 0,
      accuracyPct: 100,
      avgConfidence: 0,
      avgCorrectionMinutes: 0,
      lowConfidenceCount: 0,
      confidenceBuckets: { high: 0, medium: 0, low: 0 },
      topCorrectedActivities: [],
      topAccurateActivities: [],
    }
  }

  let appliedCount = 0
  let defaultQueueCount = 0
  let correctedCount = 0
  let sumConfidence = 0
  let sumCorrectionSeconds = 0
  let correctionsCountWithTime = 0
  let lowConfidenceCount = 0

  const buckets = { high: 0, medium: 0, low: 0 }
  const categoryStats: Record<
    string,
    {
      name: string
      total: number
      corrected: number
      accurate: number
      finalCats: Record<string, number>
    }
  > = {}

  for (const item of allTriages) {
    const conf = item.confidence || 0
    sumConfidence += conf

    if (conf >= 0.8) buckets.high++
    else if (conf >= 0.6) buckets.medium++
    else {
      buckets.low++
      lowConfidenceCount++
    }

    if (item.applied) {
      appliedCount++
    } else {
      defaultQueueCount++
    }

    if (item.operator_corrected) {
      correctedCount++
      if (item.correction_seconds && item.correction_seconds > 0) {
        sumCorrectionSeconds += item.correction_seconds
        correctionsCountWithTime++
      }
    }

    // Acompanhamento por atividade sugerida
    const catName = item.suggested_category_name || 'Sem atividade'
    const catId = item.suggested_category_id || 'unknown'
    if (!categoryStats[catId]) {
      categoryStats[catId] = {
        name: catName,
        total: 0,
        corrected: 0,
        accurate: 0,
        finalCats: {},
      }
    }
    categoryStats[catId].total++

    if (item.operator_corrected) {
      categoryStats[catId].corrected++
      const finalName = item.final_category_name || 'Outra'
      categoryStats[catId].finalCats[finalName] =
        (categoryStats[catId].finalCats[finalName] || 0) + 1
    } else {
      categoryStats[catId].accurate++
    }
  }

  const appliedPct = total > 0 ? Math.round((appliedCount / total) * 100) : 0
  const defaultQueuePct = total > 0 ? Math.round((defaultQueueCount / total) * 100) : 0
  const correctedPct = total > 0 ? Math.round((correctedCount / total) * 100) : 0
  const accuracyPct = Math.max(0, 100 - correctedPct)
  const avgConfidence = total > 0 ? Math.round((sumConfidence / total) * 100) / 100 : 0
  const avgCorrectionMinutes =
    correctionsCountWithTime > 0
      ? Math.round((sumCorrectionSeconds / correctionsCountWithTime / 60) * 10) / 10
      : 0

  // Atividades mais erradas (maior taxa de correção e volume)
  const categoryList = Object.entries(categoryStats).map(([id, st]) => ({
    categoryId: id,
    categoryName: st.name,
    totalSuggested: st.total,
    correctedCount: st.corrected,
    errorRatePct: st.total > 0 ? Math.round((st.corrected / st.total) * 100) : 0,
    finalCategoriesSummary: st.finalCats,
    accurateCount: st.accurate,
    accuracyRatePct: st.total > 0 ? Math.round((st.accurate / st.total) * 100) : 0,
  }))

  const topCorrected = [...categoryList]
    .filter((c) => c.correctedCount > 0)
    .sort((a, b) => b.correctedCount - a.correctedCount || b.errorRatePct - a.errorRatePct)
    .slice(0, 8)

  const topAccurate = [...categoryList]
    .filter((c) => c.accurateCount > 0)
    .sort((a, b) => b.accurateCount - a.accurateCount || b.accuracyRatePct - a.accuracyRatePct)
    .slice(0, 8)

  return {
    periodDays,
    totalTriages: total,
    appliedCount,
    appliedPct,
    defaultQueueCount,
    defaultQueuePct,
    correctedCount,
    correctedPct,
    accuracyPct,
    avgConfidence,
    avgCorrectionMinutes,
    lowConfidenceCount,
    confidenceBuckets: buckets,
    topCorrectedActivities: topCorrected,
    topAccurateActivities: topAccurate,
  }
}
