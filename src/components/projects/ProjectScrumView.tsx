import { useState } from 'react'
import { Calendar, CheckCircle2, Clock, Plus, Ticket, User, Zap, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateProjectSprint } from '@/services/projects'
import type {
  ProjectRecord,
  ProjectTaskRecord,
  ProjectSprintRecord,
  TaskStatus,
} from '@/types/projects'

interface ScrumViewProps {
  project: ProjectRecord
  tasks: ProjectTaskRecord[]
  sprints: ProjectSprintRecord[]
  onNewTask: (sprintId?: string) => void
  onEditTask: (task: ProjectTaskRecord) => void
  onGenerateTicket: (task: ProjectTaskRecord) => void
  onLogTime: (task: ProjectTaskRecord) => void
  onNewSprint: () => void
  onReload: () => void
}

export function ProjectScrumView({
  project,
  tasks,
  sprints,
  onNewTask,
  onEditTask,
  onGenerateTicket,
  onLogTime,
  onNewSprint,
  onReload,
}: ScrumViewProps) {
  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const active = sprints.find((s) => s.status === 'active')
    return active ? active.id : sprints[0]?.id || 'backlog'
  })

  const currentSprint = sprints.find((s) => s.id === selectedSprintId)

  // Tarefas da sprint selecionada ou backlog
  const sprintTasks = tasks.filter((t) => {
    if (selectedSprintId === 'backlog') {
      return !t.sprint
    }
    return t.sprint === selectedSprintId
  })

  // Colunas padrão de Sprint Board
  const scrumColumns: { id: TaskStatus; label: string }[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'Em Progresso' },
    { id: 'review', label: 'Em Review' },
    { id: 'done', label: 'Done' },
  ]

  const handleStartSprint = async () => {
    if (!currentSprint) return
    try {
      await updateProjectSprint(currentSprint.id, { status: 'active' })
      onReload()
    } catch (err) {
      console.error(err)
    }
  }

  const handleCloseSprint = async () => {
    if (!currentSprint) return
    try {
      await updateProjectSprint(currentSprint.id, { status: 'closed' })
      onReload()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de controle de Sprints */}
      <Card className="border-border/60">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold">Ciclo / Sprint:</span>
              </div>

              <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Selecione o ciclo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">📦 Product Backlog (Sem Sprint)</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      🏃 {s.name} (
                      {s.status === 'active'
                        ? 'Ativa'
                        : s.status === 'planned'
                          ? 'Planejada'
                          : 'Fechada'}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentSprint && (
                <Badge
                  variant="outline"
                  className={
                    currentSprint.status === 'active'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : currentSprint.status === 'closed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-50 text-slate-700'
                  }
                >
                  {currentSprint.status === 'active'
                    ? 'Sprint Ativa'
                    : currentSprint.status === 'planned'
                      ? 'Planejada'
                      : 'Encerrada'}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={onNewSprint}>
                <Plus className="h-3.5 w-3.5" />
                Nova Sprint
              </Button>

              <Button
                size="sm"
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                onClick={() =>
                  onNewTask(selectedSprintId !== 'backlog' ? selectedSprintId : undefined)
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Item no Backlog / Sprint
              </Button>

              {currentSprint && currentSprint.status === 'planned' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs gap-1"
                  onClick={handleStartSprint}
                >
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Iniciar Sprint
                </Button>
              )}

              {currentSprint && currentSprint.status === 'active' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs gap-1"
                  onClick={handleCloseSprint}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Encerrar Sprint
                </Button>
              )}
            </div>
          </div>

          {currentSprint?.goal && (
            <div className="mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-2">
              <span className="font-semibold text-foreground">Meta da Sprint:</span>
              <span>{currentSprint.goal}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualização de Sprint Board (Colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {scrumColumns.map((col) => {
          const colTasks = sprintTasks.filter((t) => t.status === col.id)
          const totalPoints = colTasks.reduce((acc, t) => acc + (t.story_points || 0), 0)

          return (
            <div
              key={col.id}
              className="bg-muted/30 rounded-lg p-3 border border-border/50 flex flex-col min-h-[420px]"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {col.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {colTasks.length}
                  </Badge>
                  {totalPoints > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600">
                      {totalPoints} pts
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-8">
                    Nenhum item
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <Card
                      key={task.id}
                      className="border-border/60 hover:shadow-sm transition-shadow text-xs"
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <span
                            onClick={() => onEditTask(task)}
                            className="font-medium hover:text-amber-500 cursor-pointer line-clamp-2"
                          >
                            {task.title}
                          </span>
                          {task.story_points && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              {task.story_points} pts
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
                              Gerar Chamado
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-1 ml-auto"
                            onClick={() => onLogTime(task)}
                          >
                            <Clock className="h-2.5 w-2.5 mr-1" />
                            Horas
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
