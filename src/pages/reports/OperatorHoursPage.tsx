import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Clock,
  Timer,
  FileText,
  User,
  RefreshCw,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from '@/hooks/use-theme'
import { useRealtime } from '@/hooks/use-realtime'
import { getOperators } from '@/services/operators'
import type { OperatorItem } from '@/types/operators'
import {
  getOperatorHoursReport,
  type OperatorHoursRow,
  type OperatorHoursReportData,
} from '@/services/operator-hours-report'
import { exportToCsv } from '@/lib/export-utils'
import React from 'react'
import { getErrorMessage } from '@/lib/pocketbase/errors'

function formatSecondsToHMS(seconds: number): string {
  const sec = Math.max(0, Math.round(seconds || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function formatInitials(name: string): string {
  if (!name) return 'OP'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function OperatorHoursPage() {
  const { toast } = useToast()
  const { designSettings } = useTheme()

  // Período padrão: mês atual
  const initialMonthKey = useMemo(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  }, [])

  const [filterMode, setFilterMode] = useState<'month' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonthKey)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all')

  const [operators, setOperators] = useState<OperatorItem[]>([])
  const [reportData, setReportData] = useState<OperatorHoursReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null)

  // Carregar lista de operadores
  useEffect(() => {
    getOperators()
      .then((ops) => setOperators(ops))
      .catch((err) => console.error('Erro ao carregar operadores:', err))
  }, [])

  // Carregar dados do relatório
  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getOperatorHoursReport({
        monthKey: filterMode === 'month' ? selectedMonth : undefined,
        startDate: filterMode === 'custom' ? startDate : undefined,
        endDate: filterMode === 'custom' ? endDate : undefined,
        operatorId: selectedOperatorId,
      })
      setReportData(data)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast({
        title: 'Erro ao gerar relatório',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filterMode, selectedMonth, startDate, endDate, selectedOperatorId, toast])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  // Tempo real para atualizar automaticamente se houver novas interações
  useRealtime('ticket_interactions', () => loadReport())

  // Lista de meses disponíveis (últimos 12 meses)
  const availableMonths = useMemo(() => {
    const list: Array<{ value: string; label: string }> = []
    const now = new Date()
    const monthNames = [
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
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const pad = (n: number) => String(n).padStart(2, '0')
      const val = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      const label = `${monthNames[d.getMonth()]} de ${d.getFullYear()}`
      list.push({ value: val, label })
    }
    return list
  }, [])

  // Exportar dados consolidados para CSV
  const handleExportCsv = () => {
    if (!reportData || reportData.rows.length === 0) return

    const exportRows = reportData.rows.map((r) => {
      return {
        Operador: r.operatorName,
        Email: r.operatorEmail,
        Funcao: r.operatorRole,
        HorasTrabalho: formatSecondsToHMS(r.workedSeconds),
        HorasAcompanhamento: formatSecondsToHMS(r.accompanimentSeconds),
        TotalHoras: formatSecondsToHMS(r.totalSeconds),
        InteracoesCrono: r.cronoInteractionsCount,
        InteracoesAcomp: r.accompanimentInteractionsCount,
        Chamados: r.ticketsCount,
      }
    })

    const headers = [
      'Operador',
      'E-mail',
      'Função',
      'Horas de Trabalho (Play/Pause)',
      'Horas de Acompanhamento (Logs)',
      'Total de Horas',
      'Interações Cronômetro',
      'Interações Acompanhamento',
      'Chamados Atendidos',
    ]

    const periodStr =
      filterMode === 'month' ? selectedMonth : `${startDate || 'inicio'}_a_${endDate || 'fim'}`

    exportToCsv(`relatorio-horas-por-operador_${periodStr}.csv`, exportRows, headers)
  }

  // Exportar detalhes de um operador específico
  const handleExportOperatorDetails = (op: OperatorHoursRow) => {
    if (!op.interactions || op.interactions.length === 0) return

    const detailRows = op.interactions.map((it) => {
      return {
        Operador: op.operatorName,
        Chamado: it.ticketNumber,
        Titulo: it.ticketTitle,
        Cliente: it.companyName,
        Data: new Date(it.created).toLocaleString('pt-BR'),
        Origem: it.origin,
        TipoHora: it.hourType,
        Duracao: formatSecondsToHMS(it.durationSeconds),
        Conteudo: it.content?.replace(/\n/g, ' ') || '',
      }
    })

    const headers = [
      'Operador',
      'Chamado',
      'Título',
      'Cliente',
      'Data',
      'Origem',
      'Tipo da Hora',
      'Duração (HH:MM:SS)',
      'Conteúdo',
    ]

    exportToCsv(
      `detalhe-horas_${op.operatorName.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedMonth}.csv`,
      detailRows,
      headers,
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página com Identidade Visual Grafite + Âmbar */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-border/80">
        <div className="flex items-center gap-3">
          {designSettings?.report_logo_url || designSettings?.logo_url ? (
            <div className="flex items-center max-h-12 max-w-[180px] p-1.5 rounded-lg bg-card/60 border border-border/60">
              <img
                src={designSettings.report_logo_url || designSettings.logo_url}
                alt="Logotipo"
                className="max-h-9 w-auto object-contain"
              />
            </div>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Relatório de Horas por Operador
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Apuração discriminada de{' '}
              <strong className="text-foreground">Horas de Trabalho</strong> (play/pause do
              cronômetro) e <strong className="text-foreground">Horas de Acompanhamento</strong>{' '}
              (lançamentos de logs que debitam franquia).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={loading || !reportData || reportData.rows.length === 0}
            className="h-8 text-xs hover:border-primary/40"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-primary" /> Exportar CSV
          </Button>
          <Button
            size="sm"
            onClick={loadReport}
            disabled={loading}
            className="h-8 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />{' '}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Box explicativo da regra de negócio de horas */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3 text-xs">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            Regra Oficial de Separação de Horas (v0.0.276 • Migrações 0093/0108/0109)
          </p>
          <p className="text-muted-foreground leading-relaxed">
            •{' '}
            <span className="font-medium text-amber-600 dark:text-amber-400">
              Horas de Trabalho (Play/Pause):
            </span>{' '}
            tempo efetivo de atendimento apurado via cronômetro (
            <code className="px-1 py-0.5 rounded bg-background/80 border border-border/60 font-mono text-[11px]">
              origin = Cronômetro
            </code>
            ), somado em{' '}
            <code className="px-1 py-0.5 rounded bg-background/80 border border-border/60 font-mono text-[11px]">
              operator_worked_seconds
            </code>
            . <strong>NÃO debita da franquia do cliente</strong>.
            <br />•{' '}
            <span className="font-medium text-sky-600 dark:text-sky-400">
              Horas de Acompanhamento (Logs):
            </span>{' '}
            tempo registrado através de logs e interações manuais (
            <code className="px-1 py-0.5 rounded bg-background/80 border border-border/60 font-mono text-[11px]">
              origin != Cronômetro
            </code>
            ), somado em{' '}
            <code className="px-1 py-0.5 rounded bg-background/80 border border-border/60 font-mono text-[11px]">
              accompaniment_seconds
            </code>
            . <strong>Debita da franquia contratual do cliente</strong>.
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-border/60 bg-secondary/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Filtros do Relatório
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <Button
              type="button"
              size="sm"
              variant={filterMode === 'month' ? 'default' : 'ghost'}
              className={`h-7 px-2.5 text-xs ${
                filterMode === 'month' ? 'bg-primary text-primary-foreground' : ''
              }`}
              onClick={() => setFilterMode('month')}
            >
              Mês/Ano
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filterMode === 'custom' ? 'default' : 'ghost'}
              className={`h-7 px-2.5 text-xs ${
                filterMode === 'custom' ? 'bg-primary text-primary-foreground' : ''
              }`}
              onClick={() => setFilterMode('custom')}
            >
              Período Livre
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {filterMode === 'month' ? (
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Mês de Referência
                </Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Data Inicial</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Data Final</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> Filtrar por Operador
              </Label>
              <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Todos os operadores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos os operadores ({operators.length})
                  </SelectItem>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id} className="text-xs">
                      {op.name || op.email} ({op.role || 'técnico'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de KPIs Consolidados */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Horas de Trabalho */}
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Horas de Trabalho</p>
              <span className="p-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Timer className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                {reportData ? formatSecondsToHMS(reportData.totals.workedSeconds) : '—'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>Play / Pause</span>
              <span className="text-muted-foreground/60">•</span>
              <span>{reportData?.totals.cronoInteractionsCount || 0} ciclos</span>
            </p>
          </CardContent>
        </Card>

        {/* Horas de Acompanhamento */}
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Horas de Acompanhamento</p>
              <span className="p-1 rounded-md bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <FileText className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 tracking-tight">
                {reportData ? formatSecondsToHMS(reportData.totals.accompanimentSeconds) : '—'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>Debita franquia</span>
              <span className="text-muted-foreground/60">•</span>
              <span>{reportData?.totals.accompanimentInteractionsCount || 0} lançamentos</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Geral de Horas */}
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Total de Horas Investidas</p>
              <span className="p-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-primary tracking-tight">
                {reportData ? formatSecondsToHMS(reportData.totals.totalSeconds) : '—'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>Trabalho + Acompanhamento</span>
            </p>
          </CardContent>
        </Card>

        {/* Operadores e Chamados */}
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Volume de Atendimentos</p>
              <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Layers className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground tracking-tight tabular-nums">
                {reportData?.totals.ticketsCount || 0}
              </span>
              <span className="text-xs text-muted-foreground">chamados</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>{reportData?.totals.operatorsCount || 0} operadores ativos no filtro</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Operadores */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/80 bg-secondary/15">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Demonstrativo por Operador
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Clique na linha do operador para abrir o detalhamento dos chamados atendidos
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-mono bg-secondary/30">
            {reportData?.rows.length || 0} operadores
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={loadReport}>
                Tentar novamente
              </Button>
            </div>
          ) : !reportData || reportData.rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum apontamento ou ciclo de atendimento encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="w-10 text-center"></TableHead>
                    <TableHead className="text-xs font-semibold">Operador</TableHead>
                    <TableHead className="text-xs font-semibold">Função</TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      Horas de Trabalho
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        (Play/Pause)
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      Horas Acompanhamento
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        (Logs / Franquia)
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      Total de Horas
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        (Geral)
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-center">Chamados</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.rows.map((row) => {
                    const isExpanded = expandedOpId === row.operatorId
                    return (
                      <React.Fragment key={row.operatorId}>
                        <TableRow
                          className="cursor-pointer hover:bg-secondary/20 transition-colors"
                          onClick={() => setExpandedOpId(isExpanded ? null : row.operatorId)}
                        >
                          <TableCell className="text-center p-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7 border border-primary/20">
                                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                  {formatInitials(row.operatorName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground">{row.operatorName}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {row.operatorEmail}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {row.operatorRole}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {formatSecondsToHMS(row.workedSeconds)}
                            <span className="block text-[10px] font-sans font-normal text-muted-foreground">
                              {row.cronoInteractionsCount} ciclo(s)
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-semibold text-sky-600 dark:text-sky-400">
                            {formatSecondsToHMS(row.accompanimentSeconds)}
                            <span className="block text-[10px] font-sans font-normal text-muted-foreground">
                              {row.accompanimentInteractionsCount} log(s)
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-primary">
                            {formatSecondsToHMS(row.totalSeconds)}
                          </TableCell>
                          <TableCell className="text-xs text-center font-semibold">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {row.ticketsCount}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="text-xs text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] hover:text-primary"
                              onClick={() => handleExportOperatorDetails(row)}
                              title="Exportar detalhes do operador"
                            >
                              <Download className="h-3 w-3 mr-1" /> Detalhe
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-secondary/10 hover:bg-secondary/15">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-3 pl-6 border-l-2 border-primary/50">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-primary" /> Chamados
                                    atendidos por {row.operatorName} no período
                                  </h4>
                                  <span className="text-[11px] text-muted-foreground">
                                    Total de {row.tickets.length} chamados com apontamento
                                  </span>
                                </div>

                                {row.tickets.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    Nenhum chamado vinculado aos registros deste operador.
                                  </p>
                                ) : (
                                  <div className="rounded-lg border border-border/70 overflow-hidden bg-card/60">
                                    <Table>
                                      <TableHeader className="bg-secondary/30">
                                        <TableRow>
                                          <TableHead className="text-[11px]">Número</TableHead>
                                          <TableHead className="text-[11px]">
                                            Título / Cliente
                                          </TableHead>
                                          <TableHead className="text-[11px]">Status</TableHead>
                                          <TableHead className="text-[11px] text-right">
                                            Trabalho (Play/Pause)
                                          </TableHead>
                                          <TableHead className="text-[11px] text-right">
                                            Acompanhamento (Logs)
                                          </TableHead>
                                          <TableHead className="text-[11px] text-right">
                                            Total
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {row.tickets.map((t) => (
                                          <TableRow key={t.ticketId}>
                                            <TableCell className="text-[11px] font-mono font-medium">
                                              {t.ticketNumber}
                                            </TableCell>
                                            <TableCell className="text-[11px]">
                                              <p className="font-medium text-foreground line-clamp-1">
                                                {t.ticketTitle}
                                              </p>
                                              <p className="text-[10px] text-muted-foreground">
                                                {t.companyName}
                                              </p>
                                            </TableCell>
                                            <TableCell className="text-[11px]">
                                              <Badge variant="outline" className="text-[9px]">
                                                {t.status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-[11px] text-right font-mono text-amber-600 dark:text-amber-400">
                                              {formatSecondsToHMS(t.workedSeconds)}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-right font-mono text-sky-600 dark:text-sky-400">
                                              {formatSecondsToHMS(t.accompanimentSeconds)}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-right font-mono font-semibold text-foreground">
                                              {formatSecondsToHMS(t.totalSeconds)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
