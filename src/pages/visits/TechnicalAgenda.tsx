import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Clock } from 'lucide-react'
import { getVisits, TechnicalVisitRecord, TECHNICIAN_STATUSES } from '@/services/technical-visits'
import { getUsers } from '@/services/users'
import { getCompanies } from '@/services/companies'
import { useRealtime } from '@/hooks/use-realtime'
import { VisitScheduleDialog } from '@/components/VisitScheduleDialog'
import { Link } from 'react-router-dom'

type ViewMode = 'day' | 'week' | 'month'

const STATUS_CLS: Record<string, string> = {
  Agendada: 'bg-blue-100 text-blue-800',
  'Em Andamento': 'bg-amber-100 text-amber-800',
  Concluída: 'bg-green-100 text-green-800',
  Cancelada: 'bg-red-100 text-red-800',
}

const TECH_CLS: Record<string, string> = {
  Disponível: 'bg-green-100 text-green-700',
  'Em Deslocamento': 'bg-blue-100 text-blue-700',
  'Em Serviço Presencial': 'bg-amber-100 text-amber-700',
  'Em Serviço Remoto': 'bg-cyan-100 text-cyan-700',
  Indisponível: 'bg-red-100 text-red-700',
  'Fora do Horário': 'bg-slate-100 text-slate-600',
}

export default function TechnicalAgenda() {
  const [visits, setVisits] = useState<TechnicalVisitRecord[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [techFilter, setTechFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [showSchedule, setShowSchedule] = useState(false)
  const [selectedTech, setSelectedTech] = useState<any | null>(null)

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
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])
  useRealtime('technical_visits', () => loadData())

  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (techFilter !== 'all' && v.technician !== techFilter) return false
      if (clientFilter !== 'all' && v.client !== clientFilter) return false
      return true
    })
  }, [visits, techFilter, clientFilter])

  const weekDays = useMemo(() => {
    const start = new Date(currentDate)
    const day = start.getDay()
    start.setDate(start.getDate() - day)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentDate])

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i))
    return days
  }, [currentDate])

  const visitsForDate = (date: Date) => {
    const dateStr = date.toISOString().slice(0, 10)
    return filteredVisits.filter(
      (v) => v.scheduled_date && v.scheduled_date.slice(0, 10) === dateStr,
    )
  }

  const navigate = (dir: number) => {
    const d = new Date(currentDate)
    if (viewMode === 'day') d.setDate(d.getDate() + dir)
    else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrentDate(d)
  }

  const dateLabel = useMemo(() => {
    if (viewMode === 'day')
      return currentDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    if (viewMode === 'week')
      return `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [currentDate, viewMode, weekDays])

  const activeTechs = technicians.filter((t) => ['tecnico', 'gestor', 'admin'].includes(t.role))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold">Agenda Técnica</h2>
        <div className="flex gap-2 flex-wrap">
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Técnicos</SelectItem>
              {activeTechs.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Clientes</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.trade_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden">
            {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={viewMode === m ? 'default' : 'ghost'}
                className="rounded-none h-8 text-xs"
                onClick={() => setViewMode(m)}
              >
                {m === 'day' ? 'Dia' : m === 'week' ? 'Semana' : 'Mês'}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowSchedule(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agendar
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">{dateLabel}</span>
      </div>

      {viewMode === 'week' && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="border bg-slate-50 p-2 text-xs font-semibold text-slate-600 w-32">
                  Técnico
                </th>
                {weekDays.map((d, i) => (
                  <th
                    key={i}
                    className="border bg-slate-50 p-2 text-xs font-semibold text-slate-600"
                  >
                    {d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTechs.map((tech) => (
                <tr key={tech.id}>
                  <td className="border p-2 text-xs font-medium">
                    <div>{tech.name}</div>
                    {tech.role && (
                      <Badge className={`mt-1 text-[9px] ${TECH_CLS['Disponível']}`}>
                        Disponível
                      </Badge>
                    )}
                  </td>
                  {weekDays.map((d, di) => {
                    const dayVisits = filteredVisits.filter((v) => {
                      if (v.technician !== tech.id) return false
                      return (
                        v.scheduled_date &&
                        v.scheduled_date.slice(0, 10) === d.toISOString().slice(0, 10)
                      )
                    })
                    return (
                      <td key={di} className="border p-1 align-top h-20">
                        {dayVisits.map((v) => (
                          <Link key={v.id} to={`/tickets/${v.ticket}`} className="block mb-1">
                            <div
                              className={`rounded p-1 text-[9px] cursor-pointer hover:opacity-80 ${STATUS_CLS[v.status] || 'bg-slate-100'}`}
                            >
                              <div className="font-semibold">
                                {v.scheduled_time || ''}{' '}
                                {v.expand?.ticket?.number ? `#${v.expand.ticket.number}` : ''}
                              </div>
                              <div className="truncate">
                                {v.client_address || v.visit_reason || 'Visita'}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'day' && (
        <div className="space-y-2">
          {visitsForDate(currentDate).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-500">
                Nenhuma visita agendada para este dia.
              </CardContent>
            </Card>
          ) : (
            visitsForDate(currentDate).map((v) => (
              <Card key={v.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_CLS[v.status]}>{v.status}</Badge>
                      <Badge className={TECH_CLS[v.technician_status || 'Disponível']}>
                        {v.technician_status || 'Disponível'}
                      </Badge>
                      <span className="text-xs font-semibold">
                        {v.scheduled_time} - {v.expected_end_time || ''}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {v.client_address || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {v.expand?.technician?.name || 'N/A'} · {v.appointment_type || 'Visita'} ·{' '}
                      {v.visit_reason || ''}
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
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-1">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 p-1">
              {d}
            </div>
          ))}
          {monthDays.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[80px] border rounded bg-slate-50" />
            const dayVisits = visitsForDate(d)
            const completed = dayVisits.filter((v) => v.status === 'Concluída').length
            const cancelled = dayVisits.filter((v) => v.status === 'Cancelada').length
            return (
              <div key={i} className="min-h-[80px] border rounded p-1 text-xs">
                <div className="font-semibold text-slate-700">{d.getDate()}</div>
                {dayVisits.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-blue-600 font-medium">{dayVisits.length} visitas</div>
                    {completed > 0 && <div className="text-green-600">{completed} concluídas</div>}
                    {cancelled > 0 && <div className="text-red-600">{cancelled} canceladas</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <VisitScheduleDialog open={showSchedule} onOpenChange={setShowSchedule} onSaved={loadData} />
    </div>
  )
}
