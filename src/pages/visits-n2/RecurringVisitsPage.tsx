import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, RefreshCw } from 'lucide-react'
import {
  getRecurringTemplates,
  createRecurringTemplate,
  RECURRING_FREQUENCIES,
} from '@/services/visit-extras'
import { getUsers } from '@/services/users'
import { getCompanies } from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function RecurringVisitsPage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<any[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    frequency: 'Semanal',
    technician: '',
    client: '',
    day_of_week: '1',
    scheduled_time: '09:00',
    estimated_duration: '',
    visit_reason: '',
    appointment_type: 'Visita Técnica',
    active: true,
  })

  const loadData = () => {
    getRecurringTemplates()
      .then(setTemplates)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
    getUsers()
      .then(setTechs)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])
  useRealtime('recurring_visit_templates', () => loadData())

  const handleSubmit = async () => {
    try {
      await createRecurringTemplate({
        ...form,
        day_of_week: parseInt(form.day_of_week),
        estimated_duration: form.estimated_duration ? parseInt(form.estimated_duration) : undefined,
        next_run: new Date().toISOString().slice(0, 10),
      } as any)
      toast({ title: 'Template criado!' })
      setShowForm(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao criar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <RefreshCw className="h-5 w-5" /> Visitas Recorrentes
        </h2>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>
      <div className="grid gap-3">
        {templates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhum template recorrente.
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">
                      {t.frequency}
                    </Badge>
                    <span className="text-sm font-medium">
                      {t.visit_reason || 'Visita Recorrente'}
                    </span>
                    {t.active ? (
                      <Badge className="bg-green-100 text-green-800 text-[9px]">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.expand?.technician?.name || '-'} · {t.expand?.client?.trade_name || '-'} ·{' '}
                    {t.scheduled_time || ''} · Próxima: {t.next_run || '-'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Template Recorrente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Frequência</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Operador</Label>
              <Select
                value={form.technician}
                onValueChange={(v) => setForm({ ...form, technician: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {techs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia da Semana</Label>
                <Select
                  value={form.day_of_week}
                  onValueChange={(v) => setForm({ ...form, day_of_week: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Horário</Label>
                <Input
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Duração Est. (min)</Label>
              <Input
                type="number"
                value={form.estimated_duration}
                onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Input
                value={form.visit_reason}
                onChange={(e) => setForm({ ...form, visit_reason: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-xs">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
