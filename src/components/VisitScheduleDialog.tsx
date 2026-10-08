import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { createVisit, APPOINTMENT_TYPES } from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { getCompanies } from '@/services/companies'
import { getCompanyUnitsByCompany } from '@/services/company-units'
import { useToast } from '@/hooks/use-toast'

export function VisitScheduleDialog({
  ticketId,
  companyId,
  open,
  onOpenChange,
  onSaved,
}: {
  ticketId?: string
  companyId?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}) {
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [technician, setTechnician] = useState('')
  const [company, setCompany] = useState(companyId || '')
  const [unit, setUnit] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [visitReason, setVisitReason] = useState('')
  const [appointmentType, setAppointmentType] = useState('Visita Técnica')
  const [priority, setPriority] = useState('P3')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    getUsers()
      .then(setTechnicians)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (company) {
      getCompanyUnitsByCompany(company)
        .then(setUnits)
        .catch(() => {})
    } else {
      setUnits([])
    }
  }, [company])

  const handleSubmit = async () => {
    if (!technician || !date || !company) {
      toast({ title: 'Preencha operador, cliente e data', variant: 'destructive' })
      return
    }
    try {
      await createVisit({
        ticket: ticketId || '',
        technician,
        client: company,
        client_address: address,
        scheduled_date: date,
        scheduled_time: startTime,
        expected_end_time: endTime,
        visit_reason: visitReason,
        appointment_type: appointmentType,
        priority,
        client_contact: contactName,
        contact_phone: contactPhone,
        notes,
        status: 'Agendada',
        technician_status: 'Disponível',
      } as any)
      toast({ title: 'Visita agendada com sucesso!' })
      onOpenChange(false)
      onSaved?.()
      setVisitReason('')
      setNotes('')
      setAddress('')
    } catch {
      toast({ title: 'Erro ao agendar visita', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Visita Técnica</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Operador *</Label>
              <Select value={technician} onValueChange={setTechnician}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Select value={company} onValueChange={setCompany}>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Filial</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Agendamento</Label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
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
          </div>
          <div>
            <Label className="text-xs">Endereço</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço da visita"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
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
            <div>
              <Label className="text-xs">Contato no Local</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-9"
                placeholder="Nome"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Telefone de Contato</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="h-9"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <Label className="text-xs">Motivo da Visita</Label>
            <Input
              value={visitReason}
              onChange={(e) => setVisitReason(e.target.value)}
              className="h-9"
              placeholder="Motivo da visita"
            />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!technician || !date || !company}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
