import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { getSurveys, SatisfactionSurveyRecord } from '@/services/satisfaction-surveys'
import { getTickets } from '@/services/tickets'
import { getUsers } from '@/services/users'
import { getCompanies } from '@/services/companies'
import { Star } from 'lucide-react'

export default function SatisfactionDashboard() {
  const [surveys, setSurveys] = useState<SatisfactionSurveyRecord[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [techFilter, setTechFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')

  useEffect(() => {
    getSurveys()
      .then(setSurveys)
      .catch(() => {})
    getTickets()
      .then(setTickets)
      .catch(() => {})
    getUsers()
      .then(setUsers)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  const responded = surveys.filter((s) => s.responded_at)
  const filtered = responded.filter((s) => {
    const ticket = tickets.find((t) => t.id === s.ticket)
    if (techFilter !== 'all' && ticket?.assigned_to !== techFilter) return false
    if (clientFilter !== 'all' && s.company !== clientFilter) return false
    return true
  })

  const avgOverall =
    filtered.length > 0
      ? (filtered.reduce((sum, s) => sum + (s.overall_score || 0), 0) / filtered.length).toFixed(1)
      : '0.0'
  const closedTickets = tickets.filter((t) => t.status === 'Resolvido' || t.status === 'Encerrado')
  const responseRate =
    closedTickets.length > 0 ? Math.round((responded.length / closedTickets.length) * 100) : 0
  const dissatisfied = filtered.filter((s) => (s.overall_score || 0) <= 2)

  const byTechnician = useMemo(() => {
    const m = new Map<string, { name: string; score: number; count: number }>()
    filtered.forEach((s) => {
      const ticket = tickets.find((t) => t.id === s.ticket)
      const techId = ticket?.assigned_to
      if (!techId) return
      const user = users.find((u) => u.id === techId)
      const existing = m.get(techId) || { name: user?.name || 'N/A', score: 0, count: 0 }
      existing.score += s.overall_score || 0
      existing.count++
      m.set(techId, existing)
    })
    return Array.from(m.values()).map((v) => ({
      name: v.name,
      avg: Number((v.score / v.count).toFixed(1)),
    }))
  }, [filtered, tickets, users])

  const byCompany = useMemo(() => {
    const m = new Map<string, { name: string; score: number; count: number }>()
    filtered.forEach((s) => {
      const comp = companies.find((c) => c.id === s.company)
      const existing = m.get(s.company) || { name: comp?.trade_name || 'N/A', score: 0, count: 0 }
      existing.score += s.overall_score || 0
      existing.count++
      m.set(s.company, existing)
    })
    return Array.from(m.values()).map((v) => ({
      name: v.name,
      avg: Number((v.score / v.count).toFixed(1)),
    }))
  }, [filtered, companies])

  const chartConfig: ChartConfig = { avg: { label: 'Nota Média', color: 'hsl(var(--chart-1))' } }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Pesquisa de Satisfação</h2>
      <div className="flex flex-wrap gap-2">
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Operador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Operadores</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-40">
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
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Nota Média Geral</p>
              <p className="text-2xl font-bold">{avgOverall}</p>
            </div>
            <Star className="h-8 w-8 text-amber-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Taxa de Resposta</p>
            <p className="text-2xl font-bold">{responseRate}%</p>
            <p className="text-xs text-slate-400">
              {responded.length} de {closedTickets.length} chamados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Insatisfeitos</p>
            <p className="text-2xl font-bold text-red-600">{dissatisfied.length}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nota por Operador</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={byTechnician} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 5]} />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10 }} />
                <Bar dataKey="avg" fill="hsl(var(--chart-1))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nota por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={byCompany} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 5]} />
                <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10 }} />
                <Bar dataKey="avg" fill="hsl(var(--chart-2))" radius={4} />
                <Tooltip />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Respostas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Chamado</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Qualid.</th>
                  <th className="p-3">Tempo</th>
                  <th className="p-3">Comun.</th>
                  <th className="p-3">Téc.</th>
                  <th className="p-3">Soluc.</th>
                  <th className="p-3">Geral</th>
                  <th className="p-3">Comentário</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-slate-500">
                      Nenhuma resposta.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const ticket = tickets.find((t) => t.id === s.ticket)
                    const comp = companies.find((c) => c.id === s.company)
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold">{ticket?.number || '-'}</td>
                        <td className="p-3">{comp?.trade_name || '-'}</td>
                        <td className="p-3">{s.quality_score || '-'}</td>
                        <td className="p-3">{s.time_score || '-'}</td>
                        <td className="p-3">{s.communication_score || '-'}</td>
                        <td className="p-3">{s.technical_score || '-'}</td>
                        <td className="p-3">{s.solution_score || '-'}</td>
                        <td className="p-3 font-bold">{s.overall_score || '-'}</td>
                        <td className="p-3 max-w-xs truncate">{s.comment || '-'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
