import pb from '@/lib/pocketbase/client'

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
  system_instructions: string
  tag_suggestions_enabled?: boolean
}

export interface AiTicketDraftResponse {
  ticketId: string
  ticketNumber: string
  draft: string
  mode: string
  generatedAt: string
}

export interface AiTicketTagsResponse {
  ticketId: string
  ticketNumber: string
  currentTags: string[]
  suggestedTags: string[]
  generatedAt: string
}

export async function getAiTicketSettings(): Promise<AiTicketSettings> {
  try {
    const res = await pb.send<{ [key: string]: unknown }>('/backend/v1/ai/ticket-settings', {
      method: 'GET',
    })
    return {
      id: typeof res.id === 'string' ? res.id : '',
      scope: 'global',
      enabled: Boolean(res.enabled ?? true),
      mode: (res.mode as AiTicketMode) || 'both',
      auto_reply_internal: Boolean(res.auto_reply_internal ?? true),
      auto_reply_portal: Boolean(res.auto_reply_portal ?? true),
      include_kb: Boolean(res.include_kb ?? true),
      include_history: Boolean(res.include_history ?? true),
      include_asset: Boolean(res.include_asset ?? true),
      system_instructions:
        typeof res.system_instructions === 'string' ? res.system_instructions : '',
      tag_suggestions_enabled: Boolean(res.tag_suggestions_enabled ?? true),
    }
  } catch (err) {
    console.warn('[AI_TICKET_SERVICE] Falha ao carregar configurações de IA:', err)
    return {
      scope: 'global',
      enabled: true,
      mode: 'both',
      auto_reply_internal: true,
      auto_reply_portal: true,
      include_kb: true,
      include_history: true,
      include_asset: true,
      system_instructions: '',
      tag_suggestions_enabled: true,
    }
  }
}

export async function saveAiTicketSettings(
  settings: Partial<AiTicketSettings>,
): Promise<AiTicketSettings> {
  const res = await pb.send<{ message: string; settings: AiTicketSettings }>(
    '/backend/v1/ai/ticket-settings',
    {
      method: 'POST',
      body: settings,
    },
  )
  return res.settings
}

export async function generateTicketDraft(options: {
  ticketId: string
  prompt?: string
}): Promise<AiTicketDraftResponse> {
  return pb.send<AiTicketDraftResponse>('/backend/v1/ai/ticket-draft', {
    method: 'POST',
    body: {
      ticketId: options.ticketId,
      prompt: options.prompt,
    },
  })
}

export async function generateTicketTags(ticketId: string): Promise<AiTicketTagsResponse> {
  return pb.send<AiTicketTagsResponse>('/backend/v1/ai/ticket-tags', {
    method: 'POST',
    body: {
      ticketId,
    },
  })
}

export const aiTicketReplyService = {
  getSettings: getAiTicketSettings,
  saveSettings: saveAiTicketSettings,
  generateDraft: generateTicketDraft,
  generateTags: generateTicketTags,
}
