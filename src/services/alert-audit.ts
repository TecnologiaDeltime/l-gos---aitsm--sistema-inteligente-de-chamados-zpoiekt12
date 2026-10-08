import pb from '@/lib/pocketbase/client'

export type AlertType =
  | 'STALE_TICKET'
  | 'SLA_RESPONSE'
  | 'SLA_RESOLUTION'
  | 'CONSUMPTION'
  | 'RETAINED_TICKETS'
export type AlertAuditAction = 'DISMISSED' | 'OPENED' | 'VIEWED' | 'MUTE_ALERTS' | 'UNMUTE_ALERTS'

export interface AlertAuditMetadata {
  hoursStale?: number
  ticketNumber?: string
  remainingMinutes?: number
  level?: string
  percentage?: number
  contractNumber?: string
  companyName?: string
  clientName?: string
  title?: string
  message?: string
  retainedCount?: number
  muted?: boolean
  operatorName?: string
  operatorEmail?: string
  reason?: string
  [key: string]: any
}

export interface AlertAuditLogRecord {
  id: string
  alert_type: AlertType
  ticket?: string
  contract?: string
  operator: string
  action: AlertAuditAction
  metadata?: AlertAuditMetadata
  created: string
  updated: string
  expand?: {
    ticket?: {
      id: string
      number: string
      title: string
      company?: string
      expand?: {
        company?: {
          id: string
          trade_name?: string
          legal_name?: string
          name?: string
        }
      }
    }
    contract?: {
      id: string
      number: string
      company?: string
    }
    operator?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
  }
}

export interface CreateAlertAuditLogParams {
  alert_type: AlertType
  ticket?: string
  contract?: string
  operator: string
  action: AlertAuditAction
  metadata?: AlertAuditMetadata
}

/**
 * Cria um registro de auditoria de alerta quando o operador interage (OPENED, DISMISSED, VIEWED).
 */
export async function createAlertAuditLog(
  data: CreateAlertAuditLogParams,
): Promise<AlertAuditLogRecord> {
  return pb.collection('alert_audit_logs').create<AlertAuditLogRecord>(data)
}

export interface GetAlertAuditLogsFilters {
  startDate?: string
  endDate?: string
  alertType?: string
  action?: string
  operatorId?: string
}

/**
 * Lista registros de auditoria de alertas com suporte a filtros e ordenação por data decrescente.
 */
export async function getAlertAuditLogs(
  filters?: GetAlertAuditLogsFilters,
): Promise<AlertAuditLogRecord[]> {
  const filterParts: string[] = []

  if (filters?.startDate) {
    filterParts.push(`created >= "${filters.startDate} 00:00:00.000Z"`)
  }
  if (filters?.endDate) {
    filterParts.push(`created <= "${filters.endDate} 23:59:59.999Z"`)
  }
  if (filters?.alertType && filters.alertType !== 'all') {
    filterParts.push(`alert_type = "${filters.alertType}"`)
  }
  if (filters?.action && filters.action !== 'all') {
    filterParts.push(`action = "${filters.action}"`)
  }
  if (filters?.operatorId && filters.operatorId !== 'all') {
    filterParts.push(`operator = "${filters.operatorId}"`)
  }

  return pb.collection('alert_audit_logs').getFullList<AlertAuditLogRecord>({
    filter: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
    sort: '-created',
    expand: 'ticket,ticket.company,contract,operator',
  })
}
