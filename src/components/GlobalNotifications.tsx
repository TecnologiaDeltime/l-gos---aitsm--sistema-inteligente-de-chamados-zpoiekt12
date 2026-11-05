import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSlaNotifications } from '@/hooks/use-sla-notifications'
import { initAudio, playTicketChime } from '@/lib/ticket-alerts'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getTicket } from '@/services/tickets'
import { MessageSquare } from 'lucide-react'

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

  // Notificação global de nova mensagem no chat interno entre operadores
  useRealtime('operator_chat_messages', (e) => {
    if (!initialized.current) return
    if (e.action !== 'create') return
    if (!user) return
    if (e.record.recipient !== user.id) return
    if (knownNotifIds.current.has(e.record.id)) return
    knownNotifIds.current.add(e.record.id)

    // Se já estiver na tela de chat (/chat), não dispara toast intrusivo duplicado
    if (window.location.pathname.startsWith('/chat')) {
      playTicketChime('Baixa')
      return
    }

    const content = e.record.content || 'Nova mensagem recebida'
    const preview = content.length > 80 ? content.slice(0, 80) + '...' : content

    toast.custom(
      (t) => (
        <div
          className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-white p-3.5 shadow-lg dark:border-amber-800 dark:bg-slate-900"
          onClick={() => {
            navigateRef.current('/chat')
            toast.dismiss(t)
          }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
              Chat Interno • Nova Mensagem
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 break-words">{preview}</p>
          </div>
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              toast.dismiss(t)
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
          >
            ✕
          </button>
        </div>
      ),
      { duration: 5000 },
    )

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notif = new Notification('Chat Interno — Nova Mensagem', {
          body: preview,
          icon: '/favicon.ico',
          tag: `chat-${e.record.id}`,
        })
        notif.onclick = () => {
          window.focus()
          navigateRef.current('/chat')
          notif.close()
        }
      } catch { /* intentionally ignored */ }
    }

    playTicketChime('Baixa')
  })

  return null
}
