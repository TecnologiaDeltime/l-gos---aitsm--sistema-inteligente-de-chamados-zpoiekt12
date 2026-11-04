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
import { formatMinutes, parseDurationToSeconds } from '@/lib/duration'

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
  const [type, setType] = useState<string>('Incidente')
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
      setType(editingCategory?.type || 'Incidente')
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
    const resp = slaResponse ? parseInt(slaResponse, 10) : undefined
    const sol = slaSolution ? parseInt(slaSolution, 10) : undefined

    if (isSub) {
      if (!impact || !urgency) {
        toast({
          title: 'Impacto e urgência são obrigatórios para subatividades',
          variant: 'destructive',
        })
        return
      }
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
        type: type || 'Incidente',
        ...(isSub
          ? {
              impact,
              urgency,
              priority: computedPriority,
              sla_response_minutes: resp,
              sla_solution_minutes: sol,
            }
          : {
              // Permite configurar SLA padrão também na categoria principal se desejado
              sla_response_minutes: resp,
              sla_solution_minutes: sol,
            }),
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
            <Label className="text-xs">Tipo do Chamado (Classificação) *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo do chamado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Incidente">Incidente (Falha / Indisponibilidade)</SelectItem>
                <SelectItem value="Requisição de Serviço">
                  Requisição de Serviço (Solicitação / Pedido)
                </SelectItem>
                <SelectItem value="Dúvida">Dúvida / Esclarecimento</SelectItem>
                <SelectItem value="Visita Técnica">Visita Técnica</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Define automaticamente se o chamado é Incidente, Requisição ou Dúvida ao selecionar
              esta atividade.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Atividade Principal Agrupadora</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (atividade principal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma (atividade principal)</SelectItem>{' '}
                {mainCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isSub ? (
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
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    SLA da Atividade (Precedência Máxima)
                  </span>
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                    1º na Precedência
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  A configuração de SLA definida na atividade tem prioridade sobre as regras do
                  Cliente e do Contrato.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">SLA Resposta (minutos) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={slaResponse}
                      onChange={(e) => setSlaResponse(e.target.value)}
                      placeholder="30"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Até Iniciar Atendimento
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SLA Solução (minutos) *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={slaSolution}
                      onChange={(e) => setSlaSolution(e.target.value)}
                      placeholder="240"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Até a Resolução do Chamado
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  SLA Padrão da Atividade Principal (opcional)
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  1º na Precedência
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pode ser herdado por atividades filhas que não definirem SLA específico. Tem
                precedência sobre o cliente.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">SLA Resposta (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slaResponse}
                    onChange={(e) => setSlaResponse(e.target.value)}
                    placeholder="Ex: 30"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SLA Solução (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slaSolution}
                    onChange={(e) => setSlaSolution(e.target.value)}
                    placeholder="Ex: 240"
                  />
                </div>
              </div>
            </div>
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
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
