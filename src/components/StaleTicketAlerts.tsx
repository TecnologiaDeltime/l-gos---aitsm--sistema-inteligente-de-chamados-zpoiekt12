import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Hourglass, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getStaleTicketAlertSettings } from '@/services/stale-ticket-alert-settings'
import { getTicket, TicketRecord } from '@/services/tickets'
import { playTicketChime, initAudio } from '@/lib/ticket-alerts'
import { getVoiceAlertsEnabled, getOperatorAlertsMuted } from '@/lib/notification-settings'

interface ActiveAlert {
  notifId: string
  ticketId: string
  number: string
  title: string
  company?: string
  client?: string
  hoursStale?: number
}

function speak(text: string) {
  if (document.visibilityState !== 'visible') return
  if (getOperatorAlertsMuted()) return
  if (!getVoiceAlertsEnabled()) return
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  } catch {
    /* ignore */
  }
}

/**
 * Componente de alerta de chamados abertos sem atualização há mais de X horas.
 * Escuta notificações em tempo real (WebSocket) da coleção `notifications`
 * com type = 'StaleTicket' dirigidas ao usuário atual. Ao receber, exibe um
 * toast customizado (popup), reproduz o som de alerta e fala a mensagem
 * (Web Speech API / SpeechSynthesis).
 */
export function StaleTicketAlerts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const knownIds = useRef<Set<string>>(new Set())
  const activeAlertsRef = useRef<Record<string, ActiveAlert>>({})
  const [activeAlerts, setActiveAlerts] = useState<Record<string, ActiveAlert>>({})
  const enabledRef = useRef(true)
  const popupRef = useRef(true)
  const voiceRef = useRef(true)

  useEffect(() => {
    initAudio()
    getStaleTicketAlertSettings()
      .then((s) => {
        enabledRef.current = s.enabled
        popupRef.current = s.popup_enabled
        voiceRef.current = s.voice_enabled
      })
      .catch(() => {})
  }, [])

  // Atualiza configurações em tempo real (se alteradas na tela de Settings).
  useRealtime(
    'stale_ticket_alert_settings',
    () => {
      getStaleTicketAlertSettings()
        .then((s) => {
          enabledRef.current = s.enabled
          popupRef.current = s.popup_enabled
          voiceRef.current = s.voice_enabled
        })
        .catch(() => {})
    },
    true,
  )

  const showAlert = useCallback((alert: ActiveAlert) => {
    activeAlertsRef.current[alert.notifId] = alert
    setActiveAlerts({ ...activeAlertsRef.current })
  }, [])

  const dismissAlert = useCallback((notifId: string) => {
    delete activeAlertsRef.current[notifId]
    setActiveAlerts({ ...activeAlertsRef.current })
  }, [])

  useRealtime(
    'notifications',
    (e) => {
      if (getOperatorAlertsMuted() || user?.alerts_muted) return
      if (!user?.id) return
      if (e.action !== 'create') return
      const rec = e.record as unknown as any
      if (rec.user !== user.id) return
      if (rec.type !== 'StaleTicket') return
      if (!enabledRef.current) return
      if (knownIds.current.has(rec.id)) return
      knownIds.current.add(rec.id)

      const ticketId = rec.ticket || ''
      const title = rec.title || ''
      const message = rec.message || ''
      // Extrai o número do ticket a partir do título "...#XXXX".
      const numberMatch = title.match(/#([^\s]+)/)
      const number = numberMatch ? numberMatch[1] : ''
      // Extrai empresa/cliente/tempo sem atualização da mensagem.
      const empresaMatch = message.match(/Empresa:\s*([^|]+)/i)
      const clienteMatch = message.match(/Cliente:\s*([^|]+)/i)
      const tempoMatch = message.match(/Sem atualização há:\s*(\d+)/i)
      const hoursStale = tempoMatch ? parseInt(tempoMatch[1], 10) : undefined

      const alert: ActiveAlert = {
        notifId: rec.id,
        ticketId,
        number,
        title: title.replace(/^⏳\s*Chamado sem atualização - Ticket\s*/i, ''),
        company: empresaMatch ? empresaMatch[1].trim() : undefined,
        client: clienteMatch ? clienteMatch[1].trim() : undefined,
        hoursStale,
      }

      // Busca o ticket para obter o título/número/empresa corretos.
      if (ticketId) {
        getTicket(ticketId)
          .then((t: TicketRecord) => {
            alert.title = t.title
            alert.number = t.number
            const company = t.expand?.company
            if (company) alert.company = company.legal_name || company.name || alert.company
            alert.client = t.requester_name || alert.client
            fireAlert(alert)
          })
          .catch(() => fireAlert(alert))
      } else {
        fireAlert(alert)
      }

      function fireAlert(a: ActiveAlert) {
        // Popup / toast customizado.
        if (popupRef.current) {
          showAlert(a)
        }
        // Som de alerta (mesmo mecanismo de novos chamados).
        playTicketChime('Alta')
        // Voz (Web Speech API).
        if (voiceRef.current) {
          const txt =
            'Atenção! O ticket número ' +
            (a.number || '') +
            ' está sem atualização há mais de ' +
            (a.hoursStale || 8) +
            ' horas.'
          speak(txt)
        }
        // Toast adicional (sonner) para visibilidade rápida.
        toast.warning('Chamado sem atualização', {
          description: 'Ticket #' + a.number + ': ' + a.title,
          duration: 10000,
          icon: <Hourglass className="h-5 w-5 text-blue-500" />,
        })
      }
    },
    !!user?.id,
  )

  if (getOperatorAlertsMuted() || user?.alerts_muted) return null
  const pendingCount = Object.keys(activeAlerts).length
  if (pendingCount === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {pendingCount > 1 && (
        <div className="pointer-events-none self-end rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
          {pendingCount} chamados sem atualização
        </div>
      )}
      {Object.values(activeAlerts).map((alert) => (
        <div
          key={alert.notifId}
          className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-blue-300 bg-blue-50 p-4 shadow-xl dark:border-blue-700 dark:bg-blue-950"
        >
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                  #{alert.number}
                </span>
                {alert.hoursStale != null && (
                  <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Sem atualização há {alert.hoursStale}h
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                {alert.title}
              </p>
              {alert.company && (
                <p className="text-xs text-blue-700 dark:text-blue-300">Empresa: {alert.company}</p>
              )}
              {alert.client && (
                <p className="text-xs text-blue-700 dark:text-blue-300">Cliente: {alert.client}</p>
              )}
            </div>
            <button
              onClick={() => dismissAlert(alert.notifId)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigateRef.current('/tickets/' + alert.ticketId)
                dismissAlert(alert.notifId)
              }}
              className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Abrir Chamado
            </button>
            <button
              onClick={() => dismissAlert(alert.notifId)}
              className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              Dispensar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
