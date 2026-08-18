import pb from '@/lib/pocketbase/client'

export interface StaleTicketAlertSettings {
  id: string
  company: string
  enabled: boolean
  popup_enabled: boolean
  voice_enabled: boolean
  hours_without_update: number
  scope: string
  last_alert_at?: string
  created: string
  updated: string
}

const DEFAULTS: Omit<StaleTicketAlertSettings, 'id' | 'created' | 'updated'> = {
  company: '',
  enabled: true,
  popup_enabled: true,
  voice_enabled: true,
  hours_without_update: 8,
  scope: 'global',
  last_alert_at: '',
}

/** Busca a configuração global de alertas de chamados sem atualização. */
export async function getStaleTicketAlertSettings(): Promise<StaleTicketAlertSettings> {
  try {
    const list = await pb
      .collection('stale_ticket_alert_settings')
      .getFullList<StaleTicketAlertSettings>({ filter: 'scope = "global"', sort: '-created' })
    if (list.length > 0) return list[0]
  } catch (_) {
    // collection pode não existir ainda (antes da migração) — retorna defaults.
  }
  return { ...DEFAULTS, id: '', created: '', updated: '' } as StaleTicketAlertSettings
}

/** Atualiza (ou cria) a configuração global de alertas de chamados sem atualização. */
export async function saveStaleTicketAlertSettings(
  data: Partial<StaleTicketAlertSettings>,
): Promise<StaleTicketAlertSettings> {
  const existing = await getStaleTicketAlertSettings()
  if (existing.id) {
    return pb
      .collection('stale_ticket_alert_settings')
      .update<StaleTicketAlertSettings>(existing.id, data)
  }
  return pb
    .collection('stale_ticket_alert_settings')
    .create<StaleTicketAlertSettings>({ ...DEFAULTS, ...data })
}
