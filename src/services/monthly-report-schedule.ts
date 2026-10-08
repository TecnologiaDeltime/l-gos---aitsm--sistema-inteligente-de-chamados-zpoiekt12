import pb from '@/lib/pocketbase/client'

export interface MonthlyReportScheduleRecord {
  id: string
  company: string
  enabled: boolean
  send_day: number
  use_focal_points: boolean
  manual_recipients?: string
  last_sent_at?: string
  last_sent_month?: string
  created_by?: string
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      legal_name?: string
      trade_name?: string
    }
  }
}

export interface MonthlyReportSendLogRecord {
  id: string
  company: string
  report_month: string
  recipients: string
  status: 'sucesso' | 'falha'
  error_message?: string
  sent_at: string
  triggered_by: string
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      legal_name?: string
      trade_name?: string
    }
  }
}

export const getMonthlyReportScheduleForCompany = async (
  companyId: string,
): Promise<MonthlyReportScheduleRecord | null> => {
  try {
    const records = await pb
      .collection('monthly_report_schedules')
      .getFullList<MonthlyReportScheduleRecord>({
        filter: `company = "${companyId}"`,
        sort: '-created',
        limit: 1,
      })
    return records[0] || null
  } catch {
    return null
  }
}

export const saveMonthlyReportSchedule = async (
  companyId: string,
  data: Partial<MonthlyReportScheduleRecord>,
): Promise<MonthlyReportScheduleRecord> => {
  const existing = await getMonthlyReportScheduleForCompany(companyId)
  if (existing) {
    return pb
      .collection('monthly_report_schedules')
      .update<MonthlyReportScheduleRecord>(existing.id, data)
  }
  return pb.collection('monthly_report_schedules').create<MonthlyReportScheduleRecord>({
    ...data,
    company: companyId,
  })
}

export const getMonthlyReportLogsForCompany = async (
  companyId: string,
  limit = 20,
): Promise<MonthlyReportSendLogRecord[]> => {
  try {
    return await pb.collection('monthly_report_send_logs').getFullList<MonthlyReportSendLogRecord>({
      filter: `company = "${companyId}"`,
      sort: '-created',
      limit,
    })
  } catch {
    return []
  }
}

export const sendMonthlyReportNow = async (
  companyId: string,
  monthKey: string,
  extraEmails: string[] = [],
): Promise<{ success: boolean; company: string; month: string; recipients: string[] }> => {
  return await pb.send('/backend/v1/reports/monthly-client/send', {
    method: 'POST',
    body: {
      company_id: companyId,
      month_key: monthKey,
      extra_emails: extraEmails,
    },
  })
}
