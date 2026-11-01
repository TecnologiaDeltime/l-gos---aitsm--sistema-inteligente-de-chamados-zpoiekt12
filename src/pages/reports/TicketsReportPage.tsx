import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Ticket,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building,
  User,
  AlertCircle,
  FileSpreadsheet,
  Printer,
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
import { exportReportToXlsx, exportReportToPdf, type ExportColumn } from '@/lib/export-reports'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  getTicketReport,
  getReportFilterOptions,
  formatSecondsToHMS,
  type TicketReportRow,
  type ReportFilterParams,
  type AuxiliaryFilterOptions,
} from '@/services/itsm-reports'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'

const ITEMS_PER_PAGE = 25

export default function TicketsReportPage() {
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

  const [rows, setRows] = useState<TicketReportRow[]>([])
  const [totalAccompanimentSeconds, setTotalAccompanimentSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Carregar opções dos filtros auxiliares
  useEffect(() => {
    getReportFilterOptions()
      .then(setFilterOptions)
      .catch((err) => console.error('Erro ao carregar opções de filtro:', err))
  }, [])

  // Carregar dados do relatório
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTicketReport(filterParams)
      setRows(data.rows)
      setTotalAccompanimentSeconds(data.totalAccompanimentSeconds)
      setCurrentPage(1)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast({
        title: 'Erro ao carregar relatório de chamados',
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

  useRealtime('tickets', () => loadData())

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

  // Filtragem local por texto (busca rápida)
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
        r.branchName.toLowerCase().includes(term) ||
        r.sectorName.toLowerCase().includes(term) ||
        r.assetName.toLowerCase().includes(term),
    )
  }, [rows, search])

  // Totalizador recalculado sobre os filtrados
  const filteredAccompanimentSeconds = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + r.accompanimentSeconds, 0)
  }, [filteredRows])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredRows.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredRows, currentPage])

  // Nome do cliente filtrado
  const selectedClientName = useMemo(() => {
    if (!filterParams.companyId || filterParams.companyId === 'all') {
      return 'Todos os clientes'
    }
    const found = filterOptions.companies.find((c) => c.id === filterParams.companyId)
    return found ? found.name : 'Todos os clientes'
  }, [filterParams.companyId, filterOptions.companies])

  // Colunas completas e legíveis para exportação XLSX e PDF
  const reportColumns: ExportColumn<TicketReportRow>[] = useMemo(
    () => [
      { header: 'Ticket', accessor: (r) => r.ticketNumber, align: 'left', width: '70px' },
      { header: 'Cliente', accessor: (r) => r.companyName, align: 'left', width: '100px' },
      { header: 'Filial', accessor: (r) => r.branchName, align: 'left', width: '80px' },
      { header: 'Setor', accessor: (r) => r.sectorName, align: 'left', width: '80px' },
      {
        header: 'Abertura',
        accessor: (r) => new Date(r.createdAt).toLocaleDateString('pt-BR'),
        align: 'center',
        width: '70px',
      },
      { header: 'Atividade', accessor: (r) => r.activityName, align: 'left', width: '90px' },
      { header: 'Título', accessor: (r) => r.title, align: 'left', width: '140px' },
      { header: 'Status', accessor: (r) => r.status, align: 'center', width: '75px' },
      {
        header: 'Horas Acompanhamento',
        accessor: (r) => formatSecondsToHMS(r.accompanimentSeconds),
        align: 'right',
        width: '90px',
      },
      {
        header: 'Resolução',
        accessor: (r) =>
          r.resolutionDate ? new Date(r.resolutionDate).toLocaleDateString('pt-BR') : '—',
        align: 'center',
        width: '70px',
      },
      { header: 'Ativo', accessor: (r) => r.assetName, align: 'left', width: '85px' },
      { header: 'Operador', accessor: (r) => r.operatorName, align: 'left', width: '95px' },
      {
        header: 'Descrição da Solução',
        accessor: (r) => r.solution.replace(/\n/g, ' ') || '—',
        align: 'left',
        width: '160px',
      },
    ],
    [],
  )

  // Exportar para CSV
  const handleExportCsv = () => {
    if (filteredRows.length === 0) return

    const exportData = filteredRows.map((r) => ({
      Ticket: r.ticketNumber,
      Cliente: r.companyName,
      Filial: r.branchName,
      'Setor Solicitante': r.sectorName,
      'Data de Abertura': new Date(r.createdAt).toLocaleString('pt-BR'),
      Atividade: r.activityName,
      Título: r.title,
      Status: r.status,
      'Total de Horas de Acompanhamento (HH:MM:SS)': formatSecondsToHMS(r.accompanimentSeconds),
      'Data de Resolução': r.resolutionDate
        ? new Date(r.resolutionDate).toLocaleString('pt-BR')
        : '—',
      Ativo: r.assetName,
      Operador: r.operatorName,
      'Descrição da Solução': r.solution.replace(/\n/g, ' '),
    }))

    const headers = [
      'Ticket',
      'Cliente',
      'Filial',
      'Setor Solicitante',
      'Data de Abertura',
      'Atividade',
      'Título',
      'Status',
      'Total de Horas de Acompanhamento (HH:MM:SS)',
      'Data de Resolução',
      'Ativo',
      'Operador',
      'Descrição da Solução',
    ]

    exportToCsv(
      `relatorio_chamados_${new Date().toISOString().slice(0, 10)}.csv`,
      exportData,
      headers,
    )
  }

  // Exportar para XLSX
  const handleExportXlsx = () => {
    if (filteredRows.length === 0) return

    exportReportToXlsx({
      filename: `relatorio_chamados_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: 'Relatório Detalhado de Chamados',
      clientName: selectedClientName,
      columns: reportColumns,
      rows: filteredRows,
      totalSummary: {
        label: `Total de Chamados: ${filteredRows.length} | Total de Horas de Acompanhamento:`,
        value: formatSecondsToHMS(filteredAccompanimentSeconds),
      },
    })
  }

  // Exportar para PDF
  const handleExportPdf = () => {
    if (filteredRows.length === 0) return

    exportReportToPdf({
      filename: `relatorio_chamados_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: 'Relatório Detalhado de Chamados',
      clientName: selectedClientName,
      logoUrl: designSettings?.report_logo_url || designSettings?.logo_url,
      columns: reportColumns,
      rows: filteredRows,
      totalSummary: {
        label: `Total de Chamados: ${filteredRows.length} | Total de Horas de Acompanhamento:`,
        value: formatSecondsToHMS(filteredAccompanimentSeconds),
      },
    })
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
                <Ticket className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Relatório de Chamados
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Visualização linha a linha com Ticket, Cliente, Filial, Setor, Datas, Atividade,
              Status, Horas de Acompanhamento (que debitam franquia), Ativo, Operador e Solução.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={loading || filteredRows.length === 0}
            className="h-8 text-xs hover:border-primary/40"
            title="Exportar dados filtrados em CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-primary" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportXlsx}
            disabled={loading || filteredRows.length === 0}
            className="h-8 text-xs hover:border-primary/40"
            title="Exportar dados filtrados em planilha XLSX"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> XLSX
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            disabled={loading || filteredRows.length === 0}
            className="h-8 text-xs hover:border-primary/40"
            title="Exportar relatório em PDF com cabeçalho oficial"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> PDF
          </Button>
          <Button
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
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
                Total de Chamados
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {filteredRows.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Ticket className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Horas de Acompanhamento
              </p>
              <p className="text-2xl font-extrabold font-mono text-primary mt-1">
                {formatSecondsToHMS(filteredAccompanimentSeconds)}
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
                Chamados Resolvidos
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {
                  filteredRows.filter((r) => r.status === 'Resolvido' || r.status === 'Encerrado')
                    .length
                }
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
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
              Lista Linha a Linha dos Chamados
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredRows.length} chamado(s) encontrado(s) para os critérios selecionados
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Busca rápida..."
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
              Nenhum chamado encontrado com os filtros aplicados.
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
                      Abertura
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Atividade
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[200px]">Título</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap text-right">
                      Horas Acompanhamento
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Resolução
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Ativo</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Operador
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[240px]">Solução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((r) => (
                    <TableRow key={r.ticketId} className="hover:bg-secondary/10 text-xs">
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
                        {new Date(r.createdAt).toLocaleDateString('pt-BR')}
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
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            r.status === 'Resolvido' || r.status === 'Encerrado'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary whitespace-nowrap">
                        {formatSecondsToHMS(r.accompanimentSeconds)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.resolutionDate
                          ? new Date(r.resolutionDate).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.assetName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.operatorName}
                      </TableCell>
                      <TableCell
                        className="max-w-sm truncate text-muted-foreground"
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

          {/* Rodapé com totalizador e paginação */}
          <div className="p-4 border-t border-border/60 bg-secondary/15 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span>
                Total de Linhas: <strong>{filteredRows.length}</strong>
              </span>
              <span>•</span>
              <span>
                Total de Horas de Acompanhamento:{' '}
                <strong className="font-mono text-primary">
                  {formatSecondsToHMS(filteredAccompanimentSeconds)}
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
