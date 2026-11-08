/**
 * Busca e resolução dos itens citados (menções `@`) do chat interno:
 * chamados, mudanças e problemas. Usada pelo seletor de menção e pelo
 * cartão clicável renderizado na mensagem.
 */
import pb from '@/lib/pocketbase/client'

export interface MentionCandidate {
  id: string
  entityType: 'ticket' | 'change' | 'problem'
  /** Número real do registro no banco (ex.: "068 - 00033", "MUD-2026-94268", "PRB-000003"). */
  number: string
  title: string
  status?: string
  priority?: string
}

/** Status "em aberto" de chamados relevantes para menção no chat. */
const TICKET_OPEN_STATUSES = [
  'Novo',
  'Em Triagem',
  'Aguardando Atribuição',
  'Atribuído',
  'Em Atendimento',
  'Aguardando Cliente',
  'Aguardando Aprovação',
  'Aguardando Terceiro',
  'Agendado',
  'Escalonado',
  'Reaberto',
]

/**
 * Busca candidatos de menção pelo texto digitado após o `@`.
 * Consulta as três coleções em paralelo e limita cada uma a 6 resultados.
 * Os números reais no banco: chamado "068 - 00033", mudança "MUD-2026-94268",
 * problema "PRB-000003" — a busca cobre número e título.
 */
export async function searchMentionCandidates(query: string): Promise<MentionCandidate[]> {
  const q = query.trim().replace(/"/g, '')
  const textFilter = q ? `number ~ "${q}" || title ~ "${q}"` : ''
  const ticketFilter = textFilter
    ? `(${TICKET_OPEN_STATUSES.map((s) => `status = "${s}"`).join(' || ')}) && (${textFilter})`
    : `(${TICKET_OPEN_STATUSES.map((s) => `status = "${s}"`).join(' || ')})`

  const mapItem =
    (entityType: MentionCandidate['entityType']) =>
    (r: any): MentionCandidate => ({
      id: r.id,
      entityType,
      number: r.number || '',
      title: r.title || '',
      status: r.status,
      priority: r.priority,
    })

  const [tickets, changes, problems] = await Promise.all([
    pb
      .collection('tickets')
      .getList<any>(1, 6, {
        filter: ticketFilter,
        sort: '-updated',
        fields: 'id,number,title,status,priority',
      })
      .catch(() => ({ items: [] as any[] })),
    pb
      .collection('changes')
      .getList<any>(1, 6, {
        filter: textFilter,
        sort: '-updated',
        fields: 'id,number,title,status,priority',
      })
      .catch(() => ({ items: [] as any[] })),
    pb
      .collection('problems')
      .getList<any>(1, 6, {
        filter: textFilter,
        sort: '-updated',
        fields: 'id,number,title,status,priority',
      })
      .catch(() => ({ items: [] as any[] })),
  ])

  return [
    ...tickets.items.map(mapItem('ticket')),
    ...changes.items.map(mapItem('change')),
    ...problems.items.map(mapItem('problem')),
  ]
}

/** Busca o item citado (uma menção) para renderizar o cartão na mensagem. */
export async function fetchMentionTarget(
  entityType: 'ticket' | 'change' | 'problem',
  entityId: string,
): Promise<MentionCandidate | null> {
  try {
    const rec = await pb
      .collection(entityType === 'ticket' ? 'tickets' : entityType)
      .getOne<any>(entityId)
    return {
      id: rec.id,
      entityType,
      number: rec.number || '',
      title: rec.title || '',
      status: rec.status,
      priority: rec.priority,
    }
  } catch {
    return null
  }
}

/** Rótulo curto do candidato, usado na lista do seletor. */
export function mentionCandidateTitle(c: MentionCandidate): string {
  return c.title ? `${c.number} — ${c.title}` : c.number
}
