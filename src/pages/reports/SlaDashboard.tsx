import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Timer, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getTickets } from '@/services/tickets'
import { getUsers } from '@/services/users'
import { getCategories } from '@/services/categories'
import { getCompanies } from '@/services/companies'
import { getSlaGoals } from '@/services/sla-goals'
import { useRealtime } from '@/hooks/use-realtime'
import {
  buildDateFilter,
  formatDate,
  computeSlaByTechnician,
  computeSlaByActivity,
  slaRowBg,
  slaPctColor,
} from '@/lib/sla-report-utils'

export default function SlaDashboard() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState(formatDate(new Date(Date.now() - 30 * 86400000)))
  const [endDate, setEndDate] = useState(formatDate(new Date()))
  const [companyId, setCompanyId] = useState('all')
  const [companies, setCompanies] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const sd = startDate || formatDate(new Date(Date.now() - 30 * 86400000))
      const ed = endDate || formatDate(new Date())
      const filter = buildDateFilter(sd, ed, companyId)
      const [t, u, c, comps, g] = await Promise.all([
        getTickets(filter),
        getUsers(),
        getCategories(),
        getCompanies(),
        getSlaGoals(),
      ])
      setTickets(t)
      setUsers(u)
      setCategories(c)
      setCompanies(comps)
      setGoals(g)
    } catch (err) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('tickets', () => {
    loadData()
  })

  const techRows = useMemo(() => computeSlaByTechnician(tickets, users), [tickets, users])
  const activityRows = useMemo(
    () => computeSlaByActivity(tickets, categories),
    [tickets, categories],
  )

  const skeletonList = Array.from({ length: 5 }).map((_, i) => (
    <Skeleton key={i} className="h-8 w-full" />
  ))

  const renderGoalCell = (techId: string, slaType: string, actualPct: number) => {
    const goal = goals.find(
      (g) => g.technician === techId && g.sla_type === slaType,
    )?.target_percentage
    if (goal === undefined || goal === null) {
      return <TableCell className="text-xs text-center text-slate-400">—</TableCell>
    }
    const met = actualPct >= goal
    return (
      <TableCell
        className={`text-xs text-center ${met ? 'bg-green-50 font-semibold text-green-700' : 'bg-red-50 font-semibold text-red-700'}`}
      >
        {goal}%
      </TableCell>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Timer className="h-5 w-5 text-blue-600" /> Dashboard SLA
        </h2>
        <div className="flex items-center gap-2">
          <Link to="/sla-goals">
            <Button size="sm" variant="outline">
              <Target className="h-4 w-4 mr-1.5" /> Gerenciar Metas
            </Button>
          </Link>
          <Button size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SLA por Técnico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{skeletonList}</div>
          ) : techRows.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum dado encontrado para o período selecionado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Técnico</TableHead>
                    <TableHead className="text-xs text-center">Total</TableHead>
                    <TableHead className="text-xs text-center">SLA Resposta</TableHead>
                    <TableHead className="text-xs text-center">Meta Resp.</TableHead>
                    <TableHead className="text-xs text-center">SLA Solução</TableHead>
                    <TableHead className="text-xs text-center">Meta Sol.</TableHead>
                    <TableHead className="text-xs text-center">Tempo Resp. (min)</TableHead>
                    <TableHead className="text-xs text-center">Tempo Sol. (min)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techRows.map((r) => (
                    <TableRow key={r.techId} className={slaRowBg(r.solutionPct)}>
                      <TableCell className="text-xs font-medium">{r.techName}</TableCell>
                      <TableCell className="text-xs text-center">{r.total}</TableCell>
                      <TableCell className={`text-xs text-center ${slaPctColor(r.responsePct)}`}>
                        {r.responseMet}/{r.total} ({r.responsePct.toFixed(1)}%)
                      </TableCell>
                      {renderGoalCell(r.techId, 'Resposta', r.responsePct)}
                      <TableCell className={`text-xs text-center ${slaPctColor(r.solutionPct)}`}>
                        {r.solutionMet}/{r.total} ({r.solutionPct.toFixed(1)}%)
                      </TableCell>
                      {renderGoalCell(r.techId, 'Solução', r.solutionPct)}
                      <TableCell className="text-xs text-center">
                        {r.avgResponseMin || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {r.avgSolutionMin || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SLA por Atividade</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{skeletonList}</div>
          ) : activityRows.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum dado encontrado para o período selecionado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Atividade Principal</TableHead>
                    <TableHead className="text-xs">Subatividade</TableHead>
                    <TableHead className="text-xs text-center">Total</TableHead>
                    <TableHead className="text-xs text-center">SLA Resposta</TableHead>
                    <TableHead className="text-xs text-center">SLA Solução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityRows.map((r) => (
                    <TableRow key={r.subcategoryId} className={slaRowBg(r.solutionPct)}>
                      <TableCell className="text-xs font-medium">{r.mainActivity}</TableCell>
                      <TableCell className="text-xs">{r.subactivity}</TableCell>
                      <TableCell className="text-xs text-center">{r.total}</TableCell>
                      <TableCell className={`text-xs text-center ${slaPctColor(r.responsePct)}`}>
                        {r.responseMet}/{r.total} ({r.responsePct.toFixed(1)}%)
                      </TableCell>
                      <TableCell className={`text-xs text-center ${slaPctColor(r.solutionPct)}`}>
                        {r.solutionMet}/{r.total} ({r.solutionPct.toFixed(1)}%)
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
