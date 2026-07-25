import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, Play, Square } from 'lucide-react'
import {
  getVisits,
  updateVisit,
  TechnicalVisitRecord,
  VISIT_STATUSES,
} from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function VisitList() {
  const perms = usePermissions()
  const { toast } = useToast()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [techFilter, setTechFilter] = useState('all')

  const loadData = () => {
    getVisits()
      .then(setVisits)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
    getUsers()
      .then(setTechnicians)
      .catch(() => {})
  }, [])
  useRealtime('technical_visits', () => loadData())

  const filtered = visits.filter((v) => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (techFilter !== 'all' && v.technician !== techFilter) return false
    return true
  })

  const handleCheckin = async (id: string) => {
    await updateVisit(id, { status: 'Em Andamento', checkin_at: new Date().toISOString() })
    loadData()
    toast({ title: 'Check-in registrado!' })
  }

  const handleCheckout = async (id: string) => {
    await updateVisit(id, { status: 'Concluída', checkout_at: new Date().toISOString() })
    loadData()
    toast({ title: 'Check-out registrado!' })
  }

  const statusCls: Record<string, string> = {
    Agendada: 'bg-blue-100 text-blue-800',
    'Em Andamento': 'bg-amber-100 text-amber-800',
    Concluída: 'bg-green-100 text-green-800',
    Cancelada: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Visitas Técnicas</h2>
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
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
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Técnico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Técnicos</SelectItem>
            {technicians.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
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
            <Card key={v.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={statusCls[v.status] || 'bg-slate-100'}>{v.status}</Badge>
                    {v.expand?.ticket && (
                      <Link
                        to={`/tickets/${v.expand.ticket.id}`}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        #{v.expand.ticket.number}
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {v.status === 'Agendada' && perms.isTecnico && (
                      <Button size="sm" variant="outline" onClick={() => handleCheckin(v.id)}>
                        <Play className="mr-1 h-3 w-3" /> Check-in
                      </Button>
                    )}
                    {v.status === 'Em Andamento' && perms.isTecnico && (
                      <Button size="sm" variant="outline" onClick={() => handleCheckout(v.id)}>
                        <Square className="mr-1 h-3 w-3" /> Check-out
                      </Button>
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
                  <div>Técnico: {v.expand?.technician?.name || '-'}</div>
                  <div>Materiais: {v.materials || '-'}</div>
                </div>
                {v.checkin_at && (
                  <p className="text-xs text-green-600">
                    Check-in: {new Date(v.checkin_at).toLocaleString('pt-BR')}
                  </p>
                )}
                {v.checkout_at && (
                  <p className="text-xs text-slate-500">
                    Check-out: {new Date(v.checkout_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
