import pb from '@/lib/pocketbase/client'

export interface PrtgMappingRule {
  id: string
  matchText: string
  companyId: string
  companyName?: string
  queueId?: string
  activityId?: string
}

export interface PrtgSettings {
  id?: string
  prtg_enabled: boolean
  prtg_webhook_token: string
  prtg_default_priority: 'Baixa' | 'Média' | 'Alta' | 'Crítica'
  prtg_default_queue: string
  prtg_default_activity: string
  prtg_default_company: string
  prtg_dedup_hours: number
  prtg_auto_resolve_on_up: boolean
  prtg_mapping_rules: PrtgMappingRule[]
}

export interface PrtgSimulationResult {
  ok: boolean
  action?: 'ticket_created' | 'interaction_added' | 'ticket_resolved' | 'none'
  ticket_id?: string
  ticket_number?: string
  sensor?: string
  message?: string
  error?: string
}

export const prtgMonitoringService = {
  async getSettings(): Promise<PrtgSettings> {
    try {
      const records = await pb.collection('system_settings').getList<any>(1, 1, {
        filter: 'key = "global"',
        requestKey: null,
      })

      if (records.items.length > 0) {
        const item = records.items[0]
        let rules: PrtgMappingRule[] = []
        try {
          const rawRules = item.prtg_mapping_rules
          if (Array.isArray(rawRules)) {
            rules = rawRules
          } else if (typeof rawRules === 'string' && rawRules.trim()) {
            rules = JSON.parse(rawRules)
          }
        } catch {
          /* intentionally ignored */
        }

        return {
          id: item.id,
          prtg_enabled: item.prtg_enabled ?? false,
          prtg_webhook_token: item.prtg_webhook_token || 'prtg_live_token_aitilsm',
          prtg_default_priority: item.prtg_default_priority || 'Média',
          prtg_default_queue: item.prtg_default_queue || '',
          prtg_default_activity: item.prtg_default_activity || '',
          prtg_default_company: item.prtg_default_company || '',
          prtg_dedup_hours: Number(item.prtg_dedup_hours) || 4,
          prtg_auto_resolve_on_up: item.prtg_auto_resolve_on_up ?? true,
          prtg_mapping_rules: rules,
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações do PRTG de system_settings:', e)
    }

    return {
      prtg_enabled: false,
      prtg_webhook_token: 'prtg_live_token_aitilsm',
      prtg_default_priority: 'Média',
      prtg_default_queue: '',
      prtg_default_activity: '',
      prtg_default_company: '',
      prtg_dedup_hours: 4,
      prtg_auto_resolve_on_up: true,
      prtg_mapping_rules: [],
    }
  },

  async saveSettings(settings: PrtgSettings): Promise<PrtgSettings> {
    const payload = {
      key: 'global',
      prtg_enabled: !!settings.prtg_enabled,
      prtg_webhook_token: (settings.prtg_webhook_token || '').trim(),
      prtg_default_priority: settings.prtg_default_priority,
      prtg_default_queue: settings.prtg_default_queue || '',
      prtg_default_activity: settings.prtg_default_activity || '',
      prtg_default_company: settings.prtg_default_company || '',
      prtg_dedup_hours: Number(settings.prtg_dedup_hours) || 4,
      prtg_auto_resolve_on_up: !!settings.prtg_auto_resolve_on_up,
      prtg_mapping_rules: settings.prtg_mapping_rules || [],
    }

    if (settings.id) {
      const updated = await pb.collection('system_settings').update<any>(settings.id, payload)
      return {
        ...settings,
        id: updated.id,
      }
    } else {
      // Procurar se já existe global
      const records = await pb.collection('system_settings').getList<any>(1, 1, {
        filter: 'key = "global"',
        requestKey: null,
      })
      if (records.items.length > 0) {
        const updated = await pb
          .collection('system_settings')
          .update<any>(records.items[0].id, payload)
        return {
          ...settings,
          id: updated.id,
        }
      }
      const created = await pb.collection('system_settings').create<any>(payload)
      return {
        ...settings,
        id: created.id,
      }
    }
  },

  /**
   * Dispara um teste de webhook local simulando o payload enviado pelo PRTG.
   */
  async simulateWebhookAlert(params: {
    token: string
    sensor: string
    device: string
    status: string
    message: string
    lastvalue?: string
    priority?: string
  }): Promise<PrtgSimulationResult> {
    const baseUrl = (import.meta.env.VITE_POCKETBASE_URL || window.location.origin).replace(
      /\/$/,
      '',
    )
    const url = `${baseUrl}/backend/v1/webhooks/prtg?token=${encodeURIComponent(params.token)}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sensor: params.sensor,
        device: params.device,
        status: params.status,
        message: params.message,
        lastvalue: params.lastvalue || '98.5% packet loss',
        datetime: new Date().toISOString(),
        priority: params.priority || '3',
      }),
    })

    const data = await response.json()
    return data
  },
}
