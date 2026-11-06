import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  FolderKanban,
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  Layers,
  Building2,
  Ticket,
  Plus,
  TrendingUp,
  CheckCircle2,
  FileText,
  Activity,
  History,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import {
  getProjectById,
  getProjectTasks,
  getProjectSprints,
  getProjectWorkLogs,
} from '@/services/projects'
import { getOperators } from '@/services/operators'
import { formatSeconds } from '@/lib/duration'
import type {
  ProjectRecord,
  ProjectTaskRecord,
  ProjectSprintRecord,
  ProjectWorkLogRecord,
  WaterfallPhase,
} from '@/types/projects'

import { ProjectWaterfallView } from '@/components/projects/ProjectWaterfallView'
import { ProjectScrumView } from '@/components/projects/ProjectScrumView'
import { ProjectLeanView } from '@/components/projects/ProjectLeanView'
import { ProjectTaskDialog } from '@/components/projects/ProjectTaskDialog'
import { GenerateTicketDialog } from '@/components/projects/GenerateTicketDialog'
import { ProjectLogTimeDialog } from '@/components/projects/ProjectLogTimeDialog'
import { ProjectSprintDialog } from '@/components/projects/ProjectSprintDialog'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const permissions = usePermissions()

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [tasks, setTasks] = useState<ProjectTaskRecord[]>([])
  const [sprints, setSprints] = useState<ProjectSprintRecord[]>([])
  const [workLogs, setWorkLogs] = useState<ProjectWorkLogRecord[]>([])
  const [operators, setOperators] = useState<any[]>([])

  // Diálogos modais
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<ProjectTaskRecord | null>(null)

  const [ticketDialogOpen, setTicketDialogOpen] = useState(false)
  const [taskForTicket, setTaskForTicket] = useState<ProjectTaskRecord | null>(null)

  const [logTimeDialogOpen, setLogTimeDialogOpen] = useState(false)
  const [taskForLogTime, setTaskForLogTime] = useState<ProjectTaskRecord | null>(null)

  const [sprintDialogOpen, setSprintDialogOpen] = useState(false)

  useEffect(() => {
    if (id) {
      loadAllData(id)
    }
  }, [id])

  const loadAllData = async (projectId: string) => {
    try {
      setLoading(true)
      const [proj, tList, sList, lList, ops] = await Promise.all([
        getProjectById(projectId),
        getProjectTasks(projectId),
        getProjectSprints(projectId),
        getProjectWorkLogs(projectId),
        getOperators().catch(() => []),
      ])
      setProject(proj)
      setTasks(tList)
      setSprints(sList)
      setWorkLogs(lList)
      setOperators(ops)
    } catch (err: any) {
      console.error('Erro ao carregar projeto:', err)
      toast({
        title: 'Erro ao carregar projeto',
        description: err.message || 'Projeto não encontrado.',
        variant: 'destructive',
      })
      navigate('/projetos')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenNewTask = (_phaseOrSprint?: string) => {
    setTaskToEdit(null)
    setTaskDialogOpen(true)
  }

  const handleOpenEditTask = (task: ProjectTaskRecord) => {
    setTaskToEdit(task)
    setTaskDialogOpen(true)
  }

  const handleOpenGenerateTicket = (task: ProjectTaskRecord) => {
    setTaskForTicket(task)
    setTicketDialogOpen(true)
  }

  const handleOpenLogTime = (task?: ProjectTaskRecord) => {
    setTaskForLogTime(task || null)
    setLogTimeDialogOpen(true)
  }

  if (loading || !project) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  // Cálculos de progresso do projeto
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const linkedTickets = tasks.filter((t) => !!t.ticket)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Botão voltar e barra superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/projetos')}
          className="gap-2 self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Projetos
        </Button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenLogTime()}
            className="text-xs gap-1.5"
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Lançar Horas Gerais
          </Button>

          {permissions.canAccessItem('projects', 'projects_manage') && (
            <Button
              size="sm"
              onClick={() => handleOpenNewTask()}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Atividade
            </Button>
          )}
        </div>
      </div>

      {/* Cabeçalho do Projeto */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <FolderKanban className="h-6 w-6 text-amber-500 shrink-0" />
                <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
                <Badge
                  variant="outline"
                  className={
                    project.methodology === 'waterfall'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                      : project.methodology === 'scrum'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                  }
                >
                  {project.methodology === 'waterfall'
                    ? 'Cascata (Waterfall)'
                    : project.methodology === 'scrum'
                      ? 'Ágil (Scrum)'
                      : 'Lean (Fluxo Contínuo)'}
                </Badge>
                <Badge
                  className={
                    project.status === 'active'
                      ? 'bg-amber-500 text-white'
                      : project.status === 'completed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-secondary text-secondary-foreground'
                  }
                >
                  {project.status === 'planning'
                    ? 'Planejamento'
                    : project.status === 'active'
                      ? 'Em Execução'
                      : project.status === 'completed'
                        ? 'Concluído'
                        : project.status === 'suspended'
                          ? 'Suspenso'
                          : 'Cancelado'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {project.expand?.company ? project.expand.company.name : 'Projeto Interno'}
                </span>

                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Gestor: {project.expand?.manager?.name || 'Não definido'}
                </span>

                {project.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Início: {new Date(project.start_date).toLocaleDateString('pt-BR')}
                    {project.target_date &&
                      ` • Previsão: ${new Date(project.target_date).toLocaleDateString('pt-BR')}`}
                  </span>
                )}
              </div>

              {project.description && (
                <p className="text-xs text-muted-foreground pt-2 max-w-3xl">
                  {project.description}
                </p>
              )}
            </div>

            {/* KPIs Rápidos do Projeto */}
            <div className="grid grid-cols-3 gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border/40 lg:pl-6">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Progresso</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {progressPct}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {completedTasks}/{totalTasks} entregues
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs text-muted-foreground">Horas Totais</div>
                <div className="text-lg font-bold font-mono">
                  {formatSeconds(project.total_worked_seconds || 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {workLogs.length} lançamentos
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs text-muted-foreground">Chamados</div>
                <div className="text-lg font-bold text-primary">{linkedTickets.length}</div>
                <div className="text-[10px] text-muted-foreground">vinculados</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abas Principais: Atividades por Metodologia, Chamados, Horas e Equipe */}
      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList className="bg-muted/40 p-1">
          <TabsTrigger value="workflow" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Quadro do Projeto ({project.methodology.toUpperCase()})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="text-xs gap-1.5">
            <Ticket className="h-3.5 w-3.5" />
            Chamados Vinculados ({linkedTickets.length})
          </TabsTrigger>
          <TabsTrigger value="worklogs" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Horas & Ações Lançadas ({workLogs.length})
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Equipe do Projeto ({project.team_members?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Aba de Fluxo Metodológico */}
        <TabsContent value="workflow" className="space-y-4">
          {project.methodology === 'waterfall' && (
            <ProjectWaterfallView
              project={project}
              tasks={tasks}
              onNewTask={handleOpenNewTask}
              onEditTask={handleOpenEditTask}
              onGenerateTicket={handleOpenGenerateTicket}
              onLogTime={handleOpenLogTime}
            />
          )}

          {project.methodology === 'scrum' && (
            <ProjectScrumView
              project={project}
              tasks={tasks}
              sprints={sprints}
              onNewTask={handleOpenNewTask}
              onEditTask={handleOpenEditTask}
              onGenerateTicket={handleOpenGenerateTicket}
              onLogTime={handleOpenLogTime}
              onNewSprint={() => setSprintDialogOpen(true)}
              onReload={() => id && loadAllData(id)}
            />
          )}

          {project.methodology === 'lean' && (
            <ProjectLeanView
              project={project}
              tasks={tasks}
              onNewTask={handleOpenNewTask}
              onEditTask={handleOpenEditTask}
              onGenerateTicket={handleOpenGenerateTicket}
              onLogTime={handleOpenLogTime}
              onReload={() => id && loadAllData(id)}
            />
          )}
        </TabsContent>

        {/* Aba de Chamados Vinculados */}
        <TabsContent value="tickets" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Chamados Vinculados às Atividades do Projeto
              </CardTitle>
              <CardDescription className="text-xs">
                Chamados de suporte e implementação técnica gerados a partir do projeto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkedTickets.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground border border-dashed border-border/60 rounded-md">
                  Nenhum chamado gerado ainda. Clique em "Gerar Chamado" em qualquer atividade do
                  projeto.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {linkedTickets.map((t) => (
                    <div
                      key={t.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="font-semibold">
                            Chamado #{t.expand?.ticket?.ticket_number || t.ticket?.slice(0, 6)}
                          </span>
                          <span className="text-muted-foreground">• Atividade: {t.title}</span>
                        </div>
                        {(t.expand?.ticket?.subject || t.expand?.ticket?.title) && (
                          <p className="text-muted-foreground pl-6 text-[11px]">
                            {t.expand.ticket.subject || t.expand.ticket.title}
                          </p>
                        )}
                      </div>

                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7 shrink-0"
                      >
                        <Link to={`/chamados/${t.ticket}`}>Acessar Chamado &rarr;</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Horas e Ações Lançadas */}
        <TabsContent value="worklogs" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Histórico de Ações e Horas Lançadas
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro de tempo dos operadores com formato HH:MM:SS.
                </CardDescription>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => handleOpenLogTime()}
              >
                <Plus className="h-3.5 w-3.5" />
                Lançar Horas
              </Button>
            </CardHeader>
            <CardContent>
              {workLogs.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground border border-dashed border-border/60 rounded-md">
                  Nenhum registro de horas trabalhado neste projeto ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {workLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-border/50 bg-card text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-semibold">
                            {log.expand?.user?.name || log.expand?.user?.email || 'Operador'}
                          </span>
                          {log.expand?.task?.title && (
                            <Badge variant="outline" className="text-[10px]">
                              {log.expand.task.title}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatSeconds(log.duration_seconds)}</span>
                        </div>
                      </div>

                      <p className="text-muted-foreground pl-5">{log.description}</p>

                      <div className="text-[10px] text-muted-foreground/70 pl-5">
                        Registrado em {new Date(log.created).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Equipe */}
        <TabsContent value="team" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Membros da Equipe</CardTitle>
              <CardDescription className="text-xs">
                Operadores com papéis delegados nesta iniciativa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!project.team_members || project.team_members.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground border border-dashed border-border/60 rounded-md">
                  Nenhum operador adicionado à equipe do projeto.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {project.team_members.map((member) => (
                    <div
                      key={member.user_id}
                      className="p-3 rounded-lg border border-border/50 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold">{member.name}</div>
                        <div className="text-muted-foreground text-[11px]">{member.email}</div>
                      </div>

                      <Badge variant="secondary" className="text-[10px]">
                        {member.role === 'manager'
                          ? 'Gestor'
                          : member.role === 'assignee'
                            ? 'Responsável'
                            : 'Colaborador'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      <ProjectTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        project={project}
        sprints={sprints}
        operators={operators}
        taskToEdit={taskToEdit}
        onSaved={() => id && loadAllData(id)}
      />

      <GenerateTicketDialog
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
        project={project}
        task={taskForTicket}
        operators={operators}
        onSuccess={() => id && loadAllData(id)}
      />

      <ProjectLogTimeDialog
        open={logTimeDialogOpen}
        onOpenChange={setLogTimeDialogOpen}
        project={project}
        task={taskForLogTime}
        onSuccess={() => id && loadAllData(id)}
      />

      <ProjectSprintDialog
        open={sprintDialogOpen}
        onOpenChange={setSprintDialogOpen}
        project={project}
        onSuccess={() => id && loadAllData(id)}
      />
    </div>
  )
}
