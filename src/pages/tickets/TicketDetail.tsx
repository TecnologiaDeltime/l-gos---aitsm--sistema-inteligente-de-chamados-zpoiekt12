import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Send,
  Clock,
  User,
  Building2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Server,
  FileCheck,
  MapPin,
  FileText,
  Timer,
  Trash2,
  Pencil,
  Loader2,
  Forward,
  History,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { RequesterInfo } from '@/components/RequesterInfo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InteractionEditDialog } from '@/components/InteractionEditDialog'
import { DelegateDialog } from '@/components/DelegateDialog'
import { deleteInteractionWithReversal } from '@/services/ticket-interactions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getTicket,
  getTicketInteractions,
  createInteraction,
  updateTicket,
  createSlaPause,
  startService,
  getTicketHistory,
  TicketRecord,
} from '@/services/tickets'
import { HOUR_TYPES, BILLING_STATUSES } from '@/services/ticket-interactions'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getActiveContracts, ContractRecord } from '@/services/contracts'
import { getCategoryById, CategoryRecord } from '@/services/categories'
import { calculateSlaDeadlines } from '@/lib/sla-utils'
import { getTicketVisits } from '@/services/technical-visits'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { computeSlaResponseStatus, computeSlaSolutionStatus } from '@/lib/sla-status'
import { ApprovalDialog } from '@/components/ApprovalDialog'
import { VisitDialog } from '@/components/VisitDialog'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const perms = usePermissions()
  const { toast } = useToast()
  const [ticket, setTicket] = useState<TicketRecord | null>(null)
  const [interactions, setInteractions] = useState<any[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [timeSpent, setTimeSpent] = useState('')
  const [timeError, setTimeError] = useState('')
  const [hourType, setHourType] = useState('Contratada')
  const [billingStatus, setBillingStatus] = useState('Faturável')
  const [sending, setSending] = useState(false)
  const [showApproval, setShowApproval] = useState(false)
  const [showVisit, setShowVisit] = useState(false)
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [timerDisplay, setTimerDisplay] = useState('00:00')
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [showDelegate, setShowDelegate] = useState(false)
  const [categoryData, setCategoryData] = useState<CategoryRecord | null>(null)

  const loadData = () => {
    if (!id) return
    getTicket(id)
      .then((t) => {
        setTicket(t)
        if (t.expand?.category) {
          setCategoryData(t.expand.category)
        } else if (t.category) {
          getCategoryById(t.category)
            .then(setCategoryData)
            .catch(() => {})
        }
      })
      .catch(() => {})
    getTicketInteractions(id)
      .then(setInteractions)
      .catch(() => {})
    getTicketVisits(id)
      .then(setVisits)
      .catch(() => {})
    getTicketHistory(id)
      .then(setHistory)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useEffect(() => {
    getActiveContracts()
      .then(setContracts)
      .catch(() => {})
  }, [])
  useRealtime('tickets', () => loadData())
  useRealtime('ticket_interactions', () => loadData())
  useRealtime('technical_visits', () => loadData())
  useRealtime('ticket_history', () => loadData())

  useEffect(() => {
    if (!timerRunning || !timerStart) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStart.getTime()) / 1000)
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
      setTimerDisplay(`${h}:${m}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, timerStart])

  const totalMinutes = interactions.reduce((sum, i) => sum + (i.duration_minutes || 0), 0)
  const totalHoursDisplay = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`

  const handleStartTimer = () => {
    setTimerStart(new Date())
    setTimerRunning(true)
    setTimerDisplay('00:00')
  }

  const handleStopTimer = () => {
    if (!timerStart) return
    const elapsed = Math.floor((Date.now() - timerStart.getTime()) / 60000)
    const h = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const m = String(elapsed % 60).padStart(2, '0')
    setTimeSpent(`${h}:${m}`)
    setTimerRunning(false)
    setTimerStart(null)
    setTimerDisplay('00:00')
    setTimeError('')
  }

  const validateTimeSpent = (value: string): string => {
    if (!value.trim()) return ''
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return 'Formato inválido. Use hh:mm.'
    const mins = parseInt(match[2], 10)
    if (mins > 59) return 'Formato inválido. Use hh:mm.'
    return ''
  }

  const parseTimeToMinutes = (value: string): number => {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return 0
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  }

  const handleSendComment = async () => {
    if (!comment.trim() || !id || !user) return
    const timeValidationError = validateTimeSpent(timeSpent)
    if (timeValidationError) {
      setTimeError(timeValidationError)
      return
    }
    setSending(true)
    try {
      const durationMinutes = parseTimeToMinutes(timeSpent)
      await createInteraction({
        ticket: id,
        author: user.id,
        type: isInternal ? 'Interno' : 'Público',
        content: comment,
        duration_minutes: durationMinutes,
        hour_type: hourType,
        billing_status: billingStatus,
        origin: 'Manual',
      })
      setComment('')
      setTimeSpent('')
      setHourType('Contratada')
      setBillingStatus('Faturável')
      setTimerRunning(false)
      setTimerStart(null)
      setTimerDisplay('00:00')
      loadData()
      if (durationMinutes > 0 && hourType === 'Contratada') {
        toast({ title: 'Interação salva e horas debitadas do contrato' })
      } else {
        toast({ title: 'Interação adicionada!' })
      }
    } catch (err) {
      toast({
        title: 'Erro ao salvar interação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return
    await updateTicket(id, { status: newStatus })
    loadData()
    toast({ title: `Status alterado para: ${newStatus}` })
  }

  const handlePauseSla = async () => {
    if (!id || !user) return
    await createSlaPause({
      ticket: id,
      reason: 'Aguardando Cliente',
      justification: 'Aguardando envio de logs',
      paused_by: user.id,
      paused_at: new Date().toISOString(),
    })
    await updateTicket(id, {
      sla_paused: true,
      sla_status: 'Pausado',
      status: 'Aguardando Cliente',
    })
    loadData()
    toast({ title: 'SLA Pausado' })
  }

  const handleResumeSla = async () => {
    if (!id) return
    await updateTicket(id, {
      sla_paused: false,
      sla_status: 'Dentro do Prazo',
      status: 'Em Atendimento',
    })
    loadData()
    toast({ title: 'SLA Retomado' })
  }

  const handleStartService = async () => {
    if (!id) return
    try {
      await startService(id)
      toast({ title: 'Atendimento iniciado! SLA Response em contagem.' })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao iniciar atendimento',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteInteractionWithReversal(deleteTarget.id)
      toast({ title: 'Interação excluída e horas estornadas!' })
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao excluir interação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleEditInteraction = (interaction: any) => {
    setEditTarget(interaction)
    setEditOpen(true)
  }

  const handleContractChange = async (newContractId: string) => {
    if (!id) return
    const actualId = newContractId === '_none' ? '' : newContractId
    const selected = contracts.find((c) => c.id === actualId)
    const sla = selected ? calculateSlaDeadlines(selected) : {}
    await updateTicket(id, { contract: actualId || null, ...sla } as any)
    loadData()
    toast({ title: 'Contrato atualizado!' })
  }

  if (!ticket)
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <RequesterInfo ticket={null} />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              #{ticket.number} - {ticket.title}
            </h2>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Aberto por <span className="font-semibold text-slate-700">{ticket.requester_name}</span>{' '}
            em {new Date(ticket.created).toLocaleString('pt-BR')}
          </p>
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-800 border dark:bg-slate-800 dark:text-slate-200">
            {ticket.description}
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-white p-3 dark:bg-slate-900">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Operador
            </span>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                {ticket.expand?.assigned_to?.avatar && (
                  <AvatarImage
                    src={`${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${ticket.expand.assigned_to.id}/${ticket.expand.assigned_to.avatar}`}
                  />
                )}
                <AvatarFallback className="bg-blue-600 text-[10px] text-white">
                  {ticket.expand?.assigned_to?.name?.substring(0, 2).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {ticket.expand?.assigned_to?.name || 'Não atribuído'}
              </span>
            </div>
          </div>
          {ticket.equipment && ticket.expand?.equipment && (
            <div className="flex items-center gap-2 text-xs">
              <Server className="h-4 w-4 text-slate-400" />
              <span>Ativo: </span>
              <Link
                to={`/cmdb/assets/${ticket.equipment}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {ticket.expand.equipment.name} ({ticket.expand.equipment.hostname || 'sem hostname'}
                )
              </Link>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            {!ticket.sla_response_start &&
              ticket.status !== 'Resolvido' &&
              ticket.status !== 'Encerrado' &&
              ticket.status !== 'Cancelado' && (
                <Button
                  size="sm"
                  onClick={handleStartService}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <PlayCircle className="mr-1.5 h-4 w-4" /> Iniciar Atendimento
                </Button>
              )}
            {ticket.sla_paused ? (
              <Button size="sm" variant="outline" onClick={handleResumeSla}>
                <PlayCircle className="mr-1.5 h-4 w-4 text-green-600" /> Retomar SLA
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handlePauseSla}>
                <PauseCircle className="mr-1.5 h-4 w-4 text-amber-600" /> Pausar SLA
              </Button>
            )}
            {ticket.status !== 'Resolvido' && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleStatusChange('Resolvido')}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Resolver
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowDelegate(true)}>
              <Forward className="mr-1.5 h-4 w-4" /> Delegar
            </Button>
            {(perms.isAdmin || perms.isGestor || perms.isClienteGestor) && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowApproval(true)}>
                  <FileCheck className="mr-1.5 h-4 w-4" /> Solicitar Aprovação
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowVisit(true)}>
                  <MapPin className="mr-1.5 h-4 w-4" /> Agendar Visita
                </Button>
              </>
            )}
          </div>
        </div>
        <Tabs defaultValue="interactions" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none p-0 bg-transparent">
            <TabsTrigger value="interactions">Interações ({interactions.length})</TabsTrigger>
            <TabsTrigger value="visits">Visitas ({visits.length})</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="interactions" className="pt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 dark:bg-slate-800">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Total de Horas
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                Total: {totalHoursDisplay}
              </span>
            </div>
            <div className="space-y-3">
              {interactions.map((i) => (
                <div
                  key={i.id}
                  className="rounded-lg border p-4 text-xs space-y-1 bg-white dark:bg-slate-900"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">
                      {i.expand?.author?.name || 'Usuário'}
                    </span>
                    <div className="flex items-center gap-2">
                      {i.type === 'Interno' && (
                        <Badge variant="outline" className="text-[10px]">
                          Interno
                        </Badge>
                      )}
                      <span className="text-slate-400">
                        {new Date(i.created).toLocaleString('pt-BR')}
                      </span>
                      {(perms.isTecnico || perms.isAdmin || perms.isGestor) && (
                        <>
                          <button
                            onClick={() => handleEditInteraction(i)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar interação"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(i)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Excluir interação"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-700">{i.content}</p>
                  {i.duration_minutes > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>
                        {Math.floor(i.duration_minutes / 60)}h {i.duration_minutes % 60}min
                      </span>
                      {i.hour_type && (
                        <Badge variant="outline" className="text-[10px]">
                          {i.hour_type}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-white p-4 space-y-3 dark:bg-slate-900">
              <Textarea
                placeholder="Escreva uma resposta ou nota interna..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Tempo Gasto</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="hh:mm"
                      value={timeSpent}
                      onChange={(e) => {
                        setTimeSpent(e.target.value)
                        setTimeError(validateTimeSpent(e.target.value))
                      }}
                      className="h-8 text-sm"
                    />
                    {timerRunning ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-8 shrink-0 whitespace-nowrap"
                        onClick={handleStopTimer}
                      >
                        <Timer className="mr-1 h-3.5 w-3.5" />
                        Parar {timerDisplay}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={handleStartTimer}
                      >
                        <Timer className="mr-1 h-3.5 w-3.5" />
                        Iniciar
                      </Button>
                    )}
                  </div>
                  {timeError && <p className="text-xs text-red-500">{timeError}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Tipo de Hora</Label>
                  <Select value={hourType} onValueChange={setHourType}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Faturamento</Label>
                  <Select value={billingStatus} onValueChange={setBillingStatus}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-600 flex items-center gap-2 cursor-pointer dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />{' '}
                  Nota interna (visível apenas para a equipe)
                </label>
                <Button
                  onClick={handleSendComment}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                  disabled={sending}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="visits" className="pt-4 space-y-3">
            {visits.length === 0 ? (
              <p className="text-center text-sm text-slate-500 p-4">
                Nenhuma visita técnica agendada.
              </p>
            ) : (
              visits.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border p-4 text-xs space-y-1 bg-white dark:bg-slate-900"
                >
                  <div className="flex justify-between items-center">
                    <Badge variant="outline">{v.status}</Badge>
                    <span className="text-slate-400">
                      {v.scheduled_date
                        ? new Date(v.scheduled_date).toLocaleDateString('pt-BR')
                        : ''}{' '}
                      {v.scheduled_time || ''}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <MapPin className="inline h-3 w-3" /> {v.client_address || '-'}
                  </p>
                  <p className="text-slate-600">Técnico: {v.expand?.technician?.name || '-'}</p>
                  {v.materials && <p className="text-slate-600">Materiais: {v.materials}</p>}
                </div>
              ))
            )}
          </TabsContent>
          <TabsContent value="history" className="pt-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-center text-sm text-slate-500 p-4">Nenhum histórico registrado.</p>
            ) : (
              history.map((h) => {
                const isDelegation = h.action === 'Delegação' || h.action === 'Delegação em lote'
                const rawNew = h.new_value || ''
                const reasonMatch = rawNew.match(/\s*\|\s*Motivo:\s*(.+)$/)
                const reason = reasonMatch ? reasonMatch[1] : ''
                const cleanNew = rawNew.replace(/\s*\|\s*Motivo:\s*.+$/, '')
                return (
                  <div
                    key={h.id}
                    className="rounded-lg border p-4 text-xs space-y-1 bg-white dark:bg-slate-900"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        {h.action}
                      </span>
                      <span className="text-slate-400">
                        {new Date(h.created).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {isDelegation ? (
                      <p className="text-slate-600">
                        De &ldquo;{h.old_value || 'Ninguém'}&rdquo; para &ldquo;{cleanNew}&rdquo;
                        {reason && (
                          <span className="text-slate-500 italic"> (Motivo: {reason})</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-slate-600">
                        {h.field && <span className="font-medium">{h.field}: </span>}
                        {h.old_value || '—'} → {h.new_value || '—'}
                      </p>
                    )}
                    {h.expand?.user && <p className="text-slate-400">Por: {h.expand.user.name}</p>}
                  </div>
                )
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
      <div className="space-y-4">
        <RequesterInfo ticket={ticket} onUpdated={loadData} />
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4 dark:bg-slate-900">
          <h3 className="font-semibold text-sm border-b pb-2">Controle de SLA</h3>
          {categoryData && (
            <div className="flex items-center justify-between text-xs pb-2 border-b">
              <span className="text-slate-500">
                Categoria:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {categoryData.name}
                </span>
              </span>
              <div className="flex gap-3">
                <span className="text-slate-500">
                  Resp:{' '}
                  {categoryData.sla_response_minutes
                    ? `${categoryData.sla_response_minutes}min`
                    : 'Não definido'}
                </span>
                <span className="text-slate-500">
                  Sol:{' '}
                  {categoryData.sla_solution_minutes
                    ? `${categoryData.sla_solution_minutes}min`
                    : 'Não definido'}
                </span>
              </div>
            </div>
          )}
          <SlaDetailBlock
            type="response"
            status={
              categoryData && !categoryData.sla_response_minutes
                ? 'Não definido'
                : computeSlaResponseStatus(ticket)
            }
            deadline={ticket.sla_response_deadline}
            completedAt={ticket.sla_response_at}
          />
          <SlaDetailBlock
            type="solution"
            status={
              categoryData && !categoryData.sla_solution_minutes
                ? 'Não definido'
                : computeSlaSolutionStatus(ticket)
            }
            deadline={ticket.sla_solution_deadline}
            completedAt={ticket.sla_solution_at}
          />
          <div className="pt-2 border-t space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400" /> Cliente:{' '}
              {ticket.expand?.company?.trade_name || 'N/A'}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4 text-slate-400" /> Técnico:{' '}
              {ticket.expand?.assigned_to?.name || 'Não atribuído'}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" /> Horas: {ticket.work_hours || 0}h
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Timer className="h-4 w-4 text-slate-400" /> Total: {totalHoursDisplay}
            </div>
            {ticket.sla_response_start && (
              <div className="flex items-center gap-2 text-slate-600">
                <PlayCircle className="h-4 w-4 text-slate-400" /> Início Atend.:{' '}
                {new Date(ticket.sla_response_start).toLocaleString('pt-BR')}
              </div>
            )}
            {ticket.equipment && ticket.expand?.equipment && (
              <div className="flex items-center gap-2 text-slate-600">
                <Server className="h-4 w-4 text-slate-400" /> Ativo:{' '}
                <Link
                  to={`/cmdb/assets/${ticket.equipment}`}
                  className="text-blue-600 hover:underline"
                >
                  {ticket.expand.equipment.name}
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3 dark:bg-slate-900">
          <h3 className="font-semibold text-sm border-b pb-2">Contrato Vinculado</h3>
          {ticket.contract && ticket.expand?.contract ? (
            <Link
              to={`/contracts/${ticket.contract}`}
              className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
            >
              <FileText className="h-4 w-4" />
              {ticket.expand.contract.number}
              {ticket.expand.contract.expand?.company?.trade_name
                ? ` — ${ticket.expand.contract.expand.company.trade_name}`
                : ''}
            </Link>
          ) : (
            <p className="text-xs text-slate-500">Nenhum contrato vinculado.</p>
          )}
          <Select value={ticket.contract || '_none'} onValueChange={handleContractChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Alterar contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sem contrato</SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.number} — {c.expand?.company?.trade_name || 'N/A'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ApprovalDialog ticketId={id!} open={showApproval} onOpenChange={setShowApproval} />
      <VisitDialog
        ticketId={id!}
        companyId={ticket.company}
        open={showVisit}
        onOpenChange={setShowVisit}
        onSaved={loadData}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Interação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta interação? As horas serão estornadas do contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InteractionEditDialog
        interaction={editTarget}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={loadData}
      />
      <DelegateDialog
        ticketId={id!}
        open={showDelegate}
        onOpenChange={setShowDelegate}
        onDelegated={loadData}
      />
    </div>
  )
}
