import pb from '@/lib/pocketbase/client'

export interface ClientNotificationSettings {
  id: string
  company?: string
  notify_ticket_created: boolean
  notify_ticket_resolved: boolean
  notify_focal_points: boolean
  scope: 'global' | 'company'
  created: string
  updated: string
}

const DEFAULTS: Omit<ClientNotificationSettings, 'id' | 'created' | 'updated'> = {
  company: '',
  notify_ticket_created: true,
  notify_ticket_resolved: true,
  notify_focal_points: false,
  scope: 'global',
}

/** Busca as configurações de notificações do cliente (global ou por empresa) */
export async function getClientNotificationSettings(
  companyId?: string,
): Promise<ClientNotificationSettings> {
  try {
    if (companyId) {
      const companyRecords = await pb
        .collection('client_notification_settings')
        .getFullList<ClientNotificationSettings>({
          filter: `company = "${companyId}"`,
          sort: '-created',
        })
      if (companyRecords.length > 0) return companyRecords[0]
    }

    const globalRecords = await pb
      .collection('client_notification_settings')
      .getFullList<ClientNotificationSettings>({
        filter: 'scope = "global"',
        sort: '-created',
      })
    if (globalRecords.length > 0) return globalRecords[0]
  } catch (_) {
    // collection pode não existir ou estar indisponível temporariamente
  }
  return { ...DEFAULTS, id: '', created: '', updated: '' } as ClientNotificationSettings
}

/** Salva (cria ou atualiza) a configuração de notificações do cliente */
export async function saveClientNotificationSettings(
  data: Partial<ClientNotificationSettings>,
  companyId?: string,
): Promise<ClientNotificationSettings> {
  const current = await getClientNotificationSettings(companyId)
  const payload = {
    ...DEFAULTS,
    ...data,
    company: companyId || '',
    scope: companyId ? ('company' as const) : ('global' as const),
  }

  if (current.id) {
    return pb
      .collection('client_notification_settings')
      .update<ClientNotificationSettings>(current.id, payload)
  }

  return pb.collection('client_notification_settings').create<ClientNotificationSettings>(payload)
}
