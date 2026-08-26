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
  imap_password?: string
  imap_ssl: boolean
}) => {
  return pb.send('/backend/v1/emails/test-connection', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const ingestEmailWebhook = async (data: {
  from: string
  from_name?: string
  subject: string
  body: string
  token?: string
}) => {
  return pb.send('/backend/v1/emails/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}
