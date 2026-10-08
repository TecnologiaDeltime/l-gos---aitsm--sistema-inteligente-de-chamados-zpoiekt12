import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getOperatorAlertsMuted } from '@/lib/notification-settings'

interface ConsumptionAlert {
  id: string
  title: string
  message: string
}

/**
 * Popup de alerta de consumo de horas contratuais por nível.
 * Escuta notificações em tempo real (WebSocket) da coleção `notifications`
 * com type="Alerta" e título contendo "Alerta de Consumo", dirigidas ao
 * usuário atual. Exibe um popup fixo com detalhes e ações.
 */
export function ConsumptionAlerts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const knownIds = useRef<Set<string>>(new Set())
  const activeRef = useRef<Record<string, ConsumptionAlert>>({})
  const [active, setActive] = useState<Record<string, ConsumptionAlert>>({})
  const initializedRef = useRef(false)

  const showAlert = useCallback((alert: ConsumptionAlert) => {
    activeRef.current[alert.id] = alert
    setActive({ ...activeRef.current })
  }, [])

  const dismiss = useCallback((id: string) => {
    delete activeRef.current[id]
    setActive({ ...activeRef.current })
  }, [])

  useEffect(() => {
    // Marca como inicializado após 2s para evitar alertas de registros antigos.
    const timer = setTimeout(() => {
      initializedRef.current = true
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  useRealtime(
    'notifications',
    (e) => {
      if (getOperatorAlertsMuted() || user?.alerts_muted) return
      if (!user?.id) return
      if (!initializedRef.current) return
      if (e.action !== 'create') return
      const rec = e.record as unknown as any
      if (rec.user !== user.id) return
      if (rec.type !== 'Alerta') return
      const title = rec.title || ''
      if (!title.includes('Alerta de Consumo')) return
      if (knownIds.current.has(rec.id)) return
      knownIds.current.add(rec.id)

      showAlert({
        id: rec.id,
        title: title,
        message: rec.message || '',
      })
    },
    !!user?.id,
  )

  if (getOperatorAlertsMuted() || user?.alerts_muted) return null
  if (Object.keys(active).length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {Object.values(active).map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-orange-300 bg-orange-50 p-4 shadow-xl dark:border-orange-700 dark:bg-orange-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-bold text-orange-800 dark:text-orange-200">
                {alert.title}
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 whitespace-pre-line">
                {alert.message}
              </p>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigateRef.current('/horas-clientes')
                dismiss(alert.id)
              }}
              className="flex-1 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
            >
              Ver Detalhes
            </button>
            <button
              onClick={() => dismiss(alert.id)}
              className="rounded-md border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
            >
              Dispensar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
