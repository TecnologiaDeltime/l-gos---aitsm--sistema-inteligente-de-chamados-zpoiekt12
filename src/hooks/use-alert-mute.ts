import { useState, useEffect, useCallback, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { getOperatorAlertsMuted, setOperatorAlertsMuted } from '@/lib/notification-settings'
import { createAlertAuditLog } from '@/services/alert-audit'

export function useAlertMute() {
  const { user } = useAuth()
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (user?.alerts_muted !== undefined) {
      return Boolean(user.alerts_muted)
    }
    return getOperatorAlertsMuted()
  })
  const [loading, setLoading] = useState(false)
  const isUpdatingRef = useRef(false)

  // Sincroniza estado inicial e quando o usuário logado mudar
  useEffect(() => {
    if (user?.alerts_muted !== undefined) {
      const serverMuted = Boolean(user.alerts_muted)
      setIsMuted(serverMuted)
      setOperatorAlertsMuted(serverMuted)
    } else {
      setIsMuted(getOperatorAlertsMuted())
    }
  }, [user?.id, user?.alerts_muted])

  // Escuta evento customizado de mudança na mesma aba
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ muted: boolean }>
      if (customEvent.detail && typeof customEvent.detail.muted === 'boolean') {
        setIsMuted(customEvent.detail.muted)
      }
    }
    window.addEventListener('itsm:alerts-muted-changed', handleSync)
    return () => window.removeEventListener('itsm:alerts-muted-changed', handleSync)
  }, [])

  const toggleMute = useCallback(async () => {
    if (isUpdatingRef.current) return
    isUpdatingRef.current = true
    setLoading(true)

    const nextMuted = !isMuted
    // Aplicação imediata no estado local e localStorage para resposta instantânea
    setIsMuted(nextMuted)
    setOperatorAlertsMuted(nextMuted)

    // Se houver voz ativa ao mutar, cancela imediatamente
    if (nextMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignore */
      }
    }

    try {
      // 1. Persistir no backend na coleção users (perfil do operador)
      if (user?.id) {
        await pb.collection('users').update(user.id, {
          alerts_muted: nextMuted,
        })

        // 2. Registrar na auditoria de alertas (alert_audit_logs)
        await createAlertAuditLog({
          alert_type: 'STALE_TICKET', // Tipo de base para o registro de auditoria geral
          operator: user.id,
          action: nextMuted ? 'MUTE_ALERTS' : 'UNMUTE_ALERTS',
          metadata: {
            muted: nextMuted,
            operatorName: user.name || user.email,
            operatorEmail: user.email,
            title: nextMuted ? 'Silenciou notificações' : 'Reativou notificações',
            message: nextMuted
              ? `O operador ${user.name || user.email} silenciou a voz e os alertas em tela.`
              : `O operador ${user.name || user.email} reativou a voz e os alertas em tela.`,
          },
        })
      }
    } catch (err) {
      console.error('Falha ao sincronizar silenciamento de alertas:', err)
    } finally {
      setLoading(false)
      isUpdatingRef.current = false
    }
  }, [isMuted, user?.id, user?.name, user?.email])

  return {
    isMuted,
    toggleMute,
    loading,
  }
}
