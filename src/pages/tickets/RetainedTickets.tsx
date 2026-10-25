import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  Trash2,
  Mail,
  Building2,
  Calendar,
  ExternalLink,
  Loader2,
  RefreshCw,
  FileQuestion,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { formatDateTime, formatTicketAge } from '@/lib/date-format'
import {
  getRetainedTickets,
  releaseRetainedTicket,
  dismissRetainedTicket,
  deleteRetainedTicket,
  RetainedTicketRecord,
} from '@/services/retained-tickets'

export default function RetainedTickets() {
  const { toast } = useToast()
  const perms = usePermissions()
  const [tickets, setTickets] = useState<RetainedTicketRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Pendente')

  // Estado para Modal de Liberação
  const [selectedTicket, setSelectedTicket] = useState<RetainedTicketRecord | null>(null)
  const [releaseModalOpen, setReleaseModalOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [releasing, setReleasing] = useState(false)

  // Estado para Modal de Exclusão/Descarte
  const [dismissTarget, setDismissTarget] = useState<RetainedTicketRecord | null>(null)
  const [dismissNotes, setDismissNotes] = useState('')
  const [dismissing, setDismissing] = useState(false)

  // Detalhes / Visualização completa da mensagem
  const [viewTicket, setViewTicket] = useState<RetainedTicketRecord | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRetainedTickets()
      setTickets(data)
    } catch {
      toast({ title: 'Erro ao carregar chamados retidos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [loadData])

  useRealtime('retained_tickets', () => loadData())

  const handleOpenRelease = (ticket: RetainedTicketRecord) => {
    setSelectedTicket(ticket)
    setSelectedCompanyId('')
    setReleaseNotes('Liberado para atendimento regular')
    setReleaseModalOpen(true)
  }

  const handleConfirmRelease = async () => {
    if (!selectedTicket) return
    setReleasing(true)
    try {
      const res: any = await releaseRetainedTicket(selectedTicket.id, {
        company_id: selectedCompanyId || undefined,
        notes: releaseNotes,
      })
      toast({
        title: 'Chamado liberado com sucesso!',
        description: `Ticket #${res.ticket_number || ''} criado no sistema.`,
      })
      setReleaseModalOpen(false)
      setSelectedTicket(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao liberar chamado',
        description: err.message || 'Falha na liberação.',
        variant: 'destructive',
      })
    } finally {
      setReleasing(false)
    }
  }

  const handleConfirmDismiss = async () => {
    if (!dismissTarget) return
    setDismissing(true)
    try {
      await dismissRetainedTicket(dismissTarget.id, dismissNotes)
      toast({ title: 'Chamado retido descartado.' })
      setDismissTarget(null)
      setDismissNotes('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao descartar chamado',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setDismissing(false)
    }
  }

  const handleDeletePermanent = async (id: string) => {
    try {
      await deleteRetainedTicket(id)
      toast({ title: 'Registro removido permanentemente' })
      loadData()
    } catch {
      toast({ title: 'Erro ao remover registro', variant: 'destructive' })
    }
  }

  // Filtragem dos tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      (t.from_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.domain || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.from_name || '').toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Chamados Retidos (Moderação de E-mail)
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                E-mails recebidos de domínios não autorizados aguardando revisão e liberação para
                abertura de tickets
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 hover:border-primary/40"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            Atualizar
          </Button>
          <Link to="/settings">
            <Button variant="outline" size="sm" className="h-9 hover:border-primary/40">
              <Mail className="mr-1.5 h-4 w-4" />
              Configurar Caixa IMAP
            </Button>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-xl border border-border/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por remetente, assunto, domínio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs bg-secondary/50 border-border"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Status:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendente">Pendentes</SelectItem>
              <SelectItem value="Liberado">Liberados</SelectItem>
              <SelectItem value="Excluído">Excluídos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listagem em Tabela / Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-slate-500 mt-2">Carregando chamados retidos...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileQuestion className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
              Nenhum chamado retido encontrado
            </p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Todos os e-mails recebidos estão em conformidade com as listas de domínios autorizados
              ou não há novos e-mails pendentes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              className={`itsm-card itsm-card-hover p-4 transition-all duration-200 ${
                t.status === 'Pendente'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : t.status === 'Liberado'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border/80 opacity-75'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Informações Principais */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{t.subject}</span>
                    <Badge
                      variant="outline"
                      className={
                        t.status === 'Pendente'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : t.status === 'Liberado'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-secondary text-muted-foreground border-border'
                      }
                    >
                      {t.status}
                    </Badge>
                    {t.domain && (
                      <span className="inline-flex items-center text-xs font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                        {t.domain}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <strong className="text-foreground/80">De:</strong>{' '}
                      {t.from_name ? `${t.from_name} <${t.from_email}>` : t.from_email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <strong className="text-foreground/80">Recebido em:</strong>{' '}
                      {formatDateTime(t.created)} ({formatTicketAge(t.created)})
                    </span>
                    {t.reason && (
                      <span className="text-amber-400 font-medium">Motivo: {t.reason}</span>
                    )}
                  </div>

                  {/* Prévia do corpo */}
                  <p className="text-xs text-muted-foreground line-clamp-2 pt-1">{t.body}</p>

                  {/* Informações de Moderação / Ticket Criado */}
                  {t.status === 'Liberado' && t.expand?.ticket && (
                    <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Chamado Criado:{' '}
                      <Link
                        to={`/tickets/${t.expand.ticket.id}`}
                        className="underline hover:text-emerald-300 flex items-center gap-1"
                      >
                        #{t.expand.ticket.number || t.expand.ticket.id}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {t.reviewed_at && (
                        <span className="text-muted-foreground font-normal">
                          (em {new Date(t.reviewed_at).toLocaleString('pt-BR')})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs hover:border-primary/40"
                    onClick={() => setViewTicket(t)}
                  >
                    Ver Conteúdo
                  </Button>

                  {t.status === 'Pendente' && (perms.isAdmin || perms.isGestor) && (
                    <>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
                        onClick={() => handleOpenRelease(t)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Liberar Chamado
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                        onClick={() => {
                          setDismissTarget(t)
                          setDismissNotes(
                            'Domínio não reconhecido e descarte confirmado pelo gestor.',
                          )
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Descartar
                      </Button>
                    </>
                  )}

                  {t.status !== 'Pendente' && perms.isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                      title="Excluir do histórico"
                      onClick={() => handleDeletePermanent(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog para Visualização Completa do E-mail */}
      <Dialog open={!!viewTicket} onOpenChange={(o) => !o && setViewTicket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Detalhes do E-mail Retido
            </DialogTitle>
            <DialogDescription>
              Mensagem original capturada pelo agente de ingestão de e-mails.
            </DialogDescription>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
                <div>
                  <span className="text-slate-400">De:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewTicket.from_name
                      ? `${viewTicket.from_name} <${viewTicket.from_email}>`
                      : viewTicket.from_email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Domínio:</span>{' '}
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {viewTicket.domain || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Recebido em:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200">
                    {new Date(viewTicket.created).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>{' '}
                  <Badge variant="outline" className="text-[10px]">
                    {viewTicket.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assunto:
                </Label>
                <div className="p-2.5 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 text-sm font-semibold">
                  {viewTicket.subject}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Corpo do E-mail (Texto limpo):
                </Label>
                <div className="p-3.5 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {viewTicket.body || 'Sem corpo de mensagem.'}
                </div>
              </div>

              {viewTicket.review_notes && (
                <div className="space-y-1 text-xs">
                  <span className="text-slate-400">Observações da Moderação:</span>
                  <p className="p-2 rounded border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {viewTicket.review_notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {viewTicket && viewTicket.status === 'Pendente' && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  const t = viewTicket
                  setViewTicket(null)
                  handleOpenRelease(t)
                }}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Liberar este Chamado
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewTicket(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Liberação de Chamado Retido */}
      <Dialog open={releaseModalOpen} onOpenChange={setReleaseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Liberar Chamado Retido
            </DialogTitle>
            <DialogDescription>
              Esta ação criará um ticket imediatamente no sistema a partir do e-mail retido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Vincular a uma Empresa / Cliente (Opcional)
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a empresa ou vincule automaticamente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_auto">Tentar identificação automática</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name || c.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Se selecionada, o ticket será atrelado a este cliente e herdará seu contrato ativo.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Justificativa da Liberação</Label>
              <Textarea
                rows={3}
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Ex: Domínio verificado e autorizado manualmente pelo gestor."
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReleaseModalOpen(false)}
              disabled={releasing}
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmRelease}
              disabled={releasing}
            >
              {releasing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {releasing ? 'Liberando...' : 'Confirmar e Criar Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Descarte */}
      <AlertDialog open={!!dismissTarget} onOpenChange={(o) => !o && setDismissTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar Chamado Retido?</AlertDialogTitle>
            <AlertDialogDescription>
              O chamado será marcado como descartado/excluído e nenhum ticket será gerado no
              sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-medium">Justificativa do descarte</Label>
            <Textarea
              rows={2}
              value={dismissNotes}
              onChange={(e) => setDismissNotes(e.target.value)}
              placeholder="Motivo do descarte..."
              className="text-xs"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dismissing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmDismiss}
              disabled={dismissing}
            >
              {dismissing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmar Descarte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
