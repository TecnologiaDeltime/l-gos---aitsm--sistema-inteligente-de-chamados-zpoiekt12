import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Server, AlertTriangle, UserX, ArrowUpRight, Calendar, Boxes } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { getEquipments, EquipmentRecord } from '@/services/equipments'
import { getConfigurationItems, ConfigurationItemRecord } from '@/services/configuration-items'
import { getTickets } from '@/services/tickets'
import { CiStatusBadge } from '@/components/CiStatusBadge'

const COLORS = [
  '#f59e0b',
  '#d97706',
  '#10b981',
  '#b45309',
  '#ef4444',
  '#fcd34d',
  '#78350f',
  '#84cc16',
  '#64748b',
  '#475569',
]

const ASSET_DEVICE_TYPES = ['Desktop', 'Notebook', 'Tablet', 'Celular']

export default function CmdbDashboard() {
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [configurationItems, setConfigurationItems] = useState<ConfigurationItemRecord[]>([])
  const [tickets, setTickets] = useState<any[]>([])

  useEffect(() => {
    getEquipments()
      .then(setEquipments)
      .catch(() => {})
    getConfigurationItems()
      .then(setConfigurationItems)
      .catch(() => {})
    getTickets()
      .then(setTickets)
      .catch(() => {})
  }, [])

  // Contagem de Ativos (equipments atribuídos a pessoas: Desktop, Notebook, Tablet, Celular)
  const totalAssets = useMemo(() => {
    return equipments.filter((e) => !e.device_type || ASSET_DEVICE_TYPES.includes(e.device_type))
      .length
  }, [equipments])

  // Contagem de Itens de Configuração
  const totalCis = configurationItems.length

  const warrantiesExpiring = equipments.filter((e) => {
    if (!e.warranty_until) return false
    const days = (new Date(e.warranty_until).getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 30
  }).length

  const noResponsible = equipments.filter((e) => !e.responsible_user && !e.owner).length

  // Ativos por Tipo (dispositivos)
  const byAssetType = useMemo(() => {
    const m = new Map<string, number>()
    equipments.forEach((e) => {
      const type = e.device_type || e.type || 'Desktop'
      m.set(type, (m.get(type) || 0) + 1)
    })
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [equipments])

  // Itens de Configuração por Tipo
  const byCiType = useMemo(() => {
    const m = new Map<string, number>()
    configurationItems.forEach((c) => {
      const type = c.type || 'Outros'
      m.set(type, (m.get(type) || 0) + 1)
    })
    return Array.from(m, ([k, v]) => ({ name: k, value: v }))
  }, [configurationItems])

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

  const typeConfig: ChartConfig = { value: { label: 'Quantidade' } }
  const barConfig: ChartConfig = { chamados: { label: 'Chamados', color: 'hsl(var(--chart-3))' } }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/cmdb/assets">
          <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Ativos</p>
                <p className="text-2xl font-bold">{totalAssets}</p>
                <p className="text-[11px] text-muted-foreground">Computadores, notebooks, etc.</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/15">
                <Server className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/cmdb/configuration-items">
          <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Itens de Configuração</p>
                <p className="text-2xl font-bold">{totalCis}</p>
                <p className="text-[11px] text-muted-foreground">Infraestrutura, switches, etc.</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50">
                <Boxes className="h-5 w-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/cmdb/assets?filter=warranty">
          <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Garantias a Expirar (30d)</p>
                <p className="text-2xl font-bold text-amber-600">{warrantiesExpiring}</p>
                <p className="text-[11px] text-muted-foreground">Ativos no prazo de expiração</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/cmdb/assets?filter=no-responsible">
          <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ativos sem Responsável</p>
                <p className="text-2xl font-bold text-red-600">{noResponsible}</p>
                <p className="text-[11px] text-muted-foreground">Sem usuário ou dono atribuído</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Gráficos de Ativos e CIs */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Ativos por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ativos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={typeConfig} className="h-[220px]">
              <PieChart>
                <Pie
                  data={byAssetType}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                >
                  {byAssetType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Itens de Configuração por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Itens de Configuração por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {byCiType.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
                Nenhum item de configuração cadastrado.
              </div>
            ) : (
              <ChartContainer config={typeConfig} className="h-[220px]">
                <PieChart>
                  <Pie
                    data={byCiType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                  >
                    {byCiType.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Ativos por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ativos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={typeConfig} className="h-[220px]">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
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

      {/* Top 10 Chamados por Ativo */}
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

      {/* Próximos Vencimentos de Garantia */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Próximos Vencimentos de Garantia</CardTitle>
          <Link to="/cmdb/items" className="text-xs text-primary hover:underline flex items-center">
            {' '}
            Ver Todos <ArrowUpRight className="h-3 w-3 ml-1" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="bg-muted/50 border-y">
                <tr>
                  <th className="p-3 font-semibold text-foreground">Nome</th>
                  <th className="p-3 font-semibold text-foreground">Tipo</th>
                  <th className="p-3 font-semibold text-foreground">Fabricante</th>
                  <th className="p-3 font-semibold text-foreground">Status</th>
                  <th className="p-3 font-semibold text-foreground">Garantia até</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nextWarranties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Nenhum vencimento próximo.
                    </td>
                  </tr>
                ) : (
                  nextWarranties.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="p-3">
                        <Link
                          to={`/cmdb/assets/${e.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {e.name}
                        </Link>
                      </td>
                      <td className="p-3">{e.device_type || e.type || '-'}</td>
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
