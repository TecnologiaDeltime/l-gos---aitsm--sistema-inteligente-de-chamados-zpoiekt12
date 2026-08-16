import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, Car, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react'
import { getVisits, TechnicalVisitRecord } from '@/services/technical-visits'
import { getTechnicianExpenses } from '@/services/expenses'
import { getTechnicianTravelEntries } from '@/services/travel-entries'
import { useRealtime } from '@/hooks/use-realtime'
import { formatHours } from '@/lib/duration'

export default function TechnicianDashboardPage() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [travel, setTravel] = useState<any[]>([])

  const loadData = async () => {
    if (!user) return
    try {
      const allVisits = await getVisits(`technician = "${user.id}"`)
      setVisits(allVisits)
      setExpenses(await getTechnicianExpenses(user.id))
      setTravel(await getTechnicianTravelEntries(user.id))
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('technical_visits', () => loadData())

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisits = visits.filter((v) => v.scheduled_date?.slice(0, 10) === todayStr)
  const pendingCheckouts = visits.filter((v) => v.status === 'Em Andamento')
  const unsubmittedExpenses = expenses.filter(
    (e) => e.approval_status === 'Rascunho' || e.approval_status === 'Aguardando Envio',
  )
  const pendingReimb = visits.filter(
    (v) =>
      v.reimbursement_status &&
      ['Aguardando Aprovação', 'Aguardando Envio'].includes(v.reimbursement_status || ''),
  )
  const todayMileage = travel
    .filter((t) => t.travel_date?.slice(0, 10) === todayStr)
    .reduce((s, t) => s + (t.actual_distance || 0), 0)
  const totalHours =
    visits
      .filter((v) => v.scheduled_date?.slice(0, 10) === todayStr)
      .reduce((s, v) => s + (v.total_time || 0), 0) / 60

  const kpis = [
    {
      label: 'Visitas Hoje',
      value: todayVisits.length,
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Sem Check-out',
      value: pendingCheckouts.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Despesas Pendentes',
      value: unsubmittedExpenses.length,
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Reembolsos Pend.',
      value: pendingReimb.length,
      icon: DollarSign,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'KM Hoje',
      value: todayMileage.toFixed(1) + 'km',
      icon: Car,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Horas Hoje',
      value: formatHours(totalHours),
      icon: Clock,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Meu Painel de Visitas</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className={`p-2 rounded-lg ${k.bg} w-fit mb-2`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <p className="text-[10px] text-slate-500">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agenda de Hoje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todayVisits.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">
              Nenhuma visita agendada para hoje.
            </p>
          ) : (
            todayVisits.map((v) => (
              <div key={v.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{v.status}</Badge>
                    <span className="text-xs font-semibold">
                      {v.scheduled_time} - {v.expected_end_time || ''}
                    </span>
                    {v.appointment_type && (
                      <Badge variant="secondary" className="text-[9px]">
                        {v.appointment_type}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {v.client_address || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.visit_reason || ''} · {v.client_contact || ''} {v.contact_phone || ''}
                  </div>
                </div>
                {v.expand?.ticket && (
                  <Link
                    to={`/tickets/${v.ticket}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    #{v.expand.ticket.number}
                  </Link>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {pendingCheckouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Visitas Sem Check-out
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingCheckouts.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-xs">
                <span>
                  {v.scheduled_time} - {v.client_address || 'N/A'}
                </span>
                <Link to={`/tickets/${v.ticket}`} className="text-blue-600 hover:underline">
                  Ver Ticket
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
