import pb from '@/lib/pocketbase/client'

export interface NotificationRecord {
  id: string
  user: string
  ticket?: string
  title: string
  message: string
  type: string
  read?: boolean
  created: string
}

export const getNotifications = (userId: string) =>
  pb.collection('notifications').getFullList<NotificationRecord>({
    filter: `user = "${userId}"`,
    sort: '-created',
  })

export const markNotificationRead = (id: string) =>
  pb.collection('notifications').update(id, { read: true, read_at: new Date().toISOString() })
