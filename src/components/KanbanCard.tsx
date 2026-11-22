import { Link } from 'react-router-dom'
import { User, Clock, Building2, Calendar, CalendarCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TicketRecord } from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SLA_DOT_COLORS } from '@/lib/kanban-constants'
import { cn } from '@/lib/utils'
import { computeSlaSolutionStatus, formatDeadline, formatRemainingTime } from '@/lib/sla-status'
import { formatDateTime } from '@/lib/date-format'

interface KanbanCardProps {
  ticket: TicketRecord
  canEdit: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent, ticket: TicketRecord) => void
  onDragEnd: () => void
  onTouchStart: (e: React.TouchEvent, ticket: TicketRecord) => void
  isSelected?: boolean
  onSelect?: (ticketId: string) => void
}

const RISK_CLASSES: Record<string, string> = {
  Violado: 'text-red-600 dark:text-red-400 font-semibold',
  Crítico: 'text-red-500 dark:text-red-400 font-semibold',
  Risco: 'text-orange-600 dark:text-orange-400',
  Atenção: 'text-amber-600 dark:text-amber-400',
}

export function KanbanCard({
  ticket,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
  isSelected,
  onSelect,
}: KanbanCardProps) {
  const slaColor = SLA_DOT_COLORS[ticket.sla_status || ''] || 'bg-slate-400'
  const solutionStatus = computeSlaSolutionStatus(ticket)
  const operatorName = ticket.expand?.assigned_to?.name || 'Não atribuído'
  const companyName = ticket.expand?.company?.trade_name || ticket.expand?.company?.name || ''
  const resolvedAt =
    ticket.status === 'Resolvido' || ticket.status === 'Encerrado'
      ? ticket.resolution_date || ticket.sla_solution_at
      : undefined

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart(e, ticket)}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => canEdit && onTouchStart(e, ticket)}
      onClick={(e) => {
        if (onSelect && !(e.target as HTMLElement).closest('a')) onSelect(ticket.id)
      }}
      title={!canEdit ? 'Você não tem permissão para mover chamados' : undefined}
      className={cn(
        'rounded-lg border bg-white p-3 shadow-sm transition-all dark:bg-slate-900',
        canEdit && 'cursor-grab active:cursor-grabbing hover:shadow-md',
        isDragging && 'opacity-40',
        isSelected && 'ring-2 ring-primary border-primary',
      )}
    >
      <div className="flex items-center justify-between mb-1.5 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            to={`/tickets/${ticket.id}`}
            className="text-xs font-bold text-primary hover:underline truncate"
          >
            {ticket.number}
          </Link>
          {ticket.is_internal && (
            <Badge
              variant="outline"
              className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-[10px] px-1 py-0 h-4 font-semibold"
            >
              Interno
            </Badge>
          )}
        </div>

        <PriorityBadge priority={ticket.priority} />
      </div>
      {ticket.approval_hold && (
        <Badge
          variant="outline"
          className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800 text-[9px] px-1.5 py-0 h-4 font-semibold whitespace-nowrap mb-1"
        >
          ⏳ Aguardando Aprovação
        </Badge>
      )}
      <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-2 dark:text-slate-200">
        {ticket.title}
      </p>
      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1 truncate">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{operatorName}</span>
        </div>
        {companyName && (
          <div className="flex items-center gap-1 truncate">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{companyName}</span>
          </div>
        )}
        <div className="flex items-center gap-1 truncate">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">Abertura: {formatDateTime(ticket.created)}</span>
        </div>
        {resolvedAt && (
          <div className="flex items-center gap-1 truncate">
            <CalendarCheck className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Resolução: {formatDateTime(resolvedAt)}</span>
          </div>
        )}
        {ticket.sla_solution_deadline && (
          <div
            className={cn(
              'flex items-center gap-1 truncate border-t border-slate-100 pt-1 dark:border-slate-800',
              RISK_CLASSES[solutionStatus] || 'text-slate-500 dark:text-slate-400',
            )}
            title={`Vencimento SLA: ${formatDeadline(ticket.sla_solution_deadline)}`}
          >
            <Clock className="h-3 w-3 flex-shrink-0 text-amber-500" />
            <span className="truncate">
              SLA: {formatDeadline(ticket.sla_solution_deadline)} ·{' '}
              {formatRemainingTime(ticket.sla_solution_deadline)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
        {(ticket.expand?.subcategory?.name || ticket.expand?.category?.name) && (
          <p className="text-xs text-slate-400 truncate">
            {ticket.expand?.subcategory?.name || ticket.expand?.category?.name}
          </p>
        )}
        <span
          className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', slaColor)}
          title={`SLA: ${ticket.sla_status || 'N/A'}${
            ticket.sla_solution_deadline
              ? ` • ${formatRemainingTime(ticket.sla_solution_deadline)}`
              : ''
          }`}
        />
      </div>
    </div>
  )
}
