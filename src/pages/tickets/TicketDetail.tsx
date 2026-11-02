import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Send,
  Clock,
  User,
  Building2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Server,
  Boxes,
  FileCheck,
  MapPin,
  FileText,
  Timer,
  Trash2,
  Pencil,
  Loader2,
  Forward,
  History,
  GitBranch,
  ArrowUpRight,
  ArrowLeft,
  Link2,
  Paperclip,
  Download,
  FileIcon,
  UploadCloud,
} from 'lucide-react'
import { ChildTicketDialog, checkPendingChildren } from '@/components/ChildTicketDialog'
import { PendingChildrenAlert } from '@/components/PendingChildrenAlert'
import { AssociateTicketsDialog } from '@/components/AssociateTicketsDialog'
import { BatchResolveConfirmDialog } from '@/components/BatchResolveConfirmDialog'
import { getChildTickets, TicketRecord as ChildTicket } from '@/services/tickets'
import { getAssociatedTickets } from '@/services/ticket-associations'
import type { TicketRecord as AssociatedTicket } from '@/services/tickets'
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
import { ResolveTicketDialog } from '@/components/ResolveTicketDialog'
import { HourReviewDialog } from '@/components/HourReviewDialog'
import { getActiveTemplates, TicketTemplateRecord } from '@/services/ticket-templates'
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
  pauseTicketSla,
  resumeTicketSla,
  startOperatorWorkCycle,
  stopOperatorWorkCycle,
  getSlaPauses,
  getTicketHistory,
  TicketRecord,
  SlaPauseRecord,
} from '@/services/tickets'

import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getActiveContracts, ContractRecord } from '@/services/contracts'
import { getCategoryById, CategoryRecord } from '@/services/categories'
import { calculateSlaDeadlines } from '@/lib/sla-utils'
import { getTicketVisits } from '@/services/technical-visits'
import {
  getTicketAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentFileUrl,
  type TicketAttachmentRecord,
} from '@/services/attachments'
import { PriorityBadge } from '@/components/PriorityBadge'
import { TicketAiReplyPanel } from '@/components/TicketAiReplyPanel'
import { TicketTagsSection } from '@/components/TicketTagsSection'
import { StatusBadge } from '@/components/StatusBadge'
import { OriginalEmailCard } from '@/components/OriginalEmailCard'
import { sanitizeEmailHtml } from '@/lib/sanitize-email-html'
import { SlaDetailBlock } from '@/components/SlaDetailBlock'
import { computeSlaResponseStatus, computeSlaSolutionStatus } from '@/lib/sla-status'
import { VisitDialog } from '@/components/VisitDialog'
import { SlaPauseDialog, STATUS_BY_REASON } from '@/components/SlaPauseDialog'
import { AccompanimentDialog } from '@/components/AccompanimentDialog'
import { formatMinutes } from '@/lib/duration'
import {
  handleTimeSpentMask,
  handleTimeSpentKeyDown,
  validateTimeSpentValue,
} from '@/lib/time-mask'
import {
  Inbox,
  Sparkles,
  Check,
  CheckCheck,
  BookOpen,
  ExternalLink,
  Play,
  Pause,
} from 'lucide-react'
import { getKnowledgeArticles, KnowledgeArticle } from '@/services/knowledge'
import { ArticleDetailDialog } from '@/components/knowledge/ArticleDetailDialog'
import { trackTicketView, getTicketViews, TicketViewRecord } from '@/services/ticket-views'
import {
  getConsolidatedTicketParticipants,
  TicketParticipant,
} from '@/services/ticket-participants'
import { TicketParticipantsViewer } from '@/components/TicketParticipantsViewer'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

interface TicketDetailProps {
  ticketId?: string
  onTicketUpdated?: () => void
}

export default function TicketDetail({
  ticketId: propTicketId,
  onTicketUpdated,
}: TicketDetailProps = {}) {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const id = propTicketId || params.id
  const { user } = useAuth()
  const perms = usePermissions()
  const canEditTicket = perms.canEdit('tickets_fila') || perms.canEdit('tickets')
  const canDeleteTicket = perms.canDelete('tickets_fila') || perms.canDelete('tickets')
  const { toast } = useToast()
  const [ticket, setTicket] = useState<TicketRecord | null>(null)
  const [interactions, setInteractions] = useState<any[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [slaPauses, setSlaPauses] = useState<SlaPauseRecord[]>([])
  const [attachments, setAttachments] = useState<TicketAttachmentRecord[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [timeSpent, setTimeSpent] = useState('')
  const [timeError, setTimeError] = useState('')
  const [sending, setSending] = useState(false)
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
  const [showResolve, setShowResolve] = useState(false)
  const [showHourReview, setShowHourReview] = useState(false)
  const [showNoRecordsConfirm, setShowNoRecordsConfirm] = useState(false)
  const [showSlaPause, setShowSlaPause] = useState(false)
  const [showAccompaniment, setShowAccompaniment] = useState(false)
  const [cycleSeconds, setCycleSeconds] = useState(0)
  const [cycleActionLoading, setCycleActionLoading] = useState(false)
  const [commentTemplates, setCommentTemplates] = useState<TicketTemplateRecord[]>([])
  const [selectedCommentTemplate, setSelectedCommentTemplate] =
    useState<TicketTemplateRecord | null>(null)
  const [showChildTicket, setShowChildTicket] = useState(false)
  const [childTickets, setChildTickets] = useState<ChildTicket[]>([])
  const [pendingChildren, setPendingChildren] = useState<ChildTicket[]>([])
  const [showPendingAlert, setShowPendingAlert] = useState(false)
  const [showAssociate, setShowAssociate] = useState(false)
  const [associatedTickets, setAssociatedTickets] = useState<AssociatedTicket[]>([])
  const [showBatchResolve, setShowBatchResolve] = useState(false)
  const [resolveBlockMessage, setResolveBlockMessage] = useState<string | null>(null)
  const [applyingTriage, setApplyingTriage] = useState(false)
  const [suggestedArticles, setSuggestedArticles] = useState<KnowledgeArticle[]>([])
  const [selectedKbArticle, setSelectedKbArticle] = useState<KnowledgeArticle | null>(null)
  const [kbDetailOpen, setKbDetailOpen] = useState(false)
  const [views, setViews] = useState<TicketViewRecord[]>([])
  const [participants, setParticipants] = useState<TicketParticipant[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)

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
        if (onTicketUpdated) {
          onTicketUpdated()
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
    getSlaPauses(id)
      .then(setSlaPauses)
      .catch(() => setSlaPauses([]))
    getTicketAttachments(id)
      .then(setAttachments)
      .catch(() => {})
    getChildTickets(id)
      .then(setChildTickets)
      .catch(() => {})
    getAssociatedTickets(id)
      .then(setAssociatedTickets)
      .catch(() => setAssociatedTickets([]))
    getTicketViews(id)
      .then(setViews)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])

  // Rastreia a visualização do usuário logado assim que o ticket é aberto
  useEffect(() => {
    if (!id || !user?.id) return
    trackTicketView(id, user.id)
      .then(() => {
        getTicketViews(id)
          .then(setViews)
          .catch(() => {})
      })
      .catch(() => {})
  }, [id, user?.id])

  // Consolida e atualiza a lista de participantes sempre que ticket, interações, anexos ou views mudarem
  useEffect(() => {
    if (!ticket) return
    let isCurrent = true
    setLoadingParticipants(true)
    getConsolidatedTicketParticipants(ticket, interactions, attachments, views)
      .then((res) => {
        if (isCurrent) setParticipants(res)
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setLoadingParticipants(false)
      })
    return () => {
      isCurrent = false
    }
  }, [ticket, interactions, attachments, views])

  // Busca procedimentos/artigos sugeridos da Base de Conhecimento com base em tokens, categoria ou atividade do ticket
  useEffect(() => {
    if (!ticket) return
    getKnowledgeArticles()
      .then((allArticles) => {
        const ticketText = `${ticket.title} ${ticket.description || ''}`.toLowerCase()
        const ticketSubcategory = ticket.subcategory || ''
        const ticketCategory = ticket.category || ''

        const matched = allArticles.filter((art) => {
          // 1. Casamento direto por atividade/categoria
          if (
            ticketSubcategory &&
            (art.activity === ticketSubcategory || art.category === ticketSubcategory)
          ) {
            return true
          }
          if (
            ticketCategory &&
            (art.activity === ticketCategory || art.category === ticketCategory)
          ) {
            return true
          }

          // 2. Casamento por tokens do artigo no título/descrição do chamado
          const tokens = Array.isArray(art.tokens)
            ? art.tokens
            : art.tags
              ? art.tags.split(',').map((t) => t.trim().toLowerCase())
              : []

          return tokens.some((t) => t.length >= 3 && ticketText.includes(t))
        })

        setSuggestedArticles(matched.slice(0, 3))
      })
      .catch(() => {})
  }, [ticket?.id, ticket?.subcategory, ticket?.category, ticket?.title])
  useEffect(() => {
    getActiveContracts()
      .then(setContracts)
      .catch(() => {})
    getActiveTemplates('Comentário')
      .then(setCommentTemplates)
      .catch(() => {})
  }, [])
  useRealtime('tickets', () => loadData())
  useRealtime('ticket_interactions', () => loadData())
  useRealtime('technical_visits', () => loadData())
  useRealtime('ticket_history', () => loadData())
  useRealtime('ticket_attachments', () => loadData())
  useRealtime('sla_pauses', () => {
    if (id) {
      getSlaPauses(id)
        .then(setSlaPauses)
        .catch(() => {})
    }
  })
  useRealtime('ticket_views', () => {
    if (id) {
      getTicketViews(id)
        .then(setViews)
        .catch(() => {})
    }
  })

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

  // Cronômetro em tempo real do ciclo de trabalho do operador (operator_cycle_start)
  const isCycleActive = Boolean(
    ticket?.operator_cycle_start &&
    ticket.status !== 'Resolvido' &&
    ticket.status !== 'Encerrado' &&
    ticket.status !== 'Cancelado' &&
    !ticket.sla_paused,
  )

  useEffect(() => {
    if (!isCycleActive || !ticket?.operator_cycle_start) {
      setCycleSeconds(0)
      return
    }
    const startMs = new Date(ticket.operator_cycle_start).getTime()
    const updateCycle = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      setCycleSeconds(diffSec)
    }
    updateCycle()
    const interval = setInterval(updateCycle, 1000)
    return () => clearInterval(interval)
  }, [isCycleActive, ticket?.operator_cycle_start])

  const formatSecondsToClock = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Divisão solicitada: Total de Horas Trabalhadas (mecânica de ciclos + acompanhamentos) e Horas de Acompanhamento
  const accumulatedWorkedSeconds = ticket?.operator_worked_seconds || 0
  const liveWorkedSeconds = accumulatedWorkedSeconds + (isCycleActive ? cycleSeconds : 0)
  const totalWorkedDisplay = formatSecondsToClock(liveWorkedSeconds)

  const accompanimentSeconds = ticket?.accompaniment_seconds || 0
  const accompanimentDisplay = formatSecondsToClock(accompanimentSeconds)

  const totalMinutes = interactions.reduce((sum, i) => sum + (i.duration_minutes || 0), 0)
  const totalHoursDisplay = formatMinutes(totalMinutes)

  const handleStartTimer = () => {
    setTimerStart(new Date())
    setTimerRunning(true)
    setTimerDisplay('00:00')
  }

  const handleStopTimer = () => {
    if (!timerStart) return
    const elapsed = Math.floor((Date.now() - timerStart.getTime()) / 60000)
    const h = String(Math.min(99, Math.floor(elapsed / 60))).padStart(2, '0')
    const m = String(elapsed % 60).padStart(2, '0')
    setTimeSpent(`${h}:${m}`)
    setTimerRunning(false)
    setTimerStart(null)
    setTimerDisplay('00:00')
    setTimeError('')
  }

  // Máscara com dois pontos (:) fixos no formato 00:00
  const handleTimeSpentChange = (rawInput: string) => {
    const formatted = handleTimeSpentMask(rawInput, timeSpent)
    setTimeSpent(formatted)
    setTimeError(validateTimeSpent(formatted))
  }

  const validateTimeSpent = (value: string): string => {
    return validateTimeSpentValue(value, false)
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
        hour_type: 'Contratada',
        billing_status: 'Faturável',
        origin: 'Manual',
        template: selectedCommentTemplate?.id || undefined,
      })
      // Horas lançadas através do log alimentam Horas de Acompanhamento (accompaniment_seconds)
      if (durationMinutes > 0) {
        const currentAcc = ticket.accompaniment_seconds || 0
        const durationSec = durationMinutes * 60
        await updateTicket(id, {
          accompaniment_seconds: currentAcc + durationSec,
        })
      }
      setComment('')
      setTimeSpent('')
      setSelectedCommentTemplate(null)
      setTimerRunning(false)
      setTimerStart(null)
      setTimerDisplay('00:00')
      loadData()
      if (durationMinutes > 0) {
        toast({ title: 'Interação salva e horas somadas em Horas de Acompanhamento' })
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

  const handlePauseSla = async (reason: string, justification: string) => {
    if (!id || !user) return
    try {
      await pauseTicketSla(id, reason, justification)
      loadData()
      toast({ title: `SLA Pausado — Motivo: ${reason}` })
    } catch (err) {
      toast({
        title: 'Erro ao pausar SLA',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleResumeSla = async () => {
    if (!id) return
    try {
      await resumeTicketSla(id)
      loadData()
      toast({ title: 'SLA Retomado com sucesso!' })
    } catch (err) {
      toast({
        title: 'Erro ao retomar SLA',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleResolveClick = async () => {
    // Validação 1: SLA pausado impede a resolução.
    if (ticket?.sla_paused) {
      setResolveBlockMessage(
        'O SLA deste chamado está pausado. Retome o SLA antes de resolver o chamado.',
      )
      return
    }
    // Validação 2: atendimento não iniciado impede a resolução.
    if (!ticket?.sla_response_start && !ticket?.sla_response_at) {
      setResolveBlockMessage(
        'O atendimento deste chamado ainda não foi iniciado. Dê o Play no chamado antes de resolver.',
      )
      return
    }
    // Regra de bloqueio: ticket pai com filhos pendentes não pode ser encerrado.
    const pending = await checkPendingChildren(id!)
    if (pending.length > 0) {
      setPendingChildren(pending)
      setShowPendingAlert(true)
      return
    }
    // Se o ticket possui associações abertas, oferece o fechamento em massa.
    const openAssociated = associatedTickets.filter(
      (t) => !['Resolvido', 'Cancelado', 'Encerrado'].includes(t.status),
    )
    if (openAssociated.length > 0) {
      setShowBatchResolve(true)
      return
    }
    const hasTimeEntries = interactions.some((i) => (i.duration_minutes || 0) > 0)
    const hasComments = interactions.some((i) => i.content && i.content.trim().length > 0)
    if (!hasTimeEntries && !hasComments) {
      setShowNoRecordsConfirm(true)
    } else {
      setShowHourReview(true)
    }
  }

  // Ações de Play e Pausar SLA (Pause) no canto direito minimalista acima de Solicitante
  const handlePlayOperatorCycle = async () => {
    if (!id) return
    setCycleActionLoading(true)
    try {
      const res = await startOperatorWorkCycle(id)
      loadData()
      const respTimeSec = res.sla_response_time_seconds || 0
      const compliance =
        res.sla_response_compliance ||
        (res.response_met ? 'Em conformidade' : 'Fora de conformidade')
      let respMsg = 'Contando cada segundo para Horas Trabalhadas.'
      if (respTimeSec > 0) {
        const rH = Math.floor(respTimeSec / 3600)
        const rM = Math.floor((respTimeSec % 3600) / 60)
        const rS = respTimeSec % 60
        const formattedResp = `${rH > 0 ? `${rH}h ` : ''}${rM > 0 || rH > 0 ? `${rM}min ` : ''}${rS}s`
        respMsg = `Tempo de resposta: ${formattedResp} — SLA Resposta parado: ${compliance}.`
      }
      toast({
        title: `▶ Atendimento iniciado — SLA Resposta ${compliance}!`,
        description: respMsg,
      })
    } catch (err) {
      toast({
        title: 'Erro ao iniciar ciclo de trabalho',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setCycleActionLoading(false)
    }
  }

  const handleStopOperatorCycle = async () => {
    if (!id) return
    setCycleActionLoading(true)
    try {
      await stopOperatorWorkCycle(id)
      loadData()
      toast({
        title: 'Ciclo de atendimento encerrado',
        description: 'Tempo acumulado com sucesso em Horas Trabalhadas.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao pausar ciclo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setCycleActionLoading(false)
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id || !user) return

    setUploadingAttachment(true)
    try {
      await uploadAttachment(id, file, user.id)
      toast({ title: 'Arquivo anexado com sucesso!' })
      e.target.value = ''
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao anexar arquivo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleDeleteAttachment = async (attId: string) => {
    setDeletingAttachmentId(attId)
    try {
      await deleteAttachment(attId)
      toast({ title: 'Anexo removido!' })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao remover anexo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleApplyTriage = async () => {
    if (!id || !ticket?.triage_suggestions) return
    const sugg = ticket.triage_suggestions
    setApplyingTriage(true)
    try {
      const payload: Partial<TicketRecord> = {}
      if (sugg.type) payload.type = sugg.type
      if (sugg.category) payload.category = sugg.category
      if (sugg.service) payload.service = sugg.service

      await updateTicket(id, payload as any)
      toast({
        title: 'Sugestões de Triagem aplicadas com sucesso!',
        description: `Tipo: ${sugg.type || '-'} | Categoria: ${sugg.category_name || sugg.service || '-'}`,
      })
      loadData()
    } catch {
      toast({ title: 'Erro ao aplicar sugestões de triagem', variant: 'destructive' })
    } finally {
      setApplyingTriage(false)
    }
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
      <div className="space-y-4">
        {!propTicketId && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/tickets')}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border-border bg-card text-foreground hover:bg-secondary hover:text-primary transition-colors shadow-2xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-primary" />
              <span>Voltar para a fila</span>
            </Button>
          </div>
        )}
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
      </div>
    )

  return (
    <div className="space-y-4">
      {!propTicketId && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/tickets')}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border-border bg-card text-foreground hover:bg-secondary hover:text-primary transition-colors shadow-2xs"
            title="Voltar para a fila de chamados"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-primary" />
            <span>Voltar para a fila</span>
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="itsm-card p-6 space-y-5 border border-border/80 bg-card shadow-sm">
            {ticket.parent_ticket_id && (
              <Link
                to={`/tickets/${ticket.parent_ticket_id}`}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-all shadow-xs"
                title="Ir para o ticket pai"
              >
                <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
                <span className="shrink-0 font-mono">
                  Ticket Filho de{' '}
                  <strong className="font-bold text-primary">
                    #{ticket.expand?.parent_ticket_id?.number || ticket.parent_ticket_id}
                  </strong>
                </span>
                {ticket.expand?.parent_ticket_id?.title && (
                  <span className="truncate text-muted-foreground">
                    — {ticket.expand.parent_ticket_id.title}
                  </span>
                )}
              </Link>
            )}

            {/* Banner de Sugestões de Triagem da IA */}
            {ticket.triage_suggestions && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-foreground">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="font-semibold text-xs uppercase tracking-wider text-primary font-mono">
                      Sugestões de Triagem Inteligente (IA)
                    </span>
                    {ticket.triage_suggestions.confidence && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/20 text-amber-300 text-[10px] border-amber-500/40 font-mono"
                      >
                        Confiança: {Math.round(ticket.triage_suggestions.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleApplyTriage}
                    disabled={applyingTriage}
                    className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold"
                  >
                    <CheckCheck className="mr-1 h-3.5 w-3.5" />
                    {applyingTriage ? 'Aplicando...' : 'Aplicar Sugestão'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {ticket.triage_suggestions.type && (
                    <div className="bg-card/80 p-2.5 rounded-lg border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                        Tipo Sugerido
                      </span>
                      <span className="font-semibold text-foreground">
                        {ticket.triage_suggestions.type}
                      </span>
                    </div>
                  )}
                  {(ticket.triage_suggestions.category_name ||
                    ticket.triage_suggestions.category) && (
                    <div className="bg-card/80 p-2.5 rounded-lg border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                        Categoria Sugerida
                      </span>
                      <span className="font-semibold text-foreground">
                        {ticket.triage_suggestions.category_name ||
                          ticket.triage_suggestions.category}
                      </span>
                    </div>
                  )}
                  {ticket.triage_suggestions.service && (
                    <div className="bg-card/80 p-2.5 rounded-lg border border-border/70">
                      <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                        Serviço / Atividade
                      </span>
                      <span className="font-semibold text-foreground">
                        {ticket.triage_suggestions.service}
                      </span>
                    </div>
                  )}
                </div>

                {ticket.triage_suggestions.reason && (
                  <p className="text-[11px] text-muted-foreground italic">
                    💡 {ticket.triage_suggestions.reason}
                  </p>
                )}
              </div>
            )}

            {/* Artigos Sugeridos da Base de Conhecimento vinculados por Tokens / Atividade */}
            {suggestedArticles.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-950 dark:text-blue-200">
                    <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-xs uppercase tracking-wider">
                      Procedimentos Recomendados da Base de Conhecimento
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] border-blue-300"
                    >
                      {suggestedArticles.length} relacionado(s)
                    </Badge>
                  </div>
                  <Link
                    to="/knowledge-base"
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Ver Base Completa
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {suggestedArticles.map((art) => (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => {
                        setSelectedKbArticle(art)
                        setKbDetailOpen(true)
                      }}
                      className="text-left p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <h5 className="font-semibold text-xs text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-blue-600">
                          {art.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {art.summary || art.content.slice(0, 100)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 pt-1.5 text-[10px] text-blue-600 font-medium">
                        <span>Abrir procedimento</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground">
                {ticket.number} - {ticket.title}
              </h2>
              <div className="flex items-center gap-2">
                {childTickets.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                    <GitBranch className="h-3 w-3" />
                    {childTickets.length} filho(s)
                  </span>
                )}
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
            </div>

            {ticket.status === 'Aguardando Aprovação' && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/40 dark:border-amber-800 space-y-1">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <Clock className="h-4 w-4" />
                  Chamado Aguardando Aprovação
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Este chamado foi submetido a fluxo de aprovação com base na atividade selecionada.
                  Os aprovadores designados receberam um e-mail para decisão com botões diretos
                  (Aprovar / Reprovar).
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Aberto por{' '}
              <span className="font-semibold text-foreground">{ticket.requester_name}</span> em{' '}
              {new Date(ticket.created).toLocaleString('pt-BR')}
            </p>
            {ticket.email_html || ticket.source === 'E-mail' ? (
              <OriginalEmailCard
                fromName={ticket.requester_name}
                fromEmail={ticket.requester_email}
                date={ticket.created}
                subject={ticket.title}
                htmlContent={ticket.email_html}
                textContent={ticket.description}
                attachments={attachments}
                defaultExpanded={true}
                className="border-slate-200/80 dark:border-slate-800"
              />
            ) : (
              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground border border-border whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </div>
            )}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Operador
              </span>
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  {ticket.expand?.assigned_to?.avatar && (
                    <AvatarImage
                      src={`${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${ticket.expand.assigned_to.id}/${ticket.expand.assigned_to.avatar}`}
                    />
                  )}
                  <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                    {ticket.expand?.assigned_to?.name?.substring(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">
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
                  className="text-primary hover:underline font-medium"
                >
                  {ticket.expand.equipment.name} (
                  {ticket.expand.equipment.hostname || 'sem hostname'})
                </Link>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              {canEditTicket &&
                (ticket.sla_paused ? (
                  <Button size="sm" variant="outline" onClick={handleResumeSla}>
                    <PlayCircle className="mr-1.5 h-4 w-4 text-green-600" /> Retomar SLA
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSlaPause(true)}
                    disabled={
                      ticket.status === 'Resolvido' ||
                      ticket.status === 'Encerrado' ||
                      ticket.status === 'Cancelado'
                    }
                  >
                    <PauseCircle className="mr-1.5 h-4 w-4 text-amber-600" /> Pausar SLA
                  </Button>
                ))}
              {canEditTicket && ticket.status !== 'Resolvido' && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleResolveClick}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Resolver
                </Button>
              )}
              {canEditTicket && (
                <Button size="sm" variant="outline" onClick={() => setShowDelegate(true)}>
                  <Forward className="mr-1.5 h-4 w-4" /> Delegar
                </Button>
              )}
              {canEditTicket &&
                ticket.status !== 'Resolvido' &&
                ticket.status !== 'Encerrado' &&
                ticket.status !== 'Cancelado' &&
                !ticket.parent_ticket_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowChildTicket(true)}
                    title="Abrir um ticket filho vinculado a este chamado"
                  >
                    <GitBranch className="mr-1.5 h-4 w-4 text-blue-600" /> Abrir Ticket Filho
                  </Button>
                )}
              {canEditTicket &&
                ticket.status !== 'Resolvido' &&
                ticket.status !== 'Encerrado' &&
                ticket.status !== 'Cancelado' &&
                !ticket.parent_ticket_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAssociate(true)}
                    title="Associar este chamado a outros chamados abertos"
                  >
                    <Link2 className="mr-1.5 h-4 w-4 text-blue-600" /> Associar Chamados
                  </Button>
                )}
              {canEditTicket && (perms.isAdmin || perms.isGestor || perms.isClienteGestor) && (
                <Button size="sm" variant="outline" onClick={() => setShowVisit(true)}>
                  <MapPin className="mr-1.5 h-4 w-4" /> Agendar Visita
                </Button>
              )}
            </div>
          </div>
          <Tabs defaultValue="interactions" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none p-0 bg-transparent">
              <TabsTrigger value="interactions">Interações ({interactions.length})</TabsTrigger>
              <TabsTrigger value="attachments">Anexos ({attachments.length})</TabsTrigger>
              <TabsTrigger value="visits">Visitas ({visits.length})</TabsTrigger>
              <TabsTrigger value="sla-audit">Auditoria de SLA ({slaPauses.length})</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="interactions" className="pt-4 space-y-4">
              {canEditTicket && perms.canAccessItem('tickets', 'tickets_ai_reply') && (
                <TicketAiReplyPanel
                  ticketId={ticket.id}
                  ticketNumber={ticket.number}
                  requesterName={ticket.requester_name}
                  canEdit={canEditTicket}
                  onApplyDraft={(draftText) => {
                    setComment(draftText)
                  }}
                />
              )}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-2">
                <span className="text-sm font-semibold text-foreground">Total de Horas</span>
                <span className="text-sm font-bold tabular-nums text-primary">
                  Total: {totalHoursDisplay}
                </span>
              </div>
              <div className="space-y-3">
                {interactions.map((i) => (
                  <div
                    key={i.id}
                    className="rounded-lg border border-border p-4 text-xs space-y-1 bg-card"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {i.content?.includes('[Resposta Automática por IA]')
                            ? 'Agente de IA'
                            : i.expand?.author?.name || 'Usuário'}
                        </span>
                        {i.content?.includes('[Resposta Automática por IA]') ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-500/10 text-primary border-amber-500/30"
                          >
                            🤖 Resposta IA
                          </Badge>
                        ) : i.origin === 'Automático' ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
                          >
                            E-mail
                          </Badge>
                        ) : null}
                        {i.origin === 'Cronômetro' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                          >
                            Cronômetro
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {i.type === 'Interno' && (
                          <Badge variant="outline" className="text-[10px]">
                            Interno
                          </Badge>
                        )}
                        <span className="text-slate-400">
                          {new Date(i.created).toLocaleString('pt-BR')}
                        </span>{' '}
                        {(perms.isTecnico || perms.isAdmin || perms.isGestor) && (
                          <>
                            {canEditTicket && i.origin !== 'Cronômetro' && (
                              <button
                                onClick={() => handleEditInteraction(i)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Editar interação"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canDeleteTicket && (
                              <button
                                onClick={() => setDeleteTarget(i)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Excluir interação"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {i.email_html ? (
                      <div className="pt-1.5 pb-0.5">
                        <div
                          className="email-html-body prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed font-sans bg-muted/30 border border-border/60 rounded-md p-3 overflow-x-auto max-h-[400px] overflow-y-auto"
                          style={{
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }}
                          dangerouslySetInnerHTML={{
                            __html: sanitizeEmailHtml(
                              i.email_html,
                              attachments.filter((a) => a.interaction === i.id || !a.interaction),
                            ),
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {i.content}
                      </p>
                    )}
                    {i.duration_minutes > 0 && (
                      <div className="flex items-center gap-2 pt-1 text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatMinutes(i.duration_minutes)}</span>
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
              {canEditTicket && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <Textarea
                    placeholder="Escreva uma resposta ou nota interna..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <div className="space-y-1 max-w-sm">
                    <Label className="text-xs text-muted-foreground">Tempo Gasto (00:00)</Label>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex items-center">
                        <Input
                          placeholder="00:00"
                          value={timeSpent}
                          onChange={(e) => handleTimeSpentChange(e.target.value)}
                          onKeyDown={(e) =>
                            handleTimeSpentKeyDown(
                              e,
                              timeSpent,
                              setTimeSpent,
                              setTimeError,
                              validateTimeSpent,
                            )
                          }
                          maxLength={5}
                          className="h-8 w-28 text-center font-mono text-sm tracking-wider"
                        />
                      </div>
                      {timerRunning && (
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
                      )}
                    </div>
                    {timeError ? (
                      <p className="text-xs text-red-500">{timeError}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Digite os dígitos das horas e minutos — os dois pontos ficam fixos (00:00).
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    {commentTemplates.length > 0 ? (
                      <Select
                        onValueChange={(val) => {
                          const tmpl = commentTemplates.find((t) => t.id === val)
                          if (tmpl) {
                            setSelectedCommentTemplate(tmpl)
                            setComment(tmpl.content)
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-auto">
                          <SelectValue placeholder="Usar modelo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {commentTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Nenhum modelo disponível. Crie um em Configurações de Modelos.
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
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
              )}
            </TabsContent>
            <TabsContent value="attachments" className="pt-4 space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Arquivos e Documentos</h4>
                  <p className="text-xs text-muted-foreground">
                    Anexos vinculados ao chamado ou recebidos via e-mail.
                  </p>
                </div>
                {canEditTicket && (
                  <div>
                    <input
                      type="file"
                      id="ticket-file-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingAttachment}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploadingAttachment}
                      onClick={() => document.getElementById('ticket-file-upload')?.click()}
                      className="text-xs"
                    >
                      {uploadingAttachment ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                      )}
                      {uploadingAttachment ? 'Enviando...' : 'Anexar arquivo'}
                    </Button>
                  </div>
                )}
              </div>

              {attachments.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg text-slate-500 text-xs">
                  <Paperclip className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  Nenhum arquivo anexado a este chamado ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {attachments.map((att) => {
                    const fileUrl = getAttachmentFileUrl(att)
                    const isImage =
                      (att.file_type || '').startsWith('image/') ||
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_name || att.file)
                    return (
                      <div
                        key={att.id}
                        className="rounded-lg border border-border bg-card p-3 flex flex-col justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border">
                            {isImage && fileUrl ? (
                              <img
                                src={fileUrl}
                                alt={att.file_name || 'Anexo'}
                                className="h-10 w-10 object-cover rounded-lg"
                              />
                            ) : (
                              <FileIcon className="h-5 w-5 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-semibold text-foreground truncate"
                              title={att.file_name || att.file}
                            >
                              {att.file_name || att.file}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span>{formatFileSize(att.file_size)}</span>
                              <span>•</span>
                              <span>{new Date(att.created).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {att.expand?.uploaded_by && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                Por: {att.expand.uploaded_by.name || att.expand.uploaded_by.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-2 mt-1">
                          {fileUrl ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                            >
                              <Download className="h-3.5 w-3.5" /> Baixar / Visualizar
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Arquivo indisponível</span>
                          )}

                          {canDeleteTicket &&
                            (perms.isAdmin ||
                              perms.isGestor ||
                              perms.isTecnico ||
                              att.uploaded_by === user?.id) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att.id)}
                                disabled={deletingAttachmentId === att.id}
                                className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                title="Remover anexo"
                              >
                                {deletingAttachmentId === att.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
                    className="rounded-lg border border-border p-4 text-xs space-y-1 bg-card"
                  >
                    <div className="flex justify-between items-center">
                      <Badge variant="outline">{v.status}</Badge>
                      <span className="text-slate-400">
                        {' '}
                        {v.scheduled_date
                          ? new Date(v.scheduled_date).toLocaleDateString('pt-BR')
                          : ''}{' '}
                        {v.scheduled_time || ''}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      <MapPin className="inline h-3 w-3" /> {v.client_address || '-'}
                    </p>
                    <p className="text-muted-foreground">
                      Operador: {v.expand?.technician?.name || '-'}
                    </p>
                    {v.materials && (
                      <p className="text-muted-foreground">Materiais: {v.materials}</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="sla-audit" className="pt-4 space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" /> Linha do Tempo e Auditoria de SLA
                  </h4>
                  {ticket.sla_paused && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                    >
                      SLA Atualmente Pausado
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registro detalhado de início de atendimento, pausas com justificativa, retomadas e
                  conclusão de metas.
                </p>
              </div>

              {/* Resumo de Marcos de SLA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Abertura do Chamado
                  </span>
                  <span className="font-semibold text-foreground">
                    {new Date(ticket.created).toLocaleString('pt-BR')}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    SLA Resposta e Solução iniciados
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground block font-medium">
                      SLA Resposta
                    </span>
                    {ticket.sla_response_compliance && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          ticket.sla_response_compliance === 'Em conformidade'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {ticket.sla_response_compliance}
                      </Badge>
                    )}
                  </div>
                  {ticket.sla_response_start || ticket.sla_response_at ? (
                    <>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
                        {new Date(
                          ticket.sla_response_start || ticket.sla_response_at!,
                        ).toLocaleString('pt-BR')}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {ticket.sla_response_compliance
                          ? `Parado via Play — ${ticket.sla_response_compliance}`
                          : 'Atendimento iniciado pelo operador'}
                      </p>
                    </>
                  ) : (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      Aguardando Início (Play)
                    </span>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Tempo Total em Pausa
                  </span>
                  <span className="font-semibold text-foreground">
                    {ticket.sla_pause_total_minutes
                      ? `${ticket.sla_pause_total_minutes} min`
                      : '0 min'}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Prorrogado no prazo de solução
                  </p>
                </div>
              </div>

              {/* Lista de Pausas e Retomadas */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                  Pausas Registradas ({slaPauses.length})
                </h5>
                {slaPauses.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-lg text-slate-500 text-xs">
                    Nenhuma pausa de SLA foi registrada neste chamado.
                  </div>
                ) : (
                  slaPauses.map((pause, idx) => (
                    <div
                      key={pause.id || idx}
                      className="rounded-lg border border-border p-3.5 text-xs space-y-2 bg-card"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-semibold"
                          >
                            Pausa: {pause.reason}
                          </Badge>
                          {pause.resumed_at ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              Retomado ({pause.duration_minutes || 0} min)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-100 text-amber-800 animate-pulse border-amber-400"
                            >
                              Em Pausa
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Início:{' '}
                          {new Date(pause.paused_at || pause.created).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="rounded bg-muted/50 p-2 text-foreground text-xs">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          Justificativa:{' '}
                        </span>
                        {pause.justification}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 border-t">
                        <span>
                          Pausado por:{' '}
                          {pause.expand?.paused_by?.name ||
                            pause.expand?.paused_by?.email ||
                            'Operador'}
                        </span>
                        {pause.resumed_at && (
                          <span>
                            Retomado em: {new Date(pause.resumed_at).toLocaleString('pt-BR')}
                            {pause.expand?.resumed_by?.name
                              ? ` (por ${pause.expand.resumed_by.name})`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-sm text-slate-500 p-4">
                  Nenhum histórico registrado.
                </p>
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
                      className="rounded-lg border border-border p-4 text-xs space-y-1 bg-card"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {' '}
                          <History className="h-3.5 w-3.5 text-slate-400" />
                          {h.action}
                        </span>
                        <span className="text-slate-400">
                          {new Date(h.created).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {isDelegation ? (
                        <p className="text-muted-foreground">
                          De &ldquo;{h.old_value || 'Ninguém'}&rdquo; para &ldquo;{cleanNew}&rdquo;
                          {reason && (
                            <span className="text-slate-500 italic"> (Motivo: {reason})</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          {h.field && <span className="font-medium">{h.field}: </span>}
                          {h.old_value || '—'} → {h.new_value || '—'}
                        </p>
                      )}
                      {h.expand?.user && (
                        <p className="text-muted-foreground">Por: {h.expand.user.name}</p>
                      )}
                    </div>
                  )
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-4">
          {/* Painel Minimalista de Ciclo de Atendimento / Horas Trabalhadas acima do Solicitante */}
          <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Ciclo de Trabalho
                </span>
                {isCycleActive ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Em Curso
                  </span>
                ) : ticket.sla_paused ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    SLA Pausado
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                    Inativo
                  </span>
                )}
              </div>

              {/* Botões Play (Verde) e Pause (Amarelo) minimalistas no canto direito */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Botão Play (Verde) - Iniciar atendimento / ciclo de trabalho */}
                <button
                  type="button"
                  onClick={handlePlayOperatorCycle}
                  disabled={
                    cycleActionLoading ||
                    isCycleActive ||
                    ticket.status === 'Resolvido' ||
                    ticket.status === 'Encerrado' ||
                    ticket.status === 'Cancelado'
                  }
                  title={
                    isCycleActive ? 'Ciclo de atendimento em andamento' : 'Play atendimento (▶)'
                  }
                  className={`h-7 px-2.5 rounded-md inline-flex items-center gap-1 text-xs font-semibold transition-all shadow-xs ${
                    isCycleActive
                      ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 cursor-default'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {cycleActionLoading && !isCycleActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                  <span className="hidden sm:inline">Play</span>
                </button>

                {/* Botão Pause (Amarelo) - Pausar SLA (aparece ao lado do play) */}
                <button
                  type="button"
                  onClick={() => {
                    if (ticket.sla_paused) {
                      handleResumeSla()
                    } else {
                      setShowSlaPause(true)
                    }
                  }}
                  disabled={
                    cycleActionLoading ||
                    ticket.status === 'Resolvido' ||
                    ticket.status === 'Encerrado' ||
                    ticket.status === 'Cancelado'
                  }
                  title={ticket.sla_paused ? 'SLA Pausado — clique para retomar' : 'Pausar SLA (⏸)'}
                  className={`h-7 px-2.5 rounded-md inline-flex items-center gap-1 text-xs font-semibold transition-all shadow-xs ${
                    ticket.sla_paused
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                      : 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span className="hidden sm:inline">
                    {ticket.sla_paused ? 'Pausado' : 'Pause'}
                  </span>
                </button>
              </div>
            </div>

            {/* Cronômetro em tempo real do ciclo de trabalho (HH:MM:SS) persistido no banco */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border/60 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Tempo do Ciclo:
              </span>
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  isCycleActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}
              >
                {formatSecondsToClock(cycleSeconds)}
              </span>
            </div>
          </div>

          <RequesterInfo ticket={ticket} onUpdated={loadData} />

          {/* Card de Horas Dividido: Total de Horas Trabalhadas e Horas de Acompanhamento */}
          <div className="itsm-card p-4 space-y-3.5 border border-border/80 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Apuração de Horas
              </h3>
              {(perms.isTecnico || perms.isAdmin || perms.isGestor) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAccompaniment(true)}
                  className="h-7 text-xs px-2.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  title="Registrar horas gastas em acompanhamento técnico"
                >
                  + Acompanhamento
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Total de Horas Trabalhadas */}
              <div className="p-3 rounded-lg border border-border/80 bg-muted/40 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block leading-tight">
                  Total de Horas Trabalhadas
                </span>
                <div className="text-base font-bold font-mono text-foreground tabular-nums flex items-baseline gap-1">
                  <span>{totalWorkedDisplay}</span>
                  {isCycleActive && (
                    <span className="text-[10px] text-emerald-600 font-sans font-normal animate-pulse">
                      (ativo)
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Play / pause de atendimento
                </p>
              </div>

              {/* Horas de Acompanhamento */}
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 block leading-tight">
                  Horas de Acompanhamento
                </span>
                <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                  {accompanimentDisplay}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">Logs registrados</p>
              </div>
            </div>
          </div>

          <div className="itsm-card p-4 space-y-4">
            <h3 className="font-semibold text-sm text-foreground border-b border-border pb-2">
              Controle de SLA
            </h3>
            {categoryData && (
              <div className="flex items-center justify-between text-xs pb-2 border-b">
                <span className="text-muted-foreground">
                  Categoria:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {categoryData.name}
                  </span>
                </span>
                <div className="flex gap-3">
                  <span className="text-muted-foreground">
                    Resp:{' '}
                    {categoryData.sla_response_minutes
                      ? `${categoryData.sla_response_minutes}min`
                      : 'Não definido'}
                  </span>
                  <span className="text-muted-foreground">
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
                categoryData && !categoryData.sla_response_minutes && !ticket.sla_response_deadline
                  ? 'Não definido'
                  : computeSlaResponseStatus(ticket)
              }
              deadline={ticket.sla_response_deadline}
              completedAt={ticket.sla_response_at}
              startedAt={ticket.sla_response_start}
              createdAt={ticket.created}
              totalPauseMinutes={0}
              responseTimeSeconds={ticket.sla_response_time_seconds}
              compliance={ticket.sla_response_compliance}
            />
            <SlaDetailBlock
              type="solution"
              status={
                categoryData && !categoryData.sla_solution_minutes && !ticket.sla_solution_deadline
                  ? 'Não definido'
                  : computeSlaSolutionStatus(ticket)
              }
              deadline={ticket.sla_solution_deadline}
              completedAt={ticket.sla_solution_at}
              createdAt={ticket.created}
              totalPauseMinutes={ticket.sla_pause_total_minutes || 0}
            />
            <div className="pt-2 border-t space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Cliente:{' '}
                {ticket.expand?.company?.trade_name || 'N/A'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 text-muted-foreground" /> Operador:{' '}
                {ticket.expand?.assigned_to?.name || 'Não atribuído'}
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Horas Trabalhadas:
                </span>
                <span className="font-mono font-medium text-foreground">{totalWorkedDisplay}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-500" /> Acompanhamento:
                </span>
                <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                  {accompanimentDisplay}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Interações (Lançamentos):
                </span>
                <span className="font-mono text-muted-foreground">{totalHoursDisplay}</span>
              </div>
              {ticket.sla_response_time_seconds !== undefined &&
                ticket.sla_response_time_seconds > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4 text-emerald-500" /> Tempo de Resposta:
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {formatSecondsToClock(ticket.sla_response_time_seconds)}
                    </span>
                  </div>
                )}
              {(ticket.sla_response_start || ticket.sla_response_at) && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-muted-foreground" /> Início Atend.:
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(ticket.sla_response_start || ticket.sla_response_at!).toLocaleString(
                      'pt-BR',
                    )}
                  </span>
                </div>
              )}
              {ticket.sla_response_compliance && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Conformidade SLA
                    Resp.:
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${
                      ticket.sla_response_compliance === 'Em conformidade'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {ticket.sla_response_compliance}
                  </Badge>
                </div>
              )}
              {ticket.equipment && ticket.expand?.equipment && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Server className="h-4 w-4 text-muted-foreground" /> Ativo:{' '}
                  <Link
                    to={`/cmdb/assets/${ticket.equipment}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {ticket.expand.equipment.name}
                  </Link>
                </div>
              )}
              {ticket.configuration_item && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Boxes className="h-4 w-4 text-muted-foreground" /> Item de Configuração:{' '}
                  <Link
                    to={`/cmdb/configuration-items/${ticket.configuration_item}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {ticket.expand?.configuration_item?.name || 'Ver Item'}
                  </Link>
                  {ticket.expand?.configuration_item?.type && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {ticket.expand.configuration_item.type}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <TicketTagsSection
            ticketId={ticket.id}
            currentTagsString={ticket.tags || ''}
            canEdit={canEditTicket}
            canUseAiTags={perms.canAccessItem('tickets', 'tickets_ai_tags')}
            onUpdateTags={async (newTagsString) => {
              await updateTicket(ticket.id, { tags: newTagsString })
              loadData()
            }}
          />

          <div className="itsm-card p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground border-b border-border pb-2">
              Fila de Atendimento
            </h3>
            {ticket.queue && ticket.expand?.queue ? (
              <div className="flex items-center gap-2 text-xs">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{ticket.expand.queue.name}</span>
                {ticket.expand.queue.level ? (
                  <Badge className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300">
                    {ticket.expand.queue.level}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-slate-400">
                    Sem nível
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma fila vinculada.</p>
            )}
          </div>
          <div className="itsm-card p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground border-b border-border pb-2">
              Contrato Vinculado
            </h3>
            {ticket.contract && ticket.expand?.contract ? (
              <Link
                to={`/contracts/${ticket.contract}`}
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                {ticket.expand.contract.number}
                {ticket.expand.contract.expand?.company?.trade_name
                  ? ` — ${ticket.expand.contract.expand.company.trade_name}`
                  : ''}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum contrato vinculado.</p>
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
          {associatedTickets.length > 0 && (
            <div className="itsm-card p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <Link2 className="h-4 w-4 text-blue-600" />
                Chamados Associados ({associatedTickets.length})
              </h3>
              <div className="space-y-2">
                {associatedTickets.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs"
                  >
                    <Link
                      to={`/tickets/${c.id}`}
                      className="font-medium text-primary hover:underline truncate"
                    >
                      {c.number} — {c.title}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={c.priority} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {childTickets.length > 0 && (
            <div className="itsm-card p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground border-b border-border pb-2 flex items-center gap-1.5">
                <GitBranch className="h-4 w-4 text-blue-600" />
                Tickets Filhos ({childTickets.length})
              </h3>
              <div className="space-y-2">
                {childTickets.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs"
                  >
                    <Link
                      to={`/tickets/${c.id}`}
                      className="font-medium text-primary hover:underline truncate"
                    >
                      {c.number} — {c.title}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={c.priority} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
                Tem certeza que deseja excluir esta interação? As horas serão estornadas do
                contrato.
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
        <HourReviewDialog
          interactions={interactions}
          open={showHourReview}
          onOpenChange={setShowHourReview}
          onProceed={() => setShowResolve(true)}
          timerRunning={timerRunning}
          timerDisplay={timerDisplay}
          pendingTimeSpent={timeSpent}
        />
        <ResolveTicketDialog
          ticketId={id!}
          open={showResolve}
          onOpenChange={setShowResolve}
          onResolved={loadData}
        />
        <AlertDialog open={showNoRecordsConfirm} onOpenChange={setShowNoRecordsConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nenhum registro encontrado</AlertDialogTitle>
              <AlertDialogDescription>
                Este chamado não possui horas lançadas ou comentários. Deseja realmente encerrá-lo
                mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setShowNoRecordsConfirm(false)
                  setShowHourReview(true)
                }}
              >
                Sim, encerrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <SlaPauseDialog
          open={showSlaPause}
          onOpenChange={setShowSlaPause}
          onConfirm={handlePauseSla}
        />
        <ChildTicketDialog
          parent={ticket}
          open={showChildTicket}
          onOpenChange={setShowChildTicket}
          onCreated={loadData}
        />
        <PendingChildrenAlert
          pending={pendingChildren}
          open={showPendingAlert}
          onOpenChange={setShowPendingAlert}
        />
        <AssociateTicketsDialog
          ticket={ticket}
          open={showAssociate}
          onOpenChange={setShowAssociate}
          onAssociated={loadData}
        />
        <BatchResolveConfirmDialog
          ticket={ticket}
          associatedTickets={associatedTickets}
          open={showBatchResolve}
          onOpenChange={setShowBatchResolve}
          onResolved={loadData}
          onResolveOnlyCurrent={() => {
            const hasTimeEntries = interactions.some((i) => (i.duration_minutes || 0) > 0)
            const hasComments = interactions.some((i) => i.content && i.content.trim().length > 0)
            if (!hasTimeEntries && !hasComments) {
              setShowNoRecordsConfirm(true)
            } else {
              setShowHourReview(true)
            }
          }}
        />
        <AlertDialog
          open={!!resolveBlockMessage}
          onOpenChange={(open) => !open && setResolveBlockMessage(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Não é possível resolver o chamado</AlertDialogTitle>
              <AlertDialogDescription>{resolveBlockMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setResolveBlockMessage(null)}>
                Entendi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal para visualizar artigo sugerido diretamente no chamado */}
        <ArticleDetailDialog
          article={selectedKbArticle}
          open={kbDetailOpen}
          onOpenChange={setKbDetailOpen}
        />

        {/* Visão no canto inferior direito: Todos aqueles que entraram no chamado */}
        <TicketParticipantsViewer
          participants={participants}
          loading={loadingParticipants}
          ticketNumber={ticket.number}
        />

        {/* Modal de Registro de Horas de Acompanhamento */}
        <AccompanimentDialog
          ticketId={ticket.id}
          open={showAccompaniment}
          onOpenChange={setShowAccompaniment}
          onSaved={loadData}
        />
      </div>
    </div>
  )
}
