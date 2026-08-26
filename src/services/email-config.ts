import pb from '@/lib/pocketbase/client'

export interface EmailConfigRecord {
  id: string
  imap_host: string
  imap_port: number
  imap_user: string
  imap_ssl: boolean
  check_interval_minutes: number
  enabled: boolean
  last_check_at?: string
  last_check_status?: string
  last_check_error?: string
  webhook_token?: string
  created: string
  updated: string
}

export const getEmailConfig = async (): Promise<EmailConfigRecord | null> => {
  try {
    const records = await pb.collection('email_config').getFullList<EmailConfigRecord>({
      sort: '-created',
      requestKey: 'get_email_config',
    })
    return records.length > 0 ? records[0] : null
  } catch {
    return null
  }
}

export const saveEmailConfig = async (
  data: Partial<EmailConfigRecord>,
): Promise<EmailConfigRecord> => {
  const current = await getEmailConfig()
  if (current) {
    return pb.collection('email_config').update<EmailConfigRecord>(current.id, data)
  }
  return pb.collection('email_config').create<EmailConfigRecord>({
    imap_host: data.imap_host || 'imap.gmail.com',
    imap_port: data.imap_port || 993,
    imap_user: data.imap_user || '',
    imap_ssl: data.imap_ssl ?? true,
    check_interval_minutes: data.check_interval_minutes || 2,
    enabled: data.enabled ?? false,
    webhook_token: data.webhook_token || undefined,
    ...data,
  })
}

export const testEmailConnection = async (data: {
  imap_host: string
  imap_port: number
  imap_user: string
  imap_pass?: string
  imap_password?: string
  imap_ssl?: boolean
}) => {
  return pb.send<{ success: boolean; message: string; tested_at?: string; status?: string }>(
    '/backend/v1/emails/test-connection',
    {
      method: 'POST',
      body: data,
    },
  )
}

export interface IngestAttachmentPayload {
  filename: string
  content_type?: string
  data_base64?: string
  url?: string
  file_size?: number
}

export interface IngestEmailResponse {
  status: 'created' | 'replied' | 'retained'
  message: string
  ticket_id?: string
  ticket_number?: string
  interaction_id?: string
  reopened?: boolean
  attachments_count?: number
  retained_id?: string
  triage_suggestions?: any
}

export const ingestEmailWebhook = async (data: {
  from: string
  from_name?: string
  subject: string
  body: string
  token?: string
  attachments?: IngestAttachmentPayload[]
}): Promise<IngestEmailResponse> => {
  return pb.send<IngestEmailResponse>('/backend/v1/emails/ingest', {
    method: 'POST',
    body: data,
  })
}
