import pb from '@/lib/pocketbase/client'

export interface RetainedTicketRecord {
  id: string
  from_email: string
  from_name?: string
  subject: string
  body?: string
  domain?: string
  reason?: string
  status: 'Pendente' | 'Liberado' | 'Excluído'
  retention_notified?: boolean
  ticket?: string
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  created: string
  updated: string
  expand?: {
    ticket?: any
    reviewed_by?: any
  }
}

export const getRetainedTickets = async (filter?: string): Promise<RetainedTicketRecord[]> => {
  return pb.collection('retained_tickets').getFullList<RetainedTicketRecord>({
    filter,
    sort: '-created',
    expand: 'ticket,reviewed_by',
  })
}

export const getPendingRetainedTicketsCount = async (): Promise<number> => {
  const result = await pb.collection('retained_tickets').getList(1, 1, {
    filter: 'status = "Pendente"',
  })
  return result.totalItems
}

export const getRetainedTicket = async (id: string): Promise<RetainedTicketRecord> => {
  return pb.collection('retained_tickets').getOne<RetainedTicketRecord>(id, {
    expand: 'ticket,reviewed_by',
  })
}

export const releaseRetainedTicket = async (
  id: string,
  options?: { notes?: string; company_id?: string },
) => {
  return pb.send(`/backend/v1/retained-tickets/${id}/release`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const dismissRetainedTicket = async (id: string, notes?: string) => {
  return pb.send(`/backend/v1/retained-tickets/${id}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({ notes: notes || 'Descartado pela moderação' }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const deleteRetainedTicket = async (id: string) => {
  return pb.collection('retained_tickets').delete(id)
}
