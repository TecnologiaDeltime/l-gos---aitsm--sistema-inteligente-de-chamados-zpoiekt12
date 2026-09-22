import pb from '@/lib/pocketbase/client'

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'

export type ScheduledTicketStatus = 'agendado' | 'processado' | 'cancelado' | 'erro'

export interface ScheduledTicketRecord {
  id: string
  title: string
  description: string
  company: string
  unit?: string
  department?: string
  contract?: string
  requester_name: string
  requester_email?: string
  requester_phone?: string
  type: string
  category?: string
  subcategory?: string
  equipment?: string
  queue?: string
  assigned_to?: string
  priority: string
  impact: string
  urgency: string
  scheduled_date: string
  status: ScheduledTicketStatus
  recurrence_type: RecurrenceType
  recurrence_days_of_week?: number[]
  recurrence_day_of_month?: number
  recurrence_end_date?: string
  advance_notice_minutes?: number
  notice_sent?: boolean
  notice_sent_at?: string
  created_by?: string
  last_executed_at?: string
  last_ticket_created?: string
  error_message?: string
  created: string
  updated: string
  expand?: any
}

export const getScheduledTickets = (filter?: string, sort: string = 'scheduled_date') =>
  pb.collection('scheduled_tickets').getFullList<ScheduledTicketRecord>({
    filter,
    sort,
    expand:
      'company,unit,department,contract,category,subcategory,queue,assigned_to,created_by,last_ticket_created',
  })

export const getScheduledTicket = (id: string) =>
  pb.collection('scheduled_tickets').getOne<ScheduledTicketRecord>(id, {
    expand:
      'company,unit,department,contract,category,subcategory,queue,assigned_to,created_by,last_ticket_created',
  })

export const createScheduledTicket = (data: Partial<ScheduledTicketRecord>) =>
  pb.collection('scheduled_tickets').create<ScheduledTicketRecord>(data)

export const updateScheduledTicket = (id: string, data: Partial<ScheduledTicketRecord>) =>
  pb.collection('scheduled_tickets').update<ScheduledTicketRecord>(id, data)

export const deleteScheduledTicket = (id: string) => pb.collection('scheduled_tickets').delete(id)

export const cancelScheduledTicket = (id: string) =>
  pb.collection('scheduled_tickets').update<ScheduledTicketRecord>(id, {
    status: 'cancelado',
  })

export const reactivateScheduledTicket = (id: string, newDate?: string) => {
  const payload: Partial<ScheduledTicketRecord> = { status: 'agendado' }
  if (newDate) {
    payload.scheduled_date = newDate
  }
  return pb.collection('scheduled_tickets').update<ScheduledTicketRecord>(id, payload)
}

/** Formata a descrição da recorrência em texto amigável em português */
export const formatRecurrenceLabel = (
  type: RecurrenceType,
  daysOfWeek?: number[],
  dayOfMonth?: number,
  endDate?: string,
): string => {
  if (!type || type === 'none') {
    return 'Não repete'
  }

  const daysMap: Record<number, string> = {
    0: 'domingo',
    1: 'segunda',
    2: 'terça',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'sábado',
  }

  let base = ''
  if (type === 'daily') {
    base = 'Diário'
  } else if (type === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      if (daysOfWeek.length === 5 && [1, 2, 3, 4, 5].every((d) => daysOfWeek.includes(d))) {
        base = 'Segunda a sexta'
      } else if (daysOfWeek.length === 7) {
        base = 'Todos os dias'
      } else {
        const sorted = [...daysOfWeek].sort()
        const dayNames = sorted.map((d) => daysMap[d] || '')
        base = `Toda ${dayNames.join(', ')}`
      }
    } else {
      base = 'Semanal'
    }
  } else if (type === 'monthly') {
    if (dayOfMonth) {
      base = `Dia ${dayOfMonth} de cada mês`
    } else {
      base = 'Mensal'
    }
  }

  if (endDate) {
    const endFormatted = new Date(endDate).toLocaleDateString('pt-BR')
    base += ` (até ${endFormatted})`
  }

  return base
}

/** Opções de aviso prévio */
export const ADVANCE_NOTICE_OPTIONS = [
  { value: 0, label: 'Não avisar' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '24 horas antes' },
]

export const formatAdvanceNoticeLabel = (minutes?: number): string => {
  if (!minutes || minutes <= 0) return 'Não configurado'
  const found = ADVANCE_NOTICE_OPTIONS.find((opt) => opt.value === minutes)
  return found ? found.label : `${minutes} min antes`
}
