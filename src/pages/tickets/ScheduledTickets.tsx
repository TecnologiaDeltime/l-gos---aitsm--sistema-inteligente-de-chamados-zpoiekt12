import { useEffect, useState, useCallback } from 'react'
import { Loader2, CalendarClock, RefreshCw, Play, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  getScheduledTickets,
  createScheduledTicket,
  updateScheduledTicket,
  deleteScheduledTicket,
  type ScheduledTicketRecord,
  type RecurrenceType,
} from '@/services/scheduled-tickets'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCompanies, CompanyRecord } from '@/services/companies'

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

interface ScheduledTicketForm {
  title: string
  description: string
  company: string
  requester_name: string
  requester_email: string
  type: string
  priority: string
  scheduled_date: string
  recurrence_type: RecurrenceType
}

const EMPTY_FORM: ScheduledTicketForm = {
  title: '',
  description: '',
  company: '',
  requester_name: '',
  requester_email: '',
  type: 'Incidente',
  priority: 'Média',
  scheduled_date: '',
  recurrence_type: 'none',
}

export default function ScheduledTickets() {
  const { toast } = useToast()
  const [items, setItems] = useState<ScheduledTicketRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ScheduledTicketForm>({ ...EMPTY_FORM })

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
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (r: ScheduledTicketRecord) => {
    setEditingId(r.id)
    setForm({
      title: r.title || '',
      description: r.description || '',
      company: r.company || '',
      requester_name: r.requester_name || '',
      requester_email: r.requester_email || '',
      type: r.type || 'Incidente',
      priority: r.priority || 'Média',
      scheduled_date: r.scheduled_date ? r.scheduled_date.slice(0, 16) : '',
      recurrence_type: r.recurrence_type || 'none',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.company || !form.scheduled_date) {
      toast({
        title: 'Preencha título, descrição, empresa e data de agendamento',
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    try {
      const payload = {
        ...form,
        scheduled_date: new Date(form.scheduled_date).toISOString(),
      }
      if (editingId) {
        await updateScheduledTicket(editingId, payload)
        toast({ title: 'Agendamento atualizado' })
      } else {
        await createScheduledTicket(payload)
        toast({ title: 'Agendamento criado' })
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar agendamento',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Chamados Agendados</h1>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar agendamento' : 'Novo chamado agendado'}</DialogTitle>
            <DialogDescription>
              O sistema cria o chamado automaticamente na data marcada (cron de processamento).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="st-title">Título *</Label>
              <Input
                id="st-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Resumo do chamado"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="st-desc">Descrição *</Label>
              <Textarea
                id="st-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes do chamado que será criado"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Empresa *</Label>
                <Select
                  value={form.company}
                  onValueChange={(v) => setForm({ ...form, company: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name || c.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data de agendamento *</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Solicitante</Label>
                <Input
                  value={form.requester_name}
                  onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                  placeholder="Nome do solicitante"
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail do solicitante</Label>
                <Input
                  type="email"
                  value={form.requester_email}
                  onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Incidente">Incidente</SelectItem>
                    <SelectItem value="Requisição de Serviço">Requisição de Serviço</SelectItem>
                    <SelectItem value="Tarefa Interna">Tarefa Interna</SelectItem>
                    <SelectItem value="Dúvida">Dúvida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Crítica">Crítica</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Recorrência</Label>
                <Select
                  value={form.recurrence_type}
                  onValueChange={(v) => setForm({ ...form, recurrence_type: v as RecurrenceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Único</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
