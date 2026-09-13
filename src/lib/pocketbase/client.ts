import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Configuração de resiliência do RealtimeService nativo do PocketBase:
// Trata o erro 400 "Invalid realtime client" ao reenviar subscriptions,
// reestabelecendo a conexão SSE e reenviando com backoff exponencial.
setupRealtimeResilience(pb)

function isInvalidClientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const anyErr = err as {
    status?: number
    statusCode?: number
    message?: string
    response?: { status?: number; message?: string }
    originalError?: { status?: number; message?: string }
  }
  const status = anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status ?? 0
  const msg =
    (anyErr.message || '') +
    ' ' +
    (anyErr.response?.message || '') +
    ' ' +
    (anyErr.originalError?.message || '')
  return status === 400 && /Invalid realtime client/i.test(msg)
}

function setupRealtimeResilience(client: PocketBase) {
  const realtime = client.realtime as any
  if (!realtime) return

  // 1. Monitorar desconexões do SSE via onDisconnect
  const previousOnDisconnect = realtime.onDisconnect?.bind(realtime)
  realtime.onDisconnect = (activeSubscriptions: string[]) => {
    // Garante que o clientId seja limpo ao desconectar para não reutilizar clientId morto
    realtime.clientId = ''
    if (previousOnDisconnect) {
      try {
        previousOnDisconnect(activeSubscriptions)
      } catch (err) {
        console.warn('[Realtime] Erro no hook onDisconnect anterior:', err)
      }
    }
  }

  // 2. Interceptar sendSubscriptions com tratamento de 400 Invalid Realtime Client + retries
  const originalSendSubscriptions = realtime.sendSubscriptions?.bind(realtime)
  if (typeof originalSendSubscriptions === 'function') {
    let isRecovering = false

    realtime.sendSubscriptions = async function sendSubscriptionsWithRetry(): Promise<void> {
      try {
        return await originalSendSubscriptions()
      } catch (err: any) {
        if (err?.isAbort) {
          return
        }

        // Se o erro for "Invalid realtime client" ou erro de conexão, tentar recuperar
        if (isInvalidClientError(err) && !isRecovering) {
          isRecovering = true
          console.warn(
            '[Realtime] Detectado clientId inválido ou expirado. Reinicializando conexão SSE...',
          )

          try {
            // Força reset do clientId morto e fecha conexão antiga
            realtime.clientId = ''
            realtime.lastSentSubscriptions = []

            // Tenta reconectar até 3 vezes com backoff
            const maxRetries = 3
            let connected = false

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                // Desconecta limpando listeners e cancelando requests pendentes
                if (typeof realtime.disconnect === 'function') {
                  realtime.disconnect(true)
                }

                // Espera um pequeno intervalo antes de tentar reconectar
                const delay = attempt * 300
                await new Promise((res) => setTimeout(res, delay))

                // Inicia nova conexão
                if (typeof realtime.connect === 'function') {
                  await realtime.connect()
                }

                connected = true
                break
              } catch (reconnectErr) {
                console.warn(
                  `[Realtime] Falha na tentativa ${attempt} de reconectar SSE:`,
                  reconnectErr,
                )
              }
            }

            if (connected && realtime.clientId) {
              // Reenvia as subscriptions agora com o novo clientId
              return await originalSendSubscriptions()
            }
          } catch (recoveryErr) {
            console.error('[Realtime] Falha na recuperação de conexão:', recoveryErr)
          } finally {
            isRecovering = false
          }
        }

        // Log silencioso e absorção para não explodir como exceção não tratada na UI
        console.warn('[Realtime] Erro ao sincronizar subscriptions:', err?.message || err)
      }
    }
  }
}

export default pb
