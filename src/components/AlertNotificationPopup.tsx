import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hourglass, AlertTriangle, X, ExternalLink, Eye, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { playTicketChime, initAudio } from '@/lib/ticket-alerts'
import { getVoiceAlertsEnabled } from '@/lib/notification-settings'
import { createAlertAuditLog, AlertType, AlertAuditMetadata } from '@/services/alert-audit'
import { getTicket, TicketRecord } from '@/services/tickets'
import { getStaleTicketAlertSettings } from '@/services/stale-ticket-alert-settings'
import { getSlaAlertSettings } from '@/services/sla-alert-settings'
import { getRetainedTickets } from '@/services/retained-tickets'
import { Button } from '@/components/ui/button'

export interface ActiveAlertPopup {
  notifId: string
  alertType: AlertType
  title: string
  message: string
  ticketId?: string
  contractId?: string
  metadata: AlertAuditMetadata
  createdTime: number
  deadline?: string
}

function speak(text: string) {
  if (document.visibilityState !== 'visible') return
  if (!getVoiceAlertsEnabled()) return
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  } catch {
    /* intentionally ignored */
  }
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

export function AlertNotificationPopup() {
  const { user } = useAuth()
  const perms = usePermissions()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const isManagerOrAdmin = perms.isAdmin || perms.isGestor

  const [activeAlerts, setActiveAlerts] = useState<Record<string, ActiveAlertPopup>>({})
  const activeAlertsRef = useRef<Record<string, ActiveAlertPopup>>({})
  const knownIds = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const [, setTick] = useState(0)

  // Rastreamento para evitar repetição de voz e popup de chamados retidos
  const lastRetainedSpokenCountRef = useRef<number>(0)
  const lastRetainedNotifCountRef = useRef<number>(0)

  // Configurações globais
  const staleSettingsRef = useRef({ enabled: true, popup_enabled: true, voice_enabled: true })
  const slaSettingsRef = useRef({ enabled: true, popup_enabled: true, voice_enabled: true })

  // Inicialização de áudio e configurações
  useEffect(() => {
    initAudio()
    getStaleTicketAlertSettings()
      .then((s) => {
        staleSettingsRef.current = {
          enabled: s.enabled,
          popup_enabled: s.popup_enabled,
          voice_enabled: s.voice_enabled,
        }
      })
      .catch(() => {})

    getSlaAlertSettings()
      .then((s) => {
        slaSettingsRef.current = {
          enabled: s.enabled,
          popup_enabled: s.popup_enabled,
          voice_enabled: s.voice_enabled,
        }
      })
      .catch(() => {})

    const timer = setTimeout(() => {
      initializedRef.current = true
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // Timer para atualização de contagem regressiva
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Atualização em tempo real das configurações
  useRealtime(
    'stale_ticket_alert_settings',
    () => {
      getStaleTicketAlertSettings()
        .then((s) => {
          staleSettingsRef.current = {
            enabled: s.enabled,
            popup_enabled: s.popup_enabled,
            voice_enabled: s.voice_enabled,
          }
        })
        .catch(() => {})
    },
    true,
  )

  useRealtime(
    'sla_alert_settings',
    () => {
      getSlaAlertSettings()
        .then((s) => {
          slaSettingsRef.current = {
            enabled: s.enabled,
            popup_enabled: s.popup_enabled,
            voice_enabled: s.voice_enabled,
          }
        })
        .catch(() => {})
    },
    true,
  )

  const showAlert = useCallback((alert: ActiveAlertPopup) => {
    activeAlertsRef.current[alert.notifId] = alert
    setActiveAlerts({ ...activeAlertsRef.current })
  }, [])

  const removeAlert = useCallback((notifId: string) => {
    delete activeAlertsRef.current[notifId]
    setActiveAlerts({ ...activeAlertsRef.current })
  }, [])

  const handleAction = useCallback(
    async (alert: ActiveAlertPopup, action: 'OPENED' | 'DISMISSED' | 'VIEWED') => {
      removeAlert(alert.notifId)

      if (user?.id) {
        try {
          await createAlertAuditLog({
            alert_type: alert.alertType,
            ticket: alert.ticketId || undefined,
            contract: alert.contractId || undefined,
            operator: user.id,
            action,
            metadata: alert.metadata,
          })
        } catch (err) {
          console.error('Falha ao registrar log de auditoria de alerta:', err)
        }
      }

      if (action === 'OPENED') {
        if (alert.alertType === 'RETAINED_TICKETS') {
          navigateRef.current('/tickets/retained')
        } else if (alert.ticketId) {
          navigateRef.current(`/tickets/${alert.ticketId}`)
        }
      } else if (action === 'VIEWED') {
        if (alert.alertType === 'RETAINED_TICKETS') {
          navigateRef.current('/tickets/retained')
        } else {
          navigateRef.current('/horas-clientes')
        }
      }
    },
    [user?.id, removeAlert],
  )

  // Escuta a coleção notifications em tempo real
  useRealtime(
    'notifications',
    (e) => {
      if (!user?.id) return
      if (!initializedRef.current) return
      if (e.action !== 'create') return

      const rec = e.record as any
      if (rec.user !== user.id) return

      const notifType = rec.type as string
      if (
        notifType !== 'StaleTicket' &&
        notifType !== 'SLA' &&
        notifType !== 'Alerta' &&
        notifType !== 'RetainedTicket'
      ) {
        return
      }

      if (knownIds.current.has(rec.id)) return
      knownIds.current.add(rec.id)

      const title = rec.title || ''
      const message = rec.message || ''
      const ticketId = rec.ticket || ''

      // Ignora marcadores de throttle
      if (message === 'marcador de intervalo') return

      // ==========================================
      // Caso 1: StaleTicket (Chamado sem atualização)
      // ==========================================
      if (notifType === 'StaleTicket') {
        if (!staleSettingsRef.current.enabled || !staleSettingsRef.current.popup_enabled) return

        const numberMatch = title.match(/#([^\s]+)/) || message.match(/Ticket #([^\s|]+)/)
        const ticketNumber = numberMatch ? numberMatch[1] : ''
        const empresaMatch = message.match(/Empresa:\s*([^|]+)/i)
        const clienteMatch = message.match(/Cliente:\s*([^|]+)/i)
        const tempoMatch = message.match(/Sem atualização há:\s*(\d+)/i)
        const hoursStale = tempoMatch ? parseInt(tempoMatch[1], 10) : undefined

        const metadata: AlertAuditMetadata = {
          ticketNumber,
          hoursStale: hoursStale || 8,
          companyName: empresaMatch ? empresaMatch[1].trim() : undefined,
          clientName: clienteMatch ? clienteMatch[1].trim() : undefined,
          title,
          message,
        }

        const alertItem: ActiveAlertPopup = {
          notifId: rec.id,
          alertType: 'STALE_TICKET',
          title: '⏳ Chamado sem Atualização',
          message:
            message || `Ticket #${ticketNumber} está sem atualização há ${hoursStale || 8} hora(s)`,
          ticketId: ticketId || undefined,
          metadata,
          createdTime: Date.now(),
        }

        if (ticketId) {
          getTicket(ticketId)
            .then((t: TicketRecord) => {
              if (t.number) alertItem.metadata.ticketNumber = t.number
              if (t.title) alertItem.metadata.title = t.title
              const company = t.expand?.company
              if (company)
                alertItem.metadata.companyName =
                  company.trade_name || company.legal_name || company.name
              if (t.requester_name) alertItem.metadata.clientName = t.requester_name
              showAlert(alertItem)
            })
            .catch(() => showAlert(alertItem))
        } else {
          showAlert(alertItem)
        }

        playTicketChime('Alta')
        if (staleSettingsRef.current.voice_enabled) {
          speak(
            `Atenção! O ticket número ${ticketNumber} está sem atualização há ${hoursStale || 8} horas.`,
          )
        }
      }

      // ==========================================
      // Caso 2: SLA (Resposta ou Solução)
      // ==========================================
      else if (notifType === 'SLA') {
        if (!slaSettingsRef.current.enabled || !slaSettingsRef.current.popup_enabled) return

        const isSolucao =
          /solução|solucao|resolução|resolucao/i.test(title) || /solução|solucao/i.test(message)
        const alertType: AlertType = isSolucao ? 'SLA_RESOLUTION' : 'SLA_RESPONSE'

        const numberMatch = title.match(/#([^\s]+)/) || message.match(/Ticket #([^\s|]+)/)
        const ticketNumber = numberMatch ? numberMatch[1] : ''
        const empresaMatch = message.match(/Empresa:\s*([^|]+)/i)
        const clienteMatch = message.match(/Cliente:\s*([^|]+)/i)
        const tempoMatch = message.match(/Tempo restante:\s*(\d+)/i)
        const remainingMinutes = tempoMatch ? parseInt(tempoMatch[1], 10) : undefined

        const metadata: AlertAuditMetadata = {
          ticketNumber,
          remainingMinutes,
          companyName: empresaMatch ? empresaMatch[1].trim() : undefined,
          clientName: clienteMatch ? clienteMatch[1].trim() : undefined,
          title,
          message,
        }

        const alertItem: ActiveAlertPopup = {
          notifId: rec.id,
          alertType,
          title:
            title ||
            (isSolucao
              ? '⚠️ SLA de Solução prestes a vencer'
              : '⚠️ SLA de Resposta prestes a vencer'),
          message: message || `Ticket #${ticketNumber} está com o SLA prestes a vencer.`,
          ticketId: ticketId || undefined,
          metadata,
          createdTime: Date.now(),
          deadline: remainingMinutes
            ? new Date(Date.now() + remainingMinutes * 60000).toISOString()
            : undefined,
        }

        if (ticketId) {
          getTicket(ticketId)
            .then((t: TicketRecord) => {
              if (t.number) alertItem.metadata.ticketNumber = t.number
              if (t.title) alertItem.metadata.title = t.title
              const company = t.expand?.company
              if (company)
                alertItem.metadata.companyName =
                  company.trade_name || company.legal_name || company.name
              if (t.requester_name) alertItem.metadata.clientName = t.requester_name
              if (isSolucao && t.sla_solution_deadline) {
                alertItem.deadline = t.sla_solution_deadline
              } else if (!isSolucao && t.sla_response_deadline) {
                alertItem.deadline = t.sla_response_deadline
              }
              showAlert(alertItem)
            })
            .catch(() => showAlert(alertItem))
        } else {
          showAlert(alertItem)
        }

        playTicketChime('Crítica')
        if (slaSettingsRef.current.voice_enabled) {
          const typeName = isSolucao ? 'SLA de Solução' : 'SLA de Resposta'
          speak(`Atenção! O ticket número ${ticketNumber} está com o ${typeName} prestes a vencer.`)
        }
      }

      // ==========================================
      // Caso 3: Alerta (Consumo de Horas)
      // ==========================================
      else if (notifType === 'Alerta') {
        const isConsumption =
          /consumo/i.test(title) ||
          /contrato/i.test(title) ||
          /consumo/i.test(message) ||
          /contrato/i.test(message)

        if (!isConsumption) return

        const contractMatch = message.match(/Contrato\s+([^:|]+)/i)
        const contractNumber = contractMatch ? contractMatch[1].trim() : undefined
        const levelMatch = message.match(/Nível:\s*([^|]+)/i)
        const level = levelMatch ? levelMatch[1].trim() : undefined
        const pctMatch =
          title.match(/(\d+)%/) || message.match(/(\d+)%/) || message.match(/Consumo:\s*(\d+)%/i)
        const percentage = pctMatch ? parseInt(pctMatch[1], 10) : undefined
        const empresaMatch = message.match(/Empresa:\s*([^|]+)/i)

        const metadata: AlertAuditMetadata = {
          contractNumber,
          level,
          percentage,
          companyName: empresaMatch ? empresaMatch[1].trim() : undefined,
          title,
          message,
        }

        const alertItem: ActiveAlertPopup = {
          notifId: rec.id,
          alertType: 'CONSUMPTION',
          title: title || '⚠️ Alerta de Consumo de Horas',
          message: message,
          contractId: rec.contract || undefined,
          ticketId: ticketId || undefined,
          metadata,
          createdTime: Date.now(),
        }

        showAlert(alertItem)
        playTicketChime('Alta')
      }

      // ==========================================
      // Caso 4: RetainedTicket (Chamados Retidos)
      // ==========================================
      else if (notifType === 'RetainedTicket') {
        if (!isManagerOrAdmin) return

        const countMatch = title.match(/(\d+)/) || message.match(/(\d+)/)
        const pendingCount = countMatch ? parseInt(countMatch[1], 10) : 1

        const alertItem: ActiveAlertPopup = {
          notifId: rec.id,
          alertType: 'RETAINED_TICKETS',
          title: title || '⚠️ Chamados Retidos Aguardando Análise',
          message:
            message ||
            (pendingCount === 1
              ? 'Existe 1 chamado retido aguardando liberação ou descarte.'
              : `Existem ${pendingCount} chamados retidos aguardando análise.`),
          metadata: {
            title,
            message,
            retainedCount: pendingCount,
          },
          createdTime: Date.now(),
        }

        showAlert(alertItem)
        playTicketChime('Alta')

        // Disparo por voz apenas se não estiver na página de chamados retidos e ainda não falado para essa contagem
        const isOnRetainedPage = window.location.pathname === '/tickets/retained'
        if (!isOnRetainedPage && lastRetainedSpokenCountRef.current !== pendingCount) {
          lastRetainedSpokenCountRef.current = pendingCount
          const speechText =
            pendingCount === 1
              ? 'Atenção. Existe 1 chamado retido aguardando análise.'
              : `Atenção. Existem ${pendingCount} chamados retidos aguardando análise.`
          speak(speechText)
        }
      }
    },
    !!user?.id,
  )

  // ==========================================
  // Fallback Polling a cada 5 minutos para chamados retidos pendentes
  // ==========================================
  useEffect(() => {
    if (!user?.id || !isManagerOrAdmin) return

    const checkPendingRetained = async () => {
      try {
        const pending = await getRetainedTickets('status = "Pendente"')
        const count = pending.length
        if (count > 0 && lastRetainedNotifCountRef.current !== count) {
          // Se já existe um alerta ativo de chamados retidos, não duplicamos
          const hasExisting = Object.values(activeAlertsRef.current).some(
            (a) => a.alertType === 'RETAINED_TICKETS',
          )
          if (!hasExisting) {
            lastRetainedNotifCountRef.current = count
            const notifId = `retained-fallback-${count}-${Date.now()}`
            const title =
              count === 1
                ? '⚠️ 1 chamado retido aguardando análise'
                : `⚠️ ${count} chamados retidos aguardando análise`
            const message =
              count === 1
                ? 'Existe 1 chamado retido por domínio não autorizado aguardando liberação ou descarte.'
                : `Existem ${count} chamados retidos por domínio não autorizado aguardando liberação ou descarte.`

            const alertItem: ActiveAlertPopup = {
              notifId,
              alertType: 'RETAINED_TICKETS',
              title,
              message,
              metadata: {
                title,
                message,
                retainedCount: count,
              },
              createdTime: Date.now(),
            }

            showAlert(alertItem)
            playTicketChime('Alta')

            const isOnRetainedPage = window.location.pathname === '/tickets/retained'
            if (!isOnRetainedPage && lastRetainedSpokenCountRef.current !== count) {
              lastRetainedSpokenCountRef.current = count
              const speechText =
                count === 1
                  ? 'Atenção. Existe 1 chamado retido aguardando análise.'
                  : `Atenção. Existem ${count} chamados retidos aguardando análise.`
              speak(speechText)
            }
          }
        } else if (count === 0) {
          lastRetainedNotifCountRef.current = 0
          lastRetainedSpokenCountRef.current = 0
        }
      } catch {
        /* gracefully ignore polling errors */
      }
    }

    // Checagem inicial após montagem e timer a cada 5 minutos (300.000 ms)
    const initialTimer = setTimeout(() => {
      checkPendingRetained()
    }, 4000)

    const interval = setInterval(checkPendingRetained, 5 * 60 * 1000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [user?.id, isManagerOrAdmin, showAlert])

  const pendingList = Object.values(activeAlerts)
  if (pendingList.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2.5 pointer-events-none">
      {pendingList.length > 1 && (
        <div className="self-end rounded-full bg-slate-900/90 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1 text-xs font-bold shadow-lg">
          {pendingList.length} alertas pendentes
        </div>
      )}

      {pendingList.map((alert) => {
        // Estilização baseada no tipo de alerta
        let borderClass = 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-slate-900'
        let textTitleClass = 'text-blue-900 dark:text-blue-200'
        let badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
        let icon = (
          <Hourglass className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        )
        let primaryBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white'

        if (alert.alertType === 'SLA_RESPONSE' || alert.alertType === 'SLA_RESOLUTION') {
          const isResolution = alert.alertType === 'SLA_RESOLUTION'
          if (isResolution) {
            borderClass = 'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-slate-900'
            textTitleClass = 'text-purple-900 dark:text-purple-200'
            badgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
            icon = (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
            )
            primaryBtnClass = 'bg-purple-600 hover:bg-purple-700 text-white'
          } else {
            borderClass = 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-slate-900'
            textTitleClass = 'text-amber-900 dark:text-amber-200'
            badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            icon = (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            )
            primaryBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white'
          }
        } else if (alert.alertType === 'CONSUMPTION') {
          borderClass = 'border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-slate-900'
          textTitleClass = 'text-orange-900 dark:text-orange-200'
          badgeClass = 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
          icon = (
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
          )
          primaryBtnClass = 'bg-orange-600 hover:bg-orange-700 text-white'
        } else if (alert.alertType === 'RETAINED_TICKETS') {
          borderClass = 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-slate-900'
          textTitleClass = 'text-amber-900 dark:text-amber-200'
          badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          icon = (
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          )
          primaryBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white'
        }

        return (
          <div
            key={alert.notifId}
            className={`pointer-events-auto flex flex-col gap-2.5 rounded-lg border p-4 shadow-xl backdrop-blur transition-all ${borderClass}`}
          >
            {/* Cabeçalho do Card */}
            <div className="flex items-start gap-3">
              {icon}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {alert.metadata.ticketNumber && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                      #{alert.metadata.ticketNumber}
                    </span>
                  )}
                  {alert.alertType === 'STALE_TICKET' && alert.metadata.hoursStale && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                    >
                      {alert.metadata.hoursStale}h sem atualização
                    </span>
                  )}
                  {alert.alertType === 'CONSUMPTION' && alert.metadata.percentage != null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                    >
                      {alert.metadata.percentage}% consumido
                    </span>
                  )}
                  {alert.alertType === 'RETAINED_TICKETS' &&
                    alert.metadata.retainedCount != null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                      >
                        {alert.metadata.retainedCount} aguardando
                      </span>
                    )}
                </div>

                <p className={`text-sm font-semibold leading-tight ${textTitleClass}`}>
                  {alert.title}
                </p>

                <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3">
                  {alert.message}
                </p>

                {/* Contagem regressiva de SLA */}
                {alert.deadline && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      Tempo restante:
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatCountdown(alert.deadline)}
                    </span>
                  </div>
                )}
              </div>

              {/* Botão fechar direto (dispensa) */}
              <button
                onClick={() => handleAction(alert, 'DISMISSED')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                title="Dispensar alerta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Ações de Auditoria */}
            <div className="flex items-center gap-2 pt-1 border-t border-black/5 dark:border-white/10">
              {alert.alertType === 'CONSUMPTION' ? (
                <Button
                  size="sm"
                  className={`flex-1 h-8 text-xs font-medium ${primaryBtnClass}`}
                  onClick={() => handleAction(alert, 'VIEWED')}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver Detalhes
                </Button>
              ) : alert.alertType === 'RETAINED_TICKETS' ? (
                <Button
                  size="sm"
                  className={`flex-1 h-8 text-xs font-medium ${primaryBtnClass}`}
                  onClick={() => handleAction(alert, 'OPENED')}
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Analisar Retidos
                </Button>
              ) : (
                <Button
                  size="sm"
                  className={`flex-1 h-8 text-xs font-medium ${primaryBtnClass}`}
                  onClick={() => handleAction(alert, 'OPENED')}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir Chamado
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-medium border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => handleAction(alert, 'DISMISSED')}
              >
                Dispensar
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default AlertNotificationPopup
