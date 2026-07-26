import { useEffect } from 'react'
import { useSlaNotifications } from '@/hooks/use-sla-notifications'
import { initAudio } from '@/lib/ticket-alerts'

export function GlobalNotifications() {
  useSlaNotifications()

  useEffect(() => {
    initAudio()
  }, [])

  return null
}
