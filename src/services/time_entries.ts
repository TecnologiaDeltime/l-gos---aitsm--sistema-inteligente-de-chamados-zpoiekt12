import pb from '@/lib/pocketbase/client'

export interface TimeEntryRecord {
  id: string
  ticket: string
  technician: string
  entry_date: string
  duration_minutes: number
  activity_type: string
  billable?: boolean
  description: string
  created: string
  expand?: any
}

export const getTimeEntries = (ticketId: string) =>
  pb.collection('time_entries').getFullList<TimeEntryRecord>({
    filter: `ticket = "${ticketId}"`,
    sort: '-entry_date',
    expand: 'technician',
  })

export const createTimeEntry = (data: Partial<TimeEntryRecord>) =>
  pb.collection('time_entries').create<TimeEntryRecord>(data)
