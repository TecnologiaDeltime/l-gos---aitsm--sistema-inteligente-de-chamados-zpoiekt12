import pb from '@/lib/pocketbase/client'

export interface EditHoursPayload {
  /** Novo tempo em minutos (0 zera). Omitir mantém o atual. */
  duration_minutes?: number
  /** Descrição/log novo. Omitir mantém o atual. */
  content?: string
  /** Data de competência retroativa (AAAA-MM-DD). Omitir mantém. */
  competency_date?: string
}

export const editInteractionWithRecalculation = (id: string, data: EditHoursPayload) =>
  pb.send<{ success: boolean; record: Record<string, unknown> }>(
    `/backend/v1/interactions/${id}/edit`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    },
  )
