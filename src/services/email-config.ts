import pb from '@/lib/pocketbase/client'

export type ImapEncryption = 'SSL/TLS' | 'STARTTLS' | 'Nenhuma'
export type SmtpEncryption = 'STARTTLS' | 'SSL/TLS' | 'Nenhuma'
export type EmailReceptionMode = 'graph' | 'imap'

export interface EmailConfigRecord {
  id: string
  reception_mode?: EmailReceptionMode
  graph_tenant_id?: string
  graph_client_id?: string
  graph_client_secret?: string
  graph_mailbox?: string
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
  last_processed_count?: number
  total_ingested_count?: number
  total_retained_count?: number
  smtp_host?: string
  smtp_port?: number
  smtp_encryption?: SmtpEncryption
  smtp_user?: string
  smtp_password?: string
  smtp_sender_name?: string
  smtp_reply_to?: string
  retention_enabled?: boolean
  retention_days?: number
  retention_action?: EmailRetentionAction
  archive_folder?: string
  last_retention_at?: string
  last_retention_status?: string
  last_retention_error?: string
  last_retention_count?: number
  total_archived_count?: number
  total_deleted_count?: number
  created: string
  updated: string
}

export interface ImapTestStep {
  id?: string
  step?: number
  name: string
  status: 'pending' | 'success' | 'warning' | 'failed' | 'skipped'
  message?: string
  detail?: string
  duration_ms: number
}

export interface ImapSampleMessage {
  id?: string
  uid?: string
  message_id?: string
  from: string
  from_name?: string
  subject: string
  date: string
  is_read?: boolean
  status?: string
}

export interface ImapTestResponse {
  success: boolean
  reception_mode?: EmailReceptionMode
  status?: 'success' | 'failed' | 'warning'
  message?: string
  summary_message?: string
  tested_at?: string
  host?: string
  port?: number
  user?: string
  encryption?: string
  inbox_folder?: string
  processed_folder?: string
  steps: ImapTestStep[]
  messages_count?: number
  latest_messages?: ImapSampleMessage[]
  samples?: ImapSampleMessage[]
  stats?: {
    unread_count?: number
    total_recent?: number
    mailbox?: string
    display_name?: string
    inbox_folder?: string
  }
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

export type EmailRetentionAction = 'archive' | 'delete'

export interface RetentionRunResponse {
  success: boolean
  action?: EmailRetentionAction
  retention_days?: number
  processed_count?: number
  archived_count?: number
  deleted_count?: number
  cutoff_date?: string
  summary?: string
  duration_ms?: number
  samples?: Array<{
    subject: string
    from: string
    date: string
    action: string
  }>
  errors?: string[]
  error?: string
  skipped?: boolean
  message?: string
}

export const isGuidSecretId = (val?: string): boolean => {
  if (!val) return false
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    val.trim(),
  )
}

export const GRAPH_SECRET_ID_WARNING =
  "O campo 'Segredo do Cliente' parece conter o ID do Segredo (identificador) e não o VALOR do segredo. No Entra ID > Certificados e segredos, copie a coluna 'Valor' do segredo — ela só é exibida uma vez na criação; se não estiver mais visível, crie um novo segredo e cole o Valor aqui."

export interface RetentionStatsResponse {
  enabled: boolean
  retention_days: number
  action: EmailRetentionAction
  archive_folder: string
  processed_folder: string
  processed_waiting_count: number
  eligible_for_retention_count: number
  folder_found?: boolean
  inspect_error?: string | null
  last_execution_at: string | null
  last_execution_status: string | null
  last_execution_error: string | null
  last_execution_count: number
  total_archived: number
  total_deleted: number
  next_schedule: string
}

export type EmailAuditTestType =
  | 'connection_test'
  | 'dry_run_simulation'
  | 'teste-envio'
  | 'teste-smtp'
  | 'retencao'
  | 'abertura_chamado'
  | 'resolucao_chamado'
  | 'alerta_sla'
  | 'aprovacao_chamado'
  | 'resposta_automatica'

export interface EmailAuditLogRecord {
  id: string
  test_type: EmailAuditTestType
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
  dry_run_result?: any
  created: string
  updated: string
}

export interface SendTestEmailPayload {
  to: string
}

export interface SendTestEmailResponse {
  success: boolean
  message: string
  target_email: string
  sender_email?: string
  sender_name?: string
  sent_at?: string
  subject?: string
  smtp_used?: 'dedicated_mailbox' | 'serviceone_fallback' | string
  smtp_host?: string
  error?: string
}

export interface SmtpTestStep {
  id: string
  name: string
  status: 'pending' | 'success' | 'warning' | 'failed' | 'skipped'
  message: string
  duration_ms: number
}

export interface SmtpTestResponse {
  success: boolean
  status: 'success' | 'failed' | 'warning'
  message: string
  duration_ms?: number
  steps: SmtpTestStep[]
  smtp_used?: 'dedicated_mailbox' | 'serviceone_fallback' | string
  host?: string
  port?: number
  user?: string
  target_email?: string
  error?: string
}

export interface TestSmtpConnectionParams {
  smtp_host?: string
  smtp_port?: number
  smtp_encryption?: SmtpEncryption
  smtp_user?: string
  smtp_password?: string
  smtp_sender_name?: string
  smtp_reply_to?: string
  to?: string
  recipient?: string
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
    graph_tenant_id: data.graph_tenant_id ? data.graph_tenant_id.trim() : data.graph_tenant_id,
    graph_client_id: data.graph_client_id ? data.graph_client_id.trim() : data.graph_client_id,
    graph_client_secret: data.graph_client_secret
      ? data.graph_client_secret.trim()
      : data.graph_client_secret,
    graph_mailbox: data.graph_mailbox ? data.graph_mailbox.trim() : data.graph_mailbox,
    imap_encryption: encryption,
    imap_ssl: isSsl,
    inbox_folder: data.inbox_folder || 'INBOX',
    processed_folder: data.processed_folder || 'Processados',
  }

  if (current) {
    // Se o valor nos campos de senha não tiver mudado ou estiver vazio/cifrado vindo do registro atual sem alteração pelo usuário,
    // preservamos o valor atual do banco para não sobrescrever com strings vazias ou desnecessárias
    const updatePayload: Record<string, any> = { ...payload }
    if (updatePayload.imap_password === undefined || updatePayload.imap_password === '') {
      delete updatePayload.imap_password
    }
    if (updatePayload.smtp_password === undefined || updatePayload.smtp_password === '') {
      delete updatePayload.smtp_password
    }
    if (
      updatePayload.graph_client_secret === undefined ||
      updatePayload.graph_client_secret === ''
    ) {
      delete updatePayload.graph_client_secret
    }
    return pb.collection('email_config').update<EmailConfigRecord>(current.id, updatePayload)
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
    smtp_host: data.smtp_host || 'smtp.office365.com',
    smtp_port: data.smtp_port || 587,
    smtp_encryption: data.smtp_encryption || 'STARTTLS',
    smtp_user: data.smtp_user || '',
    smtp_password: data.smtp_password || '',
    smtp_sender_name: data.smtp_sender_name || 'Atendimento HelpDesk',
    smtp_reply_to: data.smtp_reply_to || '',
    ...payload,
  })
}

export const testEmailConnection = async (data: {
  reception_mode?: EmailReceptionMode
  graph_tenant_id?: string
  graph_client_id?: string
  graph_client_secret?: string
  graph_mailbox?: string
  imap_host?: string
  imap_port?: number
  imap_user?: string
  imap_pass?: string
  imap_password?: string
  imap_ssl?: boolean
  imap_encryption?: ImapEncryption
  inbox_folder?: string
  processed_folder?: string
}): Promise<ImapTestResponse> => {
  const cleanedData = {
    ...data,
    graph_tenant_id: data.graph_tenant_id ? data.graph_tenant_id.trim() : data.graph_tenant_id,
    graph_client_id: data.graph_client_id ? data.graph_client_id.trim() : data.graph_client_id,
    graph_client_secret: data.graph_client_secret
      ? data.graph_client_secret.trim()
      : data.graph_client_secret,
    graph_mailbox: data.graph_mailbox ? data.graph_mailbox.trim() : data.graph_mailbox,
  }
  return pb.send<ImapTestResponse>('/backend/v1/emails/test-connection', {
    method: 'POST',
    body: cleanedData,
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

export const testSmtpConnection = async (
  params: TestSmtpConnectionParams,
): Promise<SmtpTestResponse> => {
  return pb.send<SmtpTestResponse>('/backend/v1/emails/test-smtp', {
    method: 'POST',
    body: params,
  })
}

export const sendTestEmail = async (data: SendTestEmailPayload): Promise<SendTestEmailResponse> => {
  return pb.send<SendTestEmailResponse>('/backend/v1/emails/send-test', {
    method: 'POST',
    body: data,
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

export const runEmailRetentionNow = async (): Promise<RetentionRunResponse> => {
  return pb.send<RetentionRunResponse>('/backend/v1/emails/retention/run', {
    method: 'POST',
  })
}

export const getEmailRetentionStats = async (): Promise<RetentionStatsResponse> => {
  return pb.send<RetentionStatsResponse>('/backend/v1/emails/retention/stats', {
    method: 'GET',
  })
}
