import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Server,
  Download,
  RefreshCw,
  Search,
  Filter,
  Building,
  Layers,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  Boxes,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { useTheme } from '@/hooks/use-theme'
import { useRealtime } from '@/hooks/use-realtime'
import { exportToCsv } from '@/lib/export-utils'
import { exportReportToXlsx, exportReportToPdf, type ExportColumn } from '@/lib/export-reports'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  getAssetReport,
  getReportFilterOptions,
  type AssetReportRow,
  type AssetReportFilters,
  type AuxiliaryFilterOptions,
} from '@/services/itsm-reports'
import { CI_STATUSES, AVAILABILITY_STATUSES, DEVICE_TYPES } from '@/services/equipments'
import { CiStatusBadge } from '@/components/CiStatusBadge'
import { AvailabilityStatusBadge } from '@/components/AvailabilityStatusBadge'

const ITEMS_PER_PAGE = 25

export default function AssetsReportPage() {
  const { toast } = useToast()
  const { designSettings } = useTheme()

  const [filterParams, setFilterParams] = useState<AssetReportFilters>({
    companyId: 'all',
    branchId: 'all',
    sectorId: 'all',
    status: 'all',
    availability_status: 'all',
    device_type: 'all',
    search: '',
  })

  const [filterOptions, setFilterOptions] = useState<AuxiliaryFilterOptions>({
    companies: [],
    branches: [],
    sectors: [],
    operators: [],
    activities: [],
    statuses: [],
  })

  const [rows, setRows] = useState<AssetReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Carrega opções de filiais, setores e empresas
  useEffect(() => {
    getReportFilterOptions()
      .then(setFilterOptions)
      .catch((err) => console.error('Erro ao carregar opções de filtro:', err))
  }, [])

  // Carrega ativos
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAssetReport(filterParams)
      setRows(data.rows)
      setCurrentPage(1)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      toast({
        title: 'Erro ao carregar relatório de ativos',
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

  useRealtime('equipments', () => loadData())

  // Filiais filtradas pela empresa selecionada
  const availableBranches = useMemo(() => {
    if (!filterParams.companyId || filterParams.companyId === 'all') {
      return filterOptions.branches
    }
    return filterOptions.branches.filter((b) => b.companyId === filterParams.companyId)
  }, [filterOptions.branches, filterParams.companyId])

  // Setores filtrados pela empresa selecionada
  const availableSectors = useMemo(() => {
    if (!filterParams.companyId || filterParams.companyId === 'all') {
      return filterOptions.sectors
    }
    return filterOptions.sectors.filter((s) => s.companyId === filterParams.companyId)
  }, [filterOptions.sectors, filterParams.companyId])

  const handleResetFilters = () => {
    setFilterParams({
      companyId: 'all',
      branchId: 'all',
      sectorId: 'all',
      status: 'all',
      availability_status: 'all',
      device_type: 'all',
      search: '',
    })
    setSearch('')
  }

  // Filtragem local rápida por texto
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const term = search.toLowerCase()
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.hostname.toLowerCase().includes(term) ||
        r.serial_number.toLowerCase().includes(term) ||
        r.patrimony_number.toLowerCase().includes(term) ||
        r.manufacturer.toLowerCase().includes(term) ||
        r.model.toLowerCase().includes(term) ||
        r.owner.toLowerCase().includes(term) ||
        r.responsible_user.toLowerCase().includes(term) ||
        r.companyName.toLowerCase().includes(term) ||
        r.branchName.toLowerCase().includes(term) ||
        r.sectorName.toLowerCase().includes(term) ||
        r.ip_address.toLowerCase().includes(term),
    )
  }, [rows, search])

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

  // Colunas completas de cadastro dos ativos (para XLSX e PDF)
  const reportColumns: ExportColumn<AssetReportRow>[] = useMemo(
    () => [
      { header: 'Nome do Ativo', accessor: (r) => r.name, align: 'left', width: '110px' },
      { header: 'Hostname', accessor: (r) => r.hostname, align: 'left', width: '85px' },
      { header: 'Tipo Disp.', accessor: (r) => r.device_type, align: 'left', width: '75px' },
      { header: 'Marca', accessor: (r) => r.manufacturer, align: 'left', width: '80px' },
      { header: 'Modelo', accessor: (r) => r.model, align: 'left', width: '85px' },
      { header: 'Nº Série', accessor: (r) => r.serial_number, align: 'left', width: '85px' },
      { header: 'Patrimônio', accessor: (r) => r.patrimony_number, align: 'left', width: '75px' },
      { header: 'IP', accessor: (r) => r.ip_address, align: 'left', width: '75px' },
      {
        header: 'Sistema Operacional',
        accessor: (r) => r.operating_system,
        align: 'left',
        width: '90px',
      },
      { header: 'Processador', accessor: (r) => r.processor, align: 'left', width: '85px' },
      { header: 'RAM', accessor: (r) => r.ram_total, align: 'left', width: '60px' },
      { header: 'Armazenamento', accessor: (r) => r.storageDisplay, align: 'left', width: '85px' },
      {
        header: 'Cliente (Empresa)',
        accessor: (r) => r.companyName,
        align: 'left',
        width: '100px',
      },
      { header: 'Filial', accessor: (r) => r.branchName, align: 'left', width: '80px' },
      { header: 'Setor', accessor: (r) => r.sectorName, align: 'left', width: '80px' },
      { header: 'Localização', accessor: (r) => r.location, align: 'left', width: '80px' },
      { header: 'Dono', accessor: (r) => r.owner, align: 'left', width: '85px' },
      { header: 'Responsável', accessor: (r) => r.responsible_user, align: 'left', width: '85px' },
      { header: 'Status Operacional', accessor: (r) => r.status, align: 'center', width: '75px' },
      {
        header: 'Status de Disponibilidade',
        accessor: (r) => r.availability_status,
        align: 'center',
        width: '95px',
      },
      { header: 'Fornecedor', accessor: (r) => r.supplier, align: 'left', width: '85px' },
      {
        header: 'Data de Compra',
        accessor: (r) =>
          r.acquisition_date ? new Date(r.acquisition_date).toLocaleDateString('pt-BR') : '—',
        align: 'center',
        width: '75px',
      },
      {
        header: 'Garantia até',
        accessor: (r) =>
          r.warranty_until ? new Date(r.warranty_until).toLocaleDateString('pt-BR') : '—',
        align: 'center',
        width: '75px',
      },
      {
        header: 'Observações / Notas',
        accessor: (r) => r.notes.replace(/\n/g, ' ') || '—',
        align: 'left',
        width: '140px',
      },
    ],
    [],
  )

  // Exportar para CSV
  const handleExportCsv = () => {
    if (filteredRows.length === 0) return

    const exportData = filteredRows.map((r) => ({
      'Nome do Ativo': r.name,
      Hostname: r.hostname,
      'Tipo de Dispositivo': r.device_type,
      Marca: r.manufacturer,
      Modelo: r.model,
      'Número de Série': r.serial_number,
      Patrimônio: r.patrimony_number,
      'Endereço IP': r.ip_address,
      'Sistema Operacional': r.operating_system,
      Processador: r.processor,
      'Núcleos do Processador': r.processor_cores,
      'Memória RAM': r.ram_total,
      Armazenamento: r.storageDisplay,
      'Cliente (Empresa)': r.companyName,
      Filial: r.branchName,
      Setor: r.sectorName,
      Localização: r.location,
      Dono: r.owner,
      'Usuário Responsável': r.responsible_user,
      'Status Operacional': r.status,
      'Status de Disponibilidade': r.availability_status,
      Fornecedor: r.supplier,
      'Data de Compra': r.acquisition_date
        ? new Date(r.acquisition_date).toLocaleDateString('pt-BR')
        : '—',
      'Garantia até': r.warranty_until
        ? new Date(r.warranty_until).toLocaleDateString('pt-BR')
        : '—',
      'Observações / Notas': r.notes.replace(/\n/g, ' '),
    }))

    const headers = [
      'Nome do Ativo',
      'Hostname',
      'Tipo de Dispositivo',
      'Marca',
      'Modelo',
      'Número de Série',
      'Patrimônio',
      'Endereço IP',
      'Sistema Operacional',
      'Processador',
      'Núcleos do Processador',
      'Memória RAM',
      'Armazenamento',
      'Cliente (Empresa)',
      'Filial',
      'Setor',
      'Localização',
      'Dono',
      'Usuário Responsável',
      'Status Operacional',
      'Status de Disponibilidade',
      'Fornecedor',
      'Data de Compra',
      'Garantia até',
      'Observações / Notas',
    ]

    exportToCsv(
      `relatorio_ativos_${new Date().toISOString().slice(0, 10)}.csv`,
      exportData,
      headers,
    )
  }

  // Exportar para XLSX
  const handleExportXlsx = () => {
    if (filteredRows.length === 0) return

    exportReportToXlsx({
      filename: `relatorio_ativos_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: 'Relatório Detalhado de Ativos',
      clientName: selectedClientName,
      columns: reportColumns,
      rows: filteredRows,
      totalSummary: {
        label: 'Total de Ativos Cadastrados:',
        value: `${filteredRows.length} item(ns)`,
      },
    })
  }

  // Exportar para PDF
  const handleExportPdf = () => {
    if (filteredRows.length === 0) return

    exportReportToPdf({
      filename: `relatorio_ativos_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: 'Relatório Detalhado de Ativos',
      clientName: selectedClientName,
      logoUrl: designSettings?.report_logo_url || designSettings?.logo_url,
      columns: reportColumns,
      rows: filteredRows,
      totalSummary: {
        label: 'Total de Ativos Cadastrados:',
        value: `${filteredRows.length} item(ns)`,
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
                <Server className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Relatório de Ativos
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Inventário completo com todos os campos cadastrais de CMDB: identificação, hardware,
              responsável, filial, setor, datas e o novo Status de Disponibilidade.
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
            title="Exportar dados filtrados em planilha XLSX com tema oficial"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> XLSX
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            disabled={loading || filteredRows.length === 0}
            className="h-8 text-xs hover:border-primary/40"
            title="Exportar relatório em PDF com cabeçalho oficial e paginação"
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

      {/* Barra de Filtros: Empresa, Filial, Setor, Status, Disponibilidade e Tipo */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
              <Filter className="h-4 w-4 text-primary" />
              <span>Filtros do Relatório de Ativos</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleResetFilters}
            >
              Limpar Filtros
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end">
            {/* 1. Empresa / Cliente */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Building className="h-3 w-3 text-primary" /> Empresa (Cliente) *
              </Label>
              <Select
                value={filterParams.companyId || 'all'}
                onValueChange={(val) =>
                  setFilterParams((prev) => ({
                    ...prev,
                    companyId: val,
                    branchId: 'all',
                    sectorId: 'all',
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todas as Empresas
                  </SelectItem>
                  {filterOptions.companies.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Filial */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary" /> Filial
              </Label>
              <Select
                value={filterParams.branchId || 'all'}
                onValueChange={(val) => setFilterParams((prev) => ({ ...prev, branchId: val }))}
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Todas as filiais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todas as Filiais
                  </SelectItem>
                  {availableBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Setor */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary" /> Setor
              </Label>
              <Select
                value={filterParams.sectorId || 'all'}
                onValueChange={(val) => setFilterParams((prev) => ({ ...prev, sectorId: val }))}
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos os Setores
                  </SelectItem>
                  {availableSectors.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Status de Disponibilidade (novo campo) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary" /> Disponibilidade
              </Label>
              <Select
                value={filterParams.availability_status || 'all'}
                onValueChange={(val) =>
                  setFilterParams((prev) => ({ ...prev, availability_status: val }))
                }
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todas Disponib.
                  </SelectItem>
                  {AVAILABILITY_STATUSES.map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Status Operacional */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Status Operacional
              </Label>
              <Select
                value={filterParams.status || 'all'}
                onValueChange={(val) => setFilterParams((prev) => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Todos status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos Status
                  </SelectItem>
                  {CI_STATUSES.map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 6. Tipo de Dispositivo */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Tipo Dispositivo
              </Label>
              <Select
                value={filterParams.device_type || 'all'}
                onValueChange={(val) => setFilterParams((prev) => ({ ...prev, device_type: val }))}
              >
                <SelectTrigger className="h-8 text-xs w-full bg-background">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos Tipos
                  </SelectItem>
                  {DEVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total de Ativos
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-1 tabular-nums">
                {filteredRows.length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Em uso
              </p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {filteredRows.filter((r) => r.availability_status === 'Em uso').length}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Disponível / Estoque
              </p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {
                  filteredRows.filter(
                    (r) =>
                      r.availability_status === 'Disponível' ||
                      r.availability_status === 'Em Estoque',
                  ).length
                }
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="itsm-card border-border/80 bg-card/90">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Obsoleto / Descartado
              </p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {
                  filteredRows.filter(
                    (r) =>
                      r.availability_status === 'Obsoleto' ||
                      r.availability_status === 'Descartado',
                  ).length
                }
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Ativos com busca rápida */}
      <Card className="itsm-card border-border/80 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/80 bg-secondary/15 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Detalhamento de Ativos Cadastrados
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {filteredRows.length} ativos
            </Badge>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar em todas as colunas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum ativo encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/80 bg-muted/40">
                    <TableHead className="text-xs font-semibold">Ativo</TableHead>
                    <TableHead className="text-xs font-semibold">Hostname</TableHead>
                    <TableHead className="text-xs font-semibold">Tipo</TableHead>
                    <TableHead className="text-xs font-semibold">Marca / Modelo</TableHead>
                    <TableHead className="text-xs font-semibold">Nº Série</TableHead>
                    <TableHead className="text-xs font-semibold">Patrimônio</TableHead>
                    <TableHead className="text-xs font-semibold">Empresa / Cliente</TableHead>
                    <TableHead className="text-xs font-semibold">Filial</TableHead>
                    <TableHead className="text-xs font-semibold">Setor</TableHead>
                    <TableHead className="text-xs font-semibold">Dono / Responsável</TableHead>
                    <TableHead className="text-xs font-semibold text-center">
                      Status Oper.
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-center">
                      Disponibilidade
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Garantia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium text-foreground">
                        {r.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.hostname}
                      </TableCell>
                      <TableCell className="text-xs">{r.device_type}</TableCell>
                      <TableCell className="text-xs">
                        {r.manufacturer !== '—' || r.model !== '—'
                          ? `${r.manufacturer} ${r.model}`.trim()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.serial_number}</TableCell>
                      <TableCell className="text-xs font-mono">{r.patrimony_number}</TableCell>
                      <TableCell className="text-xs font-medium">{r.companyName}</TableCell>
                      <TableCell className="text-xs">{r.branchName}</TableCell>
                      <TableCell className="text-xs">{r.sectorName}</TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const resp = r.responsible_user !== '—' ? r.responsible_user : r.owner
                          if (!resp || resp === '—') return '—'
                          // Se responsible_user já vier com o departamento formatado de itsm-reports, usa direto
                          if (resp.includes(' — ')) return resp
                          return r.sectorName && r.sectorName !== '—'
                            ? `${resp} — ${r.sectorName}`
                            : resp
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <CiStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <AvailabilityStatusBadge status={r.availability_status} />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.warranty_until
                          ? new Date(r.warranty_until).toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Paginação */}
          {filteredRows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground flex-wrap gap-2">
              <span>
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} de{' '}
                {filteredRows.length} ativos
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
