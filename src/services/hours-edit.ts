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

export interface EditWorkedHoursPayload {
  /** Novo total de horas trabalhadas em segundos (acumulado do ciclo). */
  worked_seconds: number
  /** Descrição da correção (entra na interação de rastreabilidade). */
  description?: string
}

export interface EditWorkedHoursResult {
  success: boolean
  operator_worked_seconds: number
  work_hours?: number
  unchanged?: boolean
}

/** Corrige as Horas Trabalhadas (ciclo play/pause) do chamado — admin/qualidade. */
export const editWorkedHoursWithRecalculation = (id: string, data: EditWorkedHoursPayload) =>
  pb.send<EditWorkedHoursResult>(`/backend/v1/tickets/${id}/worked-hours/edit`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
