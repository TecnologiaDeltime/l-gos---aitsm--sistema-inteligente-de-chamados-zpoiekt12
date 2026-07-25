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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { updateTicket, type TicketRecord } from '@/services/tickets'
import { getCompanyDepartments } from '@/services/companies'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface Department {
  id: string
  name: string
}

interface Props {
  ticket: TicketRecord
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}

export function RequesterEditDialog({ ticket, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [unit, setUnit] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [units, setUnits] = useState<CompanyUnitRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(ticket.requester_name || '')
      setPhone(ticket.requester_phone || '')
      setDepartment(ticket.department || 'none')
      setUnit(ticket.unit || 'none')
      if (ticket.company) {
        setLoading(true)
        Promise.all([
          getCompanyDepartments(ticket.company).catch(() => []),
          getCompanyUnitsByCompany(ticket.company).catch(() => []),
        ])
          .then(([depts, unts]) => {
            setDepartments(depts as Department[])
            setUnits(unts as CompanyUnitRecord[])
          })
          .finally(() => setLoading(false))
      }
    }
  }, [open, ticket])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await updateTicket(ticket.id, {
        requester_name: name,
        requester_phone: phone,
        department: department === 'none' ? null : department,
        unit: unit === 'none' ? null : unit,
      } as any)
      toast({ title: 'Dados do solicitante atualizados!' })
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast({
        title: 'Erro ao atualizar solicitante',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Solicitante</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail (somente leitura)</Label>
            <Input
              value={ticket.requester_email || ''}
              readOnly
              disabled
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Setor</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
              </div>
            ) : (
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filial</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
              </div>
            ) : (
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione uma filial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
