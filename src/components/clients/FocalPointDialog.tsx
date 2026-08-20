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
import {
  createClientContact,
  updateClientContact,
  type ClientContactRecord,
  type FocalPointData,
} from '@/services/client-contacts'
import { type CompanyUnitRecord } from '@/services/company-units'
import { createCompanyAuditLog } from '@/services/companies'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId?: string
  branches?: CompanyUnitRecord[]
  contact?: ClientContactRecord | null
  pendingFocalPoints?: FocalPointData[]
  onPendingFocalPointsChange?: (points: FocalPointData[]) => void
  editPendingIdx?: number | null
  onSaved?: () => void
}

const EMPTY: FocalPointData = {
  full_name: '',
  email: '',
  phone: '',
  cell_phone: '',
  has_whatsapp: false,
  user: '',
  unit: '',
  is_focal_point: true,
  client: '',
}

export function FocalPointDialog({
  open,
  onOpenChange,
  clientId,
  branches = [],
  contact,
  pendingFocalPoints = [],
  onPendingFocalPointsChange,
  editPendingIdx = null,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState<FocalPointData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (contact) {
      setForm({
        full_name: contact.full_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        cell_phone: contact.cell_phone || '',
        has_whatsapp: contact.has_whatsapp || false,
        user: contact.user || '',
        unit: contact.unit || '',
        is_focal_point: contact.is_focal_point ?? true,
        client: clientId || '',
      })
    } else if (editPendingIdx !== null && pendingFocalPoints[editPendingIdx]) {
      const fp = pendingFocalPoints[editPendingIdx]
      setForm({
        full_name: fp.full_name || '',
        email: fp.email || '',
        phone: fp.phone || '',
        cell_phone: fp.cell_phone || '',
        has_whatsapp: fp.has_whatsapp || false,
        user: fp.user || '',
        unit: fp.unit || '',
        is_focal_point: fp.is_focal_point ?? true,
        client: clientId || '',
      })
    } else {
      setForm({ ...EMPTY, client: clientId || '' })
    }
  }, [open, contact, clientId, editPendingIdx, pendingFocalPoints])

  const set = (k: string, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k])
      setErrors((p) => {
        const n = { ...p }
        delete n[k]
        return n
      })
  }

  const handleSubmit = async () => {
    const errs: FieldErrors = {}
    if (!form.full_name?.trim()) errs.full_name = 'Nome completo é obrigatório'
    if (!form.email?.trim()) errs.email = 'E-mail é obrigatório'
    if (form.has_whatsapp && !form.cell_phone?.trim())
      errs.cell_phone = 'Celular é obrigatório quando WhatsApp está marcado'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    if (!clientId) {
      if (!onPendingFocalPointsChange) return
      const point: FocalPointData = {
        ...form,
        is_focal_point: true,
        unit: form.unit || undefined,
      }
      if (editPendingIdx !== null) {
        const next = [...pendingFocalPoints]
        next[editPendingIdx] = point
        onPendingFocalPointsChange(next)
      } else {
        onPendingFocalPointsChange([...pendingFocalPoints, point])
      }
      toast({ title: 'Ponto focal salvo com sucesso!' })
      onOpenChange(false)
      return
    }

    setSaving(true)
    setErrors({})
    try {
      const payload = {
        ...form,
        client: clientId,
        is_focal_point: true,
        unit: form.unit || undefined,
        user: form.user || undefined,
      }

      if (contact) {
        await updateClientContact(contact.id, payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'updated focal point',
            entity_type: 'client_contacts',
            entity_id: contact.id,
            description: `Ponto focal "${form.full_name}" atualizado`,
            old_values: contact as unknown as Record<string, unknown>,
            new_values: payload as unknown as Record<string, unknown>,
          })
      } else {
        const created = await createClientContact(payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'created focal point',
            entity_type: 'client_contacts',
            entity_id: created.id,
            description: `Ponto focal "${form.full_name}" criado`,
            new_values: payload as unknown as Record<string, unknown>,
          })
      }
      toast({ title: contact ? 'Ponto focal atualizado!' : 'Ponto focal adicionado!' })
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar ponto focal', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? 'Editar Ponto Focal' : 'Adicionar Ponto Focal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome Completo *</Label>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
            {errors.full_name && <p className="text-xs text-red-500">{errors.full_name}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail *</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Celular</Label>
              <Input
                value={form.cell_phone || ''}
                onChange={(e) => set('cell_phone', e.target.value)}
              />
              {errors.cell_phone && <p className="text-xs text-red-500">{errors.cell_phone}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.has_whatsapp || false}
              onCheckedChange={(v) => set('has_whatsapp', v === true)}
            />
            <Label className="text-xs">Possui WhatsApp</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Filial</Label>
            <Select
              value={form.unit || 'none'}
              onValueChange={(v) => set('unit', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione uma filial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem filial / Usar endereço do cliente</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
