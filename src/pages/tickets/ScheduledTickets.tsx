import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Plus,
  Search,
  Filter,
  Repeat,
  Bell,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Edit,
  Trash2,
  Play,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import {
  ScheduledTicketRecord,
  getScheduledTickets,
  cancelScheduledTicket,
  reactivateScheduledTicket,
  deleteScheduledTicket,
  formatRecurrenceLabel,
  formatAdvanceNoticeLabel,
} from '@/services/scheduled-tickets'
import { ScheduledTicketDialog } from '@/components/ScheduledTicketDialog'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getQueues, QueueRecord } from '@/services/queues'
import { getUsers, UserItem } from '@/services/users'

export const ScheduledTickets: React.FC = () => {
  const permissions = usePermissions()
  const [tickets, setTickets] = useState<ScheduledTicketRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Metadados para formulário e filtros
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [operators, setOperators] = useState<UserItem[]>([])

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [recurrenceFilter, setRecurrenceFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')

  // Modais de Criação / Edição
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<ScheduledTicketRecord | null>(null)

  // Modal de Exclusão / Cancelamento
  const [ticketToCancel, setTicketToCancel] = useState<ScheduledTicketRecord | null>(null)
  const [ticketToDelete, setTicketToDelete] = useState<ScheduledTicketRecord | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [schedList, comps, cats, qList, ops] = await Promise.all([
        getScheduledTickets(undefined, 'scheduled_date'),
        getCompanies().catch(() => [] as CompanyRecord[]),
        getCategories().catch(() => [] as CategoryRecord[]),
        getQueues().catch(() => [] as QueueRecord[]),
        getUsers("role='tecnico' || role='gestor' || role='admin'").catch(() => [] as UserItem[]),
      ])
      setTickets(schedList)
      setCompanies(comps)
      setCategories(cats)
      setQueues(qList)
      setOperators(ops)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar tickets programados',
        description: err?.message || 'Falha ao buscar agendamentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Busca por título, solicitante ou empresa
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const titleMatch = (t.title || '').toLowerCase().includes(term)
        const reqMatch = (t.requester_name || '').toLowerCase().includes(term)
        const compMatch = (t.expand?.company?.trade_name || t.expand?.company?.name || '')
          .toLowerCase()
          .includes(term)
        if (!titleMatch && !reqMatch && !compMatch) return false
      }

      // Filtro de status
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false
      }

      // Filtro de recorrência
      if (recurrenceFilter !== 'all') {
        if (recurrenceFilter === 'recurring' && t.recurrence_type === 'none') return false
        if (recurrenceFilter === 'single' && t.recurrence_type !== 'none') return false
        if (
          ['daily', 'weekly', 'monthly'].includes(recurrenceFilter) &&
          t.recurrence_type !== recurrenceFilter
        ) {
          return false
        }
      }

      // Filtro de empresa
      if (companyFilter !== 'all' && t.company !== companyFilter) {
        return false
      }

      return true
    })
  }, [tickets, searchTerm, statusFilter, recurrenceFilter, companyFilter])

  // Contadores para KPI cards
  const stats = useMemo(() => {
    const total = tickets.length
    const scheduled = tickets.filter((t) => t.status === 'agendado').length
    const recurring = tickets.filter(
      (t) => t.status === 'agendado' && t.recurrence_type !== 'none',
    ).length
    const noticeConfigured = tickets.filter((t) => (t.advance_notice_minutes || 0) > 0).length
    const processed = tickets.filter((t) => t.status === 'processado').length

    return { total, scheduled, recurring, noticeConfigured, processed }
  }, [tickets])

  const handleOpenCreate = () => {
    setEditingTicket(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (ticket: ScheduledTicketRecord) => {
    setEditingTicket(ticket)
    setDialogOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!ticketToCancel) return
    try {
      await cancelScheduledTicket(ticketToCancel.id)
      toast({
        title: 'Agendamento cancelado',
        description: 'O agendamento foi cancelado e não gerará novos chamados.',
      })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar agendamento',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setTicketToCancel(null)
    }
  }

  const handleConfirmReactivate = async (ticket: ScheduledTicketRecord) => {
    try {
      // Se a data já passou, sugere nova data para hoje + 1 hora
      const now = new Date()
      const sched = new Date(ticket.scheduled_date)
      let newDateIso: string | undefined = undefined
      if (sched.getTime() <= now.getTime()) {
        const future = new Date(now.getTime() + 60 * 60 * 1000)
        newDateIso = future.toISOString()
      }

      await reactivateScheduledTicket(ticket.id, newDateIso)
      toast({
        title: 'Agendamento reativado',
        description: newDateIso
          ? 'O agendamento voltou para o status "agendado" com nova data.'
          : 'O agendamento voltou para o status "agendado".',
      })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao reativar agendamento',
        description: err?.message,
        variant: 'destructive',
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return
    try {
      await deleteScheduledTicket(ticketToDelete.id)
      toast({
        title: 'Agendamento excluído',
        description: 'O registro foi removido com sucesso.',
      })
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir agendamento',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setTicketToDelete(null)
    }
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'agendado':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1"
          >
            <Clock className="h-3 w-3" />
            Agendado
          </Badge>
        )
      case 'processado':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            Processado
          </Badge>
        )
      case 'cancelado':
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-muted-foreground/30 gap-1"
          >
            <XCircle className="h-3 w-3" />
            Cancelado
          </Badge>
        )
      case 'erro':
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/30 gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            Falha
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const renderRecurrenceBadge = (ticket: ScheduledTicketRecord) => {
    const label = formatRecurrenceLabel(
      ticket.recurrence_type,
      ticket.recurrence_days_of_week,
      ticket.recurrence_day_of_month,
      ticket.recurrence_end_date,
    )

    if (ticket.recurrence_type === 'none') {
      return <span className="text-xs text-muted-foreground">Único (não repete)</span>
    }

    return (
      <Badge
        variant="secondary"
        className="gap-1 font-normal bg-primary/10 text-primary border-primary/20"
      >
        <Repeat className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const renderNoticeBadge = (ticket: ScheduledTicketRecord) => {
    const minutes = ticket.advance_notice_minutes || 0
    if (minutes <= 0) {
      return <span className="text-xs text-muted-foreground">-</span>
    }

    const label = formatAdvanceNoticeLabel(minutes)
    return (
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={`text-[11px] gap-1 font-normal ${
            ticket.notice_sent
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
          }`}
          title={
            ticket.notice_sent
              ? `Aviso enviado em ${ticket.notice_sent_at}`
              : 'Aviso pendente para este ciclo'
          }
        >
          <Bell className="h-3 w-3" />
          {label}
        </Badge>
        {ticket.notice_sent && (
          <span
            className="text-[10px] text-muted-foreground font-medium"
            title="Notificação já enviada neste ciclo"
          >
            (enviado)
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Tickets Programados</h1>
            <Badge variant="outline" className="text-xs font-normal">
              Cron a cada 5 min
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gerenciamento de chamados agendados, rotinas recorrentes e avisos prévios automáticos.
          </p>
        </div>

        {permissions.canWriteModule('tickets') && (
          <Button onClick={handleOpenCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Programar Novo Ticket
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center justify-between">
              Agendados Ativos
              <Clock className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-foreground">{stats.scheduled}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Aguardando data de abertura</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center justify-between">
              Recorrência Ativa
              <Repeat className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-foreground">{stats.recurring}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Rotinas diárias, semanais ou mensais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center justify-between">
              Com Aviso Prévio
              <Bell className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-foreground">{stats.noticeConfigured}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Alertas in-app e e-mail antes da abertura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center justify-between">
              Processados
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-foreground">{stats.processed}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Finalizados ou ciclo esgotado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, cliente ou solicitante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="agendado">Apenas Agendados</SelectItem>
                <SelectItem value="processado">Apenas Processados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
                <SelectItem value="erro">Com Erro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={recurrenceFilter} onValueChange={setRecurrenceFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Recorrência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as recorrências</SelectItem>
                <SelectItem value="recurring">Apenas Recorrentes</SelectItem>
                <SelectItem value="single">Apenas Únicos (Não repete)</SelectItem>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Empresa / Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name || c.legal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Agendamentos */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Título do Chamado</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Próxima Abertura</TableHead>
                <TableHead>Recorrência</TableHead>
                <TableHead>Aviso Prévio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Carregando agendamentos...
                  </TableCell>
                </TableRow>
              ) : filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <CalendarClock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="font-medium text-foreground">
                      Nenhum ticket programado encontrado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchTerm ||
                      statusFilter !== 'all' ||
                      recurrenceFilter !== 'all' ||
                      companyFilter !== 'all'
                        ? 'Tente ajustar os filtros aplicados acima.'
                        : 'Clique em "Programar Novo Ticket" para criar seu primeiro agendamento.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((t) => {
                  const companyName =
                    t.expand?.company?.trade_name ||
                    t.expand?.company?.legal_name ||
                    t.expand?.company?.name ||
                    'N/A'
                  const assignedName =
                    t.expand?.assigned_to?.name || t.expand?.assigned_to?.email || 'Não atribuído'

                  const schedDateObj = new Date(t.scheduled_date)
                  const isPast = schedDateObj.getTime() <= Date.now() && t.status === 'agendado'

                  return (
                    <TableRow key={t.id} className={isPast ? 'bg-amber-500/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground line-clamp-1">
                              {t.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-mono px-1 py-0"
                            >
                              {t.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            Solicitante: {t.requester_name}
                          </p>
                          {t.last_ticket_created && t.expand?.last_ticket_created && (
                            <Link
                              to={`/tickets/${t.last_ticket_created}`}
                              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              Último: #{t.expand.last_ticket_created.number}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[150px]">{companyName}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-mono">
                          <div
                            className={isPast ? 'text-amber-600 font-semibold' : 'text-foreground'}
                          >
                            {schedDateObj.toLocaleDateString('pt-BR')}{' '}
                            {schedDateObj.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          {isPast && (
                            <span className="text-[10px] text-amber-600 font-sans block">
                              Próximo no ciclo do cron
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>{renderRecurrenceBadge(t)}</TableCell>

                      <TableCell>{renderNoticeBadge(t)}</TableCell>

                      <TableCell>{renderStatusBadge(t.status)}</TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <span className="truncate max-w-[120px] block">{assignedName}</span>
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {permissions.canWriteModule('tickets') && (
                              <DropdownMenuItem onClick={() => handleOpenEdit(t)} className="gap-2">
                                <Edit className="h-4 w-4" />
                                Editar Agendamento
                              </DropdownMenuItem>
                            )}

                            {t.status === 'agendado' && permissions.canWriteModule('tickets') && (
                              <DropdownMenuItem
                                onClick={() => setTicketToCancel(t)}
                                className="gap-2 text-amber-600 focus:text-amber-600"
                              >
                                <XCircle className="h-4 w-4" />
                                Cancelar Agendamento
                              </DropdownMenuItem>
                            )}

                            {(t.status === 'cancelado' || t.status === 'processado') &&
                              permissions.canWriteModule('tickets') && (
                                <DropdownMenuItem
                                  onClick={() => handleConfirmReactivate(t)}
                                  className="gap-2 text-emerald-600 focus:text-emerald-600"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Reativar Agendamento
                                </DropdownMenuItem>
                              )}

                            {permissions.isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setTicketToDelete(t)}
                                  className="gap-2 text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal de Criação / Edição */}
      <ScheduledTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTicket={editingTicket}
        onSuccess={loadData}
        companies={companies}
        categories={categories}
        queues={queues}
        operators={operators}
      />

      {/* Dialog de Confirmação de Cancelamento */}
      <AlertDialog
        open={!!ticketToCancel}
        onOpenChange={(open) => !open && setTicketToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a programação de abertura de "{ticketToCancel?.title}
              "? O chamado não será gerado na próxima data programada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={!!ticketToDelete}
        onOpenChange={(open) => !open && setTicketToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ticket programado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o agendamento "{ticketToDelete?.title}". Os
              chamados que já foram abertos no passado permanecerão salvos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir Agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ScheduledTickets
