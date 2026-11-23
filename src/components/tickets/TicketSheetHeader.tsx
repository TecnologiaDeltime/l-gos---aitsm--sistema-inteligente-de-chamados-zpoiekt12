import { ArrowLeft, Play, Square, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import type { TicketRecord } from '@/services/tickets'
import { cn } from '@/lib/utils'

interface TicketSheetHeaderProps {
  ticket: TicketRecord
  variant: 'page' | 'panel'
  onBack?: () => void
  /** Ciclo de trabalho — ações no topo direito (Play/Pause/Stop). */
  cycleStarted: boolean
  cyclePaused: boolean
  actionLoading: boolean
  onStartWorkCycle?: () => void
  onPauseWorkCycle?: () => void
  onResumeWorkCycle?: () => void
  onStopWorkCycle?: () => void
}

/**
 * Cabeçalho da Ficha do Chamado: Voltar (só página) + nº/título + badges +
 * ciclo de trabalho (Play/Pause/Stop) no topo direito.
 */
export function TicketSheetHeader({
  ticket,
  variant,
  onBack,
  cycleStarted,
  cyclePaused,
  actionLoading,
  onStartWorkCycle,
  onPauseWorkCycle,
  onResumeWorkCycle,
  onStopWorkCycle,
}: TicketSheetHeaderProps) {
  const isPanel = variant === 'panel'

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {!isPanel && (
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        )}
        <h1
          className={cn(
            'font-serif tracking-tight',
            isPanel ? 'text-base font-semibold' : 'text-2xl font-bold',
          )}
        >
          <span className="font-mono text-primary">{ticket.number}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          {ticket.title}
          {ticket.sla_paused && (
            <Badge variant="outline" className="ml-2 align-middle text-[10px]">
              SLA pausado
            </Badge>
          )}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {ticket.expand?.company?.trade_name && (
            <Badge variant="outline">{ticket.expand.company.trade_name}</Badge>
          )}
          {ticket.expand?.queue?.name && (
            <Badge variant="outline">{ticket.expand.queue.name}</Badge>
          )}
        </div>
      </div>

      {/* CICLO DE TRABALHO — Play/Pause/Stop no topo direito */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
        {!cycleStarted && onStartWorkCycle && (
          <Button
            size="icon"
            variant="ghost"
            title="Iniciar ciclo de trabalho"
            onClick={onStartWorkCycle}
            disabled={actionLoading}
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {cycleStarted && !cyclePaused && onPauseWorkCycle && (
          <Button
            size="icon"
            variant="ghost"
            title="Pausar ciclo de trabalho (o SLA continua)"
            onClick={onPauseWorkCycle}
            disabled={actionLoading}
            className="h-8 w-8 text-amber-600 hover:text-amber-700"
          >
            <Pause className="h-4 w-4" />
          </Button>
        )}
        {cyclePaused && onResumeWorkCycle && (
          <Button
            size="icon"
            variant="ghost"
            title="Retomar ciclo de trabalho"
            onClick={onResumeWorkCycle}
            disabled={actionLoading}
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {cycleStarted && onStopWorkCycle && (
          <Button
            size="icon"
            variant="ghost"
            title="Encerrar ciclo de trabalho"
            onClick={onStopWorkCycle}
            disabled={actionLoading}
            className="h-8 w-8 text-red-500 hover:text-red-600"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
