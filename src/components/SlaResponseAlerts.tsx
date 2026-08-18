import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getSlaAlertSettings } from '@/services/sla-alert-settings'
import { getTicket, TicketRecord } from '@/services/tickets'
import { playTicketChime, initAudio } from '@/lib/ticket-alerts'
import { getVoiceAlertsEnabled } from '@/lib/notification-settings'

interface ActiveAlert {
  notifId: string
  ticketId: string
  number: string
  title: string
  company?: string
  client?: string
  deadline?: string
}

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

function formatCountdown(deadline?: string): string {
  if (!deadline) return '--:--:--'
  const dl = new Date(deadline).getTime()
  if (isNaN(dl)) return '--:--:--'
  let diff = Math.max(0, dl - Date.now())
  const hours = Math.floor(diff / 3600000)
  diff -= hours * 3600000
  const minutes = Math.floor(diff / 60000)
  diff -= minutes * 60000
  const seconds = Math.floor(diff / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/**
 * Componente de alerta de SLA de Resposta prestes a vencer.
 * Escuta notificações em tempo real (WebSocket) da coleção `notifications`
 * com type = 'SLA' dirigidas ao usuário atual. Ao receber, exibe um toast
 * customizado com contagem regressiva, reproduz o som de alerta e fala a
 * mensagem (Web Speech API / SpeechSynthesis).
 */
export function SlaResponseAlerts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const knownIds = useRef<Set<string>>(new Set())
  const activeAlertsRef = useRef<Record<string, ActiveAlert>>({})
  const [activeAlerts, setActiveAlerts] = useState<Record<string, ActiveAlert>>({})
  const [, setTick] = useState(0)
  const enabledRef = useRef(true)
  const popupRef = useRef(true)
  const voiceRef = useRef(true)

  useEffect(() => {
    initAudio()
    getSlaAlertSettings()
      .then((s) => {
        enabledRef.current = s.enabled
        popupRef.current = s.popup_enabled
        voiceRef.current = s.voice_enabled
      })
      .catch(() => {})
  }, [])

  // Atualiza configurações em tempo real (se alteradas na tela de Settings).
  useRealtime(
    'sla_alert_settings',
    () => {
      getSlaAlertSettings()
        .then((s) => {
          enabledRef.current = s.enabled
          popupRef.current = s.popup_enabled
          voiceRef.current = s.voice_enabled
        })
        .catch(() => {})
    },
    true,
  )

  // Tick de contagem regressiva a cada segundo.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

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
      if (!user?.id) return
      if (e.action !== 'create') return
      const rec = e.record as unknown as any
      if (rec.user !== user.id) return
      if (rec.type !== 'SLA') return
      // Ignora marcadores de throttle (popup desabilitado).
      if ((rec.message || '') === 'marcador de intervalo') return
      if (!enabledRef.current) return
      if (knownIds.current.has(rec.id)) return
      knownIds.current.add(rec.id)

      const ticketId = rec.ticket || ''
      const title = rec.title || ''
      const message = rec.message || ''
      // Extrai o número do ticket a partir do título "...#XXXX".
      const numberMatch = title.match(/#([^\s]+)/)
      const number = numberMatch ? numberMatch[1] : ''
      // Extrai empresa/cliente/tempo restante da mensagem, se presente.
      const empresaMatch = message.match(/Empresa:\s*([^|]+)/i)
      const clienteMatch = message.match(/Cliente:\s*([^|]+)/i)
      const tempoMatch = message.match(/Tempo restante:\s*(\d+)/i)
      const remainingMin = tempoMatch ? parseInt(tempoMatch[1], 10) : undefined

      const alert: ActiveAlert = {
        notifId: rec.id,
        ticketId,
        number,
        title: title.replace(/^⚠️\s*SLA de Resposta prestes a vencer - Ticket\s*/i, ''),
        company: empresaMatch ? empresaMatch[1].trim() : undefined,
        client: clienteMatch ? clienteMatch[1].trim() : undefined,
        deadline: remainingMin
          ? new Date(Date.now() + remainingMin * 60000).toISOString()
          : undefined,
      }

      // Busca o ticket para obter o título correto e o deadline real.
      if (ticketId) {
        getTicket(ticketId)
          .then((t: TicketRecord) => {
            alert.title = t.title
            alert.deadline = t.sla_response_deadline
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
        playTicketChime('Crítica')
        // Voz (Web Speech API).
        if (voiceRef.current) {
          const txt =
            'Atenção! O ticket número ' +
            (a.number || '') +
            ', da empresa ' +
            (a.company || 'não informada') +
            ', está com o SLA de Resposta prestes a vencer. ' +
            (remainingMin ? 'Tempo restante: ' + remainingMin + ' minutos.' : '')
          speak(txt)
        }
        // Toast adicional (sonner) para visibilidade rápida.
        toast.warning('SLA de Resposta prestes a vencer', {
          description: 'Ticket #' + a.number + ': ' + a.title,
          duration: 10000,
          icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        })
      }
    },
    !!user?.id,
  )

  if (Object.keys(activeAlerts).length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {Object.values(activeAlerts).map((alert) => (
        <div
          key={alert.notifId}
          className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-xl dark:border-amber-700 dark:bg-amber-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                  #{alert.number}
                </span>
              </div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {alert.title}
              </p>
              {alert.company && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Empresa: {alert.company}
                </p>
              )}
              {alert.client && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Cliente: {alert.client}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-amber-700 dark:text-amber-300">Tempo restante:</span>
                <span className="font-mono text-sm font-bold text-amber-900 dark:text-amber-100">
                  {formatCountdown(alert.deadline)}
                </span>
              </div>
            </div>
            <button
              onClick={() => dismissAlert(alert.notifId)}
              className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
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
              className="flex-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Abrir Chamado
            </button>
            <button
              onClick={() => dismissAlert(alert.notifId)}
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
            >
              Dispensar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
