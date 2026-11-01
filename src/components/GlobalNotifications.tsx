import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSlaNotifications } from '@/hooks/use-sla-notifications'
import { initAudio, playTicketChime } from '@/lib/ticket-alerts'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getTicket } from '@/services/tickets'

export function GlobalNotifications() {
  useSlaNotifications()
  const { user } = useAuth()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const knownNotifIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

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

  useRealtime('notifications', (e) => {
    if (!initialized.current) return
    if (e.action !== 'create') return
    if (!user) return
    if (e.record.user !== user.id) return
    if (e.record.type !== 'Atribuição') return
    const message = e.record.message || ''
    if (!message.includes('delegado')) return
    if (knownNotifIds.current.has(e.record.id)) return
    knownNotifIds.current.add(e.record.id)

    const ticketId = e.record.ticket || ''

    toast.custom(
      (t) => (
        <div
          className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 shadow-lg dark:bg-slate-900"
          onClick={() => {
            if (ticketId) navigateRef.current(`/tickets/${ticketId}`)
            toast.dismiss(t)
          }}
        >
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Chamado Delegado
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
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
      { duration: 6000 },
    )

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notif = new Notification('Chamado Delegado', {
          body: message,
          icon: '/favicon.ico',
          tag: `delegation-${e.record.id}`,
        })
        notif.onclick = () => {
          window.focus()
          if (ticketId) navigateRef.current(`/tickets/${ticketId}`)
          notif.close()
        }
      } catch {
        // graceful degradation
      }
    }

    if (ticketId) {
      getTicket(ticketId)
        .then((ticket) => {
          playTicketChime(ticket.priority || 'Média')
        })
        .catch(() => {
          playTicketChime('Média')
        })
    } else {
      playTicketChime('Média')
    }
  })

  return null
}
