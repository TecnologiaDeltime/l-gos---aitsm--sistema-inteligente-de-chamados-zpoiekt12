import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSlaNotifications } from '@/hooks/use-sla-notifications'
import { initAudio, playTicketChime } from '@/lib/ticket-alerts'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getTicket } from '@/services/tickets'
import {
  chatPushPreview,
  getPushPreference,
  initPushNavigationListener,
  isTabHidden,
  pushBrandTitle,
  registerPushServiceWorker,
  requestPushPermission,
  showPushNotification,
} from '@/lib/push-notifications'
import { MessageSquare } from 'lucide-react'

/**
 * Barramento central de notificações (sino global + chat interno) e ponte para as
 * notificações push do navegador.
 *
 * Push (Notification API + service worker mínimo public/push-sw.js):
 * - Dispara apenas quando a aba NÃO está visível (segundo plano/minimizada) e o
 *   usuário ligou a preferência "Notificações push" (campo push_enabled, migração 0140).
 * - Opt-in no login: se a preferência está ligada mas a permissão ainda não foi
 *   concedida, pede UMA vez (sem loop). Se negada, reativar é pelo toggle nas
 *   Configurações > Notificações (com dica de liberar no navegador).
 * - Evita duplicidade: quando dispara push para um item (chat ou sino), o toast
 *   intrusivo local do mesmo item é suprimido na mesma passagem.
 */
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

  // Service worker mínimo + listener de navegação vinda do SW (clique na notificação).
  useEffect(() => {
    registerPushServiceWorker()
    initPushNavigationListener()
  }, [])

  // Opt-in ao logar: se o usuário JÁ ligou "Notificações push" (push_enabled) mas o
  // navegador ainda não concedeu a permissão, pede UMA vez por sessão de aba (nunca
  // em loop). Se negada, o toggle em Configurações mostra como reativar.
  const pushAskRef = useRef(false)
  useEffect(() => {
    if (!user || !user.push_enabled || pushAskRef.current) return
    pushAskRef.current = true
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestPushPermission().catch(() => {})
    }
  }, [user])

  /** Dispara o push do navegador quando a preferência/permissão/visibilidade permitem. */
  const firePushIfEligible = (
    opts: { chatBody?: string; fallbackTitle?: string; body: string; tag: string; url: string },
    chime: () => void,
  ): boolean => {
    if (!user) return false
    if (!isTabHidden()) return false
    if (!getPushPreference(user.id, user.push_enabled)) return false
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false

    showPushNotification({
      title: pushBrandTitle(opts.chatBody ? 'Nova mensagem' : (opts.fallbackTitle ?? '')),
      body: opts.chatBody ? `${opts.chatBody}: ${opts.body}` : opts.body,
      tag: opts.tag,
      url: opts.url,
    }).catch(() => {})
    chime()
    return true
  }

  useRealtime('notifications', (e) => {
    if (!initialized.current) return
    if (e.action !== 'create') return
    if (!user) return
    if (e.record.user !== user.id) return
    if (e.record.type !== 'Atribuição') return
    const rawMessage = e.record.message || ''
    const message = rawMessage.replace(/AITILSM/gi, 'AITSM')
    if (!message.includes('delegado')) return
    if (knownNotifIds.current.has(e.record.id)) return
    knownNotifIds.current.add(e.record.id)

    const ticketId = e.record.ticket || ''

    // Push do navegador (aba em segundo plano). Quando dispara, o toast intrusivo
    // local do mesmo item é suprimido (evita push duplo).
    const pushed = firePushIfEligible(
      {
        fallbackTitle: 'Chamado delegado',
        body: message,
        tag: `logos-delegation-${e.record.id}`,
        url: ticketId ? `/tickets/${ticketId}` : '/tickets',
      },
      () => playTicketChime('Média'),
    )
    if (pushed) return

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

    const content = e.record.content || 'Nova mensagem recebida'
    const preview = content.length > 80 ? content.slice(0, 80) + '...' : content
    const senderName = e.record.expand?.sender?.name || 'Alguém'

    // Push do navegador (aba em segundo plano): título com marca oficial, corpo com
    // nome do remetente + prévia ([Áudio]/[Foto]/[Vídeo] para anexos). Quando dispara,
    // o toast intrusivo local do mesmo item é suprimido (evita push duplo).
    const pushed = firePushIfEligible(
      {
        chatBody: senderName,
        body: chatPushPreview(content, e.record.file),
        tag: `logos-chat-${e.record.id}`,
        url: e.record.sender ? `/chat?partner=${e.record.sender}` : '/chat',
      },
      () => playTicketChime('Baixa'),
    )
    if (pushed) return

    // Se já estiver na tela de chat (/chat), não dispara toast intrusivo duplicado
    if (window.location.pathname.startsWith('/chat')) {
      playTicketChime('Baixa')
      return
    }

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
      } catch {
        /* intentionally ignored */
      }
    }

    playTicketChime('Baixa')
  })

  return null
}
