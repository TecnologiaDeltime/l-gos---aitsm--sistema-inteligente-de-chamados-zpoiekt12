import { useEffect, useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart3, Clock, CheckCircle, AlertTriangle, Timer } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getCompanyUnitsByCompany, CompanyUnitRecord } from '@/services/company-units'
import { getTickets, TicketRecord } from '@/services/tickets'
import { getTimeEntriesByFilter, TimeEntryRecord } from '@/services/time-entries'

export default function UnitReportsPage() {
  const permissions = usePermissions()
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [units, setUnits] = useState<CompanyUnitRecord[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      getCompanyUnitsByCompany(selectedCompany)
        .then(setUnits)
        .catch(() => {})
    } else {
      setUnits([])
      setSelectedUnit('')
    }
  }, [selectedCompany])

  const reportData = useMemo(() => {
    const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)
    const totalHours = totalMinutes / 60
    const openTickets = tickets.filter(
      (t) => !['Resolvido', 'Encerrado', 'Cancelado'].includes(t.status),
    )
    const resolvedTickets = tickets.filter((t) => ['Resolvido', 'Encerrado'].includes(t.status))
    const slaMet = tickets.filter((t) => t.sla_status === 'Dentro do Prazo').length
    const slaViolated = tickets.filter((t) =>
      ['Violado', 'Crítico'].includes(t.sla_status || ''),
    ).length
    const slaTotal = slaMet + slaViolated
    const slaCompliance = slaTotal > 0 ? (slaMet / slaTotal) * 100 : 0

    const responseTimes = tickets
      .filter((t) => (t as any).sla_response_at && t.created)
      .map(
        (t) =>
          (new Date((t as any).sla_response_at).getTime() - new Date(t.created).getTime()) / 60000,
      )
    const avgResponse =
      responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0

    const resolutionTimes = tickets
      .filter((t) => (t as any).resolution_date && t.created)
      .map(
        (t) =>
          (new Date((t as any).resolution_date).getTime() - new Date(t.created).getTime()) / 60000,
      )
    const avgResolution =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0

    return {
      totalHours,
      openCount: openTickets.length,
      resolvedCount: resolvedTickets.length,
      slaCompliance,
      avgResponse,
      avgResolution,
    }
  }, [tickets, timeEntries])

  if (!permissions.canAccessUnitReports) {
    return <Navigate to="/dashboard" replace />
  }

  const generateReport = async () => {
    setLoading(true)
    const filters: string[] = []
    if (selectedCompany) filters.push(`company = "${selectedCompany}"`)
    if (selectedUnit) filters.push(`unit = "${selectedUnit}"`)
    if (startDate) filters.push(`created >= "${startDate} 00:00:00"`)
    if (endDate) filters.push(`created <= "${endDate} 23:59:59"`)
    if (statusFilter !== 'all') filters.push(`status = "${statusFilter}"`)

    const filter = filters.join(' && ')
    try {
      const ticketData = await getTickets(filter)
      setTickets(ticketData)

      const ticketIds = ticketData.map((t) => t.id)
      if (ticketIds.length > 0) {
        const timeFilter = ticketIds.map((id) => `ticket = "${id}"`).join(' || ')
        const entries = await getTimeEntriesByFilter(timeFilter)
        setTimeEntries(entries)
      } else {
        setTimeEntries([])
      }
      setHasGenerated(true)
    } catch {
      /* intentionally ignored */
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Relatórios por Filial</h2>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Empresa</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Filial</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Data Início</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Data Fim</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Novo">Novo</SelectItem>
                  <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="Resolvido">Resolvido</SelectItem>
                  <SelectItem value="Encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-4 bg-blue-600 hover:bg-blue-700"
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </Button>
        </CardContent>
      </Card>

      {hasGenerated && (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-blue-600" /> Horas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{reportData.totalHours.toFixed(1)}h</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5 text-slate-600" /> Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{tickets.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Abertos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{reportData.openCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" /> Resolvidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{reportData.resolvedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" /> SLA %
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{reportData.slaCompliance.toFixed(0)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <Timer className="h-3.5 w-3.5 text-purple-600" /> Resp. (min)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{reportData.avgResponse.toFixed(0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
                  <tr>
                    <th className="p-3.5">Nº</th>
                    <th className="p-3.5">Título</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Nenhum chamado encontrado.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                        <td className="p-3.5 font-bold text-blue-600">#{t.number}</td>
                        <td className="p-3.5 font-medium text-slate-900 max-w-sm truncate dark:text-slate-100">
                          {t.title}
                        </td>
                        <td className="p-3.5">{t.status}</td>
                        <td className="p-3.5">{t.sla_status || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
