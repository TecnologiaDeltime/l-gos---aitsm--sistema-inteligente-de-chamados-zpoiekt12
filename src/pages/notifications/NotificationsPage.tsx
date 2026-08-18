import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getNotifications,
  markNotificationRead,
  NotificationRecord,
} from '@/services/notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCheck, Filter } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  SLA: 'SLA',
  Atribuição: 'Atribuição',
  Interação: 'Interação',
  Aprovação: 'Aprovação',
  Sistema: 'Sistema',
  Alerta: 'Alerta',
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('todos')

  const load = () => {
    if (!user) return
    setLoading(true)
    getNotifications(user.id)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Atualiza em tempo real quando chegar uma nova notificação para o usuário.
  useRealtime(
    'notifications',
    () => {
      if (user)
        getNotifications(user.id)
          .then(setNotifications)
          .catch(() => {})
    },
    !!user?.id,
  )

  const handleMarkRead = (id: string) => {
    markNotificationRead(id).then(() => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    })
  }

  const handleMarkAllRead = () => {
    const unread = notifications.filter((n) => !n.read)
    unread.forEach((n) => markNotificationRead(n.id).catch(() => {}))
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    notifications.forEach((n) => {
      if (n.type) set.add(n.type)
    })
    return Array.from(set)
  }, [notifications])

  const filtered = useMemo(() => {
    if (typeFilter === 'todos') return notifications
    if (typeFilter === 'naolidas') return notifications.filter((n) => !n.read)
    return notifications.filter((n) => n.type === typeFilter)
  }, [notifications, typeFilter])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Notificações
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Todas as notificações lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('todos')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === 'todos'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setTypeFilter('naolidas')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === 'naolidas'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Não lidas
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="itsm-card">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-400">Carregando notificações...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              Nenhuma notificação encontrada.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between gap-3 p-4 transition-colors hover:bg-secondary/30 ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </p>
                      {n.type && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {TYPE_LABELS[n.type] || n.type}
                        </Badge>
                      )}
                      {!n.read && (
                        <Badge className="bg-red-500 text-white text-[10px] py-0 px-1.5">
                          Não lida
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(n.created).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      className="flex-shrink-0"
                    >
                      <CheckCheck className="mr-1 h-3.5 w-3.5" />
                      Marcar lida
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
