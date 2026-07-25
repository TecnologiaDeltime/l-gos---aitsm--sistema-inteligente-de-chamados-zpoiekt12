import { useState } from 'react'
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
import { createApproval, APPROVAL_TYPES } from '@/services/approvals'
import { updateTicket } from '@/services/tickets'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export function ApprovalDialog({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [type, setType] = useState(APPROVAL_TYPES[0])
  const [justification, setJustification] = useState('')
  const [hours, setHours] = useState('')
  const [cost, setCost] = useState('')
  const [deadline, setDeadline] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const handleSubmit = async () => {
    if (!user || !justification.trim()) return
    setErrors({})
    try {
      await createApproval({
        ticket: ticketId,
        requester: user.id,
        type,
        justification,
        estimated_hours: hours ? Number(hours) : undefined,
        estimated_cost: cost ? Number(cost) : undefined,
        deadline: deadline || undefined,
        status: 'Pendente',
        token: crypto.randomUUID(),
      })
      await updateTicket(ticketId, { status: 'Aguardando Aprovação' })
      toast({ title: 'Solicitação de aprovação enviada!' })
      onOpenChange(false)
      setJustification('')
      setHours('')
      setCost('')
      setDeadline('')
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar Aprovação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tipo de Aprovação</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Justificativa *</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
            />
            {errors.justification && <p className="text-xs text-red-500">{errors.justification}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Horas Estimadas</Label>
              <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Custo Estimado (R$)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Prazo</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!justification.trim()}>
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
