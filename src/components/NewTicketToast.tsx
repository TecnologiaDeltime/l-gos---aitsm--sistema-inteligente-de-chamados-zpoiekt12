import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { playTicketChime, isSelfCreatedTicket, initAudio } from '@/lib/ticket-alerts'
import { PriorityBadge } from '@/components/PriorityBadge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getTicket } from '@/services/tickets'

export function NewTicketToast() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const knownTicketIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    initAudio()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      initialized.current = true
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const isOperator = ['tecnico', 'gestor', 'admin'].includes(user?.role || '')

  const showPushNotification = (ticket: any) => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    const title = `Novo Chamado: ${ticket.number} - ${ticket.title}`
    const body = `Solicitante: ${ticket.requester_name} | Prioridade: ${ticket.priority}`

    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `ticket-${ticket.id}`,
      })
      notif.onclick = () => {
        window.focus()
        navigateRef.current(`/tickets/${ticket.id}`)
        notif.close()
      }
    } catch {
      // graceful degradation
    }
  }

  const showToast = (ticket: any) => {
    const operator = ticket.expand?.assigned_to
    const operatorAvatar = operator?.avatar
      ? `${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${operator.id}/${operator.avatar}`
      : undefined

    toast.custom(
      (t) => (
        <div
          className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 shadow-lg dark:bg-slate-900"
          onClick={() => {
            navigate(`/tickets/${ticket.id}`)
            toast.dismiss(t)
          }}
        >
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-blue-600">{ticket.number}</span>
              <PriorityBadge priority={ticket.priority} />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ticket.title}</p>
            <p className="text-xs text-slate-500">Solicitante: {ticket.requester_name}</p>
            {operator && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <Avatar className="h-5 w-5">
                  {operatorAvatar && <AvatarImage src={operatorAvatar} />}
                  <AvatarFallback className="bg-blue-600 text-[8px] text-white">
                    {operator.name?.substring(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Operador: {operator.name}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              toast.dismiss(t)
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      ),
      { duration: 5000 },
    )
  }

  useRealtime('tickets', (e) => {
    if (!initialized.current) return
    if (!isOperator) return
    if (e.action !== 'create') return
    if (isSelfCreatedTicket(e.record.id)) return
    if (knownTicketIds.current.has(e.record.id)) return
    knownTicketIds.current.add(e.record.id)

    const priority = (e.record as any).priority || 'Média'
    playTicketChime(priority)

    getTicket(e.record.id)
      .then((ticket) => {
        showToast(ticket)
        showPushNotification(ticket)
      })
      .catch(() => {
        showToast(e.record as any)
        showPushNotification(e.record as any)
      })
  })

  return null
}
