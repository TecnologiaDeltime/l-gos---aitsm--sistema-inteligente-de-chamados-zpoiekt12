import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Ticket,
  Clock,
  CheckCircle2,
  CircleDot,
  LogOut,
  Search,
  RefreshCw,
  Star,
  Loader2,
  UserRound,
  MessageSquare,
  AlertCircle,
  Plus,
  Eye,
} from 'lucide-react'
import {
  useCollaboratorAuth,
  useCollaboratorTickets,
  collaboratorApi,
  type CollaboratorTicket,
} from '@/services/collaborator-portal'
import { clearImpersonation } from '@/services/collaborator-impersonation'
import type { EquipmentRecord } from '@/services/equipments'
import pb from '@/lib/pocketbase/client'
import { LogosLogoPanel } from '@/components/brand/LogosLogo'

const CLOSED_STATUSES = ['Resolvido', 'Encerrado', 'Cancelado']

function formatDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return d
  }
}

function statusBadgeClass(status: string) {
  if (CLOSED_STATUSES.includes(status)) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  }
  if (status === 'Cancelado') {
    return 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
  }
  return 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
}

function priorityBadgeClass(priority?: string) {
  switch (priority) {
    case 'Crítica':
      return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    case 'Alta':
      return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
    case 'Baixa':
      return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    default:
      return 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
  }
}

interface TicketDetail {
  ticket: {
    id: string
    number: string
    title: string
    description: string
    status: string
    priority?: string
    created: string
  }
  interactions: Array<{
    id: string
    content: string
    type: string
    origin?: string
    author_name: string
    created: string
  }>
  survey: { rating: number; comment: string; responded_at?: string } | null
}

function readToken(): string | null {
  try {
    return localStorage.getItem('logos_collaborator_session')
  } catch {
    return null
  }
}

export default function CollaboratorDashboard() {
  const navigate = useNavigate()
  const {
    collaborator,
    surveyRequired,
    pendingSurvey,
    loading: authLoading,
    logout,
    refresh,
    impersonation,
  } = useCollaboratorAuth()
  const token = impersonation ? impersonation.token : readToken()
  const { tickets, loading: ticketsLoading, reload } = useCollaboratorTickets(token)

  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [surveyTicket, setSurveyTicket] = useState<{ id: string; number: string } | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [surveySending, setSurveySending] = useState(false)
  const [surveyError, setSurveyError] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSending, setNewSending] = useState(false)
  const [newError, setNewError] = useState<string | null>(null)
  const [newEquipment, setNewEquipment] = useState('')
  const [newEquipments, setNewEquipments] = useState<EquipmentRecord[]>([])
  const [newEquipLoading, setNewEquipLoading] = useState(false)
  const wasNewOpenRef = useRef(false)

  // Ativos da empresa do colaborador — carregados na transição
  // fechado->aberto do diálogo (padrão wasOpenRef: nunca depender do objeto
  // user recriado a cada render). Pré-seleciona celular/impressora/scanner
  // quando houver, mesmo comportamento das telas de operador e ponto focal.
  useEffect(() => {
    if (newOpen && !wasNewOpenRef.current && collaborator) {
      setNewEquipment('')
      setNewEquipLoading(true)
      pb.collection('equipments')
        .getFullList<EquipmentRecord>({
          filter: `company = "${collaborator.company}"`,
          sort: 'name',
        })
        .then((list) => {
          setNewEquipments(list)
          const pref = list.find((eq) => {
            const dt = `${eq.device_type || ''} ${eq.type || ''} ${eq.name || ''}`.toLowerCase()
            return (
              dt.includes('celular') ||
              dt.includes('smartphone') ||
              dt.includes('impressora') ||
              dt.includes('printer') ||
              dt.includes('scanner')
            )
          })
          if (pref) setNewEquipment(pref.id)
        })
        .catch(() => setNewEquipments([]))
        .finally(() => setNewEquipLoading(false))
    }
    wasNewOpenRef.current = newOpen
  }, [newOpen, collaborator])

  const stats = useMemo(() => {
    const open = tickets.filter((t) => !CLOSED_STATUSES.includes(t.status)).length
    const resolved = tickets.filter((t) => ['Resolvido', 'Encerrado'].includes(t.status)).length
    return { open, resolved, total: tickets.length }
  }, [tickets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tickets
    return tickets.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.number || '').toLowerCase().includes(q),
    )
  }, [tickets, search])

  const openDetail = async (t: CollaboratorTicket) => {
    setDetailError(null)
    setDetailLoading(true)
    try {
      const data = await collaboratorApi<TicketDetail>(
        `/tickets/${t.id}?token=${encodeURIComponent(token || '')}`,
      )
      setDetail(data)
      if (['Resolvido', 'Encerrado'].includes(data.ticket.status) && !data.survey) {
        setSurveyTicket({ id: t.id, number: data.ticket.number })
        setRating(0)
        setComment('')
        setSurveyOpen(true)
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Erro ao carregar chamado.')
    } finally {
      setDetailLoading(false)
    }
  }

  const submitSurvey = async () => {
    if (!surveyTicket || rating < 1) {
      setSurveyError('Escolha uma nota de 1 a 5.')
      return
    }
    setSurveySending(true)
    setSurveyError(null)
    try {
      await collaboratorApi('/surveys', {
        method: 'POST',
        body: { token, ticket_id: surveyTicket.id, rating, comment },
      })
      setSurveyOpen(false)
      setSurveyTicket(null)
      setRating(0)
      setComment('')
      await refresh()
      await reload()
    } catch (err) {
      setSurveyError(err instanceof Error ? err.message : 'Erro ao enviar pesquisa.')
    } finally {
      setSurveySending(false)
    }
  }

  const submitNewTicket = async () => {
    setNewError(null)
    if (!newTitle.trim() || !newDescription.trim()) {
      setNewError('Informe título e descrição.')
      return
    }
    setNewSending(true)
    try {
      await collaboratorApi('/tickets', {
        method: 'POST',
        body: {
          token,
          title: newTitle.trim(),
          description: newDescription.trim(),
          equipment: newEquipment || undefined,
        },
      })
      setNewOpen(false)
      setNewTitle('')
      setNewDescription('')
      setNewEquipment('')
      await reload()
      await refresh()
    } catch (err) {
      setNewError(err instanceof Error ? err.message : 'Erro ao abrir chamado.')
    } finally {
      setNewSending(false)
    }
  }

  const handleLogout = () => {
    if (impersonation) {
      // Encerra APENAS a sessão de suporte (token de impersonação em
      // sessionStorage). A sessão real do colaborador (session_token) fica
      // intacta — "Encerrar suporte" nunca derruba o colaborador.
      const companyId = impersonation.companyId
      try {
        collaboratorApi('/logout', { method: 'POST', body: { token: impersonation.token } })
      } catch {
        /* ignore */
      }
      clearImpersonation()
      navigate(`/clients/${companyId}/edit`, { replace: true })
      return
    }
    logout()
    navigate('/portal/colaborador', { replace: true })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    )
  }

  if (!collaborator) {
    navigate('/portal/colaborador', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Barra grafite oficial */}
      <div className="bg-[#17181C] text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <LogosLogoPanel className="max-h-8" />
            <div className="hidden sm:block h-6 w-px bg-slate-600" />
            <div className="min-w-0">
              <p className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
                Portal do Colaborador
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {collaborator.name} · {collaborator.company_name || collaborator.company}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white gap-1.5"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Abrir Chamado
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white gap-1.5"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Banner de modo suporte (impersonação do admin) — sessão própria, não
          toca no session_token do colaborador */}
      {impersonation && (
        <div className="bg-amber-400 text-[#17181C]">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold flex items-center gap-1.5 truncate">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <Badge className="bg-[#17181C] text-amber-300 hover:bg-[#17181C] text-[10px] font-mono uppercase tracking-wider h-5 px-1.5">
                Modo suporte
              </Badge>
              Visualizando como {impersonation.collaboratorName} — o que você vê é o que ele vê.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-[#17181C]/40 text-[#17181C] hover:bg-[#17181C]/10 shrink-0"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" /> Encerrar suporte
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Pesquisa pendente */}
        {pendingSurvey && (
          <Alert className="border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
              Há uma pesquisa de satisfação pendente no chamado{' '}
              <strong>#{pendingSurvey.ticket_number}</strong>
              {surveyRequired
                ? ' — responda a ela antes de abrir um novo chamado.'
                : ' — sua opinião é importante!'}
              <Button
                size="sm"
                variant="outline"
                className="ml-2 h-6 text-[11px] border-amber-500/50 text-amber-700 dark:text-amber-300"
                onClick={() => {
                  const t = tickets.find((x) => x.id === pendingSurvey.ticket_id)
                  if (t) openDetail(t)
                }}
              >
                Responder agora
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Cards de resumo — somente os chamados do próprio colaborador */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5 text-sky-500" /> Em aberto
              </CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.open}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-[11px] text-slate-400">Chamados aguardando atendimento</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Resolvidos
              </CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.resolved}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-[11px] text-slate-400">Chamados concluídos pela equipe</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 text-slate-500" /> Total
              </CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.total}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-[11px] text-slate-400">Todos os chamados que você abriu</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de chamados */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Meus Chamados
                </CardTitle>
                <CardDescription className="text-xs">
                  Somente os chamados abertos por você
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar chamado..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-7 text-sm w-44 sm:w-56"
                  />
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={reload}
                  title="Atualizar"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ticketsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Nenhum chamado encontrado. Clique em "Abrir Chamado" para registrar um atendimento.
              </p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openDetail(t)}
                  className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        <span className="font-mono text-xs text-slate-500 mr-1.5">#{t.number}</span>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> {formatDate(t.created)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${priorityBadgeClass(t.priority)}`}
                      >
                        {t.priority || '—'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${statusBadgeClass(t.status)}`}
                      >
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhe do chamado */}
      <Dialog open={detailLoading || !!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          )}
          {!detailLoading && detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="font-mono text-sm text-slate-500">#{detail.ticket.number}</span>
                  {detail.ticket.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${statusBadgeClass(detail.ticket.status)}`}
                  >
                    {detail.ticket.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${priorityBadgeClass(detail.ticket.priority)}`}
                  >
                    {detail.ticket.priority || '—'}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    Aberto em {formatDate(detail.ticket.created)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Descrição
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {detail.ticket.description || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Atendimentos da equipe
                  </p>
                  {detail.interactions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">
                      Nenhum atendimento registrado ainda.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {detail.interactions.map((i) => (
                        <div
                          key={i.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <UserRound className="h-3 w-3 text-slate-400" />
                              {i.author_name || 'Equipe de Suporte'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(i.created)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                            {i.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detail.survey && (
                  <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Pesquisa respondida: nota {detail.survey.rating}/5
                    {detail.survey.comment ? ` — "${detail.survey.comment}"` : ''}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pesquisa de satisfação */}
      <Dialog open={surveyOpen} onOpenChange={setSurveyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Pesquisa de Satisfação</DialogTitle>
            <DialogDescription className="text-xs">
              Como foi o atendimento do chamado #{surveyTicket?.number}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="focus:outline-none"
                  title={`${n} estrela${n > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      n <= rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comentário (opcional)</Label>
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte como foi sua experiência..."
                className="text-sm"
              />
            </div>
            {surveyError && <p className="text-xs text-rose-500">{surveyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSurveyOpen(false)} disabled={surveySending}>
              Mais tarde
            </Button>
            <Button
              onClick={submitSurvey}
              disabled={surveySending || rating < 1}
              className="bg-slate-700 hover:bg-slate-800 text-white"
            >
              {surveySending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Enviando...
                </>
              ) : (
                'Enviar avaliação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo chamado */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Abrir Novo Chamado</DialogTitle>
            <DialogDescription className="text-xs">
              Descreva o problema ou solicitação para a equipe de suporte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Ativo (equipamento)</Label>
              <Select
                value={newEquipment || 'none'}
                onValueChange={(v) => setNewEquipment(v === 'none' ? '' : v)}
                disabled={newEquipLoading}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue
                    placeholder={
                      newEquipLoading
                        ? 'Carregando ativos...'
                        : newEquipments.length === 0
                          ? '— Nenhum ativo vinculado —'
                          : 'Selecione o ativo (opcional)'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {newEquipments.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.name}
                      {eq.device_type ? ` [${eq.device_type}]` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Pré-preenchido com o celular, impressora ou scanner em nome do colaborador, quando
                houver.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição *</Label>
              <Textarea
                rows={4}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detalhe o problema, mensagens de erro, etc."
                className="text-sm"
              />
            </div>
            {newError && <p className="text-xs text-rose-500">{newError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={newSending}>
              Cancelar
            </Button>
            <Button
              onClick={submitNewTicket}
              disabled={newSending}
              className="bg-slate-700 hover:bg-slate-800 text-white"
            >
              {newSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Abrindo...
                </>
              ) : (
                'Abrir Chamado'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
