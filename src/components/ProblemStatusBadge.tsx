import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/problem-constants'

export function ProblemStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'} text-[10px]`}>
      {status}
    </Badge>
  )
}

export function ProblemPriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge className={`${PRIORITY_COLORS[priority] || 'bg-slate-100 text-slate-700'} text-[10px]`}>
      {priority}
    </Badge>
  )
}
