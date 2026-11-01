import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText,
  Download,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { useTheme } from '@/hooks/use-theme'
import { useRealtime } from '@/hooks/use-realtime'
import { exportToCsv } from '@/lib/export-utils'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  getTicketInteractionsReport,
  getReportFilterOptions,
  formatSecondsToHMS,
  type TicketInteractionReportRow,
  type ReportFilterParams,
  type AuxiliaryFilterOptions,
} from '@/services/itsm-reports'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'

const ITEMS_PER_PAGE = 25

export default function TicketInteractionsReportPage() {
  const { toast } = useToast()
  const { designSettings } = useTheme()

  const initialMonthKey = useMemo(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  }, [])

  const [filterParams, setFilterParams] = useState<ReportFilterParams>({
    filterMode: 'month',
    monthKey: initialMonthKey,
    startDate: '',
    endDate: '',
    companyId: 'all',
    operatorId: 'all',
    branchId: 'all',
    sectorId: 'all',
    status: 'all',
    activityId: 'all',
  })

  const [filterOptions, setFilterOptions] = useState<AuxiliaryFilterOptions>({
    companies: [],
    branches: [],
    sectors: [],
    operators: [],
    activities: [],
    statuses: [],
  })

  const [rows, setRows] = useState<TicketInteractionReportRow[]>([])
  const [totalInteractionSeconds, setTotalInteractionSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    getReportFilterOptions()
      .then(setFilterOptions)
      .catch((err) => console.error('Erro ao carregar opções de filtro:', err))
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTicketInteractionsReport(filterParams)
      setRows(data.rows)
      setTotalInteractionSeconds(data.totalInteractionSeconds)
      setCurrentPage(1)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast({
        title: 'Erro ao carregar relatório de interações',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filterParams, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('ticket_interactions', () => loadData())

  const handleFilterChange = (newParams: Partial<ReportFilterParams>) => {
    setFilterParams((prev) => ({ ...prev, ...newParams }))
  }

  const handleResetFilters = () => {
    setFilterParams({
      filterMode: 'month',
      monthKey: initialMonthKey,
      startDate: '',
      endDate: '',
      companyId: 'all',
      operatorId: 'all',
      branchId: 'all',
      sectorId: 'all',
      status: 'all',
      activityId: 'all',
    })
    setSearch('')
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const term = search.toLowerCase()
    return rows.filter(
      (r) =>
        r.ticketNumber.toLowerCase().includes(term) ||
        r.companyName.toLowerCase().includes(term) ||
        r.title.toLowerCase().includes(term) ||
        r.operatorName.toLowerCase().includes(term) ||
        r.activityName.toLowerCase().includes(term) ||
        r.interactionContent.toLowerCase().includes(term) ||
        r.branchName.toLowerCase().includes(term) ||
        r.sectorName.toLowerCase().includes(term),
    )
  }, [rows, search])

  const filteredTotalSeconds = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + r.durationSeconds, 0)
  }, [filteredRows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredRows.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredRows, currentPage])

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return

    const exportData = filteredRows.map((r) => ({
      Ticket: r.ticketNumber,
      Cliente: r.companyName,
      Filial: r.branchName,
      'Setor Solicitante': r.sectorName,
      'Data de Abertura': new Date(r.ticketCreatedAt).toLocaleString('pt-BR'),
      'Data do Log': new Date(r.interactionCreatedAt).toLocaleString('pt-BR'),
      Atividade: r.activityName,
      Título: r.title,
      Status: r.status,
      'Tempo Lançado (HH:MM:SS)': formatSecondsToHMS(r.durationSeconds),
      'Data de Resolução': r.resolutionDate
        ? new Date(r.resolutionDate).toLocaleString('pt-BR')
        : '—',
      Ativo: r.assetName,
      Operador: r.operatorName,
      'Tipo de Hora': r.hourType,
      'Origem do Log': r.interactionOrigin,
      'Conteúdo do Log': r.interactionContent.replace(/\n/g, ' '),
      'Descrição da Solução': r.solution.replace(/\n/g, ' '),
    }))

    const headers = [
      'Ticket',
      'Cliente',
      'Filial',
      'Setor Solicitante',
      'Data de Abertura',
      'Data do Log',
      'Atividade',
      'Título',
      'Status',
      'Tempo Lançado (HH:MM:SS)',
      'Data de Resolução',
      'Ativo',
      'Operador',
      'Tipo de Hora',
      'Origem do Log',
      'Conteúdo do Log',
      'Descrição da Solução',
    ]

    exportToCsv(
      `relatorio_interacoes_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      exportData,
      headers,
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
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
                <FileText className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Relatório de Interações nos Chamados (Logs)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Exibe linha a linha todas as interações e logs lançados com seu respectivo tempo para
              auditoria e controle do que debita franquia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={loading || filteredRows.length === 0}
            className="h-8 text-xs hover:border-primary/40"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-primary" /> Exportar CSV
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
      </div>

      {/* Barra de Filtros */}
      <ReportFilterBar
        filterParams={filterParams}
        onFilterChange={handleFilterChange}
        filterOptions={filterOptions}
        onReset={handleResetFilters}
      />

      {/* Cards de Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total de Logs Lançados
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {filteredRows.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total de Tempo Lançado
              </p>
              <p className="text-2xl font-extrabold font-mono text-primary mt-1">
                {formatSecondsToHMS(filteredTotalSeconds)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Chamados Distintos
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {new Set(filteredRows.map((r) => r.ticketId)).size}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Dados */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold text-foreground">
              Interações e Logs de Acompanhamento Linha a Linha
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredRows.length} log(s) registrado(s) no período
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Busca em logs, títulos, texto..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={loadData} className="text-xs">
                Tentar novamente
              </Button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma interação de log encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Ticket
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Cliente
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Filial
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Setor</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Data Log
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Atividade
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[180px]">Título</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap text-right">
                      Tempo Lançado
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Operador
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Ativo</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[220px]">
                      Conteúdo do Log
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[200px]">Solução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((r) => (
                    <TableRow key={r.interactionId} className="hover:bg-secondary/10 text-xs">
                      <TableCell className="font-mono font-semibold text-primary whitespace-nowrap">
                        {r.ticketNumber}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {r.companyName}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {r.branchName}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {r.sectorName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(r.interactionCreatedAt).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px]">
                          {r.activityName}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={r.title}>
                        {r.title}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary whitespace-nowrap">
                        {formatSecondsToHMS(r.durationSeconds)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.operatorName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.assetName}
                      </TableCell>
                      <TableCell
                        className="max-w-xs truncate text-foreground font-mono text-[11px]"
                        title={r.interactionContent}
                      >
                        {r.interactionContent || '—'}
                      </TableCell>
                      <TableCell
                        className="max-w-xs truncate text-muted-foreground"
                        title={r.solution}
                      >
                        {r.solution || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Rodapé */}
          <div className="p-4 border-t border-border/60 bg-secondary/15 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span>
                Total de Logs: <strong>{filteredRows.length}</strong>
              </span>
              <span>•</span>
              <span>
                Total de Horas Lançadas:{' '}
                <strong className="font-mono text-primary">
                  {formatSecondsToHMS(filteredTotalSeconds)}
                </strong>
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-muted-foreground">
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
