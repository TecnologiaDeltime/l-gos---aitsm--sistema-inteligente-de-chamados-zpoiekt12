import pb from '@/lib/pocketbase/client'
import type { WorkflowTaskRecord } from '@/types/automation'

export const getWorkflowTasks = (ticketId?: string, responsibleId?: string) => {
  const filters: string[] = []
  if (ticketId) filters.push(`ticket = "${ticketId}"`)
  if (responsibleId) filters.push(`responsible = "${responsibleId}"`)
  const filter = filters.join(' && ')
  return pb.collection('workflow_tasks').getFullList<WorkflowTaskRecord>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'ticket,responsible,queue,automation',
  })
}

export const getWorkflowTask = (id: string) =>
  pb
    .collection('workflow_tasks')
    .getOne<WorkflowTaskRecord>(id, { expand: 'ticket,responsible,queue' })

export const createWorkflowTask = (data: Partial<WorkflowTaskRecord>) =>
  pb.collection('workflow_tasks').create<WorkflowTaskRecord>(data)

export const updateWorkflowTask = (id: string, data: Partial<WorkflowTaskRecord>) =>
  pb.collection('workflow_tasks').update<WorkflowTaskRecord>(id, data)

export const deleteWorkflowTask = (id: string) => pb.collection('workflow_tasks').delete(id)

export const completeWorkflowTask = (id: string, userId: string) =>
  pb.collection('workflow_tasks').update<WorkflowTaskRecord>(id, {
    status: 'Concluída',
    completed_at: new Date().toISOString(),
    completed_by: userId,
  })
