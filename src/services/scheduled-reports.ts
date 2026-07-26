import pb from '@/lib/pocketbase/client'

export interface ScheduledReportRecord {
  id: string
  name: string
  report_types: string[]
  recipient_emails: string
  day_of_month: number
  last_sent?: string
  next_run?: string
  active: boolean
  created: string
  updated: string
}

export function calculateNextRun(dayOfMonth: number, fromDate = new Date()): string {
  const next = new Date(fromDate)
  if (next.getDate() >= dayOfMonth) {
    next.setMonth(next.getMonth() + 1)
  }
  next.setDate(dayOfMonth)
  next.setHours(2, 0, 0, 0)
  return next.toISOString()
}

export const getScheduledReports = () =>
  pb.collection('scheduled_reports').getFullList<ScheduledReportRecord>({ sort: '-created' })

export const createScheduledReport = (data: Partial<ScheduledReportRecord>) =>
  pb.collection('scheduled_reports').create<ScheduledReportRecord>(data)

export const updateScheduledReport = (id: string, data: Partial<ScheduledReportRecord>) =>
  pb.collection('scheduled_reports').update<ScheduledReportRecord>(id, data)

export const deleteScheduledReport = (id: string) => pb.collection('scheduled_reports').delete(id)

export const checkSmtpConfigured = () =>
  pb.send('/backend/v1/smtp-status', { method: 'GET' }) as Promise<{ configured: boolean }>
