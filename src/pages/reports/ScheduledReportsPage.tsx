import { useEffect, useState } from 'react'
import { Mail, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  calculateNextRun,
  checkSmtpConfigured,
  type ScheduledReportRecord,
} from '@/services/scheduled-reports'

const TYPE_LABELS: Record<string, string> = {
  sla: 'Dados de SLA',
  atividades_recorrentes: 'Atividades Recorrentes',
}

export default function ScheduledReportsPage() {
  const { toast } = useToast()
  const [reports, setReports] = useState<ScheduledReportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [smtpOk, setSmtpOk] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledReportRecord | null>(null)
  const [form, setForm] = useState({
    name: '',
    report_types: [] as string[],
    recipient_emails: '',
    day_of_month: 1,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([getScheduledReports(), checkSmtpConfigured()])
      setReports(r)
      setSmtpOk(s.configured)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('scheduled_reports', () => {
    loadData()
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', report_types: [], recipient_emails: '', day_of_month: 1 })
    setDialogOpen(true)
  }

  const openEdit = (r: ScheduledReportRecord) => {
    setEditing(r)
    setForm({
      name: r.name,
      report_types: Array.isArray(r.report_types) ? r.report_types : [],
      recipient_emails: r.recipient_emails,
      day_of_month: r.day_of_month,
    })
    setDialogOpen(true)
  }

  const toggleType = (t: string) => {
    setForm((p) => ({
      ...p,
      report_types: p.report_types.includes(t)
        ? p.report_types.filter((x) => x !== t)
        : [...p.report_types, t],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    if (form.report_types.length === 0) {
      toast({ title: 'Selecione ao menos um tipo', variant: 'destructive' })
      return
    }
    if (!form.recipient_emails.trim()) {
      toast({ title: 'E-mail é obrigatório', variant: 'destructive' })
      return
    }
    if (form.day_of_month < 1 || form.day_of_month > 28) {
      toast({ title: 'Dia deve ser 1–28', variant: 'destructive' })
      return
    }
    if (!smtpOk) {
      toast({
        title: 'SMTP não configurado',
        description: 'Configure o SMTP no Painel Admin.',
        variant: 'destructive',
      })
      return
    }
    try {
      const data = { ...form, next_run: calculateNextRun(form.day_of_month), active: true }
      if (editing) await updateScheduledReport(editing.id, data)
      else await createScheduledReport(data)
      toast({ title: editing ? 'Relatório atualizado' : 'Relatório criado' })
      setDialogOpen(false)
      await loadData()
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteScheduledReport(id)
      toast({ title: 'Relatório excluído' })
      await loadData()
    } catch (err) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" /> Relatórios Agendados
        </h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo Relatório
        </Button>
      </div>

      {!smtpOk && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Para enviar relatórios, configure o SMTP no Painel Admin (Settings → Mail).
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Nenhum relatório agendado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Tipos</TableHead>
                    <TableHead className="text-xs text-center">Dia</TableHead>
                    <TableHead className="text-xs">Último Envio</TableHead>
                    <TableHead className="text-xs">Próximo</TableHead>
                    <TableHead className="text-xs">Destinatários</TableHead>
                    <TableHead className="text-xs text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {(r.report_types || []).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              {TYPE_LABELS[t] || t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center">Dia {r.day_of_month}</TableCell>
                      <TableCell className="text-xs">
                        {r.last_sent ? new Date(r.last_sent).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.next_run ? new Date(r.next_run).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {r.recipient_emails}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Relatório' : 'Novo Relatório Agendado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Relatório Mensal de SLA"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tipo de Relatório</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.report_types.includes('sla')}
                    onCheckedChange={() => toggleType('sla')}
                    id="rt-sla"
                  />
                  <label htmlFor="rt-sla" className="text-xs cursor-pointer">
                    Dados de SLA
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.report_types.includes('atividades_recorrentes')}
                    onCheckedChange={() => toggleType('atividades_recorrentes')}
                    id="rt-rec"
                  />
                  <label htmlFor="rt-rec" className="text-xs cursor-pointer">
                    Atividades mais Recorrentes
                  </label>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mails (separados por vírgula)</Label>
              <Input
                value={form.recipient_emails}
                onChange={(e) => setForm({ ...form, recipient_emails: e.target.value })}
                placeholder="email1@exemplo.com, email2@exemplo.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dia do Mês (1–28)</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={form.day_of_month}
                onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })}
                className="w-24"
              />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editing ? 'Atualizar' : 'Criar'} Relatório
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
