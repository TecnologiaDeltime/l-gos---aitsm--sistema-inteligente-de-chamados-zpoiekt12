import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Tags, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getChangeTypes,
  createChangeType,
  updateChangeType,
  deleteChangeType,
  type ChangeTypeRecord,
} from '@/services/change-types'
import { RISK_LEVELS } from '@/lib/change-constants'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function ChangeTypes() {
  const { toast } = useToast()
  const [types, setTypes] = useState<ChangeTypeRecord[]>([])
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ChangeTypeRecord | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    risk_level: 'Baixo',
    approval_required: false,
    committee_approval: false,
    eligible_for_automation: false,
    is_standard: false,
    recurring: false,
    active: true,
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const loadData = () => {
    getChangeTypes()
      .then(setTypes)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('change_types', () => loadData())

  const openNew = () => {
    setEditTarget(null)
    setForm({
      name: '',
      description: '',
      risk_level: 'Baixo',
      approval_required: false,
      committee_approval: false,
      eligible_for_automation: false,
      is_standard: false,
      recurring: false,
      active: true,
    })
    setErrors({})
    setOpen(true)
  }
  const openEdit = (t: ChangeTypeRecord) => {
    setEditTarget(t)
    setForm({
      name: t.name,
      description: t.description || '',
      risk_level: t.risk_level || 'Baixo',
      approval_required: t.approval_required || false,
      committee_approval: t.committee_approval || false,
      eligible_for_automation: t.eligible_for_automation || false,
      is_standard: t.is_standard || false,
      recurring: t.recurring || false,
      active: t.active ?? true,
    })
    setErrors({})
    setOpen(true)
  }

  const handleSave = async () => {
    setErrors({})
    try {
      if (editTarget) {
        await updateChangeType(editTarget.id, form)
        toast({ title: 'Tipo atualizado!' })
      } else {
        await createChangeType(form)
        toast({ title: 'Tipo criado!' })
      }
      setOpen(false)
      loadData()
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Tags className="h-5 w-5" /> Tipos de Mudança
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo Tipo
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {types.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {t.is_standard && <ShieldCheck className="h-4 w-4 text-green-600" />}
                <h3 className="font-semibold text-sm">{t.name}</h3>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    deleteChangeType(t.id)
                    loadData()
                    toast({ title: 'Tipo removido' })
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t.description || 'Sem descrição'}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">
                Risco: {t.risk_level}
              </Badge>
              {t.is_standard && (
                <Badge className="bg-green-100 text-green-700 text-[10px]">Padrão</Badge>
              )}
              {t.approval_required && (
                <Badge variant="outline" className="text-[10px]">
                  Requer Aprovação
                </Badge>
              )}
              {t.committee_approval && (
                <Badge variant="outline" className="text-[10px]">
                  Comitê
                </Badge>
              )}
              {t.eligible_for_automation && (
                <Badge variant="outline" className="text-[10px]">
                  Automatizável
                </Badge>
              )}
              {t.recurring && (
                <Badge variant="outline" className="text-[10px]">
                  Recorrente
                </Badge>
              )}
              {!t.active && (
                <Badge variant="secondary" className="text-[10px]">
                  Inativo
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Tipo' : 'Novo Tipo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs">Nível de Risco</Label>
              <Select
                value={form.risk_level}
                onValueChange={(v) => setForm({ ...form, risk_level: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_standard}
                  onCheckedChange={(v) => setForm({ ...form, is_standard: v })}
                />
                <Label className="text-xs">Padrão (Pré-autorizada)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.approval_required}
                  onCheckedChange={(v) => setForm({ ...form, approval_required: v })}
                />
                <Label className="text-xs">Requer Aprovação</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.committee_approval}
                  onCheckedChange={(v) => setForm({ ...form, committee_approval: v })}
                />
                <Label className="text-xs">Aprovação do Comitê</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.eligible_for_automation}
                  onCheckedChange={(v) => setForm({ ...form, eligible_for_automation: v })}
                />
                <Label className="text-xs">Automatizável</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.recurring}
                  onCheckedChange={(v) => setForm({ ...form, recurring: v })}
                />
                <Label className="text-xs">Recorrente</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                <Label className="text-xs">Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
