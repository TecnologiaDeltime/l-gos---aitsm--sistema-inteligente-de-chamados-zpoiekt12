import { useNavigate } from 'react-router-dom'
import {
  X,
  ExternalLink,
  User,
  Building2,
  Calendar,
  CalendarCheck,
  Clock,
  UserCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { TicketSlaEvolutionCard } from '@/components/tickets/TicketSlaEvolutionCard'
import { TicketRecord } from '@/services/tickets'
import {
  computeSlaResponseStatus,
  computeSlaSolutionStatus,
  formatDeadline,
} from '@/lib/sla-status'
import { formatDateTime } from '@/lib/date-format'

interface TicketSummaryPanelProps {
  ticket: TicketRecord | null
  onClose: () => void
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground">{children}</div>
      </div>
    </div>
  )
}

/**
 * Painel de resumo do chamado usado na visão "Tela Dividida" da Fila de Tickets:
 * mostra os dados principais ao lado da lista, sem sair da página.
 */
export function TicketSummaryPanel({ ticket, onClose }: TicketSummaryPanelProps) {
  const navigate = useNavigate()

  if (!ticket) {
    return (
      <div className="rounded-xl border bg-slate-50/50 p-6 dark:bg-slate-900/50">
        <p className="text-sm text-muted-foreground">
          Selecione um chamado na lista para ver o resumo aqui.
        </p>
      </div>
    )
  }

  const operatorName = ticket.expand?.assigned_to?.name || 'Não atribuído'
  const companyName = ticket.expand?.company?.trade_name || ticket.expand?.company?.name || '-'
  const resolvedAt =
    ticket.status === 'Resolvido' || ticket.status === 'Encerrado'
      ? ticket.resolution_date || ticket.sla_solution_at
      : undefined

  return (
    <div className="flex h-full flex-col rounded-xl border bg-white shadow-sm dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-primary">{ticket.number}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{ticket.title}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {ticket.is_internal && (
            <Badge variant="outline" className="text-[10px]">
              Interno
            </Badge>
          )}
          {ticket.sla_paused && (
            <Badge variant="outline" className="text-[10px]">
              SLA pausado
            </Badge>
          )}
        </div>

        <Row icon={UserCircle} label="Operador responsável">
          {operatorName}
        </Row>
        <Row icon={Building2} label="Cliente">
          {companyName}
        </Row>
        <Row icon={User} label="Solicitante">
          {ticket.requester_name || '-'}
        </Row>
        <Row icon={Calendar} label="Abertura">
          {formatDateTime(ticket.created)}
        </Row>
        <Row icon={CalendarCheck} label="Resolução">
          {resolvedAt ? formatDateTime(resolvedAt) : '—'}
        </Row>

        <div className="rounded-lg border bg-slate-50/60 p-2.5 dark:bg-slate-900/60">
          <p className="mb-2 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" /> SLA
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SlaStatusBadge
                type="response"
                status={computeSlaResponseStatus(ticket)}
                deadline={ticket.sla_response_deadline}
                completedAt={ticket.sla_response_at || ticket.sla_response_start}
              />
              <span className="text-xs text-muted-foreground">
                {formatDeadline(ticket.sla_response_deadline)}
              </span>
            </div>
            <SlaDetailBlock
              type="response"
              status={computeSlaResponseStatus(ticket)}
              deadline={ticket.sla_response_deadline}
              completedAt={ticket.sla_response_at || ticket.sla_response_start}
              createdAt={ticket.created}
            />
            <div className="flex items-center justify-between gap-2">
              <SlaStatusBadge
                type="solution"
                status={computeSlaSolutionStatus(ticket)}
                deadline={ticket.sla_solution_deadline}
                completedAt={ticket.sla_solution_at}
              />
              <span className="text-xs text-muted-foreground">
                {formatDeadline(ticket.sla_solution_deadline)}
              </span>
            </div>
            <SlaDetailBlock
              type="solution"
              status={computeSlaSolutionStatus(ticket)}
              deadline={ticket.sla_solution_deadline}
              completedAt={ticket.sla_solution_at}
              createdAt={ticket.created}
              totalPauseMinutes={ticket.sla_pause_total_minutes || 0}
            />
          </div>
        </div>

        {ticket.description && (
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Descrição
            </p>
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">
              {ticket.description}
            </p>
          </div>
        )}
      </div>

      <div className="border-t px-4 py-3">
        <Button size="sm" className="w-full" onClick={() => navigate(`/tickets/${ticket.id}`)}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Abrir ficha completa
        </Button>
      </div>
    </div>
  )
}
