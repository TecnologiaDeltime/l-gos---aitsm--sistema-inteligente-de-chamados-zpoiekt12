import { useEffect, useState } from 'react'
import { Building2, Clock, Pause, Play, Phone, Square, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TicketCategoryCard } from '@/components/tickets/TicketCategoryCard'
import { TicketTriageHistoryCard } from '@/components/tickets/TicketTriageHistoryCard'
import { TicketSheetCard, TicketSheetField } from '@/components/tickets/TicketSheetCard'
import { TicketHoursAuditCard } from '@/components/tickets/TicketHoursAuditCard'
import { TicketSlaEvolutionCard } from '@/components/tickets/TicketSlaEvolutionCard'
import { RequesterTicketHistory } from '@/components/tickets/RequesterTicketHistory'
import type { TicketRecord, WorkCyclePauseRecord } from '@/services/tickets'
import {
  startOperatorWorkCycle,
  resumeOperatorWorkCycle,
  stopOperatorWorkCycle,
  resumeTicketSla,
} from '@/services/tickets'
import { formatSeconds } from '@/lib/duration'
import { cn } from '@/lib/utils'

interface TicketSheetRightColumnProps {
  ticket: TicketRecord
  ticketId: string
  actionLoading: boolean
  canPauseWorkCycle: boolean
  canEditCategory: boolean
  canViewTriageHistory: boolean
  canLaunchAccompaniment: boolean
  canEditHours?: boolean
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
  onEditHours?: () => void
  onCategoryUpdated: () => Promise<void> | void
  onReclassified: () => Promise<void> | void
}

/**
 * Coluna direita da Ficha do Chamado: Ciclo de Trabalho (Play/Pause acima do
 * card, com campo fino "Tempo do Ciclo"), Solicitante (nome/telefone/setor/
 * filial + perfil completo), Apuração de Horas (2 cartões), Categoria/
 * Atividade e Triagem IA — mesma largura e cantos da coluna principal.
 */
export function TicketSheetRightColumn({
  ticket,
  ticketId,
  actionLoading,
  canPauseWorkCycle,
  canEditCategory,
  canViewTriageHistory,
  canLaunchAccompaniment,
  canEditHours,
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
  onEditHours,
  onCategoryUpdated,
  onReclassified,
}: TicketSheetRightColumnProps) {
  const [catKey, setCatKey] = useState(0)

  // remonta a TicketCategoryCard quando o chamado muda (troca de ficha)
  useEffect(() => {
    setCatKey((k) => k + 1)
  }, [ticket.id])

  const requesterExpand = (ticket.expand as Record<string, any> | undefined)?.department
  const unitExpand = (ticket.expand as Record<string, any> | undefined)?.unit

  return (
    <div className="space-y-5">
      {/* Evolução do SLA — barras de progresso de Resposta e Solução (restaurado) */}
      <TicketSlaEvolutionCard ticket={ticket} />

      {/* Ciclo de Trabalho — botões Play/Pause ACIMA do card */}
      {canPauseWorkCycle && (
        <div className="flex flex-wrap items-center gap-2">
          {!ticket.operator_cycle_start && (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() =>
                onCycleAction(() => startOperatorWorkCycle(ticketId), 'Ciclo de trabalho iniciado')
              }
              disabled={actionLoading}
            >
              <Play className="mr-1 h-4 w-4" /> Iniciar
            </Button>
          )}
          {ticket.operator_cycle_start && !cyclePaused && (
            <Button
              size="sm"
              className="bg-amber-500 text-slate-900 hover:bg-amber-600"
              onClick={onCyclePause}
              disabled={actionLoading}
            >
              <Pause className="mr-1 h-4 w-4" /> Pausar
            </Button>
          )}
          {cyclePaused && (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() =>
                onCycleAction(() => resumeOperatorWorkCycle(ticketId), 'Ciclo de trabalho retomado')
              }
              disabled={actionLoading}
            >
              <Play className="mr-1 h-4 w-4" /> Retomar
            </Button>
          )}
          {ticket.operator_cycle_start && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onCycleAction(() => stopOperatorWorkCycle(ticketId), 'Ciclo de trabalho encerrado')
              }
              disabled={actionLoading}
            >
              <Square className="mr-1 h-4 w-4" /> Encerrar
            </Button>
          )}
          {ticket.sla_paused && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSlaAction(() => resumeTicketSla(ticketId), 'SLA retomado')}
              disabled={actionLoading}
            >
              <Play className="mr-1 h-4 w-4" /> Retomar SLA
            </Button>
          )}
        </div>
      )}

      {/* Card Ciclo de Trabalho — campo fino "Tempo do Ciclo" com cronômetro ao vivo */}
      <TicketSheetCard
        title="Ciclo de Trabalho"
        icon={<Clock className="h-3.5 w-3.5" />}
        contentClassName="space-y-2"
      >
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Tempo do Ciclo</span>
          <span
            className={cn(
              'font-mono text-sm font-bold tabular-nums',
              cycleRunning && 'text-emerald-600 dark:text-emerald-400',
              cyclePaused && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {formatSeconds(liveCycleSeconds)}
          </span>
        </div>
        {cyclePaused && openCyclePause?.reason && (
          <p className="text-[11px] text-muted-foreground">
            Pausa em aberto: {openCyclePause.reason}
          </p>
        )}
      </TicketSheetCard>

      {/* Solicitante — nome, telefone, setor, filial + perfil completo */}
      <TicketSheetCard
        title="Solicitante"
        icon={<UserRound className="h-3.5 w-3.5" />}
        contentClassName="space-y-1"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {ticket.requester_name || 'Não informado'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ticket.requester_email || '—'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onShowRequesterProfile} className="shrink-0">
            Perfil
          </Button>
        </div>
        <TicketSheetField icon={<Phone className="h-3 w-3" />} label="Telefone">
          {ticket.requester_phone || '—'}
        </TicketSheetField>
        <TicketSheetField icon={<Building2 className="h-3 w-3" />} label="Setor">
          {requesterExpand?.name || '—'}
        </TicketSheetField>
        <TicketSheetField icon={<Building2 className="h-3 w-3" />} label="Filial">
          {unitExpand?.name || '—'}
        </TicketSheetField>
        {/* Histórico de chamados — seção expandível lazy (mesma busca por requester_email do diálogo de perfil) */}
        <div className="pt-1">
          <RequesterTicketHistory
            requesterEmail={ticket.requester_email}
            currentTicketId={ticket.id}
          />
        </div>
      </TicketSheetCard>

      {/* Apuração de Horas — visual refinado (2 cartões + resumo + lançamento) */}
      <TicketHoursAuditCard
        workedSeconds={liveCycleSeconds}
        loggedSeconds={ticket.accompaniment_seconds || 0}
        canLaunchAccompaniment={canLaunchAccompaniment}
        canEditHours={canEditHours}
        isClosed={isClosed}
        onLaunchAccompaniment={onShowAccompaniment}
        onEditHours={onEditHours}
      />

      {/* Categoria / Atividade */}
      {canEditCategory && (
        <TicketSheetCard title="Categoria & Atividade" contentClassName="pt-1">
          <TicketCategoryCard
            key={catKey}
            ticketId={ticket.id}
            currentCategoryId={ticket.category}
            currentSubcategoryId={ticket.subcategory}
            canEdit={!isClosed}
            onUpdated={onCategoryUpdated}
          />
        </TicketSheetCard>
      )}

      {/* Triagem IA */}
      {canViewTriageHistory && (
        <TicketSheetCard title="Triagem IA" contentClassName="pt-1">
          <TicketTriageHistoryCard ticketId={ticket.id} onReclassified={onReclassified} />
        </TicketSheetCard>
      )}
    </div>
  )
}
