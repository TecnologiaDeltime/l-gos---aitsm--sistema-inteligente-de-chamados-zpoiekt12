import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, FileText } from 'lucide-react'
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
  getChangeTemplates,
  createChangeTemplate,
  updateChangeTemplate,
  deleteChangeTemplate,
  type ChangeTemplateRecord,
} from '@/services/change-templates'
import { getChangeTypes, type ChangeTypeRecord } from '@/services/change-types'
import {
  CHANGE_PRIORITIES,
  CHANGE_IMPACTS,
  CHANGE_URGENCIES,
  RISK_LEVELS,
} from '@/lib/change-constants'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function ChangeTemplates() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ChangeTemplateRecord[]>([])
  const [types, setTypes] = useState<ChangeTypeRecord[]>([])
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ChangeTemplateRecord | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    name: '',
    change_type: '',
    description: '',
    procedure: '',
    rollback_procedure: '',
    validation_criteria: '',
    default_priority: 'Média',
    default_impact: 'Baixo',
    default_urgency: 'Média',
    default_risk_level: 'Baixo',
    active: true,
  })

  const loadData = () => {
    getChangeTemplates()
      .then(setTemplates)
      .catch(() => {})
    getChangeTypes()
      .then(setTypes)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('change_templates', () => loadData())

  const openNew = () => {
    setEditTarget(null)
    setForm({
      name: '',
      change_type: '',
      description: '',
      procedure: '',
      rollback_procedure: '',
      validation_criteria: '',
      default_priority: 'Média',
      default_impact: 'Baixo',
      default_urgency: 'Média',
      default_risk_level: 'Baixo',
      active: true,
    })
    setErrors({})
    setOpen(true)
  }
  const openEdit = (t: ChangeTemplateRecord) => {
    setEditTarget(t)
    setForm({
      name: t.name,
      change_type: t.change_type || '',
      description: t.description || '',
      procedure: t.procedure || '',
      rollback_procedure: t.rollback_procedure || '',
      validation_criteria: t.validation_criteria || '',
      default_priority: t.default_priority || 'Média',
      default_impact: t.default_impact || 'Baixo',
      default_urgency: t.default_urgency || 'Média',
      default_risk_level: t.default_risk_level || 'Baixo',
      active: t.active ?? true,
    })
    setErrors({})
    setOpen(true)
  }

  const handleSave = async () => {
    setErrors({})
    try {
      if (editTarget) {
        await updateChangeTemplate(editTarget.id, form)
        toast({ title: 'Item do catálogo atualizado!' })
      } else {
        await createChangeTemplate(form)
        toast({ title: 'Item do catálogo criado!' })
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
          <FileText className="h-5 w-5" /> Catálogo de Mudança Padrão
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo Item do Catálogo
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{t.name}</h3>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    deleteChangeTemplate(t.id)
                    loadData()
                    toast({ title: 'Item do catálogo removido' })
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t.description || 'Sem descrição'}</p>
            <div className="flex flex-wrap gap-1">
              {t.expand?.change_type && (
                <Badge variant="outline" className="text-[10px]">
                  {t.expand.change_type.name}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                P: {t.default_priority}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                R: {t.default_risk_level}
              </Badge>
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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar Item do Catálogo' : 'Novo Item do Catálogo'}
            </DialogTitle>
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
              <Label className="text-xs">Tipo de Mudança</Label>
              <Select
                value={form.change_type}
                onValueChange={(v) => setForm({ ...form, change_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label className="text-xs">Procedimento de Execução</Label>
              <Textarea
                value={form.procedure}
                onChange={(e) => setForm({ ...form, procedure: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label className="text-xs">Procedimento de Rollback</Label>
              <Textarea
                value={form.rollback_procedure}
                onChange={(e) => setForm({ ...form, rollback_procedure: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Critérios de Validação</Label>
              <Textarea
                value={form.validation_criteria}
                onChange={(e) => setForm({ ...form, validation_criteria: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={form.default_priority}
                  onValueChange={(v) => setForm({ ...form, default_priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGE_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Risco</Label>
                <Select
                  value={form.default_risk_level}
                  onValueChange={(v) => setForm({ ...form, default_risk_level: v })}
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
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-xs">Ativo</Label>
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
