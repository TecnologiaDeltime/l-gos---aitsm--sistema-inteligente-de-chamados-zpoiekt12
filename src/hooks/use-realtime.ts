import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'
import { toast } from '@/hooks/use-toast'

import pb from '@/lib/pocketbase/client'

/** Toast discreto uma única vez por perda de realtime (sem spam a cada reconexão). */
let realtimeLostNotifiedAt = 0

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 *
 * Fluidez: o callback vive em ref (a subscription NÃO é recriada a cada
 * render) e a conexão SSE do PocketBase reconecta sozinha. Queda de conexão
 * avisa o operador uma única vez com toast — nada de chat "congelado" mudo.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        callbackRef.current(e)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch(() => {})

    // Evento PB_CONNECT dispara a cada (re)conexão SSE do PocketBase.
    const connectSub = pb.realtime
      .subscribe('PB_CONNECT', () => {
        realtimeLostNotifiedAt = 0
      })
      .catch(() => {})

    // onDisconnect (SDK >= 0.23) avisa quando a SSE cai — o SDK reconecta
    // sozinho, mas sem aviso o operador acha que o chat travou.
    pb.realtime.onDisconnect = () => {
      const now = Date.now()
      if (now - realtimeLostNotifiedAt > 30000) {
        realtimeLostNotifiedAt = now
        toast({
          title: 'Conexão em tempo real perdida',
          description:
            'Reconectando automaticamente. Se mensagens novas não aparecerem, recarregue a página.',
          variant: 'destructive',
          duration: 6000,
        })
      }
    }

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
      connectSub
        .then((fn) => {
          if (typeof fn === 'function') fn().catch(() => {})
        })
        .catch(() => {})
    }
  }, [collectionName, enabled])
}

export default useRealtime
