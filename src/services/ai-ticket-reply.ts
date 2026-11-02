import { pb } from '@/lib/pocketbase/client'

export type AiTicketMode = 'suggestion' | 'automatic' | 'both'

export interface AiTicketSettings {
  id?: string
  scope: 'global'
  enabled: boolean
  mode: AiTicketMode
  auto_reply_internal: boolean
  auto_reply_portal: boolean
  include_kb: boolean
  include_history: boolean
  include_asset: boolean
  system_instructions?: string
}

export interface AiTicketDraftRequest {
  ticketId: string
  prompt?: string
}

export interface AiTicketDraftResponse {
  ticketId: string
  ticketNumber: string
  draft: string
  mode: AiTicketMode
  generatedAt: string
}

export const aiTicketReplyService = {
  async getSettings(): Promise<AiTicketSettings> {
    try {
      // Tentar via endpoint backend
      const res = await pb.send<AiTicketSettings>('/backend/v1/ai/ticket-settings', {
        method: 'GET',
      })
      if (res && typeof res.enabled === 'boolean') {
        return res
      }
    } catch (err) {
      console.warn('[aiTicketReplyService] Fallback para leitura da collection:', err)
    }

    // Fallback: consulta direta na collection ai_ticket_settings
    try {
      const records = await pb.collection('ai_ticket_settings').getList(1, 1, {
        filter: 'scope = "global"',
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        return {
          id: item.id,
          scope: 'global',
          enabled: !!item.enabled,
          mode: (item.mode as AiTicketMode) || 'both',
          auto_reply_internal: !!item.auto_reply_internal,
          auto_reply_portal: !!item.auto_reply_portal,
          include_kb: !!item.include_kb,
          include_history: !!item.include_history,
          include_asset: !!item.include_asset,
          system_instructions: item.system_instructions || '',
        }
      }
    } catch {
      /* intentionally ignored */
    }

    return {
      scope: 'global',
      enabled: true,
      mode: 'both',
      auto_reply_internal: true,
      auto_reply_portal: true,
      include_kb: true,
      include_history: true,
      include_asset: true,
      system_instructions:
        'Seja cordial, profissional e forneça passos técnicos objetivos e claros.',
    }
  },

  async saveSettings(settings: Partial<AiTicketSettings>): Promise<AiTicketSettings> {
    const res = await pb.send<{ message: string; settings: AiTicketSettings }>(
      '/backend/v1/ai/ticket-settings',
      {
        method: 'POST',
        body: settings,
      },
    )
    return res.settings
  },

  async generateDraft(req: AiTicketDraftRequest): Promise<AiTicketDraftResponse> {
    const res = await pb.send<AiTicketDraftResponse>('/backend/v1/ai/ticket-draft', {
      method: 'POST',
      body: req,
    })
    return res
  },
}
