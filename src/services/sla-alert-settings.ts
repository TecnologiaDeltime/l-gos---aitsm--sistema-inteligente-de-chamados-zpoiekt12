import pb from '@/lib/pocketbase/client'

export interface SlaAlertSettings {
  id: string
  company: string
  enabled: boolean
  popup_enabled: boolean
  email_enabled: boolean
  voice_enabled: boolean
  minutes_before_expiry: number
  interval_minutes: number
  scope: string
  last_alert_at?: string
  created: string
  updated: string
}

const DEFAULTS: Omit<SlaAlertSettings, 'id' | 'created' | 'updated'> = {
  company: '',
  enabled: true,
  popup_enabled: true,
  email_enabled: true,
  voice_enabled: true,
  minutes_before_expiry: 60,
  interval_minutes: 10,
  scope: 'global',
  last_alert_at: '',
}

/** Busca a configuração global de alertas de SLA (cria com defaults se não existir). */
export async function getSlaAlertSettings(): Promise<SlaAlertSettings> {
  try {
    const list = await pb
      .collection('sla_alert_settings')
      .getFullList<SlaAlertSettings>({ filter: 'scope = "global"', sort: '-created' })
    if (list.length > 0) return list[0]
  } catch (_) {
    // collection pode não existir ainda (antes da migração) — retorna defaults.
  }
  return { ...DEFAULTS, id: '', created: '', updated: '' } as SlaAlertSettings
}

/** Atualiza (ou cria) a configuração global de alertas de SLA. */
export async function saveSlaAlertSettings(
  data: Partial<SlaAlertSettings>,
): Promise<SlaAlertSettings> {
  const existing = await getSlaAlertSettings()
  if (existing.id) {
    return pb.collection('sla_alert_settings').update<SlaAlertSettings>(existing.id, data)
  }
  return pb.collection('sla_alert_settings').create<SlaAlertSettings>({ ...DEFAULTS, ...data })
}
