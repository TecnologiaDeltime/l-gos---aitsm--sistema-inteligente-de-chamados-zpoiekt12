import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'

export function usePbHealth() {
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const check = async () => {
      try {
        await pb.health.check()
        setConnected(true)
      } catch {
        setConnected(false)
      }
    }
    const interval = setInterval(check, 15000)
    check()
    return () => clearInterval(interval)
  }, [])

  return connected
}
