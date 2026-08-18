import pb from '@/lib/pocketbase/client'

export interface ConsumptionAlertConfig {
  id: string
  enabled: boolean
  notify_admins: boolean
  notify_focal_points: boolean
  notify_ticket_responsible: boolean
  notify_quality_team: boolean
  notify_company_responsible: boolean
  quality_team_emails: string
  threshold_80_enabled: boolean
  threshold_90_enabled: boolean
  threshold_100_enabled: boolean
  company?: string
  last_notified_level_pcts?: Record<string, number>
  created?: string
  updated?: string
}

const DEFAULTS: Omit<ConsumptionAlertConfig, 'id' | 'created' | 'updated'> = {
  enabled: true,
  notify_admins: true,
  notify_focal_points: true,
  notify_ticket_responsible: true,
  notify_quality_team: false,
  notify_company_responsible: true,
  quality_team_emails: '',
  threshold_80_enabled: true,
  threshold_90_enabled: true,
  threshold_100_enabled: true,
  company: '',
  last_notified_level_pcts: {},
}

/** Busca a configuração global de alertas de consumo (cria com defaults se não existir). */
export async function getConsumptionAlertConfig(): Promise<ConsumptionAlertConfig> {
  try {
    const list = await pb
      .collection('consumption_alert_configs')
      .getFullList<ConsumptionAlertConfig>({ filter: 'company = ""', sort: '-created' })
    if (list.length > 0) return list[0]
  } catch (_) {
    // collection pode não existir ainda (antes da migração) — retorna defaults.
  }
  return { ...DEFAULTS, id: '', created: '', updated: '' } as ConsumptionAlertConfig
}

/** Atualiza (ou cria) a configuração global de alertas de consumo de horas. */
export async function saveConsumptionAlertConfig(
  config: Partial<ConsumptionAlertConfig>,
): Promise<ConsumptionAlertConfig> {
  const existing = await getConsumptionAlertConfig()
  const payload: Partial<ConsumptionAlertConfig> = {
    enabled: config.enabled,
    notify_admins: config.notify_admins,
    notify_focal_points: config.notify_focal_points,
    notify_ticket_responsible: config.notify_ticket_responsible,
    notify_quality_team: config.notify_quality_team,
    notify_company_responsible: config.notify_company_responsible,
    quality_team_emails: config.quality_team_emails,
    threshold_80_enabled: config.threshold_80_enabled,
    threshold_90_enabled: config.threshold_90_enabled,
    threshold_100_enabled: config.threshold_100_enabled,
  }
  if (existing.id) {
    return pb
      .collection('consumption_alert_configs')
      .update<ConsumptionAlertConfig>(existing.id, payload)
  }
  return pb.collection('consumption_alert_configs').create<ConsumptionAlertConfig>({
    ...DEFAULTS,
    ...payload,
  })
}
