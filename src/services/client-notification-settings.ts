import pb from '@/lib/pocketbase/client'

export interface ClientNotificationSettings {
  id: string
  company?: string
  notify_ticket_created: boolean
  notify_ticket_resolved: boolean
  notify_focal_points: boolean
  reopen_window_days?: number
  scope: 'global' | 'company'
  created: string
  updated: string
}

export const DEFAULT_REOPEN_WINDOW_DAYS = 2

const DEFAULTS: Omit<ClientNotificationSettings, 'id' | 'created' | 'updated'> = {
  company: '',
  notify_ticket_created: true,
  notify_ticket_resolved: true,
  notify_focal_points: false,
  reopen_window_days: DEFAULT_REOPEN_WINDOW_DAYS,
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
      if (companyRecords.length > 0) {
        const item = companyRecords[0]
        if (item.reopen_window_days === undefined || item.reopen_window_days === null) {
          item.reopen_window_days = DEFAULT_REOPEN_WINDOW_DAYS
        }
        return item
      }
    }

    const globalRecords = await pb
      .collection('client_notification_settings')
      .getFullList<ClientNotificationSettings>({
        filter: 'scope = "global"',
        sort: '-created',
      })
    if (globalRecords.length > 0) {
      const item = globalRecords[0]
      if (item.reopen_window_days === undefined || item.reopen_window_days === null) {
        item.reopen_window_days = DEFAULT_REOPEN_WINDOW_DAYS
      }
      return item
    }
  } catch (_) {
    // collection pode não existir ou estar indisponível temporariamente
  }
  return { ...DEFAULTS, id: '', created: '', updated: '' } as ClientNotificationSettings
}

/**
 * Retorna os dias configurados para prazo de reabertura após resolução.
 * Padrão sensato: 2 dias.
 */
export async function getReopenWindowDays(companyId?: string): Promise<number> {
  const settings = await getClientNotificationSettings(companyId)
  if (typeof settings.reopen_window_days === 'number' && settings.reopen_window_days >= 0) {
    return settings.reopen_window_days
  }
  return DEFAULT_REOPEN_WINDOW_DAYS
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
