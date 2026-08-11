import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { createVisit, APPOINTMENT_TYPES, TRANSPORT_MODES } from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { getCompanies } from '@/services/companies'
import { getTickets } from '@/services/tickets'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function VisitCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    ticket: '',
    technician: '',
    client_address: '',
    scheduled_date: '',
    scheduled_time: '09:00',
    expected_end_time: '11:00',
    appointment_type: 'Visita Técnica',
    estimated_duration: '',
    scheduling_responsible: '',
    client_contact: '',
    contact_phone: '',
    required_resources: '',
    required_equipment: '',
    team: '',
    region: '',
    transport_mode: 'Veículo Próprio',
    vehicle_plate: '',
    priority: 'P3',
    visit_reason: '',
    notes: '',
  })

  const [techs, setTechs] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])

  useState(() => {
    getUsers()
      .then(setTechs)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
    getTickets()
      .then(setTickets)
      .catch(() => {})
  })

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.technician || !form.scheduled_date) return
    setSubmitting(true)
    setErrors({})
    try {
      const visit = await createVisit({
        ...form,
        ticket: form.ticket || undefined,
        estimated_duration: form.estimated_duration
          ? parseFloat(form.estimated_duration)
          : undefined,
        status: 'Agendada',
        technician_status: 'Disponível',
      } as any)
      toast({ title: 'Visita criada com sucesso!' })
      navigate(`/visitas-n2/${visit.id}`)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao criar visita', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        to="/visitas-n2/list"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-xl font-bold">Nova Visita Técnica</h1>
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Técnico *</Label>
            <Select value={form.technician} onValueChange={(v) => set('technician', v)}>
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
            {errors.technician && <p className="text-xs text-red-500">{errors.technician}</p>}
          </div>
          <div>
            <Label className="text-xs">Ticket</Label>
            <Select value={form.ticket} onValueChange={(v) => set('ticket', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {tickets.slice(0, 50).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Endereço</Label>
          <Input
            value={form.client_address}
            onChange={(e) => set('client_address', e.target.value)}
            className="h-9"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Data *</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => set('scheduled_date', e.target.value)}
              className="h-9"
            />
            {errors.scheduled_date && (
              <p className="text-xs text-red-500">{errors.scheduled_date}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Início</Label>
            <Input
              type="time"
              value={form.scheduled_time}
              onChange={(e) => set('scheduled_time', e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input
              type="time"
              value={form.expected_end_time}
              onChange={(e) => set('expected_end_time', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Tipo de Agendamento</Label>
            <Select value={form.appointment_type} onValueChange={(v) => set('appointment_type', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['P1', 'P2', 'P3', 'P4', 'P5'].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Duração Estimada (min)</Label>
            <Input
              type="number"
              value={form.estimated_duration}
              onChange={(e) => set('estimated_duration', e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Responsável Agendamento</Label>
            <Input
              value={form.scheduling_responsible}
              onChange={(e) => set('scheduling_responsible', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Contato no Local</Label>
            <Input
              value={form.client_contact}
              onChange={(e) => set('client_contact', e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input
              value={form.contact_phone}
              onChange={(e) => set('contact_phone', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Recursos Necessários</Label>
            <Input
              value={form.required_resources}
              onChange={(e) => set('required_resources', e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Equipamentos Necessários</Label>
            <Input
              value={form.required_equipment}
              onChange={(e) => set('required_equipment', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Equipe</Label>
            <Input
              value={form.team}
              onChange={(e) => set('team', e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Região</Label>
            <Input
              value={form.region}
              onChange={(e) => set('region', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Transporte</Label>
            <Select value={form.transport_mode} onValueChange={(v) => set('transport_mode', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_MODES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Placa do Veículo</Label>
            <Input
              value={form.vehicle_plate}
              onChange={(e) => set('vehicle_plate', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Motivo da Visita</Label>
          <Input
            value={form.visit_reason}
            onChange={(e) => set('visit_reason', e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/visitas-n2/list')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar Visita'}
          </Button>
        </div>
      </form>
    </div>
  )
}
