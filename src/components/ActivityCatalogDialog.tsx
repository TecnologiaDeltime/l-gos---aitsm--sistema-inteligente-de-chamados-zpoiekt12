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
import { CategoryRecord, createCategory, updateCategory } from '@/services/categories'
import { computePriority, IMPACT_VALUES, URGENCY_VALUES } from '@/lib/itil-matrix'
import { PriorityBadge } from '@/components/PriorityBadge'
import { useToast } from '@/hooks/use-toast'

interface ActivityCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingCategory?: CategoryRecord | null
  mainCategories: CategoryRecord[]
  presetParent?: string
}

export function ActivityCatalogDialog({
  open,
  onOpenChange,
  onSaved,
  editingCategory,
  mainCategories,
  presetParent,
}: ActivityCatalogDialogProps) {
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
    }
  }, [open, editingCategory, presetParent])

  const isSub = !!parent
  const computedPriority = isSub ? computePriority(impact, urgency) : ''

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    if (isSub) {
      if (!impact || !urgency) {
        toast({
          title: 'Impacto e urgência são obrigatórios para subatividades',
          variant: 'destructive',
        })
        return
      }
      const resp = parseInt(slaResponse, 10)
      const sol = parseInt(slaSolution, 10)
      if (!resp || resp < 1) {
        toast({ title: 'SLA Resposta deve ser um inteiro positivo', variant: 'destructive' })
        return
      }
      if (!sol || sol < 1) {
        toast({ title: 'SLA Solução deve ser um inteiro positivo', variant: 'destructive' })
        return
      }
    }
    setSaving(true)
    try {
      const data: Partial<CategoryRecord> = {
        name,
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
        toast({ title: 'Atividade atualizada!' })
      } else {
        await createCategory(data)
        toast({ title: 'Atividade criada!' })
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
          <DialogTitle>{editingCategory ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Computador não liga"
            />
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
            <Label className="text-xs">Categoria Principal</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Nenhuma (categoria principal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma (categoria principal)</SelectItem>
                {mainCategories.map((c) => (
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
                </div>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} id="active-check" />
            <Label htmlFor="active-check" className="text-xs cursor-pointer">
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
