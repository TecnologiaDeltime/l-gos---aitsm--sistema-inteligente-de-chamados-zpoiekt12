import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldCheck,
  Download,
  RefreshCw,
  Search,
  FileSpreadsheet,
  Printer,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useTheme } from '@/hooks/use-theme'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getApprovalReportRows, type ApprovalReportRow } from '@/services/approval-report'
import { exportReportToXlsx, exportReportToPdf, type ExportColumn } from '@/lib/export-reports'

const ITEMS_PER_PAGE = 25

function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'Aprovado':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold'
    case 'Reprovado':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold'
    default:
      return 'bg-secondary text-secondary-foreground border-border'
  }
}

export default function ApprovalsReportPage() {
  const { toast } = useToast()
  const { designSettings } = useTheme()

  const [startDate, setStartDate] = useState(toISODate(new Date(Date.now() - 90 * 86400000)))
  const [endDate, setEndDate] = useState(toISODate(new Date()))
  const [appliedStart, setAppliedStart] = useState(startDate)
  const [appliedEnd, setAppliedEnd] = useState(endDate)
  const [companyId, setCompanyId] = useState('all')
  const [appliedCompanyId, setAppliedCompanyId] = useState('all')

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [rows, setRows] = useState<ApprovalReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Opções de empresas (para o select de filtro)
  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch((err) => console.error('Erro ao carregar empresas:', err))
  }, [])

  // Carregar decisões (Aprovado/Reprovado) do período/empresa aplicados
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getApprovalReportRows({
        startDate: appliedStart,
        endDate: appliedEnd,
        companyId: appliedCompanyId,
      })
      setRows(data)
      setCurrentPage(1)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast({
        title: 'Erro ao carregar relatório de aprovações',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [appliedStart, appliedEnd, appliedCompanyId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // "Aplicar filtros" — só recarrega ao clicar no botão
  const handleApplyFilters = () => {
    setAppliedStart(startDate)
    setAppliedEnd(endDate)
    setAppliedCompanyId(companyId)
  }

  const handleResetFilters = () => {
    const sd = toISODate(new Date(Date.now() - 90 * 86400000))
    const ed = toISODate(new Date())
    setStartDate(sd)
    setEndDate(ed)
    setCompanyId('all')
    setAppliedStart(sd)
    setAppliedEnd(ed)
    setAppliedCompanyId('all')
    setSearch('')
  }

  // Filtro local de busca rápida
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const term = search.toLowerCase()
    return rows.filter(
      (r) =>
        r.ticketNumber.toLowerCase().includes(term) ||
        r.ticketTitle.toLowerCase().includes(term) ||
        r.companyName.toLowerCase().includes(term) ||
        r.requesterName.toLowerCase().includes(term) ||
        r.approverName.toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term),
    )
  }, [rows, search])

  const approvedCount = useMemo(
    () => filteredRows.filter((r) => r.status === 'Aprovado').length,
    [filteredRows],
  )
  const rejectedCount = useMemo(
    () => filteredRows.filter((r) => r.status === 'Reprovado').length,
    [filteredRows],
  )

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredRows.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredRows, currentPage])

  // Nome da empresa filtrada (cabeçalho das exportações)
  const selectedClientName = useMemo(() => {
    if (!appliedCompanyId || appliedCompanyId === 'all') return 'Todas as empresas'
    const found = companies.find((c) => c.id === appliedCompanyId)
    return found ? found.trade_name || found.legal_name : 'Todas as empresas'
  }, [appliedCompanyId, companies])

  const periodLabel = useMemo(() => {
    const fmt = (iso: string) => {
      if (!iso) return '—'
      const [y, m, d] = iso.split('-')
      return `${d}/${m}/${y}`
    }
    return `${fmt(appliedStart)} a ${fmt(appliedEnd)}`
  }, [appliedStart, appliedEnd])

  // Colunas para exportação XLSX e PDF
  const reportColumns: ExportColumn<ApprovalReportRow>[] = useMemo(
    () => [
      {
        header: 'Data da Decisão',
        accessor: (r) => r.decisionDate || '—',
        align: 'center',
        width: '70px',
      },
      { header: 'Chamado', accessor: (r) => r.ticketNumber, align: 'left', width: '60px' },
      { header: 'Título', accessor: (r) => r.ticketTitle, align: 'left', width: '140px' },
      {
        header: 'Status',
        accessor: (r) => r.status,
        align: 'center',
        width: '60px',
      },
      {
        header: 'Motivo',
        accessor: (r) => r.reason || '—',
        align: 'left',
        width: '170px',
      },
      {
        header: 'Solicitante',
        accessor: (r) => r.requesterName,
        align: 'left',
        width: '100px',
      },
      {
        header: 'Aprovador',
        accessor: (r) => r.approverName,
        align: 'left',
        width: '100px',
      },
      { header: 'Empresa', accessor: (r) => r.companyName, align: 'left', width: '100px' },
    ],
    [],
  )

  const exportSummary = {
    label: `Período: ${periodLabel} | Total de Decisões:`,
    value: filteredRows.length,
  }

  // Exportar para XLSX
  const handleExportXlsx = () => {
    if (filteredRows.length === 0) return
    exportReportToXlsx({
      filename: `relatorio_aprovacoes_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: 'Relatório de Aprovações',
      clientName: selectedClientName,
      columns: reportColumns,
      rows: filteredRows,
      totalSummary: exportSummary,
    })
  }

  // Exportar para PDF
  const handleExportPdf = () => {
    if (filteredRows.length === 0) return
    exportReportToPdf({
      filename: `relatorio_aprovacoes_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: 'Relatório de Aprovações',
      clientName: selectedClientName,
      logoUrl: designSettings?.report_logo_url || designSettings?.logo_url,
      columns: reportColumns,
      rows: filteredRows,
      totalSummary: exportSummary,
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
                <ShieldCheck className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Relatório de Aprovações
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Decisões de aprovação de chamados (aprovados e reprovados) com data, motivo,
              solicitante, aprovador e empresa — com filtro por período e empresa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial (decisão)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final (decisão)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Building className="h-3 w-3" /> Empresa
              </Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-56 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name || c.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleApplyFilters} className="h-8 text-xs">
              <Search className="h-3.5 w-3.5 mr-1.5" /> Aplicar Filtros
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetFilters}
              className="h-8 text-xs"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total de Decisões
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {filteredRows.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Aprovados
              </p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {approvedCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Reprovados
              </p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {rejectedCount}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Dados */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold text-foreground">
              Decisões de Aprovação (Aprovados e Reprovados)
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredRows.length} decisão(ões) encontrada(s) • Período de {periodLabel} •{' '}
              {selectedClientName}
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
              Nenhuma aprovação decidida encontrada com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Data da Decisão
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Chamado
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[180px]">Título</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[200px]">Motivo</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Solicitante
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Aprovador
                    </TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">
                      Empresa
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-secondary/10 text-xs">
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.decisionDate || '—'}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-primary whitespace-nowrap">
                        {r.ticketNumber}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={r.ticketTitle}>
                        {r.ticketTitle || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statusBadgeClass(r.status)}`}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-sm truncate text-muted-foreground"
                        title={r.reason}
                      >
                        {r.reason || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.requesterName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.approverName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.companyName}
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
                Aprovados:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{approvedCount}</strong>
              </span>
              <span>•</span>
              <span>
                Reprovados:{' '}
                <strong className="text-rose-600 dark:text-rose-400">{rejectedCount}</strong>
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
