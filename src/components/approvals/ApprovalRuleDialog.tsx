import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/MultiSelect'
import { CategoryRecord, getCategories } from '@/services/categories'
import { CompanyRecord, getCompanies } from '@/services/companies'
import {
  ApprovalConfigRecord,
  createApprovalConfig,
  updateApprovalConfig,
} from '@/services/approval-configs'
import { useToast } from '@/hooks/use-toast'

export function ApprovalRuleDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ApprovalConfigRecord | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [activity, setActivity] = useState('')
  const [clients, setClients] = useState<string[]>([])
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      getCategories()
        .then((cats) => setCategories(cats.filter((c) => c.active !== false)))
        .catch(() => {})
      getCompanies()
        .then(setCompanies)
        .catch(() => {})
      setActivity(editing?.activity || '')
      setClients(editing?.clients || [])
      setActive(editing?.active ?? true)
    }
  }, [open, editing])

  const companyOptions = companies.map((c) => ({
    value: c.id,
    label: c.trade_name || c.legal_name,
  }))

  const handleSave = async () => {
    if (clients.length === 0) {
      toast({ title: 'Selecione ao menos um cliente', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = { activity: activity || null, clients, active }
      if (editing) {
        await updateApprovalConfig(editing.id, data)
        toast({ title: 'Regra atualizada!' })
      } else {
        await createApprovalConfig(data)
        toast({ title: 'Regra criada!' })
      }
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Regra' : 'Nova Regra de Aprovação'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Atividade</Label>
            <Select
              value={activity || '__all__'}
              onValueChange={(v) => setActivity(v === '__all__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma atividade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as atividades</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Clientes *</Label>
            <MultiSelect
              options={companyOptions}
              value={clients}
              onChange={setClients}
              placeholder="Selecionar clientes"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active-rule" />
            <Label htmlFor="active-rule" className="text-xs cursor-pointer">
              Ativo
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
