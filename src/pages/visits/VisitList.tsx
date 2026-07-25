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
import { MapPin, Clock, Play, Square, Plus, FileText } from 'lucide-react'
import {
  getVisits,
  updateVisit,
  TechnicalVisitRecord,
  VISIT_STATUSES,
  generateServiceOrder,
} from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { VisitCheckInDialog } from '@/components/VisitCheckInDialog'
import { VisitCheckOutDialog } from '@/components/VisitCheckOutDialog'
import { VisitScheduleDialog } from '@/components/VisitScheduleDialog'

export default function VisitList() {
  const perms = usePermissions()
  const { toast } = useToast()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [techFilter, setTechFilter] = useState('all')
  const [checkinVisit, setCheckinVisit] = useState<string | null>(null)
  const [checkoutVisit, setCheckoutVisit] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)

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

  const handleServiceOrder = async (id: string) => {
    try {
      await generateServiceOrder(id)
      toast({ title: 'Ordem de serviço gerada!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao gerar OS', variant: 'destructive' })
    }
  }

  const statusCls: Record<string, string> = {
    Agendada: 'bg-blue-100 text-blue-800',
    'Em Andamento': 'bg-amber-100 text-amber-800',
    Concluída: 'bg-green-100 text-green-800',
    Cancelada: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Visitas Técnicas</h2>
        <Button size="sm" onClick={() => setShowSchedule(true)}>
          <Plus className="h-4 w-4 mr-1" /> Agendar
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
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
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-48 h-8 text-xs">
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
                    {v.appointment_type && (
                      <Badge variant="secondary" className="text-[9px]">
                        {v.appointment_type}
                      </Badge>
                    )}
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
                      <Button size="sm" variant="outline" onClick={() => setCheckinVisit(v.id)}>
                        <Play className="mr-1 h-3 w-3" /> Check-in
                      </Button>
                    )}
                    {v.status === 'Em Andamento' && perms.isTecnico && (
                      <Button size="sm" variant="outline" onClick={() => setCheckoutVisit(v.id)}>
                        <Square className="mr-1 h-3 w-3" /> Check-out
                      </Button>
                    )}
                    {v.status === 'Concluída' &&
                      !v.service_order_generated &&
                      (perms.isAdmin || perms.isGestor) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleServiceOrder(v.id)}
                        >
                          <FileText className="mr-1 h-3 w-3" /> OS
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
                  <div>{v.visit_reason || ''}</div>
                </div>
                {v.calculated_mileage ? (
                  <p className="text-xs text-purple-600">KM: {v.calculated_mileage.toFixed(1)}</p>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      {checkinVisit && (
        <VisitCheckInDialog
          visitId={checkinVisit}
          open={!!checkinVisit}
          onOpenChange={(v) => !v && setCheckinVisit(null)}
          onDone={loadData}
        />
      )}
      {checkoutVisit && (
        <VisitCheckOutDialog
          visitId={checkoutVisit}
          open={!!checkoutVisit}
          onOpenChange={(v) => !v && setCheckoutVisit(null)}
          onDone={loadData}
        />
      )}
      <VisitScheduleDialog open={showSchedule} onOpenChange={setShowSchedule} onSaved={loadData} />
    </div>
  )
}
