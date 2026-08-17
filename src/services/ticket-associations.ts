import pb from '@/lib/pocketbase/client'
import { TicketRecord, getChildTickets, CHILD_CLOSED_STATUSES } from '@/services/tickets'

/** Statuses that prevent a ticket from being associated or batch-resolved. */
export const ASSOCIATION_CLOSED_STATUSES = ['Resolvido', 'Cancelado', 'Encerrado']

export interface BatchResolveResult {
  success: boolean
  group_id: string
  resolved: string[]
  skipped_closed: string[]
  skipped_blocked: string[]
  resolved_at: string
}

/**
 * Lista todos os tickets do mesmo grupo de associação do ticket informado
 * (excluindo o próprio). Retorna [] se o ticket não tiver grupo.
 */
export const getAssociatedTickets = async (ticketId: string): Promise<TicketRecord[]> => {
  const current = await pb.collection('tickets').getOne<TicketRecord>(ticketId, {
    fields: 'id,association_group_id',
  })
  const groupId = (current as any).association_group_id as string | undefined
  if (!groupId) return []
  const list = await pb.collection('tickets').getFullList<TicketRecord>({
    filter: `association_group_id = "${groupId}" && id != "${ticketId}"`,
    sort: 'created',
    expand: 'company,category,assigned_to,queue,contract',
  })
  return list
}

/**
 * Associa (bidirecionalmente) o ticket atual a um ou mais tickets abertos.
 * Delega a lógica de merge de grupos para o hook `ticket_associate.js`.
 */
export const associateTickets = (ticketId: string, targetIds: string[]) =>
  pb.send(`/backend/v1/tickets/${ticketId}/associate`, {
    method: 'POST',
    body: JSON.stringify({ target_ids: targetIds }),
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Resolve em massa todos os tickets abertos do grupo de associação do ticket
 * informado, aplicando a mesma descrição de solução a todos.
 */
export const batchResolveAssociated = (
  ticketId: string,
  solutionDescription: string,
  resolvedBy: string,
): Promise<BatchResolveResult> =>
  pb.send(`/backend/v1/tickets/${ticketId}/batch-resolve`, {
    method: 'POST',
    body: JSON.stringify({
      solution_description: solutionDescription,
      resolved_by: resolvedBy,
    }),
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Busca tickets abertos elegíveis para associação:
 *  - status não fechado;
 *  - sem parent_ticket_id (filhos não podem ser associados);
 *  - diferente do ticket atual;
 *  - (opcional) não pertencentes ao mesmo grupo de associação atual.
 * Filtra por termo de busca (número/título/solicitante) client-side.
 */
export const searchEligibleTicketsForAssociation = async (
  currentTicketId: string,
  searchTerm: string,
): Promise<TicketRecord[]> => {
  const openFilter = ASSOCIATION_CLOSED_STATUSES.map((s) => `status != "${s}"`).join(' && ')
  const filter = `${openFilter} && parent_ticket_id = "" && id != "${currentTicketId}"`
  const all = await pb.collection('tickets').getFullList<TicketRecord>({
    filter,
    sort: '-created',
    expand: 'company,assigned_to',
  })
  const term = searchTerm.trim().toLowerCase()
  if (!term) return all.slice(0, 50)
  return all
    .filter(
      (t) =>
        t.number.toLowerCase().includes(term) ||
        t.title.toLowerCase().includes(term) ||
        t.requester_name.toLowerCase().includes(term),
    )
    .slice(0, 50)
}

/**
 * Helper para que o TicketDetail verifique o bloqueio de encerramento do
 * ticket pai antes de abrir o diálogo de resolução (reaproveitado para o
 * fluxo de fechamento em massa). Retorna a lista de filhos pendentes
 * (vazia = pode encerrar).
 */
export async function checkPendingChildrenForBatch(parentId: string): Promise<TicketRecord[]> {
  try {
    const children = await getChildTickets(parentId)
    return children.filter((c) => !CHILD_CLOSED_STATUSES.includes(c.status))
  } catch {
    return []
  }
}
