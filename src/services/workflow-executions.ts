import pb from '@/lib/pocketbase/client'
import type { WorkflowExecutionRecord, WorkflowExecutionLogRecord } from '@/types/automation'

export const getExecutions = (automationId?: string, ticketId?: string) => {
  const filters: string[] = []
  if (automationId) filters.push(`automation = "${automationId}"`)
  if (ticketId) filters.push(`ticket = "${ticketId}"`)
  const filter = filters.join(' && ')
  return pb.collection('workflow_executions').getFullList<WorkflowExecutionRecord>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'automation,version,ticket',
  })
}

export const getExecution = (id: string) =>
  pb.collection('workflow_executions').getOne<WorkflowExecutionRecord>(id, {
    expand: 'automation,version,ticket',
  })

export const getExecutionLogs = (executionId: string) =>
  pb.collection('workflow_execution_logs').getFullList<WorkflowExecutionLogRecord>({
    filter: `execution = "${executionId}"`,
    sort: 'created',
  })

export const getExecutionStats = async () => {
  const all = await pb.collection('workflow_executions').getFullList<WorkflowExecutionRecord>()
  const total = all.length
  const completed = all.filter((e) => e.status === 'Concluído').length
  const inProgress = all.filter((e) => e.status === 'Em Execução').length
  const errors = all.filter((e) => e.status === 'Erro').length
  const waiting = all.filter(
    (e) => e.status === 'Aguardando Aprovação' || e.status === 'Aguardando',
  ).length
  return { total, completed, inProgress, errors, waiting }
}
