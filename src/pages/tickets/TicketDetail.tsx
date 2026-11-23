import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Play,
  PauseCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
  GitBranch,
  Link2,
  ClipboardCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import {
  getTicket,
  getTicketInteractions,
  getTicketHistory,
  createInteraction,
  addAccompanimentHours,
  startService,
  pauseTicketSla,
  resumeTicketSla,
  startOperatorWorkCycle,
  stopOperatorWorkCycle,
  pauseOperatorWorkCycle,
  resumeOperatorWorkCycle,
  getOpenWorkCyclePause,
} from '@/services/tickets'
import type {
  WorkCyclePauseRecord,
  TicketRecord,
  TicketInteractionRecord,
} from '@/services/tickets'
import { getTicketAttachments, uploadAttachment } from '@/services/attachments'
import type { TicketAttachmentRecord } from '@/services/attachments'
import { sendManualApproval } from '@/services/approvals'
import { SlaPauseDialog } from '@/components/SlaPauseDialog'
import { WorkCyclePauseDialog } from '@/components/WorkCyclePauseDialog'
import { ResolveTicketDialog } from '@/components/ResolveTicketDialog'
import { DelegateDialog } from '@/components/DelegateDialog'
import { ChildTicketDialog } from '@/components/ChildTicketDialog'
import { AssociateTicketsDialog } from '@/components/AssociateTicketsDialog'
import { TicketAiReplyPanel } from '@/components/TicketAiReplyPanel'
import { KbRecommendedBlock } from '@/components/tickets/KbRecommendedBlock'
import { TicketRequesterProfileDialog } from '@/components/tickets/TicketRequesterProfileDialog'
import { AccompanimentHoursDialog } from '@/components/tickets/AccompanimentHoursDialog'
import { TicketSheetTabs, type HistoryRecord } from '@/components/tickets/TicketSheetTabs'
import { TicketSheetRightColumn } from '@/components/tickets/TicketSheetRightColumn'
import { TicketSheetHeader } from '@/components/tickets/TicketSheetHeader'
import { parseHHMMToMinutes, formatSeconds } from '@/lib/duration'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const CLOSED_STATUSES = ['Resolvido', 'Encerrado', 'Cancelado']

export interface TicketDetailProps {
  /** Página (padrão) ou painel lateral da Tela Dividida. */
  variant?: 'page' | 'panel'
  /** Sobrepõe o :id da rota — usado pelo painel da Tela Dividida. */
  ticketId?: string
}

/**
 * FICHA COMPLETA DO CHAMADO — usada na página /tickets/:id (variant="page")
 * e no painel direito da Tela Dividida (variant="panel", sem botão Voltar,
 * sem título gigante; rolagem independente no contêiner do painel).
 */
export default function TicketDetail({ variant = 'page', ticketId }: TicketDetailProps) {
  const routeParams = useParams<{ id: string }>()
  const id = ticketId || routeParams.id
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canAccessItem, canPauseSla, canResolveTicket, canAssignTicket } = usePermissions()
  const { toast } = useToast()

  const [ticket, setTicket] = useState<TicketRecord | null>(null)
  const [interactions, setInteractions] = useState<TicketInteractionRecord[]>([])
  const [attachments, setAttachments] = useState<TicketAttachmentRecord[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [openCyclePause, setOpenCyclePause] = useState<WorkCyclePauseRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Diálogos: cada pausa tem seu PRÓPRIO estado e seu PRÓPRIO diálogo.
  // - showSlaPause: pausa de SLA (botão "Pausar SLA")
  // - showWorkCyclePause: pausa do ciclo de trabalho (só contabiliza horas do
  //   operador; NUNCA toca em campos de SLA)
  const [showSlaPause, setShowSlaPause] = useState(false)
  const [showWorkCyclePause, setShowWorkCyclePause] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [showDelegate, setShowDelegate] = useState(false)
  const [showChildTicket, setShowChildTicket] = useState(false)
  const [showAssociate, setShowAssociate] = useState(false)
  const [sendingApproval, setSendingApproval] = useState(false)
  const [showRequesterProfile, setShowRequesterProfile] = useState(false)
  const [showAccompaniment, setShowAccompaniment] = useState(false)

  const [newInteraction, setNewInteraction] = useState('')
  const [newInteractionMinutes, setNewInteractionMinutes] = useState('')
  const [sendingInteraction, setSendingInteraction] = useState(false)

  const canPauseWorkCycle = canAccessItem('tickets', 'tickets_work_cycle_pause')
  const canUseAiReply = canAccessItem('tickets', 'tickets_ai_reply')
  const canViewTriageHistory = canAccessItem('tickets', 'tickets_triage_history')
  const canEditCategory = canAccessItem('tickets', 'tickets_categoria_edit')
  const canSendManualApproval = canAccessItem('tickets', 'tickets_manual_approval_send')
  // Lançamento de acompanhamento (horas de log) — item do catálogo de permissões.
  const canLaunchAccompaniment = canAccessItem('tickets', 'admin_accompaniment_hours_edit')

  const loadTicket = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [t, ints, atts, hist, wcp] = await Promise.all([
        getTicket(id),
        getTicketInteractions(id).catch(() => [] as TicketInteractionRecord[]),
        getTicketAttachments(id).catch(() => [] as TicketAttachmentRecord[]),
        getTicketHistory(id).catch(() => [] as HistoryRecord[]),
        getOpenWorkCyclePause(id).catch(() => null),
      ])
      setTicket(t)
      setInteractions(ints)
      setAttachments(atts)
      setHistory(hist as HistoryRecord[])
      setOpenCyclePause(wcp)
    } catch (err) {
      setTicket(null)
      if (variant === 'page') {
        toast({
          title: 'Erro ao carregar chamado',
          description: getErrorMessage(err),
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, variant])

  useEffect(() => {
    setTicket(null)
    setLoading(true)
    loadTicket()
  }, [loadTicket])

  const refreshTicket = useCallback(async () => {
    if (!id) return
    try {
      const [t, wcp] = await Promise.all([
        getTicket(id),
        getOpenWorkCyclePause(id).catch(() => null),
      ])
      setTicket(t)
      setOpenCyclePause(wcp)
    } catch {
      /* silencioso — o reload completo já cobre */
    }
  }, [id])

  // O ciclo está pausado quando existe pausa de ciclo EM ABERTO (resumed_at
  // vazio em operator_work_cycle_pauses) — o backend zera operator_cycle_start
  // ao pausar e o reabre ao retomar. Não depende de nenhum campo de SLA.
  const cyclePaused = !!openCyclePause

  const isClosed = ticket ? CLOSED_STATUSES.includes(ticket.status) : false

  // ---- CRONÔMETRO DO CICLO (Tempo do Ciclo) ----
  // Enquanto o ciclo está EM ANDAMENTO (não pausado, operator_cycle_start
  // preenchido), o acumulado do backend (operator_worked_seconds) ainda não
  // inclui o segmento atual — somamos (agora − operator_cycle_start) ao vivo,
  // com um tick por segundo. Quando pausado ou não iniciado, fica estático.
  const cycleRunning = !cyclePaused && !!ticket?.operator_cycle_start
  const [cycleNowMs, setCycleNowMs] = useState(Date.now())
  useEffect(() => {
    if (!cycleRunning) return
    setCycleNowMs(Date.now())
    const t = setInterval(() => setCycleNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [cycleRunning, ticket?.operator_cycle_start])
  const liveCycleSeconds =
    cycleRunning && ticket?.operator_cycle_start
      ? (ticket.operator_worked_seconds || 0) +
        Math.max(
          0,
          Math.floor((cycleNowMs - new Date(ticket.operator_cycle_start).getTime()) / 1000),
        )
      : ticket?.operator_worked_seconds || 0

  const runAction = async (fn: () => Promise<unknown>, successTitle: string) => {
    setActionLoading(true)
    try {
      await fn()
      toast({ title: successTitle })
      await refreshTicket()
    } catch (err) {
      toast({
        title: 'Erro na operação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ---- Ações de CICLO DE TRABALHO (horas do operador; sem tocar no SLA) ----
  const handleStartWorkCycle = () =>
    runAction(() => startOperatorWorkCycle(id!), 'Ciclo de trabalho iniciado')
  const handleStopWorkCycle = () =>
    runAction(() => stopOperatorWorkCycle(id!), 'Ciclo de trabalho encerrado')
  const handleResumeWorkCycle = () =>
    runAction(() => resumeOperatorWorkCycle(id!), 'Ciclo de trabalho retomado')
  const handleConfirmWorkCyclePause = async (reason: string, description: string) => {
    await pauseOperatorWorkCycle(id!, reason, description)
    toast({ title: 'Ciclo de trabalho pausado (o SLA continua correndo)' })
    await refreshTicket()
  }

  // ---- Ações de SLA (botão "Pausar SLA") ----
  const handleResumeSla = () => runAction(() => resumeTicketSla(id!), 'SLA retomado')
  const handleConfirmSlaPause = async (reason: string, justification: string) => {
    await pauseTicketSla(id!, reason, justification)
    toast({ title: 'SLA pausado' })
    await refreshTicket()
  }

  const handleStartService = () => runAction(() => startService(id!), 'Atendimento iniciado')

  // ---- Envio manual para aprovação (rota /backend/v1/tickets/{id}/send-approval) ----
  const handleSendApproval = async () => {
    if (!id) return
    setSendingApproval(true)
    try {
      await sendManualApproval(id)
      toast({ title: 'Chamado enviado para aprovação' })
      await loadTicket()
    } catch (err) {
      toast({
        title: 'Erro ao enviar para aprovação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSendingApproval(false)
    }
  }

  // ---- Interações com TEMPO (duration_minutes → horas de log do chamado) ----
  const handleSendInteraction = async () => {
    if (!newInteraction.trim() || !user?.id) return
    setSendingInteraction(true)
    try {
      const minutes = parseHHMMToMinutes(newInteractionMinutes)
      if (minutes !== null) {
        // Interação com tempo = log de horas: debita a franquia do cliente e
        // soma nas horas do chamado (work_hours/accompaniment_seconds) via a
        // rota de acompanhamento (/backend/v1/tickets/{id}/accompaniment).
        await addAccompanimentHours(id!, {
          content: newInteraction.trim(),
          duration_minutes: minutes,
        })
      } else {
        await createInteraction({
          ticket: id!,
          author: user.id,
          type: 'Comentário',
          content: newInteraction.trim(),
          origin: 'interno',
        })
      }
      setInteractions(await getTicketInteractions(id!))
      await refreshTicket()
      setNewInteraction('')
      setNewInteractionMinutes('')
      toast({ title: 'Interação registrada' })
    } catch (err) {
      toast({
        title: 'Erro ao registrar interação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSendingInteraction(false)
    }
  }

  const handleApplyAiDraft = (draftText: string) => {
    setNewInteraction((prev) => (prev ? `${prev}\n\n${draftText}` : draftText))
  }

  const handleAttach = async (files: FileList | null) => {
    if (!files?.length || !user?.id) return
    setActionLoading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(id!, file, user.id)
      }
      setAttachments(await getTicketAttachments(id!))
      toast({ title: 'Anexo(s) enviado(s)' })
    } catch (err) {
      toast({
        title: 'Erro ao enviar anexo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading && !ticket) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">Chamado não encontrado.</p>
        {variant === 'page' && (
          <Button variant="outline" onClick={() => navigate('/tickets')}>
            Voltar para a lista
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <TicketSheetHeader
        ticket={ticket}
        variant={variant}
        onBack={() => navigate('/tickets')}
        cycleStarted={!!ticket.operator_cycle_start}
        cyclePaused={cyclePaused}
        actionLoading={actionLoading}
        onStartWorkCycle={handleStartWorkCycle}
        onPauseWorkCycle={() => setShowWorkCyclePause(true)}
        onResumeWorkCycle={handleResumeWorkCycle}
        onStopWorkCycle={handleStopWorkCycle}
      />

      <div className="grid gap-5 items-start lg:grid-cols-3">
        {/* Coluna principal — 2/3 da ficha */}
        <div className="space-y-5 lg:col-span-2">
          {/* Procedimentos Recomendados da KB — topo da ficha */}
          <KbRecommendedBlock title={ticket.title} description={ticket.description} />

          {/* Descrição */}
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base tracking-tight">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {ticket.description || 'Sem descrição.'}
              </p>
              {ticket.solution && (
                <>
                  <Separator className="my-4" />
                  <h3 className="mb-1 text-sm font-semibold">Solução</h3>
                  <p className="whitespace-pre-wrap text-sm text-emerald-700 dark:text-emerald-400">
                    {ticket.solution}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Barra de ações — 6 botões lado a lado, logo abaixo da descrição */}
          <div className="flex flex-wrap items-center gap-2">
            {ticket.status === 'Novo' && canAssignTicket && (
              <Button size="sm" onClick={handleStartService} disabled={actionLoading}>
                <Play className="mr-1 h-4 w-4" /> Iniciar Atendimento
              </Button>
            )}
            {!isClosed && (
              <>
                {ticket.sla_paused
                  ? canPauseSla && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResumeSla}
                        disabled={actionLoading}
                      >
                        <Play className="mr-1 h-4 w-4" /> Retomar SLA
                      </Button>
                    )
                  : canPauseSla && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowSlaPause(true)}
                        disabled={actionLoading}
                      >
                        <PauseCircle className="mr-1 h-4 w-4" /> Pausar SLA
                      </Button>
                    )}
                {canResolveTicket && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowResolve(true)}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Resolver
                  </Button>
                )}
              </>
            )}
            {canAssignTicket && (
              <Button size="sm" variant="outline" onClick={() => setShowDelegate(true)}>
                <Users className="mr-1 h-4 w-4" /> Delegar
              </Button>
            )}
            {canAssignTicket && (
              <Button size="sm" variant="outline" onClick={() => setShowChildTicket(true)}>
                <GitBranch className="mr-1 h-4 w-4" /> Abrir Ticket Filho
              </Button>
            )}
            {canAssignTicket && (
              <Button size="sm" variant="outline" onClick={() => setShowAssociate(true)}>
                <Link2 className="mr-1 h-4 w-4" /> Associar Chamados
              </Button>
            )}
            {canSendManualApproval && !isClosed && !ticket.approval_hold && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendApproval}
                disabled={sendingApproval || actionLoading}
              >
                {sendingApproval ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="mr-1 h-4 w-4" />
                )}
                Enviar para Aprovação
              </Button>
            )}
          </div>

          {/* Interações / Histórico / Anexos */}
          <TicketSheetTabs
            interactions={interactions}
            history={history}
            attachments={attachments}
            isClosed={isClosed}
            sendingInteraction={sendingInteraction}
            newInteraction={newInteraction}
            newInteractionMinutes={newInteractionMinutes}
            onNewInteractionChange={setNewInteraction}
            onNewInteractionMinutesChange={setNewInteractionMinutes}
            onSendInteraction={handleSendInteraction}
            onAttach={handleAttach}
          />

          {/* Agente de Resposta IA */}
          {canUseAiReply && (
            <TicketAiReplyPanel
              ticketId={id!}
              ticketNumber={ticket.number}
              requesterName={ticket.requester_name}
              canEdit={!isClosed}
              onApplyDraft={handleApplyAiDraft}
            />
          )}

          {/* Total de Horas Lançadas — faixa compacta âmbar no rodapé da coluna */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4" /> Total de Horas Lançadas
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-amber-800 dark:text-amber-300">
              {formatSeconds(ticket.accompaniment_seconds || 0)}
            </span>
          </div>
        </div>

        {/* Coluna direita — 1/3 da ficha */}
        <TicketSheetRightColumn
          ticket={ticket}
          ticketId={id!}
          actionLoading={actionLoading}
          canPauseWorkCycle={canPauseWorkCycle && !isClosed}
          canEditCategory={canEditCategory}
          canViewTriageHistory={canViewTriageHistory}
          canLaunchAccompaniment={canLaunchAccompaniment && !isClosed}
          isClosed={isClosed}
          cyclePaused={cyclePaused}
          cycleRunning={cycleRunning}
          liveCycleSeconds={liveCycleSeconds}
          openCyclePause={openCyclePause}
          onCycleAction={runAction}
          onCyclePause={() => setShowWorkCyclePause(true)}
          onSlaAction={runAction}
          onShowRequesterProfile={() => setShowRequesterProfile(true)}
          onShowAccompaniment={() => setShowAccompaniment(true)}
          onCategoryUpdated={refreshTicket}
          onReclassified={refreshTicket}
        />
      </div>

      {/* Diálogo de PAUSA DE SLA — motivo próprio (SlaPauseDialog) */}
      <SlaPauseDialog
        open={showSlaPause}
        onOpenChange={setShowSlaPause}
        onConfirm={handleConfirmSlaPause}
      />

      {/* Diálogo de PAUSA DO CICLO DE TRABALHO — próprio diálogo, nunca o de SLA */}
      <WorkCyclePauseDialog
        open={showWorkCyclePause}
        onOpenChange={setShowWorkCyclePause}
        onConfirm={handleConfirmWorkCyclePause}
      />

      <ResolveTicketDialog
        ticketId={id!}
        open={showResolve}
        onOpenChange={setShowResolve}
        onResolved={loadTicket}
      />

      <DelegateDialog
        ticketId={id!}
        open={showDelegate}
        onOpenChange={setShowDelegate}
        onDelegated={loadTicket}
      />

      <ChildTicketDialog
        parent={ticket}
        open={showChildTicket}
        onOpenChange={setShowChildTicket}
        onCreated={loadTicket}
      />

      <AssociateTicketsDialog
        ticket={ticket}
        open={showAssociate}
        onOpenChange={setShowAssociate}
        onAssociated={loadTicket}
      />

      {/* Diálogo "+ Acompanhamento" — lança horas de log e recarrega a ficha ao salvar */}
      <AccompanimentHoursDialog
        open={showAccompaniment}
        onOpenChange={setShowAccompaniment}
        ticketId={id!}
        ticketNumber={ticket.number}
        onSaved={refreshTicket}
      />

      {/* Diálogo de perfil completo + histórico do solicitante */}
      <TicketRequesterProfileDialog
        open={showRequesterProfile}
        onOpenChange={setShowRequesterProfile}
        requesterEmail={ticket.requester_email}
        fallbackName={ticket.requester_name}
        currentTicketId={ticket.id}
      />
    </div>
  )
}
