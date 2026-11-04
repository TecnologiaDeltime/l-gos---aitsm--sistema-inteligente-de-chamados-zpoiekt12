import { Link } from 'react-router-dom'
import { User, Clock } from 'lucide-react'
import { TicketRecord } from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SLA_DOT_COLORS } from '@/lib/kanban-constants'
import { cn } from '@/lib/utils'
import { formatRemainingTime } from '@/lib/sla-status'

interface KanbanCardProps {
  ticket: TicketRecord
  canEdit: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent, ticket: TicketRecord) => void
  onDragEnd: () => void
  onTouchStart: (e: React.TouchEvent, ticket: TicketRecord) => void
}

export function KanbanCard({
  ticket,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
}: KanbanCardProps) {
  const slaColor = SLA_DOT_COLORS[ticket.sla_status || ''] || 'bg-slate-400'

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart(e, ticket)}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => canEdit && onTouchStart(e, ticket)}
      title={!canEdit ? 'Você não tem permissão para mover chamados' : undefined}
      className={cn(
        'rounded-lg border bg-white p-3 shadow-sm transition-all dark:bg-slate-900',
        canEdit && 'cursor-grab active:cursor-grabbing hover:shadow-md',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <Link
          to={`/tickets/${ticket.id}`}
          className="text-xs font-bold text-primary hover:underline"
        >
          {ticket.number}
        </Link>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-2 dark:text-slate-200">
        {ticket.title}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1 truncate max-w-[150px]">
          <User className="h-3 w-3 flex-shrink-0" />
          {ticket.expand?.assigned_to?.name || 'Não atribuído'}
        </span>
        <span
          className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', slaColor)}
          title={`SLA: ${ticket.sla_status || 'N/A'}${
            ticket.sla_solution_deadline
              ? ` • ${formatRemainingTime(ticket.sla_solution_deadline)}`
              : ''
          }`}
        />
      </div>
      {ticket.sla_solution_deadline && (
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <Clock className="h-3 w-3 shrink-0 text-amber-500" />
          <span className="truncate">{formatRemainingTime(ticket.sla_solution_deadline)}</span>
        </div>
      )}
      {(ticket.expand?.subcategory?.name || ticket.expand?.category?.name) && (
        <p className="text-xs text-slate-400 mt-1.5 truncate">
          {ticket.expand?.subcategory?.name || ticket.expand?.category?.name}
        </p>
      )}
    </div>
  )
}
