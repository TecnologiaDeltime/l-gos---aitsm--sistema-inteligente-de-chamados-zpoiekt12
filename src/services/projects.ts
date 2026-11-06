import pb from '@/lib/pocketbase/client'
import type {
  ProjectRecord,
  ProjectSprintRecord,
  ProjectTaskRecord,
  ProjectWorkLogRecord,
} from '@/types/projects'

export const WATERFALL_PHASES = [
  {
    id: 'initiation',
    label: 'Iniciação',
    order: 1,
    description: 'Definição de objetivos, escopo inicial e alinhamento de stakeholders',
  },
  {
    id: 'planning',
    label: 'Planejamento',
    order: 2,
    description: 'Detalhamento de escopo, cronograma, recursos e marcos',
  },
  {
    id: 'execution',
    label: 'Execução',
    order: 3,
    description: 'Desenvolvimento e entrega dos pacotes de trabalho',
  },
  {
    id: 'monitoring',
    label: 'Monitoramento & Controle',
    order: 4,
    description: 'Acompanhamento de progresso, qualidade e riscos',
  },
  {
    id: 'closure',
    label: 'Encerramento',
    order: 5,
    description: 'Entrega final, lições aprendidas e encerramento formal',
  },
] as const

export const DEFAULT_LEAN_STAGES = [
  { id: 'backlog', label: 'Backlog / Ideias', wip_limit: 0, order: 1 },
  { id: 'todo', label: 'A Fazer (Pronto)', wip_limit: 5, order: 2 },
  { id: 'in_progress', label: 'Em Execução', wip_limit: 3, order: 3 },
  { id: 'review', label: 'Em Validação', wip_limit: 2, order: 4 },
  { id: 'done', label: 'Concluído', wip_limit: 0, order: 5 },
]

export const SCRUM_BOARD_COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'Em Progresso' },
  { id: 'review', label: 'Em Review' },
  { id: 'done', label: 'Done' },
] as const

// Projects CRUD
export async function getProjects(filter = ''): Promise<ProjectRecord[]> {
  return pb.collection('projects').getFullList<ProjectRecord>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'company,manager',
  })
}

export async function getProject(id: string): Promise<ProjectRecord> {
  return pb.collection('projects').getOne<ProjectRecord>(id, {
    expand: 'company,manager',
  })
}

export const getProjectById = getProject
export const createTicketFromTask = generateTicketFromTask
export const logProjectTimeAction = addProjectWorkLog

export async function createProject(data: Partial<ProjectRecord>): Promise<ProjectRecord> {
  return pb.collection('projects').create<ProjectRecord>(data)
}

export async function updateProject(
  id: string,
  data: Partial<ProjectRecord>,
): Promise<ProjectRecord> {
  return pb.collection('projects').update<ProjectRecord>(id, data)
}

export async function deleteProject(id: string): Promise<boolean> {
  return pb.collection('projects').delete(id)
}

// Sprints
export async function getProjectSprints(projectId: string): Promise<ProjectSprintRecord[]> {
  return pb.collection('project_sprints').getFullList<ProjectSprintRecord>({
    filter: `project = "${projectId}"`,
    sort: 'created',
  })
}

export async function createProjectSprint(
  data: Partial<ProjectSprintRecord>,
): Promise<ProjectSprintRecord> {
  return pb.collection('project_sprints').create<ProjectSprintRecord>(data)
}

export async function updateProjectSprint(
  id: string,
  data: Partial<ProjectSprintRecord>,
): Promise<ProjectSprintRecord> {
  return pb.collection('project_sprints').update<ProjectSprintRecord>(id, data)
}

export async function deleteProjectSprint(id: string): Promise<boolean> {
  return pb.collection('project_sprints').delete(id)
}

// Tasks
export async function getProjectTasks(projectId: string): Promise<ProjectTaskRecord[]> {
  return pb.collection('project_tasks').getFullList<ProjectTaskRecord>({
    filter: `project = "${projectId}"`,
    sort: 'order,created',
    expand: 'assigned_to,sprint,ticket',
  })
}

export async function getProjectTask(id: string): Promise<ProjectTaskRecord> {
  return pb.collection('project_tasks').getOne<ProjectTaskRecord>(id, {
    expand: 'assigned_to,sprint,ticket',
  })
}

export async function createProjectTask(
  data: Partial<ProjectTaskRecord>,
): Promise<ProjectTaskRecord> {
  return pb.collection('project_tasks').create<ProjectTaskRecord>(data)
}

export async function updateProjectTask(
  id: string,
  data: Partial<ProjectTaskRecord>,
): Promise<ProjectTaskRecord> {
  return pb.collection('project_tasks').update<ProjectTaskRecord>(id, data)
}

export async function deleteProjectTask(id: string): Promise<boolean> {
  return pb.collection('project_tasks').delete(id)
}

// Work Logs (Ações e Horas no projeto)
export async function getProjectWorkLogs(projectId: string): Promise<ProjectWorkLogRecord[]> {
  return pb.collection('project_work_logs').getFullList<ProjectWorkLogRecord>({
    filter: `project = "${projectId}"`,
    sort: '-created',
    expand: 'user,task,ticket',
  })
}

export async function addProjectWorkLog(data: {
  project: string
  task?: string
  user: string
  description: string
  duration_seconds: number
  logged_at?: string
  ticket?: string
}): Promise<ProjectWorkLogRecord> {
  const log = await pb.collection('project_work_logs').create<ProjectWorkLogRecord>(data)

  // Atualizar total de segundos no projeto
  try {
    const proj = await pb.collection('projects').getOne<ProjectRecord>(data.project)
    const currentTotal = proj.total_worked_seconds || 0
    await pb.collection('projects').update(data.project, {
      total_worked_seconds: currentTotal + data.duration_seconds,
    })
  } catch (err) {
    console.error('Erro ao atualizar horas totais do projeto:', err)
  }

  // Atualizar total de segundos na tarefa se informada
  if (data.task) {
    try {
      const task = await pb.collection('project_tasks').getOne<ProjectTaskRecord>(data.task)
      const currentTaskSec = task.worked_seconds || 0
      await pb.collection('project_tasks').update(data.task, {
        worked_seconds: currentTaskSec + data.duration_seconds,
      })
    } catch (err) {
      console.error('Erro ao atualizar horas da tarefa do projeto:', err)
    }
  }

  return log
}

// Geração de chamado a partir da atividade delegada
export async function generateTicketFromTask(params: {
  project: ProjectRecord
  task: ProjectTaskRecord
  userId: string
  ticketSubject?: string
  ticketDescription?: string
}): Promise<{ ticketId: string; ticketNumber?: number }> {
  const { project, task, userId, ticketSubject, ticketDescription } = params

  const methodologyLabel =
    project.methodology === 'waterfall'
      ? 'Cascata'
      : project.methodology === 'scrum'
        ? 'Ágil/Scrum'
        : 'Lean'

  const subject = ticketSubject || `[Projeto: ${project.name}] ${task.title}`

  const defaultDescription =
    ticketDescription ||
    `Chamado gerado a partir de atividade delegada no Módulo de Projetos.

Projeto: ${project.name} (${methodologyLabel})
Atividade: ${task.title}
Status da atividade: ${task.status}
${task.description ? `\nDescrição da atividade:\n${task.description}` : ''}`

  const ticketPayload: Record<string, any> = {
    subject,
    description: defaultDescription,
    status: 'Em andamento',
    priority:
      task.priority === 'critical'
        ? 'Crítica'
        : task.priority === 'high'
          ? 'Alta'
          : task.priority === 'low'
            ? 'Baixa'
            : 'Média',
    assigned_to: task.assigned_to || userId,
    created_by: userId,
  }

  if (project.company) {
    ticketPayload.company = project.company
  }

  const ticket = await pb.collection('tickets').create(ticketPayload)

  // Vínculo bidirecional: salva o ticket na tarefa do projeto
  await pb.collection('project_tasks').update(task.id, {
    ticket: ticket.id,
  })

  // Registra interação inicial no chamado documentando a origem no projeto
  try {
    await pb.collection('ticket_interactions').create({
      ticket: ticket.id,
      user: userId,
      type: 'internal_note',
      content: `Atividade vinculada ao projeto "${project.name}". ID da atividade: ${task.id}.`,
    })
  } catch (err) {
    console.warn('Não foi possível criar interação inicial no chamado:', err)
  }

  return {
    ticketId: ticket.id,
    ticketNumber: (ticket as any).ticket_number,
  }
}
