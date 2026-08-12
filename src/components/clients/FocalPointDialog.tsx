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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { getUsers, type UserItem } from '@/services/users'
import { type FocalPointData } from '@/services/client-contacts'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId?: string
  initialData?: Partial<FocalPointData> | null
  onSave: (data: FocalPointData) => void
  saving?: boolean
}

const EMPTY: FocalPointData = {
  full_name: '',
  email: '',
  phone: '',
  cell_phone: '',
  has_whatsapp: false,
  user: '',
}

export function FocalPointDialog({
  open,
  onOpenChange,
  clientId,
  initialData,
  onSave,
  saving,
}: Props) {
  const [form, setForm] = useState<FocalPointData>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<UserItem[]>([])

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(initialData ? { ...EMPTY, ...initialData } : EMPTY)
      if (clientId) {
        getUsers(`company = "${clientId}"`)
          .then(setUsers)
          .catch(() => setUsers([]))
      }
    }
  }, [open, initialData, clientId])

  const set = (k: string, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k])
      setErrors((p) => {
        const n = { ...p }
        delete n[k]
        return n
      })
  }

  const handleUserSelect = (userId: string) => {
    if (userId === 'none') {
      set('user', '')
      return
    }
    const u = users.find((x) => x.id === userId)
    if (u) {
      setForm({
        full_name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        cell_phone: '',
        has_whatsapp: false,
        user: userId,
      })
    }
  }

  const handleSubmit = () => {
    const errs: Record<string, string> = {}
    if (!form.full_name.trim()) errs.full_name = 'Nome completo é obrigatório'
    if (!form.email.trim() && !form.phone.trim())
      errs.email = 'Informe pelo menos um método de contato'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Ponto Focal' : 'Adicionar Ponto Focal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {clientId && users.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Vincular a Colaborador</Label>
              <Select value={form.user || 'none'} onValueChange={handleUserSelect}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Digitar manualmente —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Nome Completo *</Label>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
            {errors.full_name && <p className="text-xs text-red-500">{errors.full_name}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Celular</Label>
              <Input value={form.cell_phone} onChange={(e) => set('cell_phone', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.has_whatsapp}
              onCheckedChange={(v) => set('has_whatsapp', v === true)}
            />
            <Label className="text-xs">Possui WhatsApp</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
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
