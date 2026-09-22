import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  Building2,
  Calendar,
  AlertCircle,
  RefreshCw,
  PieChart as PieChartIcon,
  BarChart3,
  Users,
  HardDrive,
  Lightbulb,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  LineChart as LineChartIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { formatHours } from '@/lib/duration'
import {
  fetchMonthlyClientReportData,
  type MonthlyClientReportData,
} from '@/services/monthly-client-report'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const CHART_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#d97706', // amber-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#dc2626', // red-600
  '#4f46e5', // indigo-600
  '#059669', // emerald-600
  '#ea580c', // orange-600
  '#64748b', // slate-500
]

const MONTH_NAMES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10))
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10))
  return `${MONTH_NAMES_FULL[m - 1]} de ${y}`
}

export default function MonthlyClientReportPage() {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialCompany = searchParams.get('company') || ''
  const initialMonth = searchParams.get('month') || currentMonthKey()

  const [monthKey, setMonthKey] = useState<string>(initialMonth)
  const [companyId, setCompanyId] = useState<string>(initialCompany)
  const [companies, setCompanies] = useState<CompanyRecord[]>([])

  const [reportData, setReportData] = useState<MonthlyClientReportData | null>(null)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carrega empresas
  useEffect(() => {
    let mounted = true
    getCompanies()
      .then((list) => {
        if (!mounted) return
        setCompanies(list)
        if (!companyId && list.length > 0) {
          // Seleciona a primeira empresa por padrão se nenhuma tiver na URL
          setCompanyId(list[0].id)
        }
      })
      .catch(() => {
        if (mounted) setCompanies([])
      })
      .finally(() => {
        if (mounted) setLoadingCompanies(false)
      })
    return () => {
      mounted = false
    }
  }, [companyId])

  // Atualiza query string
  useEffect(() => {
    if (companyId) {
      setSearchParams({ company: companyId, month: monthKey }, { replace: true })
    }
  }, [companyId, monthKey, setSearchParams])

  const loadReport = useCallback(async () => {
    if (!companyId) return
    setLoadingReport(true)
    setError(null)
    try {
      const data = await fetchMonthlyClientReportData(companyId, monthKey)
      setReportData(data)
    } catch (err: any) {
      const msg = err?.message || 'Erro ao gerar o relatório mensal.'
      setError(msg)
      toast({
        title: 'Erro ao gerar relatório',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoadingReport(false)
    }
  }, [companyId, monthKey, toast])

  // Dispara a busca quando seleciona ou troca
  useEffect(() => {
    if (companyId) {
      loadReport()
    }
  }, [companyId, monthKey, loadReport])

  const handlePrint = () => {
    window.print()
  }

  // Prepara dados para os gráficos de recharts
  const agreementsChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.agreements.map((a) => ({
      name: a.name,
      Contratado: a.contractedHours,
      Utilizado: a.usedHours,
    }))
  }, [reportData])

  const sectorsChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.sectors
      .filter((s) => s.usedHours > 0 || s.ticketCount > 0)
      .slice(0, 8)
      .map((s) => ({
        name: s.name.length > 18 ? s.name.slice(0, 18) + '...' : s.name,
        fullName: s.name,
        Horas: s.usedHours,
        Chamados: s.ticketCount,
      }))
  }, [reportData])

  const requestersChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.requesters.slice(0, 6).map((r) => ({
      name: r.name.length > 15 ? r.name.slice(0, 15) + '...' : r.name,
      fullName: r.name,
      Horas: r.usedHours,
      Chamados: r.ticketCount,
    }))
  }, [reportData])

  const activitiesChartData = useMemo(() => {
    if (!reportData) return []
    return reportData.activities.slice(0, 6).map((a) => ({
      name: a.name.length > 18 ? a.name.slice(0, 18) + '...' : a.name,
      fullName: a.name,
      Chamados: a.ticketCount,
      Horas: a.usedHours,
    }))
  }, [reportData])

  const assetsPieData = useMemo(() => {
    if (!reportData) return []
    return [
      { name: 'Entradas no Mês', value: reportData.assets.enteredCount },
      { name: 'Saídas / Baixas', value: reportData.assets.exitedCount },
      {
        name: 'Ativos em Operação',
        value: Math.max(0, reportData.assets.activeCount - reportData.assets.enteredCount),
      },
    ].filter((i) => i.value > 0)
  }, [reportData])

  const comparisonChartData = useMemo(() => {
    if (!reportData?.comparison) return []
    return reportData.comparison.items.map((item) => ({
      name: item.label,
      monthKey: item.monthKey,
      'Horas Utilizadas': item.horasUtilizadasDecimal,
      'Chamados Abertos': item.chamadosAbertos,
      'Chamados Resolvidos': item.chamadosResolvidos,
      isRef: item.isReferenceMonth,
    }))
  }, [reportData])

  return (
    <div className="space-y-6 print:m-0 print:p-0 print:space-y-0">
      {/* Estilos ABNT para impressão */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin-top: 3cm;
            margin-left: 3cm;
            margin-bottom: 2cm;
            margin-right: 2cm;
          }

          body {
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 12pt !important;
            line-height: 1.5 !important;
            color: #000000 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Remove cabeçalhos e barras do app */
          header, nav, aside, .no-print, button, .print\\:hidden {
            display: none !important;
          }

          /* Container do relatório */
          .abnt-report-root {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Capa ABNT */
          .abnt-cover {
            page-break-after: always;
            break-after: page;
            min-height: 24cm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            padding: 2cm 0;
          }

          .abnt-cover-header {
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .abnt-cover-title-box {
            margin: auto 0;
          }

          .abnt-cover-title {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 0.5cm;
          }

          .abnt-cover-subtitle {
            font-size: 13pt;
            font-weight: normal;
          }

          .abnt-cover-footer {
            font-size: 12pt;
          }

          /* Seções principais numeradas */
          .abnt-section {
            page-break-before: always;
            break-before: page;
            padding-top: 0.5cm;
          }

          .abnt-section:first-of-type {
            page-break-before: auto;
            break-before: auto;
          }

          .abnt-section-title {
            font-size: 14pt !important;
            font-weight: bold !important;
            text-transform: uppercase;
            margin-bottom: 0.6cm !important;
            color: #000000 !important;
            border-bottom: 1.5pt solid #000000;
            padding-bottom: 4pt;
          }

          .abnt-section-subtitle {
            font-size: 12pt !important;
            font-weight: bold !important;
            margin-top: 0.4cm !important;
            margin-bottom: 0.3cm !important;
          }

          .abnt-paragraph {
            text-align: justify;
            text-indent: 1.25cm;
            margin-bottom: 0.4cm;
            font-size: 12pt !important;
          }

          /* Títulos de Tabelas e Figuras ABNT (acima, tamanho 10pt-11pt) */
          .abnt-caption-top {
            font-size: 10pt !important;
            font-weight: bold;
            margin-bottom: 4pt;
            text-align: left;
          }

          .abnt-source-bottom {
            font-size: 10pt !important;
            font-style: italic;
            margin-top: 4pt;
            text-align: left;
            color: #333333;
          }

          /* Quebra evitada dentro de figuras e tabelas */
          .abnt-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 0.8cm;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10pt !important;
          }

          th, td {
            border: 1pt solid #444444 !important;
            padding: 4pt 6pt !important;
            color: #000000 !important;
          }

          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
            text-align: left;
          }

          /* Gráficos para impressão */
          .abnt-chart-box {
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
            border: 1pt solid #cccccc;
            padding: 8pt;
            background: #ffffff !important;
          }

          .abnt-header-print {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1pt solid #000000;
            padding-bottom: 6pt;
            margin-bottom: 0.6cm;
            font-size: 9pt;
            text-transform: uppercase;
          }
        }
      `}</style>

      {/* Barra de Filtros e Controles no Topo (Oculto na Impressão) */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/reports">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <FileText className="h-5 w-5 text-blue-600" /> Relatório Mensal do Cliente
              </h1>
              <p className="text-xs text-slate-500">
                Extração gráfica mensal com consolidação de acordos, setores, solicitantes e ativos
                (Normas ABNT).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loadingReport || !reportData}
              className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <Printer className="h-4 w-4 mr-1.5" /> Exportar PDF (ABNT)
            </Button>
            <Button
              size="sm"
              onClick={loadReport}
              disabled={loadingReport || !companyId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingReport ? 'animate-spin' : ''}`} />
              Gerar Relatório
            </Button>
          </div>
        </div>

        {/* Card de Filtros */}
        <Card className="shadow-xs">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 items-end">
              {/* Cliente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" /> Cliente / Empresa
                </Label>
                <Select
                  value={companyId}
                  onValueChange={setCompanyId}
                  disabled={loadingCompanies || companies.length === 0}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name || c.legal_name} ({c.code || 'S/C'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mês de Referência */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" /> Mês de Referência
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setMonthKey((k) => shiftMonth(k, -1))}
                    title="Mês anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-9 flex-1 flex items-center justify-center border rounded-md px-2 text-xs font-semibold bg-muted/20">
                    {formatMonthLabel(monthKey)}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setMonthKey((k) => shiftMonth(k, 1))}
                    title="Próximo mês"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Status do Contrato */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Contrato Vinculado</Label>
                <div className="h-9 flex items-center px-3 border rounded-md text-xs bg-muted/10 truncate font-mono">
                  {reportData?.contract
                    ? `${reportData.contract.number} (${reportData.contract.type || 'Padrão'})`
                    : 'Nenhum contrato ativo'}
                </div>
              </div>

              {/* Botão Atalho */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full text-xs"
                  onClick={() => setMonthKey(currentMonthKey())}
                >
                  Mês Atual
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo do Relatório */}
      {loadingReport ? (
        <div className="space-y-6 print:hidden">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <Card className="print:hidden">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{error}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Verifique a conexão ou selecione outro cliente para gerar o relatório.
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={loadReport}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : !reportData ? (
        <Card className="print:hidden">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            <p>Selecione um cliente e clique em "Gerar Relatório".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="abnt-report-root space-y-8 print:space-y-0">
          {/* ============================================================== */}
          {/* CAPA DO RELATÓRIO (Normas ABNT NBR 10719 / 14724)            */}
          {/* ============================================================== */}
          <div className="abnt-cover bg-white dark:bg-slate-900 border rounded-xl p-8 shadow-xs print:border-none print:shadow-none print:rounded-none">
            <div className="abnt-cover-header">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                DELTIME SOLUÇÕES EM TECNOLOGIA — ITSM SERVICEONE
              </p>
              <p className="text-xs font-normal text-slate-500 mt-1">
                GESTÃO DA OPERAÇÃO TÉCNICA E GOVERNANÇA DE TI
              </p>
            </div>

            <div className="abnt-cover-title-box my-10 py-6 text-center border-y print:border-y-2 border-slate-200 dark:border-slate-800">
              <h2 className="abnt-cover-title text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                RELATÓRIO MENSAL DE ATENDIMENTO TÉCNICO
              </h2>
              <p className="abnt-cover-subtitle text-lg font-medium text-blue-700 dark:text-blue-400 mt-2">
                {reportData.company.trade_name || reportData.company.legal_name}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-serif">
                Período de Referência: {reportData.periodLabel}
              </p>
              {reportData.contract && (
                <p className="text-xs text-slate-500 mt-2">
                  Contrato de Prestação de Serviços: nº {reportData.contract.number}
                </p>
              )}
            </div>

            <div className="abnt-cover-footer text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {reportData.company.address_city || 'São Paulo'} —{' '}
                {reportData.company.address_state || 'SP'}
              </p>
              <p className="mt-1">
                Documento técnico para acompanhamento mensal de prestação de serviços de TIC
              </p>
            </div>
          </div>

          {/* Cabeçalho impresso que aparece no topo das páginas seguintes no print */}
          <div className="hidden print:flex abnt-header-print text-muted-foreground">
            <span>
              Relatório Mensal de Atendimento —{' '}
              {reportData.company.trade_name || reportData.company.legal_name}
            </span>
            <span>{reportData.periodLabel}</span>
          </div>

          {/* Cards de Indicadores Rápidos (visível na tela) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
            <Card className="shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Horas Contratadas</p>
                <p className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-1">
                  {reportData.totalContractedHours.toFixed(1)}h
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Franquia do mês</p>
              </CardContent>
            </Card>
            <Card className="shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Horas Utilizadas</p>
                <p className="text-2xl font-bold font-mono text-blue-600 mt-1">
                  {reportData.totalUsedHours.toFixed(1)}h
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total apurado</p>
              </CardContent>
            </Card>
            <Card className="shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Saldo Contratual</p>
                <p
                  className={`text-2xl font-bold font-mono mt-1 ${
                    reportData.totalBalanceHours < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {reportData.totalBalanceHours.toFixed(1)}h
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {reportData.totalBalanceHours < 0 ? 'Horas excedentes' : 'Saldo disponível'}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">% Utilização</p>
                <p
                  className={`text-2xl font-bold font-mono mt-1 ${
                    reportData.totalUtilizationPercent > 100
                      ? 'text-red-600'
                      : reportData.totalUtilizationPercent > 80
                        ? 'text-amber-600'
                        : 'text-blue-600'
                  }`}
                >
                  {reportData.totalUtilizationPercent.toFixed(1)}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Eficiência do pacote</p>
              </CardContent>
            </Card>
          </div>

          {/* ============================================================== */}
          {/* SEÇÃO 1: HORAS POR ACORDO DE ATENDIMENTO                       */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <Clock className="h-5 w-5 text-blue-600 print:hidden" />
              1. Horas por Acordo de Atendimento
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Apresenta a comparação entre as horas contratadas na distribuição formal do acordo de
              atendimento (Nível 1, Nível 2, Nível 3, Consultoria, Backoffice, Administrativo e
              acordos personalizados) e as horas efetivamente utilizadas pela equipe técnica no mês
              de {reportData.periodLabel}.
            </p>

            {/* Gráfico 1 */}
            <div className="abnt-avoid-break mb-6">
              <p className="abnt-caption-top">
                Figura 1 – Comparativo de Horas Contratadas versus Horas Utilizadas por Acordo de
                Atendimento
              </p>
              <div className="abnt-chart-box h-72 w-full rounded-lg bg-slate-50/50 dark:bg-slate-800/30 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={agreementsChartData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      unit="h"
                      label={{ value: 'Horas', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${Number(v).toFixed(2)}h`, '']}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                    <Bar
                      dataKey="Contratado"
                      fill="#3b82f6"
                      name="Horas Contratadas"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="Utilizado"
                      fill="#10b981"
                      name="Horas Utilizadas"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="abnt-source-bottom">
                Fonte: Elaborado pelo autor com base nos registros do ServiceOne ITSM (
                {reportData.periodLabel}).
              </p>
            </div>

            {/* Tabela de Apoio 1 */}
            <div className="abnt-avoid-break">
              <p className="abnt-caption-top">
                Quadro 1 – Demonstrativo Analítico de Consumo e Saldos por Nível de Atendimento
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableHead className="text-xs font-bold">Acordo / Nível</TableHead>
                      <TableHead className="text-xs font-bold text-right">Contratado</TableHead>
                      <TableHead className="text-xs font-bold text-right">Utilizado</TableHead>
                      <TableHead className="text-xs font-bold text-right">Saldo</TableHead>
                      <TableHead className="text-xs font-bold text-right">% Utilização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.agreements.map((ag) => (
                      <TableRow key={ag.key}>
                        <TableCell className="text-xs font-medium">{ag.name}</TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {ag.contractedHours.toFixed(2)}h
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {ag.usedHours.toFixed(2)}h
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right font-mono ${
                            ag.balanceHours < 0
                              ? 'text-red-600 font-semibold'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {ag.balanceHours.toFixed(2)}h
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          <span
                            className={
                              ag.percentUsed > 100
                                ? 'font-bold text-red-600'
                                : ag.percentUsed > 80
                                  ? 'font-semibold text-amber-600'
                                  : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {ag.contractedHours > 0 ? `${ag.percentUsed.toFixed(1)}%` : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Linha de Total */}
                    <TableRow className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t-2">
                      <TableCell className="text-xs">TOTAL CONSOLIDADO</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {reportData.totalContractedHours.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-blue-700 dark:text-blue-400">
                        {reportData.totalUsedHours.toFixed(2)}h
                      </TableCell>
                      <TableCell
                        className={`text-xs text-right font-mono ${
                          reportData.totalBalanceHours < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {reportData.totalBalanceHours.toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-primary">
                        {reportData.totalContractedHours > 0
                          ? `${reportData.totalUtilizationPercent.toFixed(1)}%`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="abnt-source-bottom">
                Fonte: Módulo de Contratos e Gestão de Tempo do ServiceOne.
              </p>
            </div>
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO 2: HORAS UTILIZADAS POR SETOR                            */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <Layers className="h-5 w-5 text-blue-600 print:hidden" />
              2. Horas Utilizadas por Setor
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Demonstra a distribuição da carga de suporte técnico entre as diferentes áreas e
              departamentos da organização no período apurado, identificando setores com maior
              consumo de esforço técnico e chamados gerados.
            </p>

            {sectorsChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Não foram registrados chamados vinculados a setores específicos no mês selecionado.
              </p>
            ) : (
              <>
                {/* Gráfico 2 */}
                <div className="abnt-avoid-break mb-6">
                  <p className="abnt-caption-top">
                    Figura 2 – Distribuição das Horas de Atendimento por Departamento da Empresa
                  </p>
                  <div className="abnt-chart-box h-72 w-full rounded-lg bg-slate-50/50 dark:bg-slate-800/30 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={sectorsChartData}
                        margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                      >
                        <XAxis type="number" unit="h" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                        <Tooltip
                          formatter={(v: any, name: any) => [
                            name === 'Horas' ? `${Number(v).toFixed(2)}h` : v,
                            name,
                          ]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="Horas"
                          fill="#6366f1"
                          name="Horas Consumidas"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="abnt-source-bottom">
                    Fonte: Apuração por centro de custo/departamento — ServiceOne.
                  </p>
                </div>

                {/* Tabela de Apoio 2 */}
                <div className="abnt-avoid-break">
                  <p className="abnt-caption-top">
                    Quadro 2 – Detalhamento de Demandas e Horas por Departamento
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Departamento / Setor</TableHead>
                          <TableHead className="text-xs font-bold text-center">
                            Nº de Chamados
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Horas Utilizadas
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">% do Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.sectors.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs font-medium">{s.name}</TableCell>
                            <TableCell className="text-xs text-center">{s.ticketCount}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">
                              {s.usedHours.toFixed(2)}h
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {s.percentTotal.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="abnt-source-bottom">
                    Fonte: Dados apurados no período de referência.
                  </p>
                </div>
              </>
            )}
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO 3: HORAS POR USUÁRIO SOLICITANTE                         */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <Users className="h-5 w-5 text-blue-600 print:hidden" />
              3. Horas Utilizadas por Usuário Solicitante
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Identifica os colaboradores que mais demandaram suporte no mês, permitindo avaliar
              necessidades de capacitação individual, troca de equipamentos com incidentes
              recorrentes ou suporte a projetos específicos.
            </p>

            {requestersChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Sem registros de solicitantes no mês selecionado.
              </p>
            ) : (
              <>
                {/* Gráfico 3 */}
                <div className="abnt-avoid-break mb-6">
                  <p className="abnt-caption-top">
                    Figura 3 – Ranking dos Maiores Solicitantes por Volume de Horas de Suporte
                  </p>
                  <div className="abnt-chart-box h-72 w-full rounded-lg bg-slate-50/50 dark:bg-slate-800/30 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={requestersChartData}
                        margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
                      >
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 11 }} unit="h" />
                        <Tooltip
                          formatter={(v: any) => [`${Number(v).toFixed(2)}h`, 'Horas Consumidas']}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="Horas"
                          fill="#0284c7"
                          name="Horas Utilizadas"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="abnt-source-bottom">
                    Fonte: Registros de abertura de chamados e apontamentos técnicos (ServiceOne).
                  </p>
                </div>

                {/* Tabela de Apoio 3 */}
                <div className="abnt-avoid-break">
                  <p className="abnt-caption-top">
                    Quadro 3 – Consolidação de Horas e Chamados por Colaborador Solicitante
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Nome do Solicitante</TableHead>
                          <TableHead className="text-xs font-bold">Setor</TableHead>
                          <TableHead className="text-xs font-bold">E-mail</TableHead>
                          <TableHead className="text-xs font-bold text-center">Chamados</TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Horas Utilizadas
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">% do Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.requesters.slice(0, 15).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{r.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.sectorName}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {r.email || '—'}
                            </TableCell>
                            <TableCell className="text-xs text-center">{r.ticketCount}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">
                              {r.usedHours.toFixed(2)}h
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {r.percentTotal.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="abnt-source-bottom">Fonte: ServiceOne ITSM.</p>
                </div>
              </>
            )}
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO 4: ATIVIDADES MAIS REQUISITADAS NO MÊS                   */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <BarChart3 className="h-5 w-5 text-blue-600 print:hidden" />
              4. Atividades Mais Requisitadas no Mês
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Mapeia os tipos de serviços e incidentes mais frequentes do catálogo de atividades de
              TIC, classificando o volume de aberturas e o tempo dedicado para resolução de cada
              natureza de demanda técnica.
            </p>

            {activitiesChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Sem registros de atividades catalogadas para o período.
              </p>
            ) : (
              <>
                {/* Gráfico 4 */}
                <div className="abnt-avoid-break mb-6">
                  <p className="abnt-caption-top">
                    Figura 4 – Volume de Chamados por Categoria de Atividade Técnica
                  </p>
                  <div className="abnt-chart-box h-72 w-full rounded-lg bg-slate-50/50 dark:bg-slate-800/30 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={activitiesChartData}
                        margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
                      >
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v: any, name: any) => [
                            name === 'Horas' ? `${Number(v).toFixed(2)}h` : v,
                            name === 'Horas' ? 'Horas Gastas' : 'Qtd. Chamados',
                          ]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="Chamados"
                          fill="#8b5cf6"
                          name="Qtd. Chamados"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="Horas"
                          fill="#f59e0b"
                          name="Horas Dedicadas"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="abnt-source-bottom">
                    Fonte: Catálogo de Atividades e Categorias do ITSM.
                  </p>
                </div>

                {/* Tabela de Apoio 4 */}
                <div className="abnt-avoid-break">
                  <p className="abnt-caption-top">
                    Quadro 4 – Detalhamento das Atividades Demandadas e Tempo Consumido
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs font-bold">
                            Atividade / Subcategoria
                          </TableHead>
                          <TableHead className="text-xs font-bold">Categoria Macro</TableHead>
                          <TableHead className="text-xs font-bold text-center">
                            Chamados Atendidos
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Horas Dedicadas
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            % do Volume
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.activities.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs font-medium">{a.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {a.categoryName}
                            </TableCell>
                            <TableCell className="text-xs text-center font-semibold">
                              {a.ticketCount}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {a.usedHours.toFixed(2)}h
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {a.percentTotal.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="abnt-source-bottom">Fonte: Catálogo de Serviços do ServiceOne.</p>
                </div>
              </>
            )}
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO 5: ESTUDO DE ONDE MAIS SE REQUER ATENDIMENTO TÉCNICO     */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <Lightbulb className="h-5 w-5 text-amber-500 print:hidden" />
              5. Estudo e Diagnóstico: Onde Mais se Requer Atendimento Técnico
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              {reportData.study.analysisText}
            </p>

            {/* Painel com Indicadores de Destaque da Análise */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4 abnt-avoid-break">
              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Maior Ponto de Concentração
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {reportData.study.topSector?.name || 'N/A'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reportData.study.topSector?.hours.toFixed(1)}h (
                  {reportData.study.topSector?.pct.toFixed(1)}% do esforço)
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Maior Solicitante
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {reportData.study.topRequester?.name || 'N/A'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reportData.study.topRequester?.hours.toFixed(1)}h em{' '}
                  {reportData.study.topRequester?.ticketCount} chamados
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nível Mais Acionado
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {reportData.study.topAgreement?.name || 'N/A'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reportData.study.topAgreement?.hours.toFixed(1)}h consumidas
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Média de Horas por Chamado
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {reportData.study.avgTicketHours.toFixed(2)}h / ticket
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reportData.study.totalTickets} chamado(s) no mês
                </p>
              </div>
            </div>

            {/* Recomendações e Plano de Ação */}
            <div className="abnt-avoid-break mt-6">
              <h4 className="abnt-section-subtitle text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 print:hidden" />
                5.1. Recomendações Técnicas e Plano de Melhoria
              </h4>
              <div className="border rounded-lg p-4 bg-slate-50/70 dark:bg-slate-800/30">
                <ul className="list-disc list-inside space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {reportData.study.recommendations.map((rec, i) => (
                    <li key={i} className="leading-relaxed">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO 6: MOVIMENTAÇÃO DE ATIVOS NO PERÍODO                     */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <HardDrive className="h-5 w-5 text-blue-600 print:hidden" />
              6. Movimentação de Ativos no Período (Entradas e Saídas)
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Registra o fluxo de equipamentos computacionais (desktops, notebooks, tablets e
              celulares) que foram integrados ao parque da empresa (entradas por aquisição ou nova
              atribuição) e os que foram desativados, descartados ou encaminhados para manutenção
              (saídas do ambiente operacional) durante {reportData.periodLabel}.
            </p>

            {/* Indicadores de Movimentação */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 abnt-avoid-break">
              <div className="border rounded-lg p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                  Entradas no Período
                </span>
                <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                  +{reportData.assets.enteredCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Novos ativos ativados</p>
              </div>

              <div className="border rounded-lg p-3 bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block">
                  Saídas no Período
                </span>
                <p className="text-2xl font-bold font-mono text-red-700 dark:text-red-300 mt-1">
                  -{reportData.assets.exitedCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Baixas, descartes ou manutenção
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                  Ativos Ativos Totais
                </span>
                <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
                  {reportData.assets.activeCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Em uso no cliente</p>
              </div>

              <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Total Cadastrado
                </span>
                <p className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                  {reportData.assets.totalInScope}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Base histórica CMDB</p>
              </div>
            </div>

            {/* Gráfico 5: Distribuição por Tipo de Ativo e Fluxo */}
            {reportData.assets.byType.length > 0 && (
              <div className="abnt-avoid-break mb-6">
                <p className="abnt-caption-top">
                  Figura 5 – Composição do Parque de Ativos e Movimentações por Categoria
                </p>
                <div className="abnt-chart-box h-64 w-full rounded-lg bg-slate-50/50 dark:bg-slate-800/30 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={reportData.assets.byType}
                      margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                    >
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="total"
                        fill="#3b82f6"
                        name="Total de Ativos"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="entered"
                        fill="#10b981"
                        name="Entradas (Mês)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="exited"
                        fill="#ef4444"
                        name="Saídas (Mês)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="abnt-source-bottom">
                  Fonte: Módulo de Gestão de Ativos (Equipments) do ServiceOne.
                </p>
              </div>
            )}

            {/* Tabela de Apoio 5: Lista de Ativos Movimentados */}
            <div className="space-y-4">
              <div className="abnt-avoid-break">
                <p className="abnt-caption-top">
                  Quadro 5 – Lista de Ativos com Entrada Registrada no Mês
                </p>
                {reportData.assets.enteredList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 border rounded-lg text-center bg-slate-50/50">
                    Nenhum novo ativo cadastrado ou incorporado no mês de {reportData.periodLabel}.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs font-bold">
                            Identificação / Hostname
                          </TableHead>
                          <TableHead className="text-xs font-bold">Tipo</TableHead>
                          <TableHead className="text-xs font-bold">Marca / Modelo</TableHead>
                          <TableHead className="text-xs font-bold">Responsável / Usuário</TableHead>
                          <TableHead className="text-xs font-bold">Status</TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Data de Entrada
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.assets.enteredList.map((eq) => (
                          <TableRow key={eq.id}>
                            <TableCell className="text-xs font-medium">{eq.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {eq.device_type}
                            </TableCell>
                            <TableCell className="text-xs">
                              {eq.manufacturer} {eq.model !== '—' ? eq.model : ''}
                            </TableCell>
                            <TableCell className="text-xs">{eq.responsible_user}</TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300"
                              >
                                {eq.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {eq.date}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="abnt-source-bottom">Fonte: CMDB ServiceOne.</p>
              </div>

              {reportData.assets.exitedList.length > 0 && (
                <div className="abnt-avoid-break">
                  <p className="abnt-caption-top">
                    Quadro 6 – Lista de Ativos Desativados, Descartados ou em Manutenção no Mês
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs font-bold">
                            Identificação / Hostname
                          </TableHead>
                          <TableHead className="text-xs font-bold">Tipo</TableHead>
                          <TableHead className="text-xs font-bold">Marca / Modelo</TableHead>
                          <TableHead className="text-xs font-bold">Último Responsável</TableHead>
                          <TableHead className="text-xs font-bold">Status</TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Data da Ocorrência
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.assets.exitedList.map((eq) => (
                          <TableRow key={eq.id}>
                            <TableCell className="text-xs font-medium">{eq.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {eq.device_type}
                            </TableCell>
                            <TableCell className="text-xs">
                              {eq.manufacturer} {eq.model !== '—' ? eq.model : ''}
                            </TableCell>
                            <TableCell className="text-xs">{eq.responsible_user}</TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-red-50 text-red-700 border-red-300"
                              >
                                {eq.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {eq.date}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="abnt-source-bottom">Fonte: CMDB ServiceOne.</p>
                </div>
              )}
            </div>
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO 7: COMPARATIVO COM MESES ANTERIORES                      */}
          {/* ============================================================== */}
          <section className="abnt-section bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-xs print:border-none print:shadow-none print:p-0">
            <h3 className="abnt-section-title text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-5 w-5 text-blue-600 print:hidden" />
              7. Comparativo com Meses Anteriores
            </h3>

            <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Apresenta a análise evolutiva do consumo de horas técnicas e do fluxo de abertura e
              resolução de chamados ao longo dos últimos 6 (seis) meses, permitindo diagnosticar a
              tendência de demanda, a estabilidade das operações e os períodos de pico técnico da
              organização.
            </p>

            {/* Texto analítico ABNT gerado dos dados */}
            {reportData.comparison?.summaryText && (
              <p className="abnt-paragraph text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-6 font-serif">
                {reportData.comparison.summaryText}
              </p>
            )}

            {!reportData.comparison || !reportData.comparison.hasData ? (
              <div className="border rounded-lg p-6 text-center bg-slate-50/50 dark:bg-slate-800/30 text-xs text-muted-foreground my-4">
                Sem dados de consumo nos últimos 6 meses para este cliente.
              </div>
            ) : (
              <>
                {/* Gráfico 6: Evolução de Consumo de Horas nos Últimos 6 Meses */}
                <div className="abnt-avoid-break mb-6">
                  <p className="abnt-caption-top">
                    Figura 6 – Evolução do consumo de horas nos últimos 6 meses
                  </p>
                  <div className="abnt-chart-box h-72 w-full rounded-lg bg-slate-50/50 dark:bg-slate-800/30 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={comparisonChartData}
                        margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          unit="h"
                          label={{
                            value: 'Horas',
                            angle: -90,
                            position: 'insideLeft',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          formatter={(v: any, name: any) => [
                            name === 'Horas Utilizadas' ? `${Number(v).toFixed(2)}h` : v,
                            name,
                          ]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                        <Area
                          type="monotone"
                          dataKey="Horas Utilizadas"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorHours)"
                          name="Horas Utilizadas"
                          dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: '#2563eb' }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="abnt-source-bottom">
                    Fonte: Registros históricos de interações e apontamentos de horas (ServiceOne).
                  </p>
                </div>

                {/* Quadro 7: Comparativo mensal de consumo */}
                <div className="abnt-avoid-break">
                  <p className="abnt-caption-top">Quadro 7 – Comparativo mensal de consumo</p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Mês</TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Horas Utilizadas (HH:MM:SS)
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Horas (Decimal)
                          </TableHead>
                          <TableHead className="text-xs font-bold text-center">
                            Chamados Abertos
                          </TableHead>
                          <TableHead className="text-xs font-bold text-center">
                            Chamados Resolvidos
                          </TableHead>
                          <TableHead className="text-xs font-bold text-right">
                            Variação vs. Mês Anterior
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.comparison.items.map((row) => {
                          const isSelected = row.isReferenceMonth
                          const variacao = row.variacaoPercent
                          const isPositive = variacao !== null && variacao > 0
                          const isNegative = variacao !== null && variacao < 0

                          return (
                            <TableRow
                              key={row.monthKey}
                              className={
                                isSelected
                                  ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold border-l-4 border-l-blue-600 print:bg-slate-100'
                                  : undefined
                              }
                            >
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span>{row.label}</span>
                                  {isSelected && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1.5 py-0 h-4 border-blue-400 text-blue-700 bg-blue-100/60 dark:bg-blue-900/40"
                                    >
                                      Mês Selecionado
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono font-semibold">
                                {row.horasUtilizadasFormatted}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono text-muted-foreground">
                                {row.horasUtilizadasDecimal.toFixed(2)}h
                              </TableCell>
                              <TableCell className="text-xs text-center font-mono">
                                {row.chamadosAbertos}
                              </TableCell>
                              <TableCell className="text-xs text-center font-mono">
                                {row.chamadosResolvidos}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {variacao === null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center justify-end gap-1 font-semibold ${
                                      isPositive
                                        ? 'text-red-600 dark:text-red-400'
                                        : isNegative
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                    style={{
                                      WebkitPrintColorAdjust: 'exact',
                                      printColorAdjust: 'exact',
                                    }}
                                  >
                                    {isPositive && (
                                      <span className="text-red-600 font-bold">▲</span>
                                    )}
                                    {isNegative && (
                                      <span className="text-emerald-600 font-bold">▼</span>
                                    )}
                                    {!isPositive && !isNegative && (
                                      <span className="text-slate-500 font-bold">―</span>
                                    )}
                                    {Math.abs(variacao).toFixed(1)}%
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}

                        {/* Linha Consolidada do Semestre */}
                        <TableRow className="bg-slate-100/70 dark:bg-slate-800/80 font-bold border-t-2">
                          <TableCell className="text-xs">TOTAL DO SEMESTRE</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {formatHours(reportData.comparison.totalHours6Months)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-blue-700 dark:text-blue-400">
                            {reportData.comparison.totalHours6Months.toFixed(2)}h
                          </TableCell>
                          <TableCell className="text-xs text-center font-mono">
                            {reportData.comparison.totalOpened6Months}
                          </TableCell>
                          <TableCell className="text-xs text-center font-mono">
                            {reportData.comparison.totalResolved6Months}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-muted-foreground text-[11px]">
                            Média: {reportData.comparison.averageHours.toFixed(1)}h/mês
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="abnt-source-bottom">
                    Fonte: Série histórica consolidada dos últimos 6 meses (ServiceOne ITSM).
                  </p>
                </div>
              </>
            )}
          </section>
          {/* Rodapé / Assinaturas do Relatório */}
          <div className="abnt-avoid-break border-t-2 pt-6 mt-8 print:block">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-b border-black w-48 mx-auto mb-2" />
                <p className="font-bold">Responsável Técnico Deltime</p>
                <p className="text-slate-500">ServiceOne ITSM</p>
              </div>
              <div>
                <div className="border-b border-black w-48 mx-auto mb-2" />
                <p className="font-bold">Gestor Responsável no Cliente</p>
                <p className="text-slate-500">
                  {reportData.company.trade_name || reportData.company.legal_name}
                </p>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-6">
              Relatório emitido automaticamente pelo ServiceOne ITSM em{' '}
              {new Date().toLocaleString('pt-BR')}. Documento em conformidade com normas ABNT NBR
              10719.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
