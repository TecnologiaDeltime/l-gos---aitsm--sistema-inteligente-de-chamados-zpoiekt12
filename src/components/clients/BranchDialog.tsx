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
import { Loader2 } from 'lucide-react'
import {
  createCompanyUnit,
  updateCompanyUnit,
  type CompanyUnitRecord,
} from '@/services/company-units'
import { createCompanyAuditLog } from '@/services/companies'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  branch?: CompanyUnitRecord | null
  onSaved: () => void
}

const EMPTY: Record<string, string> = {
  name: '',
  address_street: '',
  address_number: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zipcode: '',
  phone: '',
  manager_name: '',
}

export function BranchDialog({ open, onOpenChange, clientId, branch, onSaved }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState<Record<string, string>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        branch
          ? {
              name: branch.name || '',
              address_street: branch.address_street || '',
              address_number: branch.address_number || '',
              address_neighborhood: branch.address_neighborhood || '',
              address_city: branch.address_city || '',
              address_state: branch.address_state || '',
              address_zipcode: branch.address_zipcode || '',
              phone: branch.phone || '',
              manager_name: branch.manager_name || '',
            }
          : { ...EMPTY },
      )
    }
  }, [open, branch])

  const set = (k: string, v: string) => {
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
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSaving(true)
    setErrors({})
    try {
      const payload = { ...form, company: clientId }
      if (branch) {
        await updateCompanyUnit(branch.id, payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'updated branch',
            entity_type: 'company_units',
            entity_id: branch.id,
            description: `Filial "${form.name}" atualizada`,
            old_values: branch as Record<string, unknown>,
            new_values: payload as Record<string, unknown>,
          })
      } else {
        const created = await createCompanyUnit(payload)
        if (user?.id)
          await createCompanyAuditLog({
            user: user.id,
            action: 'created branch',
            entity_type: 'company_units',
            entity_id: created.id,
            description: `Filial "${form.name}" criada`,
            new_values: payload as Record<string, unknown>,
          })
      }
      toast({ title: branch ? 'Filial atualizada!' : 'Filial adicionada!' })
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar filial', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const cls = 'h-9 text-sm'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{branch ? 'Editar Filial' : 'Adicionar Filial'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              className={cls}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input
                className={cls}
                value={form.address_street}
                onChange={(e) => set('address_street', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número</Label>
              <Input
                className={cls}
                value={form.address_number}
                onChange={(e) => set('address_number', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input
                className={cls}
                value={form.address_neighborhood}
                onChange={(e) => set('address_neighborhood', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input
                className={cls}
                value={form.address_zipcode}
                onChange={(e) => set('address_zipcode', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input
                className={cls}
                value={form.address_city}
                onChange={(e) => set('address_city', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Input
                className={cls}
                value={form.address_state}
                onChange={(e) => set('address_state', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input
                className={cls}
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gerente</Label>
              <Input
                className={cls}
                value={form.manager_name}
                onChange={(e) => set('manager_name', e.target.value)}
              />
            </div>
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
