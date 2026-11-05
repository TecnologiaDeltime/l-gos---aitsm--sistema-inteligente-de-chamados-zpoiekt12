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
import { getQueues, QueueRecord } from '@/services/queues'
import { computePriority, IMPACT_VALUES, URGENCY_VALUES } from '@/lib/itil-matrix'
import { PriorityBadge } from '@/components/PriorityBadge'
import { useToast } from '@/hooks/use-toast'
import { formatMinutes, parseDurationToSeconds, validateHHMMSS } from '@/lib/duration'
import { DurationInput } from '@/components/ui/DurationInput'
import { Users } from 'lucide-react'

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
  const [queueId, setQueueId] = useState('')
  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [impact, setImpact] = useState('')
  const [urgency, setUrgency] = useState('')
  const [slaResponse, setSlaResponse] = useState('')
  const [slaSolution, setSlaSolution] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slaError, setSlaError] = useState('')

  useEffect(() => {
    getQueues()
      .then((qs) => setQueues(qs.filter((q) => q.active !== false)))
      .catch((e) => console.warn('Erro ao carregar filas de atendimento:', e))
  }, [])

  useEffect(() => {
    if (open) {
      setName(editingCategory?.name || '')
      setDescription(editingCategory?.description || '')
      setParent(editingCategory?.parent || presetParent || '')
      setType(editingCategory?.type || 'Incidente')
      setQueueId(editingCategory?.queue || '')
      setImpact(editingCategory?.impact || '')
      setUrgency(editingCategory?.urgency || '')
      setSlaResponse(
        editingCategory?.sla_response_minutes
          ? formatMinutes(editingCategory.sla_response_minutes)
          : '',
      )
      setSlaSolution(
        editingCategory?.sla_solution_minutes
          ? formatMinutes(editingCategory.sla_solution_minutes)
          : '',
      )
      setActive(editingCategory?.active ?? true)
      setSlaError('')
    }
  }, [open, editingCategory, presetParent])

  const isSub = !!parent
  const computedPriority = isSub ? computePriority(impact, urgency) : ''

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    const respSeconds = slaResponse ? parseDurationToSeconds(slaResponse) : null
    const solSeconds = slaSolution ? parseDurationToSeconds(slaSolution) : null
    // Banco persiste minutos (sla_response_minutes / sla_solution_minutes)
    const resp = respSeconds !== null ? Math.round(respSeconds / 60) : undefined
    const sol = solSeconds !== null ? Math.round(solSeconds / 60) : undefined

    if (isSub) {
      if (slaResponse && respSeconds === null) {
        setSlaError('SLA Resposta inválida. Use o formato 00:00:00.')
        return
      }
      if (slaSolution && solSeconds === null) {
        setSlaError('SLA Solução inválida. Use o formato 00:00:00.')
        return
      }
      const slaValidationError =
        validateHHMMSS(slaResponse, true) || validateHHMMSS(slaSolution, true)
      if (slaValidationError) {
        setSlaError(slaValidationError)
        toast({ title: slaValidationError, variant: 'destructive' })
        return
      }
      setSlaError('')

      if (!impact || !urgency) {
        toast({
          title: 'Impacto e urgência são obrigatórios para subatividades',
          variant: 'destructive',
        })
        return
      }
      if (!respSeconds || respSeconds < 60) {
        toast({
          title: 'SLA Resposta deve ser maior que 00:00:00',
          variant: 'destructive',
        })
        return
      }
      if (!solSeconds || solSeconds < 60) {
        toast({
          title: 'SLA Solução deve ser maior que 00:00:00',
          variant: 'destructive',
        })
        return
      }
    } else {
      setSlaError('')
    }
    setSaving(true)
    try {
      const data: Partial<CategoryRecord> = {
        name,
        description,
        parent: parent || undefined,
        active,
        queue: queueId || undefined,
        ...(isSub
          ? {
              type: type || 'Incidente',
              impact,
              urgency,
              priority: computedPriority,
              sla_response_minutes: resp,
              sla_solution_minutes: sol,
            }
          : {
              // Atividade Principal: dispensa tipo, impacto, urgência e SLAs
              type: undefined,
              impact: undefined,
              urgency: undefined,
              priority: undefined,
              sla_response_minutes: undefined,
              sla_solution_minutes: undefined,
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
            <Label className="text-xs">Atividade Principal Agrupadora</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma (esta é uma Atividade Principal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma (esta é uma Atividade Principal)</SelectItem>{' '}
                {mainCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {isSub
                ? 'Subatividade vinculada à atividade principal selecionada. Exige tipo, impacto, urgência e SLAs.'
                : 'Atividade Principal agrupadora. Dispensa Tipo de Chamado, Impacto, Urgência e SLAs (definidos nas subatividades).'}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              Equipe Responsável (Fila de Atendimento)
            </Label>
            <Select
              value={queueId || 'none'}
              onValueChange={(val) => setQueueId(val === 'none' ? '' : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a equipe responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (selecionar na abertura)</SelectItem>
                {queues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name} {q.level ? `(${q.level})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Equipes cadastradas no módulo Gerenciamento de Filas. Na abertura do chamado, esta
              equipe será pré-selecionada automaticamente.
            </p>
          </div>

          {isSub && (
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
          )}

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
                    <Label className="text-xs">SLA Resposta *</Label>
                    <DurationInput
                      value={slaResponse}
                      onChange={setSlaResponse}
                      placeholder="00:30:00"
                      className="h-9 text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Até Iniciar Atendimento (00:00:00)
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SLA Solução *</Label>
                    <DurationInput
                      value={slaSolution}
                      onChange={setSlaSolution}
                      placeholder="04:00:00"
                      className="h-9 text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Até a Resolução do Chamado (00:00:00)
                    </span>
                  </div>
                </div>
                {slaError && <p className="text-[11px] text-red-500">{slaError}</p>}
              </div>
            </>
          ) : null}
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
