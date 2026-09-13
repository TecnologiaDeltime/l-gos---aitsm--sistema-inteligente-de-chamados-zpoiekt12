import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
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
    let isSubscribing = true

    // Assina com retentativas automáticas caso a conexão SSE esteja restabelecendo
    let retryTimeoutId: any

    const startSubscription = async (attempt = 1) => {
      if (cancelled) return

      try {
        const fn = await pb.collection<TRecord>(collectionName).subscribe('*', (e) => {
          if (!cancelled) {
            callbackRef.current(e)
          }
        })

        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      } catch (err: any) {
        if (cancelled) return

        // Se for erro de realtime e ainda temos tentativas, reagendar com backoff
        if (attempt <= 3) {
          const delay = attempt * 500
          retryTimeoutId = setTimeout(() => {
            if (!cancelled) {
              startSubscription(attempt + 1)
            }
          }, delay)
        } else {
          console.warn(
            `[useRealtime] Não foi possível subscrever à coleção '${collectionName}':`,
            err?.message || err,
          )
        }
      } finally {
        isSubscribing = false
      }
    }

    startSubscription()

    return () => {
      cancelled = true
      clearTimeout(retryTimeoutId)

      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      } else if (isSubscribing) {
        // Se ainda estava no processo de registrar listener ou se o fn ainda não chegou,
        // aguarda resolução ou limpa a subscrição com segurança
        pb.collection(collectionName)
          .unsubscribe('*')
          .catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
