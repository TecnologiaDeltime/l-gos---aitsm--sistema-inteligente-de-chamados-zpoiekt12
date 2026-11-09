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
  queue?: string
  debug?: string[]
}

export const DEFAULT_TRIAGE_SETTINGS: PortalTriageSettings = {
  portal_auto_triage_enabled: true,
  portal_triage_default_queue: '',
  portal_triage_min_confidence: 0.4,
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
