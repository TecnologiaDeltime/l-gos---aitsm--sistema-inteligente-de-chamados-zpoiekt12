import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  MapPin,
  Car,
  DollarSign,
  Activity,
} from 'lucide-react'
import { getVisits, TechnicalVisitRecord } from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { getExpenses } from '@/services/expenses'
import { getTravelEntries } from '@/services/travel-entries'
import { useRealtime } from '@/hooks/use-realtime'

export default function VisitManagerDashboard() {
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [travel, setTravel] = useState<any[]>([])

  const loadData = async () => {
    try {
      const [v, t, e, tr] = await Promise.all([
        getVisits(),
        getUsers(),
        getExpenses(),
        getTravelEntries(),
      ])
      setVisits(v)
      setTechs(t)
      setExpenses(e)
      setTravel(tr)
    } catch {
      /* intentionally ignored */
    }
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('technical_visits', () => loadData())

  const activeTechs = techs.filter((t: any) => ['tecnico', 'gestor', 'admin'].includes(t.role))
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayVisits = visits.filter((v) => v.scheduled_date?.slice(0, 10) === todayStr)
  const completed = todayVisits.filter((v) => v.status === 'Concluída')
  const pending = todayVisits.filter((v) => v.status === 'Agendada')
  const cancelled = todayVisits.filter((v) => v.status === 'Cancelada')
  const inProgress = todayVisits.filter((v) => v.status === 'Em Andamento')
  const late = pending.filter(
    (v) => v.scheduled_time && v.scheduled_time < new Date().toTimeString().slice(0, 5),
  )
  const totalMileage = visits.reduce((s, v) => s + (v.calculated_mileage || 0), 0)
  const pendingExpenses = expenses.filter((e) =>
    ['Rascunho', 'Aguardando Aprovação'].includes(e.approval_status),
  )
  const pendingReimb = visits.filter(
    (v) =>
      v.reimbursement_status &&
      ['Aguardando Aprovação', 'Aguardando Envio'].includes(v.reimbursement_status || ''),
  )
  const techStatusCount = activeTechs.reduce((acc: Record<string, number>, t: any) => {
    const v = visits.find((v) => v.technician === t.id && v.status === 'Em Andamento')
    const status = v?.technician_status || 'Disponível'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const kpis = [
    {
      label: 'Técnicos Ativos',
      value: activeTechs.length,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Visitas Hoje',
      value: todayVisits.length,
      icon: Clock,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Em Andamento',
      value: inProgress.length,
      icon: Activity,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Concluídas',
      value: completed.length,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Pendentes',
      value: pending.length,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Atrasadas',
      value: late.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Canceladas',
      value: cancelled.length,
      icon: XCircle,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
    },
    {
      label: 'KM Total',
      value: totalMileage.toFixed(0) + 'km',
      icon: Car,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Dashboard de Gestão de Visitas</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${k.bg}`}>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status dos Técnicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(techStatusCount).map(([status, count]) => (
              <div key={status} className="flex justify-between text-xs">
                <span className="text-slate-500">{status}</span>
                <Badge>{count as React.ReactNode}</Badge>
              </div>
            ))}
            {activeTechs.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">Sem dados</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pendências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Despesas pendentes</span>
              <span className="font-bold text-amber-600">{pendingExpenses.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Reembolsos pendentes</span>
              <span className="font-bold text-orange-600">{pendingReimb.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Visitas sem check-out</span>
              <span className="font-bold text-red-600">{inProgress.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visitas de Hoje</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Horário</th>
                  <th className="p-3">Técnico</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Endereço</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {todayVisits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Nenhuma visita hoje.
                    </td>
                  </tr>
                ) : (
                  todayVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium">{v.scheduled_time || '-'}</td>
                      <td className="p-3">{v.expand?.technician?.name || '-'}</td>
                      <td className="p-3">
                        {v.expand?.ticket?.expand?.company?.trade_name || v.client_address || '-'}
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        <MapPin className="inline h-3 w-3" /> {v.client_address || '-'}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{v.status}</Badge>
                      </td>
                      <td className="p-3">
                        {v.expand?.ticket ? (
                          <Link
                            to={`/tickets/${v.ticket}`}
                            className="text-blue-600 hover:underline"
                          >
                            #{v.expand.ticket.number}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
