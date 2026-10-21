import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type RefreshIntervalValue = 30 | 60 | 180 | 300 | 0 // em segundos. 0 = Desativado/Manual

export interface RefreshIntervalOption {
  value: RefreshIntervalValue
  label: string
  shortLabel: string
}

export const REFRESH_OPTIONS: RefreshIntervalOption[] = [
  { value: 60, label: '1 minuto', shortLabel: '1m' },
  { value: 180, label: '3 minutos', shortLabel: '3m' },
  { value: 300, label: '5 minutos (padrão)', shortLabel: '5m' },
  { value: 30, label: '30 segundos', shortLabel: '30s' },
  { value: 0, label: 'Pausado (manual)', shortLabel: 'Off' },
]

const STORAGE_KEY = 'itsm:auto-refresh-interval'
const DEFAULT_INTERVAL: RefreshIntervalValue = 300 // 5 minutos padrão

type RefreshHandler = () => Promise<void> | void

interface AutoRefreshContextValue {
  /** Intervalo configurado em segundos (0 = pausado) */
  interval: RefreshIntervalValue
  setIntervalValue: (val: RefreshIntervalValue) => void
  /** Segundos restantes até a próxima atualização automática (null se desativado) */
  secondsLeft: number | null
  /** Se há uma atualização sendo executada agora */
  isRefreshing: boolean
  /** Timestamp da última atualização concluída com sucesso */
  lastRefreshedAt: Date | null
  /** Dispara uma atualização agora manualmente */
  triggerRefresh: () => Promise<void>
  /** Registra um handler de refresh para a tela ativa */
  registerRefreshHandler: (id: string, handler: RefreshHandler) => () => void
  /** Sinaliza se há handlers ativos registrados */
  hasActiveHandlers: boolean
}

const AutoRefreshContext = createContext<AutoRefreshContextValue | null>(null)

export function AutoRefreshProvider({ children }: { children: React.ReactNode }) {
  const [interval, setIntervalState] = useState<RefreshIntervalValue>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        const parsed = Number(saved)
        if ([0, 30, 60, 180, 300].includes(parsed)) {
          return parsed as RefreshIntervalValue
        }
      }
    } catch {
      // localStorage indisponível ou erro
    }
    return DEFAULT_INTERVAL
  })

  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    interval > 0 ? interval : null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(() => new Date())
  const [handlersCount, setHandlersCount] = useState(0)

  // Armazena handlers registrados por tela
  const handlersRef = useRef<Map<string, RefreshHandler>>(new Map())
  const isRefreshingRef = useRef(false)
  isRefreshingRef.current = isRefreshing

  const setIntervalValue = useCallback((val: RefreshIntervalValue) => {
    setIntervalState(val)
    try {
      localStorage.setItem(STORAGE_KEY, String(val))
    } catch {
      // ignore
    }
    if (val > 0) {
      setSecondsLeft(val)
    } else {
      setSecondsLeft(null)
    }
  }, [])

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    setIsRefreshing(true)
    try {
      const fns = Array.from(handlersRef.current.values())
      if (fns.length > 0) {
        await Promise.all(
          fns.map((fn) =>
            Promise.resolve()
              .then(fn)
              .catch((e) => {
                console.warn('Erro ao atualizar tela via timer:', e)
              }),
          ),
        )
      }
      setLastRefreshedAt(new Date())
    } finally {
      setIsRefreshing(false)
      // Reinicia contagem se timer estiver ativo
      setIntervalState((currentInterval) => {
        if (currentInterval > 0) {
          setSecondsLeft(currentInterval)
        }
        return currentInterval
      })
    }
  }, [])

  const registerRefreshHandler = useCallback((id: string, handler: RefreshHandler) => {
    handlersRef.current.set(id, handler)
    setHandlersCount(handlersRef.current.size)
    return () => {
      handlersRef.current.delete(id)
      setHandlersCount(handlersRef.current.size)
    }
  }, [])

  // Timer de 1 segundo para contagem regressiva e disparo
  useEffect(() => {
    if (interval <= 0) {
      setSecondsLeft(null)
      return
    }

    setSecondsLeft(interval)

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          // Dispara refresh
          triggerRefresh()
          return interval
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [interval, triggerRefresh])

  return (
    <AutoRefreshContext.Provider
      value={{
        interval,
        setIntervalValue,
        secondsLeft,
        isRefreshing,
        lastRefreshedAt,
        triggerRefresh,
        registerRefreshHandler,
        hasActiveHandlers: handlersCount > 0,
      }}
    >
      {children}
    </AutoRefreshContext.Provider>
  )
}

/**
 * Hook para acessar o controle global do timer de atualização.
 */
export function useAutoRefresh() {
  const ctx = useContext(AutoRefreshContext)
  if (!ctx) {
    throw new Error('useAutoRefresh deve ser usado dentro de um AutoRefreshProvider')
  }
  return ctx
}

/**
 * Hook de conveniência para registrar a função de refresh da página atual.
 * Desregistra automaticamente quando a tela for desmontada.
 */
export function useRegisterRefresh(id: string, handler: RefreshHandler, enabled: boolean = true) {
  const { registerRefreshHandler } = useAutoRefresh()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const unregister = registerRefreshHandler(id, () => handlerRef.current())
    return unregister
  }, [id, enabled, registerRefreshHandler])
}
