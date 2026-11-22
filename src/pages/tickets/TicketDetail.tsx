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
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import {
  getTicket,
  getTicketInteractions,
  getTicketHistory,
  createInteraction,
  startService,
  pauseTicketSla,
  resumeTicketSla,
  startOperatorWorkCycle,
  stopOperatorWorkCycle,
  pauseOperatorWorkCycle,
  resumeOperatorWorkCycle,
  getOpenWorkCyclePause,
  WorkCyclePauseRecord,
  TicketRecord,
  TicketInteractionRecord,
} from '@/services/tickets'
import {
  getTicketAttachments,
  uploadAttachment,
  getAttachmentFileUrl,
  TicketAttachmentRecord,
} from '@/services/attachments'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { SlaStatusBadge } from '@/components/SlaStatusBadge'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { SlaPauseDialog } from '@/components/SlaPauseDialog'
import { WorkCyclePauseDialog } from '@/components/WorkCyclePauseDialog'
import { ResolveTicketDialog } from '@/components/ResolveTicketDialog'
import { computeSlaSolutionStatus } from '@/lib/sla-status'
import { formatSeconds } from '@/lib/duration'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import pb from '@/lib/pocketbase/client'

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
  // - showSlaPause: pausa de SLA (botão "Pausar SLA", antes de Resolver)
  // - showWorkCyclePause: pausa do ciclo de trabalho (só contabiliza horas do
  //   operador; NUNCA toca em campos de SLA)
  const [showSlaPause, setShowSlaPause] = useState(false)
  const [showWorkCyclePause, setShowWorkCyclePause] = useState(false)
  const [showResolve, setShowResolve] = useState(false)

  const [newInteraction, setNewInteraction] = useState('')
  const [sendingInteraction, setSendingInteraction] = useState(false)

  const canPauseWorkCycle = canAccessItem('tickets', 'tickets_work_cycle_pause')

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

  // ---- Ações de SLA (botão "Pausar SLA", antes de Resolver) ----
  const handleResumeSla = () => runAction(() => resumeTicketSla(id!), 'SLA retomado')
  const handleConfirmSlaPause = async (reason: string, justification: string) => {
    await pauseTicketSla(id!, reason, justification)
    toast({ title: 'SLA pausado' })
    await refreshTicket()
  }

  const handleStartService = () => runAction(() => startService(id!), 'Atendimento iniciado')

  const handleSendInteraction = async () => {
    if (!newInteraction.trim() || !user?.id) return
    setSendingInteraction(true)
    try {
      await createInteraction({
        ticket: id!,
        author: user.id,
        type: 'Comentário',
        content: newInteraction.trim(),
        origin: 'interno',
      })
      setInteractions(await getTicketInteractions(id!))
      setNewInteraction('')
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
          <span className="font-mono text-lg font-bold">{ticket.number || ticket.id}</span>
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
        <h1 className="text-xl font-semibold tracking-tight">{ticket.title}</h1>
      </div>

      {/* Barra de ações */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          {ticket.status === 'Novo' && canAssignTicket && (
            <Button size="sm" onClick={handleStartService} disabled={actionLoading}>
              <Play className="mr-1 h-4 w-4" /> Iniciar Atendimento
            </Button>
          )}

          {/* CICLO DE TRABALHO — guard tickets_work_cycle_pause; NÃO pausa SLA.
              A pausa fecha operator_cycle_start no backend, então o estado de
              pausa é detectado pela pausa EM ABERTO (openCyclePause) e tem
              precedência sobre "Iniciar Ciclo". */}
          {canPauseWorkCycle && !isClosed && (
            <>
              {cyclePaused ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResumeWorkCycle}
                  disabled={actionLoading}
                >
                  <Coffee className="mr-1 h-4 w-4" /> Retomar Ciclo
                </Button>
              ) : ticket.operator_cycle_start ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowWorkCyclePause(true)}
                    disabled={actionLoading}
                  >
                    <Coffee className="mr-1 h-4 w-4 text-amber-500" /> Pausar Ciclo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStopWorkCycle}
                    disabled={actionLoading}
                  >
                    <Square className="mr-1 h-4 w-4" /> Encerrar Ciclo
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartWorkCycle}
                  disabled={actionLoading}
                >
                  <Clock className="mr-1 h-4 w-4" /> Iniciar Ciclo
                </Button>
              )}
            </>
          )}

          {/* SLA — botão Pausar SLA fica ANTES do botão Resolver */}
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
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Descrição</CardTitle>
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

          {/* Interações */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> Interações ({interactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {interactions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
              )}
              {interactions.map((it) => (
                <div key={it.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {it.expand?.author?.name || 'Sistema'}
                    </span>
                    <span>
                      {it.type} · {new Date(it.created).toLocaleString('pt-BR')}
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
              )}
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" /> Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          {/* SLA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">SLA</CardTitle>
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

          {/* Ciclo de Trabalho — painel próprio, separado do SLA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Ciclo de Trabalho do Operador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo da pausa</span>
                  <span className="font-medium">
                    {openCyclePause.reason}
                    {openCyclePause.description ? ` — ${openCyclePause.description}` : ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horas trabalhadas</span>
                <span className="font-mono font-medium">
                  {formatSeconds(ticket.operator_worked_seconds || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horas do chamado</span>
                <span className="font-mono font-medium">
                  {(ticket.work_hours || 0).toFixed(2)} h
                </span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                A pausa do ciclo de trabalho serve apenas para contabilização das horas de trabalho
                do operador — ela <strong>não pausa o SLA</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Detalhes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solicitante</span>
                <span className="font-medium">{ticket.requester_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-mail</span>
                <span>{ticket.requester_email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria</span>
                <span>{categoryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span>{ticket.type}</span>
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

          {/* Anexos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4" /> Anexos ({attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
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
    </div>
  )
}
