import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import type { AuthRecord } from 'pocketbase'
import { securityService } from '@/services/security'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Clock, ShieldAlert } from 'lucide-react'

export interface UserRecord {
  id: string
  email: string
  name: string
  role:
    | 'admin'
    | 'gestor'
    | 'operador'
    | 'tecnico'
    | 'cliente_solicitante'
    | 'cliente_gestor'
    | 'auditor'
  phone?: string
  mobile?: string
  active?: boolean
  position?: string
  company?: string
  unit?: string
  avatar?: string
  is_active?: boolean
  alerts_muted?: boolean
  totp_enabled?: boolean
  failed_login_attempts?: number
  locked_until?: string
  session_last_activity?: string
  must_change_password?: boolean
  push_enabled?: boolean
  created?: string
  updated?: string
  profile_id?: string
  expand?: any
}

export type User = UserRecord

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, record: AuthRecord) => void
  logout: (reason?: any) => void
  signOut: (reason?: any) => void
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
  sessionRemainingSeconds: number
  renewSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_EXPIRED_KEY = 'itsm_session_expired_message'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [timeoutMinutes, setTimeoutMinutes] = useState(60)
  const [secondsRemaining, setSecondsRemaining] = useState(3600)

  // Referência para timestamp da última interação do usuário (clique, tecla, mouse)
  const lastActivityRef = useRef<number>(Date.now())
  const lastHeartbeatSentRef = useRef<number>(Date.now())

  const mapRecordToUser = (record: AuthRecord): User | null => {
    if (!record) return null
    return {
      id: record.id,
      email: record.email,
      name: record.name || record.email,
      role: (record.role as any) || 'cliente_solicitante',
      phone: record.phone,
      mobile: record.mobile,
      active: record.active !== false,
      position: record.position,
      company: record.company,
      unit: record.unit,
      avatar: record.avatar,
      is_active: record.is_active !== undefined ? record.is_active : true,
      alerts_muted: !!record.alerts_muted,
      totp_enabled: !!record.totp_enabled,
      failed_login_attempts: record.failed_login_attempts || 0,
      locked_until: record.locked_until,
      session_last_activity: record.session_last_activity,
      must_change_password: !!record.must_change_password,
      push_enabled: !!record.push_enabled,
      created: record.created,
      updated: record.updated,
      profile_id: record.profile_id,
      expand: record.expand,
    }
  }

  const logout = useCallback((reason?: any) => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
    setShowWarningModal(false)

    if (typeof reason === 'string' && reason) {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, reason)
    }

    // Se estiver fora da página de login, redirecionar
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }, [])

  const renewSession = useCallback(async () => {
    try {
      lastActivityRef.current = Date.now()
      lastHeartbeatSentRef.current = Date.now()
      setShowWarningModal(false)
      await securityService.sendHeartbeat()
    } catch (err) {
      console.warn('Falha ao enviar heartbeat de sessão:', err)
    }
  }, [])

  // Carregar tempo de expiração configurado
  useEffect(() => {
    let isMounted = true
    securityService
      .getPolicy()
      .then((policy) => {
        if (isMounted && policy?.session_timeout_minutes) {
          setTimeoutMinutes(policy.session_timeout_minutes)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [user])

  // Ouvir evento customizado de expiração de sessão disparado pelo heartbeat
  useEffect(() => {
    const handleSessionExpired = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ reason?: string }>
      const reason =
        customEvt.detail?.reason || 'Sua sessão expirou por inatividade. Faça login novamente.'
      logout(reason)
    }

    window.addEventListener('itsm:session-expired', handleSessionExpired)
    return () => {
      window.removeEventListener('itsm:session-expired', handleSessionExpired)
    }
  }, [logout])

  // Referência para evitar concorrência/reentrância de heartbeat
  const isHeartbeatSendingRef = useRef<boolean>(false)

  // Monitorar eventos de atividade do usuário
  useEffect(() => {
    if (!pb.authStore.isValid || !token) return

    const handleUserActivity = () => {
      const now = Date.now()
      lastActivityRef.current = now

      // Enviar heartbeat a cada 60 segundos de atividade contínua.
      // Antes eram 5 min: com o limite de presença de 15 min do chat, um operador
      // ativo podia ficar >5 min sem registrar atividade e aparecer offline.
      if (
        now - lastHeartbeatSentRef.current > 60 * 1000 &&
        !isHeartbeatSendingRef.current &&
        pb.authStore.isValid
      ) {
        lastHeartbeatSentRef.current = now
        isHeartbeatSendingRef.current = true
        securityService
          .sendHeartbeat()
          .catch(() => {})
          .finally(() => {
            isHeartbeatSendingRef.current = false
          })
      }
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }))

    // Heartbeat garantido: envia periodicamente mesmo sem eventos de mouse/teclado
    // (usuário parado lendo a tela continua "online" para o chat).
    const heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (now - lastHeartbeatSentRef.current > 60 * 1000 && pb.authStore.isValid) {
        lastHeartbeatSentRef.current = now
        securityService
          .sendHeartbeat()
          .catch(() => {})
          .finally(() => {
            isHeartbeatSendingRef.current = false
          })
      }
    }, 30 * 1000)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity))
      clearInterval(heartbeatTimer)
    }
  }, [token])

  // Timer de checagem de inatividade (roda a cada 1s)
  useEffect(() => {
    if (!token || !user) return

    const totalSeconds = timeoutMinutes * 60
    const interval = setInterval(() => {
      // Checar se o token ainda é válido no authStore
      if (!pb.authStore.isValid) {
        clearInterval(interval)
        logout('Sua sessão expirou por inatividade. Faça login novamente.')
        return
      }

      const elapsedSec = Math.floor((Date.now() - lastActivityRef.current) / 1000)
      const remaining = Math.max(0, totalSeconds - elapsedSec)
      setSecondsRemaining(remaining)

      // Se restam 2 minutos (120s) ou menos, exibir modal de aviso prévio
      if (remaining <= 120 && remaining > 0) {
        setShowWarningModal(true)
      } else if (remaining > 120) {
        setShowWarningModal(false)
      }

      // Se zerar, expirar sessão
      if (remaining <= 0) {
        clearInterval(interval)
        logout('Sua sessão expirou por inatividade. Faça login novamente.')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [token, user, timeoutMinutes, logout])

  useEffect(() => {
    // Inicializar a partir do authStore
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(mapRecordToUser(pb.authStore.record))
      setToken(pb.authStore.token)
      lastActivityRef.current = Date.now()
    }

    // Ouvir mudanças no authStore
    const unsubscribe = pb.authStore.onChange((newToken, newRecord) => {
      if (newToken && newRecord) {
        setUser(mapRecordToUser(newRecord))
        setToken(newToken)
        lastActivityRef.current = Date.now()
      } else {
        setUser(null)
        setToken(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = (newToken: string, record: AuthRecord) => {
    pb.authStore.save(newToken, record)
    setUser(mapRecordToUser(record))
    setToken(newToken)
    lastActivityRef.current = Date.now()
    lastHeartbeatSentRef.current = Date.now()
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      try {
        const refreshedRecord = await pb.collection('users').getOne(pb.authStore.record.id)
        pb.authStore.save(pb.authStore.token, refreshedRecord)
        setUser(mapRecordToUser(refreshedRecord))
      } catch (error) {
        console.error('Failed to refresh user:', error)
      }
    }
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        refreshUser,
        loading: false,
        signOut: logout,
        isAuthenticated: !!token && !!user,
        sessionRemainingSeconds: secondsRemaining,
        renewSession,
      }}
    >
      {children}

      {/* Modal de Aviso Prévio de Expiração de Sessão (últimos 2 minutos) */}
      <AlertDialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Clock className="w-5 h-5 animate-pulse" />
              <AlertDialogTitle>Sua sessão está prestes a expirar</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3 pt-2 text-foreground">
              <p>Por motivos de segurança, sua sessão será encerrada por inatividade em:</p>
              <div className="flex items-center justify-center p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
                <span className="text-3xl font-mono font-bold text-amber-600">
                  {formatCountdown(secondsRemaining)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Clique no botão abaixo para renovar a sua sessão e continuar trabalhando sem
                interrupções.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => logout('Sessão encerrada voluntariamente.')}>
              Sair agora
            </Button>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={renewSession}
            >
              Continuar conectado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
