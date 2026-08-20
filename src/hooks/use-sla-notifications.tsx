import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Inbox } from 'lucide-react'
import { getQueues } from '@/services/queues'
import { getTickets, TicketRecord } from '@/services/tickets'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getVoiceAlertsEnabled, getSlaThresholdMinutes } from '@/lib/notification-settings'

function speak(text: string) {
  if (document.visibilityState !== 'visible') return
  if (!getVoiceAlertsEnabled()) return
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'pt-BR'
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}

const RESOLVED_SLA_STATUSES = new Set(['Violado', 'Resolvido'])
const CLOSED_TICKET_STATUSES = new Set(['Encerrado', 'Cancelado', 'Resolvido'])

export function useSlaNotifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const slaAlertedRef = useRef<Set<string>>(new Set())
  const newTicketAlertedRef = useRef<Set<string>>(new Set())
  const queueIdsRef = useRef<string[]>([])
  const assignedTicketsRef = useRef<TicketRecord[]>([])

  useEffect(() => {
    if (!user?.id) {
      queueIdsRef.current = []
      assignedTicketsRef.current = []
      slaAlertedRef.current.clear()
      newTicketAlertedRef.current.clear()
      return
    }
    getQueues()
      .then((queues) => {
        queueIdsRef.current = queues
          .filter((q) => {
            const members = q.members as any
            if (!members || !Array.isArray(members)) return false
            return members.some((m: any) =>
              typeof m === 'string' ? m === user.id : m?.id === user.id,
            )
          })
          .map((q) => q.id)
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const filter = `assigned_to = "${user.id}" && sla_status != 'Violado'`
    getTickets(filter)
      .then((tickets) => {
        assignedTicketsRef.current = tickets.filter(
          (t) =>
            !CLOSED_TICKET_STATUSES.has(t.status) && !RESOLVED_SLA_STATUSES.has(t.sla_status || ''),
        )
      })
      .catch(() => {})
  }, [user?.id])

  const checkSla = useCallback(() => {
    if (!user?.id) return
    const threshold = getSlaThresholdMinutes()
    const now = Date.now()
    const thresholdMs = threshold * 60000

    for (const ticket of assignedTicketsRef.current) {
      if (!ticket.sla_solution_deadline) continue
      if (slaAlertedRef.current.has(ticket.id)) continue
      if (RESOLVED_SLA_STATUSES.has(ticket.sla_status || '')) continue
      if (ticket.sla_paused) continue

      const deadlineMs = new Date(ticket.sla_solution_deadline).getTime()
      if (isNaN(deadlineMs)) continue

      const diff = deadlineMs - now
      if (diff <= thresholdMs && diff > 0) {
        slaAlertedRef.current.add(ticket.id)
        speak('Você tem SLA prestes a vencer')
        toast.warning('SLA prestes a vencer', {
          description: `Chamado #${ticket.number}: ${ticket.title} – ${ticket.priority}`,
          duration: 10000,
          icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
          action: {
            label: 'Abrir',
            onClick: () => navigate(`/tickets/${ticket.id}`),
          },
        })
      }
    }
  }, [user?.id, navigate])

  useEffect(() => {
    if (!user?.id) return
    const interval = setInterval(checkSla, 60000)
    const timeout = setTimeout(checkSla, 5000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [user?.id, checkSla])

  useRealtime(
    'tickets',
    (e) => {
      if (!user?.id) return
      const record = e.record as unknown as TicketRecord

      if (e.action === 'create') {
        if (newTicketAlertedRef.current.has(record.id)) return
        const isAssigned = record.assigned_to === user.id
        const isInQueue = !!record.queue && queueIdsRef.current.includes(record.queue)

        if (isAssigned || isInQueue) {
          newTicketAlertedRef.current.add(record.id)
          speak('Você possui um novo chamado na sua fila de atendimento')
          toast.info('Novo chamado na sua fila', {
            description: `Chamado #${record.number}: ${record.title} – ${record.priority}`,
            duration: 10000,
            icon: <Inbox className="h-5 w-5 text-blue-500" />,
            action: {
              label: 'Abrir',
              onClick: () => navigate(`/tickets/${record.id}`),
            },
          })
          if (isAssigned && !CLOSED_TICKET_STATUSES.has(record.status)) {
            assignedTicketsRef.current = [...assignedTicketsRef.current, record]
          }
        }
      } else if (e.action === 'update') {
        if (record.assigned_to === user.id) {
          const idx = assignedTicketsRef.current.findIndex((t) => t.id === record.id)
          if (idx >= 0) {
            assignedTicketsRef.current[idx] = record
          } else if (!CLOSED_TICKET_STATUSES.has(record.status)) {
            assignedTicketsRef.current = [...assignedTicketsRef.current, record]
          }
          if (RESOLVED_SLA_STATUSES.has(record.sla_status || '')) {
            slaAlertedRef.current.delete(record.id)
          }
        } else {
          assignedTicketsRef.current = assignedTicketsRef.current.filter((t) => t.id !== record.id)
          slaAlertedRef.current.delete(record.id)
        }
      } else if (e.action === 'delete') {
        assignedTicketsRef.current = assignedTicketsRef.current.filter((t) => t.id !== record.id)
        slaAlertedRef.current.delete(record.id)
        newTicketAlertedRef.current.delete(record.id)
      }
    },
    !!user?.id,
  )
}
