import { useState } from 'react'
import { Layers, CheckCircle2, Clock, AlertTriangle, Plus, Ticket, User, Flag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { WATERFALL_PHASES } from '@/services/projects'
import type { ProjectRecord, ProjectTaskRecord, WaterfallPhase } from '@/types/projects'

interface WaterfallViewProps {
  project: ProjectRecord
  tasks: ProjectTaskRecord[]
  onNewTask: (phase?: WaterfallPhase) => void
  onEditTask: (task: ProjectTaskRecord) => void
  onGenerateTicket: (task: ProjectTaskRecord) => void
  onLogTime: (task: ProjectTaskRecord) => void
}

export function ProjectWaterfallView({
  project,
  tasks,
  onNewTask,
  onEditTask,
  onGenerateTicket,
  onLogTime,
}: WaterfallViewProps) {
  // Agrupa tarefas por fase
  const tasksByPhase: Record<WaterfallPhase, ProjectTaskRecord[]> = {
    initiation: [],
    planning: [],
    execution: [],
    monitoring: [],
    closure: [],
  }

  tasks.forEach((t) => {
    const phase = t.waterfall_phase || 'planning'
    if (tasksByPhase[phase]) {
      tasksByPhase[phase].push(t)
    } else {
      tasksByPhase.planning.push(t)
    }
  })

  // Calcula se há aviso de sequência quebrada
  let previousPhaseHasIncomplete = false
  const phaseStatus: Record<
    WaterfallPhase,
    { completed: boolean; total: number; done: number; outOfSequenceWarning: boolean }
  > = {
    initiation: { completed: false, total: 0, done: 0, outOfSequenceWarning: false },
    planning: { completed: false, total: 0, done: 0, outOfSequenceWarning: false },
    execution: { completed: false, total: 0, done: 0, outOfSequenceWarning: false },
    monitoring: { completed: false, total: 0, done: 0, outOfSequenceWarning: false },
    closure: { completed: false, total: 0, done: 0, outOfSequenceWarning: false },
  }

  WATERFALL_PHASES.forEach((p) => {
    const pTasks = tasksByPhase[p.id]
    const total = pTasks.length
    const done = pTasks.filter((t) => t.status === 'done').length
    const hasActive = pTasks.some((t) => t.status === 'in_progress' || t.status === 'review')
    const isCompleted = total > 0 && done === total

    const outOfSequence = hasActive && previousPhaseHasIncomplete

    phaseStatus[p.id] = {
      completed: isCompleted,
      total,
      done,
      outOfSequenceWarning: outOfSequence,
    }

    if (total > 0 && !isCompleted) {
      previousPhaseHasIncomplete = true
    }
  })

  return (
    <div className="space-y-6">
      {/* Resumo da Sequência Cascata */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {WATERFALL_PHASES.map((phase) => {
          const info = phaseStatus[phase.id]
          const pct = info.total > 0 ? Math.round((info.done / info.total) * 100) : 0

          return (
            <div
              key={phase.id}
              className={`p-3 rounded-lg border text-xs space-y-2 ${
                info.completed
                  ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                  : info.outOfSequenceWarning
                    ? 'bg-amber-50/50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800'
                    : 'bg-card border-border/60'
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <span className="truncate">
                  {phase.order}. {phase.label}
                </span>
                {info.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : info.outOfSequenceWarning ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {info.done}/{info.total}
                  </span>
                )}
              </div>

              <Progress value={pct} className="h-1.5" />

              {info.outOfSequenceWarning && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                  Aviso: fase anterior ainda tem atividades pendentes.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Detalhamento de Fases e Atividades */}
      <div className="space-y-6">
        {WATERFALL_PHASES.map((phase) => {
          const pTasks = tasksByPhase[phase.id]
          const info = phaseStatus[phase.id]

          return (
            <Card key={phase.id} className="border-border/60">
              <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/40 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-sm font-semibold">
                    Fase {phase.order}: {phase.label}
                  </CardTitle>
                  <Badge variant="outline" className="text-[11px] ml-1">
                    {pTasks.length} {pTasks.length === 1 ? 'atividade' : 'atividades'}
                  </Badge>
                  {info.outOfSequenceWarning && (
                    <Badge variant="destructive" className="bg-amber-500 text-white text-[10px]">
                      Sequência não linear
                    </Badge>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onNewTask(phase.id)}
                >
                  <Plus className="h-3 w-3" />
                  Atividade nesta Fase
                </Button>
              </CardHeader>

              <CardContent className="p-4">
                {pTasks.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/60 rounded-md">
                    Nenhuma atividade cadastrada para a fase de {phase.label}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/10 transition-colors gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {task.is_milestone && (
                              <Badge className="bg-purple-600 text-white text-[10px] gap-1 px-1.5 py-0">
                                <Flag className="h-2.5 w-2.5" />
                                Marco
                              </Badge>
                            )}
                            <span
                              onClick={() => onEditTask(task)}
                              className="font-medium text-xs hover:text-amber-500 cursor-pointer"
                            >
                              {task.title}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${
                                task.status === 'done'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : task.status === 'in_progress'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : ''
                              }`}
                            >
                              {task.status === 'todo'
                                ? 'A Fazer'
                                : task.status === 'in_progress'
                                  ? 'Em Progresso'
                                  : task.status === 'review'
                                    ? 'Review'
                                    : task.status === 'done'
                                      ? 'Concluído'
                                      : task.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {task.expand?.assigned_to && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.expand.assigned_to.name || task.expand.assigned_to.email}
                              </span>
                            )}
                            {task.due_date && (
                              <span>
                                Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {task.expand?.ticket && (
                              <span className="flex items-center gap-1 text-amber-600 font-medium">
                                <Ticket className="h-3 w-3" />
                                Chamado #
                                {task.expand.ticket.ticket_number || task.ticket?.slice(0, 6)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Ações da Atividade */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {!task.ticket && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1 hover:border-amber-500 hover:text-amber-600"
                              onClick={() => onGenerateTicket(task)}
                            >
                              <Ticket className="h-3 w-3" />
                              Gerar Chamado
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 hover:border-amber-500 hover:text-amber-600"
                            onClick={() => onLogTime(task)}
                          >
                            <Clock className="h-3 w-3" />
                            Lançar Horas
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
