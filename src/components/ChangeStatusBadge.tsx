import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, RISK_COLORS, PRIORITY_COLORS } from '@/lib/change-constants'

export function ChangeStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${STATUS_COLORS[status] || 'bg-slate-100'} text-[10px]`}>{status}</Badge>
  )
}

export function RiskLevelBadge({ level }: { level: string }) {
  return <Badge className={`${RISK_COLORS[level] || 'bg-slate-100'} text-[10px]`}>{level}</Badge>
}

export function ChangePriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge className={`${PRIORITY_COLORS[priority] || 'bg-slate-100'} text-[10px]`}>
      {priority}
    </Badge>
  )
}
