import { useRef, useState, useEffect, useCallback } from 'react'
import { Clock, Pause, PauseCircle, Play, PlusCircle, Square } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { TicketCategoryCard } from '@/components/tickets/TicketCategoryCard'
import { TicketTriageHistoryCard } from '@/components/tickets/TicketTriageHistoryCard'
import {
  TicketSheetCard,
  TicketSheetField,
  TicketSheetRequesterCard,
} from '@/components/tickets/TicketSheetCard'
import type { TicketRecord, WorkCyclePauseRecord } from '@/services/tickets'
import { formatSeconds } from '@/lib/duration'
import { computeSlaSolutionStatus } from '@/lib/sla-status'
import { cn } from '@/lib/utils'

interface TicketSheetRightColumnProps {
  ticket: TicketRecord
  ticketId: string
  assignedName: string
  canPauseWorkCycle: boolean
  canEditCategory: boolean
  canViewTriageHistory: boolean
  canLaunchAccompaniment: boolean
  isClosed: boolean
  cyclePaused: boolean
  cycleRunning: boolean
  liveCycleSeconds: number
  openCyclePause: WorkCyclePauseRecord | null
  onCycleAction: (fn: () => Promise<unknown>, successTitle: string) => Promise<void>
  onCyclePause: () => void
  onSlaAction: (fn: () => Promise<unknown>, successTitle: string) => Promise<void>
  onShowRequesterProfile: () => void
  onShowAccompaniment: () => void
  onCategoryUpdated: () => Promise<void> | void
  onReclassified: () => Promise<void> | void
}

const EMPTY_CATEGORY = { id: '', category: '', activity: '', priority: '' }

/**
 * Coluna direita da Ficha do Chamado: Solicitante, Categoria/Atividade,
 * Triagem IA, Ciclo de Trabalho (play/pause) e Apuração de Horas — os mesmos
 * cards com mesmas alturas e cantos (simetria com a coluna principal).
 */
export function TicketSheetRightColumn({
  ticket,
  ticketId,
  assignedName,
  canPauseWorkCycle,
  canEditCategory,
  canViewTriageHistory,
  canLaunchAccompaniment,
  isClosed,
  cyclePaused,
  cycleRunning,
  liveCycleSeconds,
  openCyclePause,
  onCycleAction,
  onCyclePause,
  onSlaAction,
  onShowRequesterProfile,
  onShowAccompaniment,
  onCategoryUpdated,
  onReclassified,
}: TicketSheetRightColumnProps) {
  const expanded: any = ticket.expand || {}
  const busy = actionLoading || false
  const [catKey, setCatKey] = useState(0)
  const categoryRef = useRef<{ save: () => Promise<boolean> } | null>(null)

  // remonta a TicketCategoryCard quando o chamado muda (troca de ficha)
  useEffect(() => {
    setCatKey((k) => k + 1)
  }, [ticket.id])

  return (
    <div className="space-y-5">
      {/* Solicitante — perfil completo via requester_email */}
      <TicketSheetRequesterCard ticket={ticket} onOpenProfile={onShowRequesterProfile} />

      {/* Categoria / Atividade */}
      {canEditCategory && (
        <TicketSheetCard title="Categoria & Atividade" className="h-full" contentClassName="pt-1">
          <TicketCategoryCard
            key={catKey}
            ref={categoryRef}
            ticketId={ticket.id}
            ticket={{
              category: ticket.category,
              activity: ticket.activity,
              priority: ticket.priority,
            }}
            onSaved={onCategoryUpdated}
          />
        </TicketSheetCard>
      )}

      {/* Triagem IA */}
      {canViewTriageHistory && (
        <TicketSheetCard title="Triagem IA" className="h-full" contentClassName="pt-1">
          <TicketTriageHistoryCard ticketId={ticket.id} onReclassified={onReclassified} />
        </TicketSheetCard>
      )}

      {/* Ciclo de Trabalho — Play/Pause/Stop + tempo do ciclo */}
      <TicketSheetCard
        title="Ciclo de Trabalho"
        icon={<Clock className="h-3.5 w-3.5" />}
        contentClassName="space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Tempo do ciclo</span>
          <span
            className={cn(
              'font-mono text-lg font-bold tabular-nums',
              cycleRunning && 'text-emerald-600 dark:text-emerald-400',
              cyclePaused && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {formatSeconds(liveCycleSeconds)}
          </span>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center gap-1.5">
          {!ticket.operator_cycle_start && canPauseWorkCycle && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onCycleAction(startOperatorWorkCycle(ticketId), 'Ciclo de trabalho iniciado')
              }
              disabled={busy}
            >
              <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
            </Button>
          )}
          {ticket.operator_cycle_start && !cyclePaused && canPauseWorkCycle && (
            <Button size="sm" variant="outline" onClick={onCyclePause} disabled={busy}>
              <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
            </Button>
          )}
          {cyclePaused && canPauseWorkCycle && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onCycleAction(resumeOperatorWorkCycle(ticketId), 'Ciclo de trabalho retomado')
              }
              disabled={busy}
            >
              <Play className="mr-1 h-3.5 w-3.5" /> Retomar
            </Button>
          )}
          {ticket.operator_cycle_start && canPauseWorkCycle && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onCycleAction(stopOperatorWorkCycle(ticketId), 'Ciclo de trabalho encerrado')
              }
              disabled={busy}
            >
              <Square className="mr-1 h-3.5 w-3.5" /> Encerrar
            </Button>
          )}
          {cyclePaused && openCyclePause?.reason && (
            <span className="text-[11px] text-muted-foreground">
              Pausa em aberto: {openCyclePause.reason}
            </span>
          )}
        </div>
      </TicketSheetCard>

      {/* Apuração de Horas */}
      <TicketSheetCard
        title="Apuração de Horas"
        icon={<Clock className="h-3.5 w-3.5" />}
        contentClassName="space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Horas de log (franquia)</span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {formatSeconds(ticket.accompaniment_seconds || 0)}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Horas do ciclo</span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {formatSeconds(ticket.operator_worked_seconds || 0)}
          </span>
        </div>
        {canLaunchAccompaniment && !isClosed && (
          <Button size="sm" variant="outline" onClick={onShowAccompaniment}>
            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Acompanhamento
          </Button>
        )}
      </TicketSheetCard>

      {/* SLA */}
      <TicketSheetCard title="SLA" contentClassName="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SlaStatusBadge
            type="response"
            status={computeSlaResponseStatus(ticket)}
            deadline={ticket.sla_response_deadline}
            completedAt={ticket.sla_response_at || ticket.sla_response_start}
          />
          <SlaStatusBadge
            type="solution"
            status={computeSlaSolutionStatus(ticket)}
            deadline={ticket.sla_solution_deadline}
            completedAt={ticket.sla_solution_at}
          />
          {ticket.sla_paused && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSlaAction(resumeTicketSla(ticketId), 'SLA retomado')}
              disabled={busy}
            >
              <Play className="mr-1 h-3.5 w-3.5" /> Retomar SLA
            </Button>
          )}
        </div>
        <SlaDetailBlock ticket={ticket} />
      </TicketSheetCard>
    </div>
  )
}
