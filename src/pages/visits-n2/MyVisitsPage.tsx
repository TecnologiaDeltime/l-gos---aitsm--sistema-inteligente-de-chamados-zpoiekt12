import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Clock, Plus } from 'lucide-react'
import { getVisits, TechnicalVisitRecord, VISIT_STATUSES } from '@/services/technical-visits'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'

const STATUS_CLS: Record<string, string> = {
  Agendada: 'bg-blue-100 text-blue-800',
  'Em Andamento': 'bg-amber-100 text-amber-800',
  Concluída: 'bg-green-100 text-green-800',
  Cancelada: 'bg-red-100 text-red-800',
}

export default function MyVisitsPage() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = () => {
    if (!user) return
    getVisits(`technician = "${user.id}"`)
      .then(setVisits)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('technical_visits', () => loadData())

  const filtered = visits.filter((v) => statusFilter === 'all' || v.status === statusFilter)
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Minhas Visitas</h2>
        <Link to="/visitas-n2/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Visita
          </Button>
        </Link>
      </div>
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {VISIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhuma visita encontrada.
            </CardContent>
          </Card>
        ) : (
          filtered.map((v) => (
            <Link key={v.id} to={`/visitas-n2/${v.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_CLS[v.status] || 'bg-slate-100'}>{v.status}</Badge>
                      {v.scheduled_date?.slice(0, 10) === todayStr && (
                        <Badge variant="secondary" className="text-[9px]">
                          Hoje
                        </Badge>
                      )}
                      {v.appointment_type && (
                        <Badge variant="outline" className="text-[9px]">
                          {v.appointment_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {v.client_address || '-'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{' '}
                      {v.scheduled_date
                        ? new Date(v.scheduled_date).toLocaleDateString('pt-BR')
                        : '-'}{' '}
                      {v.scheduled_time || ''}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{v.visit_reason || ''}</p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
