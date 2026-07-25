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
import { createVisit } from '@/services/technical-visits'
import { updateTicket } from '@/services/tickets'
import { getUsers } from '@/services/users'
import { getCompanyUnits } from '@/services/companies'
import { useToast } from '@/hooks/use-toast'

export function VisitDialog({
  ticketId,
  companyId,
  open,
  onOpenChange,
  onSaved,
}: {
  ticketId: string
  companyId?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}) {
  const { toast } = useToast()
  const [technicians, setTechnicians] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [technician, setTechnician] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [materials, setMaterials] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    getUsers()
      .then(setTechnicians)
      .catch(() => {})
    if (companyId)
      getCompanyUnits(companyId)
        .then(setUnits)
        .catch(() => {})
  }, [companyId])

  const handleSubmit = async () => {
    if (!technician || !date) return
    try {
      await createVisit({
        ticket: ticketId,
        technician,
        client_address: address,
        scheduled_date: date,
        scheduled_time: time,
        materials,
        notes,
        status: 'Agendada',
      })
      await updateTicket(ticketId, { status: 'Agendado' })
      toast({ title: 'Visita técnica agendada!' })
      onOpenChange(false)
      onSaved?.()
      setAddress('')
      setDate('')
      setMaterials('')
      setNotes('')
    } catch {
      toast({ title: 'Erro ao agendar visita', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar Visita Técnica</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Técnico *</Label>
            <Select value={technician} onValueChange={setTechnician}>
              <SelectTrigger>
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
            <Label className="text-xs">Endereço do Cliente</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, cidade"
            />
            {units.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setAddress(
                        [u.address_street, u.address_number, u.address_city]
                          .filter(Boolean)
                          .join(', '),
                      )
                    }
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Materiais</Label>
            <Input
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              placeholder="Lista de materiais"
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
          <Button onClick={handleSubmit} disabled={!technician || !date}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
