import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Download, RefreshCw, Timer, AlertCircle, ChevronRight } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/hooks/use-theme'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { exportToCsv } from '@/lib/export-utils'
import { useRealtime } from '@/hooks/use-realtime'
import { formatMinutes } from '@/lib/duration'
import { formatDate } from '@/lib/sla-report-utils'
import pb from '@/lib/pocketbase/client'

interface InteractionRow {
  id: string
  ticket: string
  author: string
  created: string
  duration_minutes?: number
  hour_type?: string
  origin?: string
  content?: string
  expand?: any
}

/** Outros relatórios disponíveis no sistema, para acesso rápido. */
const OTHER_REPORTS = [
  {
    title: 'Relatório Mensal do Cliente',
    desc: 'Extração gráfica e executiva de horas por acordo, setores, solicitantes, atividades e movimentação de ativos nas normas ABNT.',
    path: '/reports/monthly-client',
  },
  {
    title: 'Extração de Clientes',
    desc: 'Relatório dinâmico com seleção flexível de colunas cadastrais, contatos, unidades e contratos para conferência e exportação.',
    path: '/reports/clients',
  },
  {
    title: 'Funcionalidades Implantadas',
    desc: 'Relatório executivo e inventário detalhado de todas as funcionalidades entregues, com exportação para PDF e CSV.',
    path: '/reports/implemented-features',
  },
  {
    title: 'Auditoria de Alertas',
    desc: 'Auditoria e engajamento de operadores com alertas de SLA, chamados parados e horas.',
    path: '/reports/alert-audit',
  },
  {
    title: 'Dashboard de SLA',
    desc: 'Cumprimento de prazos de resposta e solução por cliente e operador.',
    path: '/sla-dashboard',
  },
  {
    title: 'Relatórios Agendados',
    desc: 'Disparo periódico automático de relatórios por e-mail.',
    path: '/scheduled-reports',
    itemKey: 'rep_scheduled_reports',
  },
  {
    title: 'Apuração de Horas de Contrato',
    desc: 'Consumo de horas contratadas vs excedentes por cliente.',
    path: '/horas-clientes',
    itemKey: 'clients_horas',
    moduleKey: 'clients' as const,
  },
  {
    title: 'Relatórios por Filial',
    desc: 'Indicadores de chamados segmentados por unidade/filial.',
    path: '/reports/unit',
    itemKey: 'rep_unit',
  },
]

export default function ReportsPage() {
  const permissions = usePermissions()
  const { toast } = useToast()
  const { designSettings } = useTheme()

  const [startDate, setStartDate] = useState(formatDate(new Date(Date.now() - 30 * 86400000)))
  const [endDate, setEndDate] = useState(formatDate(new Date()))
  const [companyId, setCompanyId] = useState('all')

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [interactions, setInteractions] = useState<InteractionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sd = startDate || formatDate(new Date(Date.now() - 30 * 86400000))
      const ed = endDate || formatDate(new Date())
      const parts = [
        `origin = 'Cronômetro'`,
        `created >= '${sd} 00:00:00.000Z'`,
        `created <= '${ed} 23:59:59.999Z'`,
      ]
      const [ints, comps] = await Promise.all([
        pb.collection('ticket_interactions').getFullList<InteractionRow>({
          filter: parts.join(' && '),
          sort: '-created',
          expand: 'ticket,ticket.company,author',
        }),
        getCompanies(),
      ])
      setInteractions(ints)
      setCompanies(comps)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast({
        title: 'Erro ao carregar dados',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('ticket_interactions', () => loadData())

  // Aplica filtro de empresa no cliente (company está no ticket expandido).
  const rows = useMemo(() => {
    const filtered = interactions.filter((it) => {
      if (companyId === 'all') return true
      return it.expand?.ticket?.company === companyId
    })
    return filtered.map((it) => {
      const ticket = it.expand?.ticket
      const company = ticket?.expand?.company
      const author = it.expand?.author
      return {
        id: it.id,
        ticketId: it.ticket,
        ticketNumber: ticket?.number || '—',
        companyName: company?.trade_name || company?.legal_name || '—',
        authorName: author?.name || author?.email || '—',
        created: it.created,
        duration_minutes: it.duration_minutes || 0,
        hour_type: it.hour_type || '—',
        content: it.content,
      }
    })
  }, [interactions, companyId])

  const totalMinutes = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.duration_minutes) || 0), 0),
    [rows],
  )

  const handleExport = () => {
    if (rows.length === 0) return
    const sd = startDate || formatDate(new Date(Date.now() - 30 * 86400000))
    const ed = endDate || formatDate(new Date())
    exportToCsv(
      `horas-cronometro_${sd}_a_${ed}.csv`,
      rows.map((r) => ({
        Ticket: r.ticketNumber,
        Empresa: r.companyName,
        Operador: r.authorName,
        Data: new Date(r.created).toLocaleString('pt-BR'),
        'Horas (HH:MM:SS)': formatMinutes(r.duration_minutes),
        'Tipo de Hora': r.hour_type,
      })),
      ['Ticket', 'Empresa', 'Operador', 'Data', 'Horas (HH:MM:SS)', 'Tipo de Hora'],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 pb-1 border-b border-border/80">
        <div className="flex items-center gap-3">
          {designSettings?.report_logo_url || designSettings?.logo_url ? (
            <div className="flex items-center max-h-12 max-w-[180px] p-1.5 rounded-lg bg-card/60 border border-border/60">
              <img
                src={designSettings.report_logo_url || designSettings.logo_url}
                alt="Logotipo de Documentos"
                className="max-h-9 w-auto object-contain"
              />
            </div>
          ) : null}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />{' '}
              Relatórios Gerenciais
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Apurações consolidadas de apontamento, SLA, atendimento e contratos
            </p>
          </div>
        </div>
      </div>

      {/* Relatório principal: Horas por Cronômetro */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/80 bg-secondary/15">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Timer className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Horas por Cronômetro
            </CardTitle>
            <Badge
              variant="outline"
              className="ml-1 text-[10px] bg-primary/10 text-primary border-primary/30"
            >
              origin = Cronômetro
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={loading || rows.length === 0}
              className="h-8 text-xs hover:border-primary/40"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-8 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />{' '}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
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
              <Label className="text-xs">Empresa / Cliente</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name || c.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
              <p className="text-xs text-muted-foreground">Total de Horas</p>
              <p className="text-2xl font-bold font-mono text-primary mt-1">
                {formatMinutes(totalMinutes)}
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
              <p className="text-xs text-muted-foreground">Interações</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
              <p className="text-xs text-muted-foreground">Período</p>
              <p className="text-sm font-semibold text-foreground/90 mt-2">
                {startDate} → {endDate}
              </p>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={loadData}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma interação originada por cronômetro no período selecionado.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-xs">Ticket</TableHead>
                      <TableHead className="text-xs">Empresa</TableHead>
                      <TableHead className="text-xs">Operador</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs text-right">Horas</TableHead>
                      <TableHead className="text-xs">Tipo de Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">{r.ticketNumber}</TableCell>
                        <TableCell className="text-xs">{r.companyName}</TableCell>
                        <TableCell className="text-xs">{r.authorName}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(r.created).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold">
                          {formatMinutes(r.duration_minutes)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.hour_type !== '—' ? (
                            <Badge variant="outline" className="text-[10px]">
                              {r.hour_type}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outros relatórios */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Outros relatórios disponíveis
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {OTHER_REPORTS.filter((r) => {
            if ((r as any).moduleKey) {
              return permissions.canAccessItem((r as any).moduleKey, (r as any).itemKey)
            }
            if ((r as any).itemKey) {
              return permissions.canAccessItem('reports', (r as any).itemKey)
            }
            return true
          }).map((r) => (
            <Card key={r.path} className="itsm-card itsm-card-hover border-border/80 bg-card/90">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60 bg-secondary/10">
                <CardTitle className="text-sm font-semibold text-foreground">{r.title}</CardTitle>
                <BarChart3 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs hover:border-primary/40 hover:text-primary"
                  asChild
                >
                  <Link to={r.path}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Visualizar
                    <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
