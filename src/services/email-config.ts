import pb from '@/lib/pocketbase/client'

export type ImapEncryption = 'SSL/TLS' | 'STARTTLS' | 'Nenhuma'

export interface EmailConfigRecord {
  id: string
  imap_host: string
  imap_port: number
  imap_user: string
  imap_password?: string
  imap_ssl: boolean
  imap_encryption?: ImapEncryption
  inbox_folder?: string
  processed_folder?: string
  check_interval_minutes: number
  enabled: boolean
  last_check_at?: string
  last_check_status?: string
  last_check_error?: string
  webhook_token?: string
  created: string
  updated: string
}

export interface ImapTestStep {
  id: string
  name: string
  status: 'pending' | 'success' | 'warning' | 'failed' | 'skipped'
  message: string
  duration_ms: number
}

export interface ImapSampleMessage {
  uid: string
  from: string
  subject: string
  date: string
  status: string
}

export interface ImapTestResponse {
  success: boolean
  status: 'success' | 'failed' | 'warning'
  message: string
  tested_at: string
  host: string
  port: number
  user: string
  encryption: string
  inbox_folder: string
  processed_folder: string
  steps: ImapTestStep[]
  messages_count: number
  latest_messages: ImapSampleMessage[]
  cron_info?: {
    last_execution_at?: string
    last_execution_status?: string
    interval_minutes?: number
  }
}

export interface DryRunSimulationResult {
  message_sampled: {
    from: string
    from_name?: string
    subject: string
    body_preview: string
    domain: string
  }
  domain_check: {
    domain: string
    allowed: boolean
    company_id?: string
    company_name: string
  }
  requester_identification: {
    matched_user?: {
      id: string
      name: string
      email: string
      role?: string
    } | null
    matched_contact?: {
      id: string
      name: string
      email: string
      phone?: string
    } | null
    resolved_name: string
    phone?: string
  }
  ticket_routing: {
    is_reply: boolean
    existing_ticket?: {
      id: string
      number: string
      title: string
      status: string
    } | null
    suggested_queue: string
    suggested_category: string
    type: string
    priority: string
  }
  expected_destination: string
  explanation: string
  dry_run: boolean
  simulation_time: string
}

export interface DryRunResponse {
  success: boolean
  result: DryRunSimulationResult
  error?: string
}

export interface EmailAuditLogRecord {
  id: string
  test_type: 'connection_test' | 'dry_run_simulation'
  executed_by?: string
  executed_by_name?: string
  executed_by_email?: string
  status: 'success' | 'warning' | 'failed'
  host?: string
  port?: number
  user_account?: string
  inbox_folder?: string
  encryption?: string
  steps_result?: ImapTestStep[]
  summary_message?: string
  latest_messages_count?: number
  latest_messages?: ImapSampleMessage[]
  dry_run_result?: DryRunSimulationResult
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
  const encryption = data.imap_encryption || (data.imap_ssl === false ? 'STARTTLS' : 'SSL/TLS')
  const isSsl = encryption === 'SSL/TLS'

  const payload = {
    ...data,
    imap_encryption: encryption,
    imap_ssl: isSsl,
    inbox_folder: data.inbox_folder || 'INBOX',
    processed_folder: data.processed_folder || 'Processados',
  }

  if (current) {
    return pb.collection('email_config').update<EmailConfigRecord>(current.id, payload)
  }
  return pb.collection('email_config').create<EmailConfigRecord>({
    imap_host: data.imap_host || 'imap.gmail.com',
    imap_port: data.imap_port || 993,
    imap_user: data.imap_user || '',
    imap_password: data.imap_password || '',
    imap_ssl: isSsl,
    imap_encryption: encryption,
    inbox_folder: 'INBOX',
    processed_folder: 'Processados',
    check_interval_minutes: data.check_interval_minutes || 2,
    enabled: data.enabled ?? false,
    webhook_token: data.webhook_token || undefined,
    ...payload,
  })
}

export const testEmailConnection = async (data: {
  imap_host: string
  imap_port: number
  imap_user: string
  imap_pass?: string
  imap_password?: string
  imap_ssl?: boolean
  imap_encryption?: ImapEncryption
  inbox_folder?: string
  processed_folder?: string
}): Promise<ImapTestResponse> => {
  return pb.send<ImapTestResponse>('/backend/v1/emails/test-connection', {
    method: 'POST',
    body: data,
  })
}

export const runEmailDryRunSimulation = async (data?: {
  from?: string
  from_name?: string
  subject?: string
  body?: string
}): Promise<DryRunResponse> => {
  return pb.send<DryRunResponse>('/backend/v1/emails/dry-run', {
    method: 'POST',
    body: data || {},
  })
}

export const getEmailAuditLogs = async (limit = 10): Promise<EmailAuditLogRecord[]> => {
  try {
    const records = await pb.collection('email_audit_logs').getList<EmailAuditLogRecord>(1, limit, {
      sort: '-created',
      requestKey: 'get_email_audit_logs',
    })
    return records.items
  } catch {
    return []
  }
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
