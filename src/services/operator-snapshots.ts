import pb from '@/lib/pocketbase/client'

export interface OperatorSnapshotRecord {
  id: string
  operator: string
  date: string
  tickets_attended: number
  tickets_resolved: number
  slas_met: number
  slas_violated: number
  hours_worked: number
  avg_first_response_minutes?: number
  avg_resolution_minutes?: number
  avg_interaction_gap_minutes?: number
  max_idle_minutes?: number
  reopens: number
  backlog: number
  expand?: any
}

export const getOperatorSnapshots = (operatorId?: string, startDate?: string, endDate?: string) => {
  const filters: string[] = []
  if (operatorId) filters.push(`operator = "${operatorId}"`)
  if (startDate) filters.push(`date >= "${startDate}"`)
  if (endDate) filters.push(`date <= "${endDate}"`)
  return pb.collection('operator_daily_snapshots').getFullList<OperatorSnapshotRecord>({
    filter: filters.length > 0 ? filters.join(' && ') : undefined,
    sort: 'date',
    expand: 'operator',
  })
}
