import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  createProjectTask,
  updateProjectTask,
  WATERFALL_PHASES,
  DEFAULT_LEAN_STAGES,
} from '@/services/projects'
import type {
  ProjectRecord,
  ProjectTaskRecord,
  ProjectSprintRecord,
  TaskStatus,
  TaskPriority,
  WaterfallPhase,
} from '@/types/projects'

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRecord
  sprints: ProjectSprintRecord[]
  operators: any[]
  taskToEdit?: ProjectTaskRecord | null
  onSaved: () => void
}

export function ProjectTaskDialog({
  open,
  onOpenChange,
  project,
  sprints,
  operators,
  taskToEdit,
  onSaved,
}: TaskDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('none')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [waterfallPhase, setWaterfallPhase] = useState<WaterfallPhase>('planning')
  const [isMilestone, setIsMilestone] = useState(false)
  const [sprintId, setSprintId] = useState('none')
  const [storyPoints, setStoryPoints] = useState('')
  const [leanStage, setLeanStage] = useState('todo')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title)
      setDescription(taskToEdit.description || '')
      setAssignedTo(taskToEdit.assigned_to || 'none')
      setStatus(taskToEdit.status)
      setPriority(taskToEdit.priority || 'medium')
      setWaterfallPhase(taskToEdit.waterfall_phase || 'planning')
      setIsMilestone(!!taskToEdit.is_milestone)
      setSprintId(taskToEdit.sprint || 'none')
      setStoryPoints(taskToEdit.story_points ? String(taskToEdit.story_points) : '')
      setLeanStage(taskToEdit.lean_stage || 'todo')
      setDueDate(taskToEdit.due_date ? taskToEdit.due_date.split('T')[0] : '')
    } else {
      setTitle('')
      setDescription('')
      setAssignedTo('none')
      setStatus('todo')
      setPriority('medium')
      setWaterfallPhase('planning')
      setIsMilestone(false)
      setSprintId('none')
      setStoryPoints('')
      setLeanStage('todo')
      setDueDate('')
    }
  }, [taskToEdit, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o título da atividade.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const payload: Partial<ProjectTaskRecord> = {
        project: project.id,
        title: title.trim(),
        description: description.trim() || undefined,
        assigned_to: assignedTo !== 'none' ? assignedTo : undefined,
        status,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      }

      if (project.methodology === 'waterfall') {
        payload.waterfall_phase = waterfallPhase
        payload.is_milestone = isMilestone
      } else if (project.methodology === 'scrum') {
        payload.sprint = sprintId !== 'none' ? sprintId : undefined
        payload.story_points = storyPoints ? parseInt(storyPoints, 10) : undefined
      } else if (project.methodology === 'lean') {
        payload.lean_stage = leanStage
      }

      if (taskToEdit) {
        await updateProjectTask(taskToEdit.id, payload)
        toast({ title: 'Atividade atualizada com sucesso!' })
      } else {
        await createProjectTask(payload)
        toast({ title: 'Atividade criada com sucesso!' })
      }

      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao salvar atividade:', err)
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar atividade.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const leanStages =
    project.methodology_settings?.lean_stages && project.methodology_settings.lean_stages.length > 0
      ? project.methodology_settings.lean_stages
      : DEFAULT_LEAN_STAGES

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{taskToEdit ? 'Editar Atividade' : 'Nova Atividade do Projeto'}</DialogTitle>
          <DialogDescription className="text-xs">
            Atividade vinculada a {project.name}. Pode ser delegada a operador e gerar chamados com
            horas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs">
              Título da Atividade <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Ex: Configurar regras de firewall, Validar homologação..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Delegar para Operador</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o operador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não atribuído (Backlog)</SelectItem>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name || op.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={priority} onValueChange={(val: TaskPriority) => setPriority(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status Geral</Label>
              <Select value={status} onValueChange={(val: TaskStatus) => setStatus(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">A Fazer (To Do)</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="review">Em Validação / Review</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Prazo Estimado</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Campos específicos Cascata */}
          {project.methodology === 'waterfall' && (
            <div className="p-3 bg-muted/40 rounded-lg space-y-3 border border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fase do Projeto (Cascata)</Label>
                <Select
                  value={waterfallPhase}
                  onValueChange={(val: WaterfallPhase) => setWaterfallPhase(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fase" />
                  </SelectTrigger>
                  <SelectContent>
                    {WATERFALL_PHASES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.order}. {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <Label className="text-xs font-medium cursor-pointer">
                    É um Marco / Deliverable Crítico?
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Marcos sinalizam encerramento de fase ou entrega formal.
                  </p>
                </div>
                <Switch checked={isMilestone} onCheckedChange={setIsMilestone} />
              </div>
            </div>
          )}

          {/* Campos específicos Scrum */}
          {project.methodology === 'scrum' && (
            <div className="p-3 bg-muted/40 rounded-lg space-y-3 border border-border/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sprint</Label>
                  <Select value={sprintId} onValueChange={setSprintId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Product Backlog (Sem sprint)</SelectItem>
                      {sprints.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Story Points / Estimativa</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Ex: 1, 2, 3, 5, 8..."
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Campos específicos Lean */}
          {project.methodology === 'lean' && (
            <div className="p-3 bg-muted/40 rounded-lg space-y-3 border border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Etapa de Fluxo Lean</Label>
                <Select value={leanStage} onValueChange={setLeanStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Etapa Lean" />
                  </SelectTrigger>
                  <SelectContent>
                    {leanStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.label} {stage.wip_limit ? `(WIP: ${stage.wip_limit})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-desc" className="text-xs">
              Detalhamento / Critérios de Aceite
            </Label>
            <Textarea
              id="task-desc"
              placeholder="Instruções, escopo e requisitos para execução desta atividade..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {loading ? 'Salvando...' : taskToEdit ? 'Atualizar Atividade' : 'Criar Atividade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
