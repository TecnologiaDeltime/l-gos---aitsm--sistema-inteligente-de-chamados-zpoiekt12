import { FolderKanban, AlertTriangle, Clock, Plus, Ticket, User, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_LEAN_STAGES, updateProjectTask } from '@/services/projects'
import type { ProjectRecord, ProjectTaskRecord, LeanStageConfig } from '@/types/projects'

interface LeanViewProps {
  project: ProjectRecord
  tasks: ProjectTaskRecord[]
  onNewTask: (leanStage?: string) => void
  onEditTask: (task: ProjectTaskRecord) => void
  onGenerateTicket: (task: ProjectTaskRecord) => void
  onLogTime: (task: ProjectTaskRecord) => void
  onReload: () => void
}

export function ProjectLeanView({
  project,
  tasks,
  onNewTask,
  onEditTask,
  onGenerateTicket,
  onLogTime,
  onReload,
}: LeanViewProps) {
  const stages: LeanStageConfig[] =
    project.methodology_settings?.lean_stages && project.methodology_settings.lean_stages.length > 0
      ? project.methodology_settings.lean_stages
      : DEFAULT_LEAN_STAGES

  // Detecção de desperdício básico: atividade criada ou atualizada há mais de 7 dias sem conclusão
  const isStaleTask = (task: ProjectTaskRecord) => {
    if (task.status === 'done' || task.lean_stage === 'done') return false
    const dateRef = new Date(task.updated || task.created)
    const now = new Date()
    const diffDays = (now.getTime() - dateRef.getTime()) / (1000 * 3600 * 24)
    return diffDays >= 7
  }

  const handleMoveStage = async (task: ProjectTaskRecord, nextStageId: string) => {
    try {
      await updateProjectTask(task.id, {
        lean_stage: nextStageId,
        status: nextStageId === 'done' ? 'done' : 'in_progress',
      })
      onReload()
    } catch (err) {
      console.error('Erro ao mover etapa lean:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Explicativo Lean & Limite WIP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>
            <strong>Fluxo Contínuo Lean:</strong> Puxe o trabalho conforme a capacidade. Evite
            gargalos respeitando o limite de WIP (Work in Progress).
          </span>
        </div>

        <Button
          size="sm"
          className="text-xs bg-amber-500 hover:bg-amber-600 text-white shrink-0 gap-1.5"
          onClick={() => onNewTask()}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Atividade no Fluxo
        </Button>
      </div>

      {/* Colunas Kanban com Limite de WIP */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stages.map((stage, idx) => {
          const stageTasks = tasks.filter((t) => (t.lean_stage || 'todo') === stage.id)
          const isWipExceeded =
            stage.wip_limit && stage.wip_limit > 0 && stageTasks.length > stage.wip_limit

          const nextStage = stages[idx + 1]

          return (
            <div
              key={stage.id}
              className={`rounded-lg p-3 border flex flex-col min-h-[460px] ${
                isWipExceeded
                  ? 'bg-rose-50/40 border-rose-300 dark:bg-rose-950/20 dark:border-rose-800'
                  : 'bg-muted/30 border-border/50'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {stage.label}
                  </span>
                  {isWipExceeded && <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />}
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={isWipExceeded ? 'destructive' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {stageTasks.length}
                    {stage.wip_limit ? ` / ${stage.wip_limit}` : ''}
                  </Badge>
                </div>
              </div>

              {isWipExceeded && (
                <div className="mb-2 p-1.5 bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 rounded text-[10px] flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Violação de WIP! Reduza itens em execução.</span>
                </div>
              )}

              <div className="space-y-2 flex-1 overflow-y-auto">
                {stageTasks.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-8">
                    Nenhum item nesta etapa
                  </div>
                ) : (
                  stageTasks.map((task) => {
                    const stale = isStaleTask(task)

                    return (
                      <Card
                        key={task.id}
                        className={`border hover:shadow-sm transition-shadow text-xs ${
                          stale
                            ? 'border-amber-400 bg-amber-50/20 dark:border-amber-700'
                            : 'border-border/60'
                        }`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-1">
                            <span
                              onClick={() => onEditTask(task)}
                              className="font-medium hover:text-amber-500 cursor-pointer line-clamp-2"
                            >
                              {task.title}
                            </span>
                            {stale && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 px-1 py-0 shrink-0"
                              >
                                Parado &gt; 7d
                              </Badge>
                            )}
                          </div>

                          {task.expand?.assigned_to && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">
                                {task.expand.assigned_to.name || task.expand.assigned_to.email}
                              </span>
                            </div>
                          )}

                          {task.expand?.ticket && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                              <Ticket className="h-3 w-3" />
                              <span>
                                Chamado #
                                {task.expand.ticket.ticket_number || task.ticket?.slice(0, 6)}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-border/30">
                            {!task.ticket && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-1 text-amber-600 hover:text-amber-700"
                                onClick={() => onGenerateTicket(task)}
                              >
                                <Ticket className="h-2.5 w-2.5 mr-1" />
                                Chamado
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-1"
                              onClick={() => onLogTime(task)}
                            >
                              <Clock className="h-2.5 w-2.5 mr-1" />
                              Horas
                            </Button>

                            {nextStage && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-1.5 ml-auto"
                                onClick={() => handleMoveStage(task, nextStage.id)}
                              >
                                Avançar &rarr;
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
