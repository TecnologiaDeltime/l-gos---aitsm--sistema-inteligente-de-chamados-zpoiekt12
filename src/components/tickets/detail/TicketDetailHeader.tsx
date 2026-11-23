import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { computeSlaSolutionStatus } from '@/lib/sla-status'
import type { TicketRecord } from '@/services/tickets'
import { cn } from '@/lib/utils'

interface TicketDetailHeaderProps {
  ticket: TicketRecord
  assignedName: string
  variant: 'page' | 'panel'
  onBack?: () => void
  onClose?: () => void
}

function Badges({ ticket }: { ticket: TicketRecord }) {
  return (
    <>
      <StatusBadge status={ticket.status} />
      <PriorityBadge priority={ticket.priority} />
      <SlaStatusBadge
        type="solution"
        status={computeSlaSolutionStatus(ticket)}
        deadline={ticket.sla_solution_deadline}
        completedAt={ticket.sla_solution_at}
      />
      {ticket.sla_paused && (
        <Badge variant="outline" className="border-amber-500/50 text-amber-600">
          SLA Pausado
        </Badge>
      )}
    </>
  )
}

/**
 * Cabeçalho da ficha do chamado, em duas variantes:
 * - "page": cabeçalho completo da rota /tickets/:id (com botão Voltar);
 * - "panel": cabeçalho compacto e fixo (sticky) do painel da Tela Dividida.
 */
export function TicketDetailHeader({
  ticket,
  assignedName,
  variant,
  onBack,
  onClose,
}: TicketDetailHeaderProps) {
  const isPanel = variant === 'panel'

  if (isPanel) {
    return (
      <div className="sticky top-0 z-10 border-b bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-primary">
                {ticket.number || ticket.id}
              </span>
              <Badges ticket={ticket} />
            </div>
            <h3 className="mt-1.5 line-clamp-2 font-serif text-lg font-bold leading-snug tracking-tight text-foreground">
              {ticket.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{ticket.requester_name}</span>
              <span className="mx-1.5 text-border">|</span>
              {assignedName}
              <span className="mx-1.5 text-border">|</span>
              {new Date(ticket.created).toLocaleString('pt-BR')}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold tracking-wide text-primary">
          {ticket.number || ticket.id}
        </span>
        <Badges ticket={ticket} />
      </div>
      <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-foreground">
        {ticket.title}
      </h1>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Solicitante:</span> {ticket.requester_name}
        <span className="mx-2 text-border">|</span>
        <span className="font-medium text-foreground">Responsável:</span> {assignedName}
        <span className="mx-2 text-border">|</span>
        <span className="font-medium text-foreground">Aberto em:</span>{' '}
        {new Date(ticket.created).toLocaleString('pt-BR')}
      </p>
    </div>
  )
}
