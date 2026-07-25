import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Server, AlertTriangle, UserX, ArrowUpRight, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { getEquipments, EquipmentRecord } from '@/services/equipments'
import { getTickets } from '@/services/tickets'
import { CiStatusBadge } from '@/components/CiStatusBadge'

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
]

export default function CmdbDashboard() {
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [tickets, setTickets] = useState<any[]>([])

  useEffect(() => {
    getEquipments()
      .then(setEquipments)
      .catch(() => {})
    getTickets()
      .then(setTickets)
      .catch(() => {})
  }, [])

  const totalCis = equipments.length
  const warrantiesExpiring = equipments.filter((e) => {
    if (!e.warranty_until) return false
    const days = (new Date(e.warranty_until).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 30
  }).length
  const noResponsible = equipments.filter((e) => !e.responsible_user).length

  const byType = useMemo(() => {
    const m = new Map<string, number>()
    equipments.forEach((e) => m.set(e.type || 'N/D', (m.get(e.type || 'N/D') || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [equipments])

  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    equipments.forEach((e) => m.set(e.status || 'N/D', (m.get(e.status || 'N/D') || 0) + 1))
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [equipments])

  const topTicketed = useMemo(() => {
    const m = new Map<string, number>()
    tickets.forEach((t) => {
      if (t.equipment) m.set(t.equipment, (m.get(t.equipment) || 0) + 1)
    })
    const eqMap = new Map(equipments.map((e) => [e.id, e.name]))
    return Array.from(m, ([id, count]) => ({ name: eqMap.get(id) || id, chamados: count }))
      .sort((a, b) => b.chamados - a.chamados)
      .slice(0, 10)
  }, [tickets, equipments])

  const nextWarranties = equipments
    .filter((e) => e.warranty_until && new Date(e.warranty_until) > new Date())
    .sort((a, b) => new Date(a.warranty_until!).getTime() - new Date(b.warranty_until!).getTime())
    .slice(0, 10)

  const typeConfig: ChartConfig = { value: { label: 'Ativos' } }
  const barConfig: ChartConfig = { chamados: { label: 'Chamados', color: 'hsl(var(--chart-3))' } }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total de Ativos</p>
              <p className="text-2xl font-bold">{totalCis}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Server className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Link to="/cmdb/assets?filter=warranty">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Garantias a Expirar (30d)</p>
                <p className="text-2xl font-bold text-amber-600">{warrantiesExpiring}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/cmdb/assets?filter=no-responsible">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Ativos sem Responsável</p>
                <p className="text-2xl font-bold text-red-600">{noResponsible}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ativos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={typeConfig} className="h-[240px]">
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ativos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={typeConfig} className="h-[240px]">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top 10 Ativos com Mais Chamados</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[260px]">
            <BarChart data={topTicketed} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
              <Bar dataKey="chamados" fill="hsl(var(--chart-3))" radius={4} />
              <Tooltip />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Próximos Vencimentos de Garantia</CardTitle>
          <Link
            to="/cmdb/assets"
            className="text-xs text-blue-600 hover:underline flex items-center"
          >
            Ver Todos <ArrowUpRight className="h-3 w-3 ml-1" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-y">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Fabricante</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Garantia até</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {nextWarranties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500">
                      Nenhum vencimento próximo.
                    </td>
                  </tr>
                ) : (
                  nextWarranties.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <Link to={`/cmdb/assets/${e.id}`} className="font-semibold text-blue-600">
                          {e.name}
                        </Link>
                      </td>
                      <td className="p-3">{e.type || '-'}</td>
                      <td className="p-3">{e.manufacturer || '-'}</td>
                      <td className="p-3">
                        <CiStatusBadge status={e.status} />
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(e.warranty_until!).toLocaleDateString('pt-BR')}
                        </span>
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
