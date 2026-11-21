import pb from '@/lib/pocketbase/client'

export interface KbSource {
  id: string
  name: string
  source_type: 'pdf' | 'closure'
  status: 'Processando' | 'Pronto' | 'Erro'
  summary?: string
  pages?: number
  error?: string
  ticket?: string
  ticket_number?: string
  category?: string
  tokens?: string[]
  uploaded_by?: string
  processed_at?: string
  created: string
  updated: string
  expand?: {
    ticket?: { id: string; number: string; title: string }
    uploaded_by?: { id: string; name: string; email?: string }
  }
}

export const getKbSources = (filter?: string) =>
  pb.collection('kb_sources').getFullList<KbSource>({
    filter,
    sort: '-created',
    expand: 'ticket,uploaded_by',
  })

/**
 * Envia um PDF para a Base de Conhecimento via rota backend do hook
 * A0_kb_learning_routes (/backend/v1/kb/sources/upload), que extrai o texto
 * server-side ($documents.toMarkdown), resume com IA e grava como fonte.
 * Sempre via pb.send — nunca fetch relativo (sem proxy no vite).
 */
export const uploadKbSourcePdf = async (
  file: File,
  name?: string,
): Promise<{
  success: boolean
  id: string
  name: string
  status: string
  summary?: string
  pages?: number
  error?: string
}> => {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  return pb.send('/backend/v1/kb/sources/upload', {
    method: 'POST',
    body: form,
  })
}

/**
 * Reprocessa fontes pendentes (status 'Processando')
 */
export const processKbSources = async (): Promise<{
  success: boolean
  processed: number
  results: { id: string; name: string; status: string; error?: string }[]
}> => {
  return pb.send('/backend/v1/kb/sources/process', {
    method: 'POST',
    body: {},
  })
}

/**
 * Remove uma fonte de aprendizado
 */
export const deleteKbSource = async (id: string): Promise<void> => {
  await pb.send(`/backend/v1/kb/sources/${id}`, {
    method: 'DELETE',
  })
}
