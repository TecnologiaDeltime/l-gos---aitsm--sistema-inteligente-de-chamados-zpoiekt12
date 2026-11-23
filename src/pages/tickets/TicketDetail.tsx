import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Square,
  PauseCircle,
  Coffee,
  CheckCircle2,
  Clock,
  Paperclip,
  Send,
  Loader2,
  History,
  MessageSquare,
  Download,
  Users,
  GitBranch,
  Link2,
  ClipboardCheck,
  Pause,
  Timer,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  getTicketAttachments,
  uploadAttachment,
  getAttachmentFileUrl,
} from '@/services/attachments'
import type { TicketAttachmentRecord } from '@/services/attachments'
import { sendManualApproval } from '@/services/approvals'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { SlaPauseDialog } from '@/components/SlaPauseDialog'
import { WorkCyclePauseDialog } from '@/components/WorkCyclePauseDialog'
import { ResolveTicketDialog } from '@/components/ResolveTicketDialog'
import { DelegateDialog } from '@/components/DelegateDialog'
import { ChildTicketDialog } from '@/components/ChildTicketDialog'
import { AssociateTicketsDialog } from '@/components/AssociateTicketsDialog'
import { TicketAiReplyPanel } from '@/components/TicketAiReplyPanel'
import { TicketCategoryCard } from '@/components/tickets/TicketCategoryCard'
import { TicketTriageHistoryCard } from '@/components/tickets/TicketTriageHistoryCard'
import { KbRecommendedBlock } from '@/components/tickets/KbRecommendedBlock'
import { computeSlaSolutionStatus } from '@/lib/sla-status'
import { formatSeconds, parseHHMMToMinutes } from '@/lib/duration'
import { HHMMInput } from '@/components/ui/HHMMInput'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { cn } from '@/lib/utils'

interface HistoryRecord {
  id: string
  action: string
  field?: string
  old_value?: string
  new_value?: string
  created: string
  expand?: { user?: { id: string; name?: string; email?: string } }
}

const CLOSED_STATUSES = ['Resolvido', 'Encerrado', 'Cancelado']

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
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

  const [newInteraction, setNewInteraction] = useState('')
  const [newInteractionMinutes, setNewInteractionMinutes] = useState('')
  const [sendingInteraction, setSendingInteraction] = useState(false)

  const canPauseWorkCycle = canAccessItem('tickets', 'tickets_work_cycle_pause')
  const canUseAiReply = canAccessItem('tickets', 'tickets_ai_reply')
  const canViewTriageHistory = canAccessItem('tickets', 'tickets_triage_history')
  const canEditCategory = canAccessItem('tickets', 'tickets_categoria_edit')
  const canSendManualApproval = canAccessItem('tickets', 'tickets_manual_approval_send')

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
      toast({
        title: 'Erro ao carregar chamado',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
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

  if (loading) {
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
        <Button variant="outline" onClick={() => navigate('/tickets')}>
          Voltar para a lista
        </Button>
      </div>
    )
  }

  const expanded: any = ticket.expand || {}
  const assignedName = expanded.assigned_to?.name || 'Não atribuído'
  const categoryName = expanded.category?.name || ticket.category || '—'

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold tracking-wide text-primary">
            {ticket.number || ticket.id}
          </span>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Procedimentos Recomendados da KB — topo da ficha */}
          <KbRecommendedBlock title={ticket.title} description={ticket.description} />

          {/* Descrição */}
          <Card>
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

          {/* Interações / Histórico / Anexos — abas */}
          <Tabs defaultValue="interactions">
            <TabsList>
              <TabsTrigger value="interactions">
                <MessageSquare className="mr-1 h-4 w-4" /> Interações ({interactions.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-1 h-4 w-4" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="attachments">
                <Paperclip className="mr-1 h-4 w-4" /> Anexos ({attachments.length})
              </TabsTrigger>
            </TabsList>

            {/* Aba Interações — com campo de tempo por interação */}
            <TabsContent value="interactions" className="space-y-3">
              {interactions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
              )}
              {interactions.map((it) => (
                <div key={it.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {it.expand?.author?.name || 'Sistema'}
                    </span>
                    <span className="flex items-center gap-2">
                      {typeof it.duration_minutes === 'number' && it.duration_minutes > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {formatSeconds(it.duration_minutes * 60)} de trabalho
                        </Badge>
                      )}
                      <span>
                        {it.type} · {new Date(it.created).toLocaleString('pt-BR')}
                      </span>
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{it.content}</p>
                </div>
              ))}
              {!isClosed && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    value={newInteraction}
                    onChange={(e) => setNewInteraction(e.target.value)}
                    rows={3}
                    placeholder="Registrar uma interação (comentário interno ou para o cliente)..."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                        Tempo (00:00)
                      </span>
                      <HHMMInput
                        value={newInteractionMinutes}
                        onChange={setNewInteractionMinutes}
                        aria-label="Tempo da interação (horas e minutos)"
                        className="w-24"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSendInteraction}
                      disabled={sendingInteraction || !newInteraction.trim()}
                    >
                      {sendingInteraction ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-4 w-4" />
                      )}
                      Enviar Interação
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Aba Histórico */}
            <TabsContent value="history" className="space-y-2">
              {history.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
              )}
              {history.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {new Date(h.created).toLocaleString('pt-BR')}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {h.action}
                  </Badge>
                  {h.field && <span className="font-mono">{h.field}</span>}
                  {h.new_value && (
                    <span className="text-muted-foreground">
                      {h.old_value ? `${h.old_value} → ` : ''}
                      {h.new_value}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    por {h.expand?.user?.name || h.expand?.user?.email || 'sistema'}
                  </span>
                </div>
              ))}
            </TabsContent>

            {/* Aba Anexos */}
            <TabsContent value="attachments" className="space-y-2">
              {attachments.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
              )}
              {attachments.map((a) => (
                <a
                  key={a.id}
                  href={getAttachmentFileUrl(a)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded border px-2 py-1.5 text-xs hover:bg-muted/50"
                >
                  <span className="truncate">{a.file_name || a.file}</span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              ))}
              {!isClosed && (
                <label className="mt-2 block cursor-pointer text-xs text-primary hover:underline">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleAttach(e.target.files)}
                  />
                  Anexar arquivo…
                </label>
              )}
            </TabsContent>
          </Tabs>

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

          {/* Total de Horas Lançadas no Chamado */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base tracking-tight">
                <Timer className="h-4 w-4" /> Total de Horas Lançadas no Chamado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-2xl font-bold">
                {formatSeconds(ticket.accompaniment_seconds || 0)}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          {/* CICLO DE TRABALHO — topo da coluna direita; Play (verde) e Pause
              (âmbar) ACIMA do card, no canto superior direito da coluna */}
          {canPauseWorkCycle && !isClosed && (
            <div className="flex justify-end">
              <span className="flex items-center gap-1.5">
                {cyclePaused ? (
                  <Button
                    size="icon"
                    variant="outline"
                    title="Retomar ciclo"
                    aria-label="Retomar ciclo de trabalho"
                    className="h-8 w-8 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    onClick={handleResumeWorkCycle}
                    disabled={actionLoading}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : ticket.operator_cycle_start ? (
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      title="Pausar ciclo"
                      aria-label="Pausar ciclo de trabalho"
                      className="h-8 w-8 border-amber-500/60 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                      onClick={() => setShowWorkCyclePause(true)}
                      disabled={actionLoading}
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Encerrar ciclo"
                      aria-label="Encerrar ciclo de trabalho"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleStopWorkCycle}
                      disabled={actionLoading}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="icon"
                    variant="outline"
                    title="Iniciar ciclo"
                    aria-label="Iniciar ciclo de trabalho"
                    className="h-8 w-8 border-emerald-500/60 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    onClick={handleStartWorkCycle}
                    disabled={actionLoading}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
              </span>
            </div>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-base tracking-tight">
                <Clock className="h-4 w-4" /> Ciclo de Trabalho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tempo do Ciclo
                </p>
                <p className="font-mono text-3xl font-bold">
                  {formatSeconds(ticket.operator_worked_seconds || 0)}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estado</span>
                <span className="font-medium">
                  {cyclePaused
                    ? 'Pausado (não pausa o SLA)'
                    : ticket.operator_cycle_start
                      ? 'Em andamento'
                      : 'Não iniciado'}
                </span>
              </div>
              {cyclePaused && openCyclePause?.reason && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Motivo da pausa</span>
                  <span className="font-medium">
                    {openCyclePause.reason}
                    {openCyclePause.description ? ` — ${openCyclePause.description}` : ''}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                A pausa do ciclo serve apenas para contabilização das horas de trabalho do operador
                — ela <strong>não pausa o SLA</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Solicitante */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base tracking-tight">Solicitante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{ticket.requester_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-mail</span>
                <span>{ticket.requester_email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Responsável</span>
                <span>{assignedName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aberto em</span>
                <span>{new Date(ticket.created).toLocaleString('pt-BR')}</span>
              </div>
            </CardContent>
          </Card>

          {/* SLA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-base tracking-tight">SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SlaDetailBlock
                type="response"
                status={
                  ticket.sla_response_at
                    ? ticket.sla_response_compliance || 'Dentro do Prazo'
                    : ticket.sla_response_deadline
                      ? 'Dentro do Prazo'
                      : 'Não definido'
                }
                deadline={ticket.sla_response_deadline}
                completedAt={ticket.sla_response_at}
                startedAt={ticket.sla_response_start}
                createdAt={ticket.created}
              />
              <SlaDetailBlock
                type="solution"
                status={
                  ticket.sla_paused && !ticket.sla_solution_at
                    ? 'Pausado'
                    : computeSlaSolutionStatus(ticket)
                }
                deadline={ticket.sla_solution_deadline}
                completedAt={ticket.sla_solution_at}
                createdAt={ticket.created}
                totalPauseMinutes={ticket.sla_pause_total_minutes || 0}
              />
            </CardContent>
          </Card>

          {/* DOIS CARTÕES LADO A LADO — horas trabalhadas (âmbar claro) e horas de log (cinza claro) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Horas Trabalhadas
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-amber-800 dark:text-amber-300">
                {formatSeconds(ticket.operator_worked_seconds || 0)}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Horas de Log do Chamado
              </p>
              <p className="mt-1 font-mono text-lg font-bold">
                {formatSeconds(ticket.accompaniment_seconds || 0)}
              </p>
            </div>
          </div>

          {/* Categoria / Atividade */}
          <TicketCategoryCard
            ticketId={id!}
            currentCategoryId={ticket.category}
            currentSubcategoryId={ticket.subcategory}
            canEdit={canEditCategory}
            onUpdated={refreshTicket}
          />

          {/* Triagem por IA */}
          {canViewTriageHistory && (
            <TicketTriageHistoryCard
              ticketId={id!}
              canReclassify={!isClosed}
              onReclassified={refreshTicket}
            />
          )}
        </div>
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
    </div>
  )
}
