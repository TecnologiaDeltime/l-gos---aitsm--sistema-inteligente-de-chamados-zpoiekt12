import { useEffect, useState, useCallback } from 'react'
import { Loader2, CalendarClock, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getScheduledTickets,
  deleteScheduledTicket,
  type ScheduledTicketRecord,
} from '@/services/scheduled-tickets'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getQueues, QueueRecord } from '@/services/queues'
import { getUsers, UserItem } from '@/services/users'
import { ScheduledTicketDialog } from '@/components/ScheduledTicketDialog'

const STATUS_COLORS: Record<string, string> = {
  agendado:
    'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  processado:
    'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40',
  cancelado:
    'bg-slate-500/10 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40',
  erro: 'bg-red-500/10 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',
}

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Único',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
}

export default function ScheduledTickets() {
  const { toast } = useToast()
  const [items, setItems] = useState<ScheduledTicketRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [operators, setOperators] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledTicketRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getScheduledTickets()
      setItems(data)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar chamados agendados',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
    getCategories()
      .then(setCategories)
      .catch(() => {})
    getQueues()
      .then(setQueues)
      .catch(() => {})
    getUsers()
      .then(setOperators)
      .catch(() => {})
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (r: ScheduledTicketRecord) => {
    setEditing(r)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    try {
      await deleteScheduledTicket(id)
      toast({ title: 'Agendamento excluído' })
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chamados Programados</h1>
          <p className="text-sm text-muted-foreground">
            Chamados recorrentes e futuros que o sistema cria automaticamente na data marcada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <CalendarClock className="mr-1 h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Carregando...' : `${items.length} agendamento(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum chamado agendado. Crie o primeiro com "Novo Agendamento".
            </p>
          ) : (
            items.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${STATUS_COLORS[r.status] || ''}`}
                    >
                      {r.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {RECURRENCE_LABELS[r.recurrence_type] || r.recurrence_type || 'Único'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {r.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)} disabled={busy}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      disabled={busy}
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.expand?.company?.trade_name || r.expand?.company?.name
                    ? `Empresa: ${r.expand?.company?.trade_name || r.expand?.company?.name}`
                    : ''}
                  {r.scheduled_date
                    ? ` · Agendado para ${new Date(r.scheduled_date).toLocaleString('pt-BR')}`
                    : ''}
                  {r.last_executed_at
                    ? ` · Última execução ${new Date(r.last_executed_at).toLocaleString('pt-BR')}`
                    : ''}
                  {r.last_ticket_created ? ' · chamado já gerado' : ''}
                </div>
                {r.error_message && (
                  <p className="text-xs text-red-600 dark:text-red-400">Erro: {r.error_message}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ScheduledTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTicket={editing}
        onSuccess={load}
        companies={companies}
        categories={categories}
        queues={queues}
        operators={operators}
      />
    </div>
  )
}
