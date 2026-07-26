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
import { CategoryRecord, createCategory, updateCategory } from '@/services/categories'
import { computePriority, IMPACT_VALUES, URGENCY_VALUES } from '@/lib/itil-matrix'
import { PriorityBadge } from '@/components/PriorityBadge'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

function getDescendantIds(id: string, all: CategoryRecord[]): Set<string> {
  const desc = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()!
    all
      .filter((c) => c.parent === cur)
      .forEach((c) => {
        if (!desc.has(c.id)) {
          desc.add(c.id)
          queue.push(c.id)
        }
      })
  }
  return desc
}

interface CategoryEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingCategory?: CategoryRecord | null
  allCategories: CategoryRecord[]
  presetParent?: string
}

export function CategoryEditDialog({
  open,
  onOpenChange,
  onSaved,
  editingCategory,
  allCategories,
  presetParent,
}: CategoryEditDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parent, setParent] = useState('')
  const [impact, setImpact] = useState('')
  const [urgency, setUrgency] = useState('')
  const [slaResponse, setSlaResponse] = useState('')
  const [slaSolution, setSlaSolution] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const excludedIds = useMemo(() => {
    if (!editingCategory) return new Set<string>()
    const d = getDescendantIds(editingCategory.id, allCategories)
    d.add(editingCategory.id)
    return d
  }, [editingCategory, allCategories])

  const availableParents = useMemo(
    () => allCategories.filter((c) => !excludedIds.has(c.id)),
    [allCategories, excludedIds],
  )

  const isParentLocked = !!presetParent && !editingCategory
  const isSub = !!parent
  const computedPriority = isSub ? computePriority(impact, urgency) : ''

  useEffect(() => {
    if (open) {
      setName(editingCategory?.name || '')
      setDescription(editingCategory?.description || '')
      setParent(editingCategory?.parent || presetParent || '')
      setImpact(editingCategory?.impact || '')
      setUrgency(editingCategory?.urgency || '')
      setSlaResponse(
        editingCategory?.sla_response_minutes ? String(editingCategory.sla_response_minutes) : '',
      )
      setSlaSolution(
        editingCategory?.sla_solution_minutes ? String(editingCategory.sla_solution_minutes) : '',
      )
      setActive(editingCategory?.active ?? true)
      setFieldErrors({})
    }
  }, [open, editingCategory, presetParent])

  const handleSave = async () => {
    setFieldErrors({})
    const errors: FieldErrors = {}
    if (!name.trim()) errors.name = 'Nome é obrigatório'
    if (isSub) {
      if (!impact) errors.impact = 'Impacto é obrigatório para subcategorias'
      if (!urgency) errors.urgency = 'Urgência é obrigatória para subcategorias'
      const resp = parseInt(slaResponse, 10)
      const sol = parseInt(slaSolution, 10)
      if (!resp || resp < 1) errors.sla_response_minutes = 'Deve ser um inteiro positivo'
      if (!sol || sol < 1) errors.sla_solution_minutes = 'Deve ser um inteiro positivo'
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }
    setSaving(true)
    try {
      const data: Partial<CategoryRecord> = {
        name: name.trim(),
        description,
        parent: parent || undefined,
        active,
        ...(isSub
          ? {
              impact,
              urgency,
              priority: computedPriority,
              sla_response_minutes: parseInt(slaResponse, 10),
              sla_solution_minutes: parseInt(slaSolution, 10),
            }
          : {}),
      }
      if (editingCategory) {
        await updateCategory(editingCategory.id, data)
        toast({ title: 'Categoria atualizada com sucesso!' })
      } else {
        await createCategory(data)
        toast({ title: 'Categoria criada com sucesso!' })
      }
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length) setFieldErrors(fe)
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Infraestrutura"
            />
            {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria Pai</Label>
            <Select value={parent} onValueChange={setParent} disabled={isParentLocked}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Nenhuma (categoria principal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma (categoria principal)</SelectItem>
                {availableParents.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isSub && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Impacto *</Label>
                  <Select value={impact} onValueChange={setImpact}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPACT_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.impact && (
                    <p className="text-xs text-red-500">{fieldErrors.impact}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Urgência *</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.urgency && (
                    <p className="text-xs text-red-500">{fieldErrors.urgency}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Prioridade:</Label>
                {computedPriority ? (
                  <PriorityBadge priority={computedPriority} />
                ) : (
                  <span className="text-xs text-slate-400">Selecione impacto e urgência</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">SLA Resposta (min) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slaResponse}
                    onChange={(e) => setSlaResponse(e.target.value)}
                    placeholder="30"
                  />
                  {fieldErrors.sla_response_minutes && (
                    <p className="text-xs text-red-500">{fieldErrors.sla_response_minutes}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SLA Solução (min) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slaSolution}
                    onChange={(e) => setSlaSolution(e.target.value)}
                    placeholder="240"
                  />
                  {fieldErrors.sla_solution_minutes && (
                    <p className="text-xs text-red-500">{fieldErrors.sla_solution_minutes}</p>
                  )}
                </div>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} id="cat-active" />
            <Label htmlFor="cat-active" className="text-xs cursor-pointer">
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
