import { useState, useEffect, useMemo } from 'react'
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
} from '@/services/client-contacts'
import { type CompanyUnitRecord } from '@/services/company-units'
import { createCompanyAuditLog } from '@/services/companies'
import { buildSectorTree, flattenSectorTree, getSectorIndent } from '@/lib/sector-hierarchy'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface Department {
  id: string
  name: string
  parent?: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  departments: Department[]
  branches?: CompanyUnitRecord[]
  contact?: ClientContactRecord | null
  onSaved: () => void
}

const EMPTY = {
  full_name: '',
  email: '',
  phone: '',
  cell_phone: '',
  has_whatsapp: false,
  departments: [] as string[],
  unit: '' as string,
  is_focal_point: false,
}

export function CollaboratorDialog({
  open,
  onOpenChange,
  clientId,
  departments,
  branches = [],
  contact,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      if (contact) {
        setForm({
          full_name: contact.full_name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          cell_phone: contact.cell_phone || '',
          has_whatsapp: contact.has_whatsapp || false,
          departments: contact.departments || [],
          unit: contact.unit || '',
          is_focal_point: contact.is_focal_point || false,
        })
      } else {
        setForm(EMPTY)
      }
    }
  }, [open, contact])

  const flatDepartments = useMemo(
    () => flattenSectorTree(buildSectorTree(departments)),
    [departments],
  )

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
    if (!form.full_name.trim()) errs.full_name = 'Nome completo é obrigatório'
    if (!form.email.trim()) errs.email = 'E-mail é obrigatório'
    if (form.departments.length === 0) errs.departments = 'Selecione um setor'
    if (form.has_whatsapp && !form.cell_phone.trim())
      errs.cell_phone = 'Celular é obrigatório quando WhatsApp está marcado'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSaving(true)
    setErrors({})
    try {
      const payload = {
        ...form,
        client: clientId,
        unit: form.unit || undefined,
      }

      if (contact) {
        await updateClientContact(contact.id, payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'updated collaborator',
            entity_type: 'client_contacts',
            entity_id: contact.id,
            description: `Colaborador "${form.full_name}" atualizado`,
            old_values: contact as Record<string, unknown>,
            new_values: payload as Record<string, unknown>,
          })
      } else {
        const created = await createClientContact(payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'created collaborator',
            entity_type: 'client_contacts',
            entity_id: created.id,
            description: `Colaborador "${form.full_name}" criado`,
            new_values: payload as Record<string, unknown>,
          })
      }
      toast({ title: contact ? 'Colaborador atualizado!' : 'Colaborador adicionado!' })
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar colaborador', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? 'Editar Colaborador' : 'Adicionar Colaborador'}</DialogTitle>
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
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Celular</Label>
              <Input value={form.cell_phone} onChange={(e) => set('cell_phone', e.target.value)} />
              {errors.cell_phone && <p className="text-xs text-red-500">{errors.cell_phone}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.has_whatsapp}
              onCheckedChange={(v) => set('has_whatsapp', v === true)}
            />
            <Label className="text-xs">Possui WhatsApp</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.is_focal_point}
              onCheckedChange={(v) => set('is_focal_point', v === true)}
            />
            <Label className="text-xs">É Ponto Focal</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Setor *</Label>
            {departments.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum setor cadastrado para este cliente.</p>
            ) : (
              <Select
                value={form.departments[0] || 'none'}
                onValueChange={(v) => set('departments', v === 'none' ? [] : [v])}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {flatDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {getSectorIndent(d.level)}
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.departments && <p className="text-xs text-red-500">{errors.departments}</p>}
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
