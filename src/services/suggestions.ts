// Área de Sugestões dos Operadores (v0.0.x) — serviço da coleção `suggestions`
// (mig 0181): operador envia/acompanha; gestão responde, aceita/nega com motivo e
// vincula a janela de implantação (relação com `changes` — mudanças programadas).
import pb from '@/lib/pocketbase/client'

export type SuggestionStatus = 'pendente' | 'aceita' | 'negada' | 'implantada'

export type SuggestionCategory = 'processo' | 'sistema' | 'automacao' | 'infraestrutura' | 'outro'

export interface Suggestion {
  id: string
  title: string
  description: string
  category?: SuggestionCategory | ''
  author: string
  status: SuggestionStatus
  admin_reply?: string
  reject_reason?: string
  change_window?: string
  implantation_date?: string
  created?: string
  updated?: string
  expand?: {
    author?: { id: string; name: string; email?: string; avatar?: string }
    change_window?: {
      id: string
      number?: string
      title?: string
      planned_start?: string
      planned_end?: string
      status?: string
    }
  }
}

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  negada: 'Negada',
  implantada: 'Implantada',
}

export const SUGGESTION_CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  processo: 'Processo',
  sistema: 'Sistema',
  automacao: 'Automação',
  infraestrutura: 'Infraestrutura',
  outro: 'Outro',
}

export function listSuggestions(): Promise<Suggestion[]> {
  return pb
    .collection('suggestions')
    .getFullList<Suggestion>({ sort: '-created', expand: 'author,change_window' })
}

export function listMySuggestions(authorId: string): Promise<Suggestion[]> {
  return pb.collection('suggestions').getFullList<Suggestion>({
    filter: `author="${authorId}"`,
    sort: '-created',
    expand: 'author,change_window',
  })
}

export function createSuggestion(
  data: Pick<Suggestion, 'title' | 'description'> & { category?: SuggestionCategory },
  authorId: string,
): Promise<Suggestion> {
  return pb.collection('suggestions').create<Suggestion>({
    title: data.title,
    description: data.description,
    category: data.category || 'outro',
    author: authorId,
    status: 'pendente',
  })
}

/** Ação de gestão: atualiza status, resposta, motivo da negativa e janela (change). */
export function manageSuggestion(
  id: string,
  data: {
    status?: SuggestionStatus
    admin_reply?: string
    reject_reason?: string
    change_window?: string | ''
    implantation_date?: string | ''
  },
): Promise<Suggestion> {
  const payload: Record<string, unknown> = { ...data }
  if (payload.change_window === '') payload.change_window = null
  if (payload.implantation_date === '') payload.implantation_date = null
  return pb.collection('suggestions').update<Suggestion>(id, payload)
}

export async function deleteSuggestion(id: string): Promise<void> {
  await pb.collection('suggestions').delete(id)
}

/** Lista de janelas de mudança (coleção `changes`) para vinculação da implantação. */
export function listChangeWindows(): Promise<
  Array<{
    id: string
    number?: string
    title?: string
    status?: string
    planned_start?: string
    planned_end?: string
  }>
> {
  return pb
    .collection('changes')
    .getFullList({ sort: '-planned_start', filter: 'status = "Agendada"' })
}
