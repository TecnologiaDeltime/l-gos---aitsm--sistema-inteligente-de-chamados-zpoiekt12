import React from 'react'
import {
  LifeBuoy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
  Users,
  Activity,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  PieChart as PieChartIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PortalDashboardMetrics,
  PortalSectorConsumption,
  PortalMonthlyHoursHistory,
  PortalTopActivity,
  PortalTopRequester,
} from '@/services/client-portal-dashboard'

interface PortalDashboardTabProps {
  metrics: PortalDashboardMetrics | null
  loading: boolean
  companyName: string
  onOpenTicketsTab?: () => void
  onOpenHoursTab?: () => void
  onOpenReportsTab?: () => void
}

const SECTOR_COLORS = [
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#64748b', // slate-500
]

export default function PortalDashboardTab({
  metrics,
  loading,
  companyName,
  onOpenTicketsTab,
  onOpenHoursTab,
  onOpenReportsTab,
}: PortalDashboardTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  const sectors = metrics?.sectors || []
  const last3Months = metrics?.last3Months || []
  const top10Activities = metrics?.top10Activities || []
  const top10Requesters = metrics?.top10Requesters || []

  // Prepara dados para o gráfico de consumo por setor
  const sectorChartData = sectors.slice(0, 8).map((s) => ({
    name: s.sectorName.length > 16 ? s.sectorName.slice(0, 16) + '...' : s.sectorName,
    fullName: s.sectorName,
    Horas: s.hours,
    Chamados: s.ticketCount,
    percent: s.percent,
  }))

  // Prepara dados para o gráfico de série mensal dos últimos 3 meses
  const months3ChartData = last3Months.map((m) => ({
    name: m.label,
    Contratadas: m.contractedHours,
    Consumidas: m.consumedHours,
    Saldo: m.balanceHours,
    Abertos: m.ticketsOpened,
    Fechados: m.ticketsClosed,
  }))

  // Top setor que mais requisita
  const topSector = sectors.length > 0 ? sectors[0] : null

  return (
    <div className="space-y-6">
      {/* =========================================================================
          INDICADORES PRINCIPAIS (KPIS)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total de chamados abertos */}
        <Card
          onClick={onOpenTicketsTab}
          className="cursor-pointer bg-card border hover:border-amber-500/50 transition-all shadow-2xs group"
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Total de Chamados Abertos</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                <LifeBuoy className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                {metrics?.totalTicketsOpened || 0}
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
                Histórico
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 mt-2">
            <span>{metrics?.totalTicketsPending || 0} em andamento</span>
            <span className="text-amber-500 flex items-center font-semibold gap-0.5">
              Ver chamados <ArrowUpRight className="h-3 w-3" />
            </span>
          </CardContent>
        </Card>

        {/* Total de chamados fechados */}
        <Card
          onClick={onOpenTicketsTab}
          className="cursor-pointer bg-card border hover:border-emerald-500/50 transition-all shadow-2xs group"
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Total de Chamados Fechados</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {metrics?.totalTicketsClosed || 0}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                {metrics?.resolutionRate || 0}% resolvidos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 mt-2">
            <span>Resolvidos e encerrados</span>
            <span className="text-emerald-500 flex items-center font-semibold gap-0.5">
              Auditar <ArrowUpRight className="h-3 w-3" />
            </span>
          </CardContent>
        </Card>

        {/* Consumo do Mês Corrente */}
        <Card
          onClick={onOpenHoursTab}
          className="cursor-pointer bg-card border hover:border-blue-500/50 transition-all shadow-2xs group"
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Consumo do Mês Corrente</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                {metrics?.currentMonthConsumedHours || 0}h
              </span>
              <span className="text-xs text-muted-foreground">
                de {metrics?.currentMonthContractedHours || 0}h
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 mt-2">
            <span>Saldo: {metrics?.currentMonthBalanceHours || 0}h</span>
            <span className="text-blue-500 flex items-center font-semibold gap-0.5">
              Extrato <ArrowUpRight className="h-3 w-3" />
            </span>
          </CardContent>
        </Card>

        {/* Setor Mais Demandante */}
        <Card className="bg-card border shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Setor Mais Demandante</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1">
              <span
                className="text-lg font-bold text-foreground block truncate"
                title={topSector?.sectorName || 'N/D'}
              >
                {topSector?.sectorName || 'Nenhum'}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-bold text-amber-500">
                  {topSector ? `${topSector.hours}h` : '0h'}
                </span>
                <span>• {topSector?.ticketCount || 0} chamado(s)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 mt-2">
            <span>{topSector?.percent || 0}% do consumo total</span>
            {onOpenReportsTab && (
              <button
                onClick={onOpenReportsTab}
                className="text-purple-500 hover:underline flex items-center font-semibold gap-0.5"
              >
                Relatórios <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          LINHA DE GRÁFICOS 1: (A) POR SETOR & (B) ÚLTIMOS 3 MESES
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO (A): Consumo da franquia por setor da empresa */}
        <Card className="bg-card border shadow-2xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-500" />
                  Consumo da Franquia por Setor / Departamento
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Identifica qual setor da empresa está requisitando mais suportes e consumindo mais
                  horas.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {sectors.length} setor(es)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            {sectorChartData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
                <p>Nenhum chamado com setor registrado para esta empresa.</p>
              </div>
            ) : (
              <div className="h-[280px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sectorChartData}
                    margin={{ top: 20, right: 15, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      unit="h"
                      label={{ value: 'Horas', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-popover p-2.5 text-xs shadow-md space-y-1 text-popover-foreground">
                            <p className="font-bold text-sm text-foreground">{d.fullName}</p>
                            <p className="text-amber-500 font-semibold font-mono">
                              Horas Consumidas: {d.Horas}h ({d.percent}%)
                            </p>
                            <p className="text-muted-foreground">
                              Chamados Registrados: {d.Chamados}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Bar
                      dataKey="Horas"
                      name="Horas de Suporte (h)"
                      radius={[4, 4, 0, 0]}
                      fill="#d97706"
                    >
                      {sectorChartData.map((_, idx) => (
                        <Cell key={idx} fill={SECTOR_COLORS[idx % SECTOR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Rodapé explicativo do gráfico */}
            <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Distribuição proporcional entre os setores da {companyName}</span>
              {topSector && (
                <span className="font-medium text-foreground">
                  Maior demanda: <strong>{topSector.sectorName}</strong>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO (B): Consumo de horas dos últimos 3 meses (série mensal) */}
        <Card className="bg-card border shadow-2xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Consumo de Horas nos Últimos 3 Meses
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Série histórica mensal comparando franquia contratada versus horas utilizadas.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Trimestre
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            {months3ChartData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
                <Calendar className="h-8 w-8 text-muted-foreground/40" />
                <p>Nenhum dado histórico registrado para o trimestre.</p>
              </div>
            ) : (
              <div className="h-[280px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={months3ChartData}
                    margin={{ top: 20, right: 15, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      unit="h"
                      label={{ value: 'Horas', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-popover p-2.5 text-xs shadow-md space-y-1 text-popover-foreground">
                            <p className="font-bold text-sm text-foreground">{d.name}</p>
                            <p className="text-amber-500 font-semibold font-mono">
                              Consumidas: {d.Consumidas}h
                            </p>
                            <p className="text-blue-500 font-semibold font-mono">
                              Contratadas: {d.Contratadas}h
                            </p>
                            <p className="text-emerald-500 font-mono">Saldo: {d.Saldo}h</p>
                            <p className="text-muted-foreground pt-1 border-t text-[11px]">
                              Chamados: {d.Abertos} abertos / {d.Fechados} fechados
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Bar
                      dataKey="Contratadas"
                      name="Franquia Contratada"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Consumidas"
                      name="Horas Consumidas"
                      fill="#d97706"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Rodapé explicativo do gráfico */}
            <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Série temporal dos últimos 3 meses consolidados</span>
              <span className="font-mono text-xs text-foreground">
                Mês corrente: {metrics?.currentMonthConsumedHours || 0}h utilizadas
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          LINHA DE TABELAS 2: (E) TOP 10 ATIVIDADES & (F) TOP 10 COLABORADORES
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* (E) TOP 10 DE ATIVIDADES MAIS REQUISITADAS */}
        <Card className="bg-card border shadow-2xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" />
                  Top 10 de Atividades Mais Requisitadas
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Tipos de serviço e solicitações com maior volume de chamados da sua empresa.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Top 10
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            {top10Activities.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Nenhuma atividade registrada até o momento.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5 text-left">Atividade / Serviço</th>
                      <th className="p-2.5 text-left hidden sm:table-cell">Categoria</th>
                      <th className="p-2.5 text-right">Chamados</th>
                      <th className="p-2.5 text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {top10Activities.map((act, idx) => (
                      <tr key={act.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-2.5 text-center font-bold text-amber-600 dark:text-amber-400 font-mono">
                          {idx + 1}º
                        </td>
                        <td className="p-2.5 font-medium text-foreground">
                          <span className="line-clamp-1" title={act.name}>
                            {act.name}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground hidden sm:table-cell">
                          <span className="line-clamp-1">{act.categoryName}</span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-foreground">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {act.ticketCount}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          {act.hours > 0 ? `${act.hours}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* (F) TOP 10 DE COLABORADORES QUE MAIS SOLICITARAM */}
        <Card className="bg-card border shadow-2xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Top 10 de Colaboradores Solicitantes
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Usuários e colaboradores que mais abriram chamados na central de suporte.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Top 10
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-2">
            {top10Requesters.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Nenhum solicitante identificado até o momento.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5 text-left">Colaborador</th>
                      <th className="p-2.5 text-left hidden sm:table-cell">Setor</th>
                      <th className="p-2.5 text-right">Chamados</th>
                      <th className="p-2.5 text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {top10Requesters.map((req, idx) => (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="p-2.5 text-center font-bold text-blue-600 dark:text-blue-400 font-mono">
                          {idx + 1}º
                        </td>
                        <td className="p-2.5 font-medium text-foreground">
                          <div className="flex flex-col">
                            <span className="line-clamp-1 font-semibold">{req.name}</span>
                            {req.email && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                {req.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-muted-foreground hidden sm:table-cell">
                          <span className="line-clamp-1">{req.sectorName}</span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-foreground">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {req.ticketCount}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          {req.hours > 0 ? `${req.hours}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
