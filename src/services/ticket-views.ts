import pb from '@/lib/pocketbase/client'

export interface TicketViewRecord {
  id: string
  ticket: string
  user: string
  viewed_at?: string
  created: string
  updated: string
  expand?: {
    user?: {
      id: string
      name?: string
      email?: string
      role?: string
      avatar?: string
    }
  }
}

/**
 * Registra ou atualiza a visualização de um chamado pelo usuário atual (upsert leve).
 */
export async function trackTicketView(
  ticketId: string,
  userId: string,
): Promise<TicketViewRecord | null> {
  if (!ticketId || !userId) return null

  const nowIso = new Date().toISOString()
  try {
    // Tenta encontrar registro existente de visualização deste usuário neste ticket
    const existing = await pb
      .collection('ticket_views')
      .getFirstListItem<TicketViewRecord>(`ticket = "${ticketId}" && user = "${userId}"`)

    // Atualiza viewed_at
    return await pb.collection('ticket_views').update<TicketViewRecord>(existing.id, {
      viewed_at: nowIso,
    })
  } catch (err: any) {
    // Se não encontrou (status 404), cria novo registro
    if (err?.status === 404 || err?.status === 0 || !err?.status) {
      try {
        return await pb.collection('ticket_views').create<TicketViewRecord>({
          ticket: ticketId,
          user: userId,
          viewed_at: nowIso,
        })
      } catch (createErr: any) {
        // Pode ter havido concorrência e o registro foi criado em paralelo
        try {
          const fallback = await pb
            .collection('ticket_views')
            .getFirstListItem<TicketViewRecord>(`ticket = "${ticketId}" && user = "${userId}"`)
          return await pb.collection('ticket_views').update<TicketViewRecord>(fallback.id, {
            viewed_at: nowIso,
          })
        } catch {
          return null
        }
      }
    }
    return null
  }
}

/**
 * Busca todas as visualizações registradas para um chamado com os dados do usuário expandidos.
 */
export async function getTicketViews(ticketId: string): Promise<TicketViewRecord[]> {
  if (!ticketId) return []
  try {
    return await pb.collection('ticket_views').getFullList<TicketViewRecord>({
      filter: `ticket = "${ticketId}"`,
      sort: '-viewed_at,-updated',
      expand: 'user',
    })
  } catch {
    return []
  }
}
