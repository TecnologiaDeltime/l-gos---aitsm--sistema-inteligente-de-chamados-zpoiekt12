import React, { useState, useMemo } from 'react'
import {
  Server,
  Search,
  Filter,
  Layers,
  MapPin,
  Cpu,
  Tag,
  CheckCircle,
  AlertTriangle,
  FileText,
  Boxes,
  Eye,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  X,
  HardDrive,
  RefreshCw,
  Building2,
  Calendar,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigurationItemRecord } from '@/services/configuration-items'
import AssetDetailModal from '@/components/portal/AssetDetailModal'

interface PortalAssetsTabProps {
  assets: ConfigurationItemRecord[]
  loading: boolean
  onOpenTicketWithAsset?: (asset: ConfigurationItemRecord) => void
}

export default function PortalAssetsTab({
  assets,
  loading,
  onOpenTicketWithAsset,
}: PortalAssetsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('todos')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')
  const [selectedLocation, setSelectedLocation] = useState<string>('todos')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedAsset, setSelectedAsset] = useState<ConfigurationItemRecord | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // Tipos únicos presentes na lista de ativos da empresa
  const assetTypes = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.type).filter(Boolean))).sort()
  }, [assets])

  // Status únicos presentes
  const assetStatuses = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.status).filter(Boolean))).sort()
  }, [assets])

  // Localizações únicas presentes
  const assetLocations = useMemo(() => {
    return Array.from(
      new Set(assets.map((a) => a.location?.trim()).filter(Boolean) as string[]),
    ).sort()
  }, [assets])

  // Métricas de resumo no topo
  const metrics = useMemo(() => {
    const total = assets.length
    const ativos = assets.filter((a) => a.status === 'Ativo').length
    const manutencao = assets.filter((a) => a.status === 'Em Manutenção').length
    const reserva = assets.filter((a) => a.status === 'Reserva').length
    const outros = total - (ativos + manutencao + reserva)

    return {
      total,
      ativos,
      manutencao,
      reserva,
      outros,
    }
  }, [assets])

  // Filtragem dos ativos
  const filteredAssets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return assets.filter((item) => {
      const matchesSearch =
        !term ||
        item.name?.toLowerCase().includes(term) ||
        item.serial_number?.toLowerCase().includes(term) ||
        item.brand?.toLowerCase().includes(term) ||
        item.model?.toLowerCase().includes(term) ||
        item.location?.toLowerCase().includes(term) ||
        item.type?.toLowerCase().includes(term) ||
        item.expand?.unit?.name?.toLowerCase().includes(term)

      const matchesType = selectedType === 'todos' || item.type === selectedType
      const matchesStatus = selectedStatus === 'todos' || item.status === selectedStatus
      const matchesLocation =
        selectedLocation === 'todos' || item.location?.trim() === selectedLocation

      return matchesSearch && matchesType && matchesStatus && matchesLocation
    })
  }, [assets, searchTerm, selectedType, selectedStatus, selectedLocation])

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedType !== 'todos' ||
    selectedStatus !== 'todos' ||
    selectedLocation !== 'todos'

  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedType('todos')
    setSelectedStatus('todos')
    setSelectedLocation('todos')
  }

  const handleOpenDetail = (asset: ConfigurationItemRecord) => {
    setSelectedAsset(asset)
    setDetailModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* =========================================================================
          RESUMO NO TOPO: Total de ativos e contadores por status
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Geral */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedStatus('todos')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedStatus('todos')
            }
          }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'todos'
              ? 'border-amber-500 bg-amber-500/10 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Total de Ativos</span>
            <Server className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground">{metrics.total}</span>
            <span className="text-[11px] text-muted-foreground">cadastrados</span>
          </div>
        </div>

        {/* Ativos em Operação */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedStatus('Ativo')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedStatus('Ativo')
            }
          }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Ativo'
              ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Em Operação</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.ativos}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {metrics.total > 0 ? `${Math.round((metrics.ativos / metrics.total) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Em Manutenção */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedStatus('Em Manutenção')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedStatus('Em Manutenção')
            }
          }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Em Manutenção'
              ? 'border-amber-500 bg-amber-500/15 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Em Manutenção</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.manutencao}
            </span>
            <span className="text-[11px] text-muted-foreground">em reparo</span>
          </div>
        </div>

        {/* Reserva / Outros */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedStatus(metrics.reserva > 0 ? 'Reserva' : 'todos')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedStatus(metrics.reserva > 0 ? 'Reserva' : 'todos')
            }
          }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            selectedStatus === 'Reserva'
              ? 'border-purple-500 bg-purple-500/10 shadow-xs'
              : 'bg-card hover:bg-muted/40 border-border'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
            <span className="font-medium">Reserva / Sobressalente</span>
            <Boxes className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground">{metrics.reserva}</span>
            <span className="text-[11px] text-muted-foreground">disponíveis</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BARRA DE FERRAMENTAS: Busca por texto + Filtros + Alternador Cards/Tabela
          ========================================================================= */}
      <div className="bg-card border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Server className="h-5 w-5 text-amber-500" />
              Inventário de Infraestrutura e Equipamentos de TI
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Itens de configuração (CMDB), hardware, números de série e locais mapeados para a sua
              organização.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Alternador de visualização: Cards vs Tabela */}
            <div className="flex items-center p-0.5 bg-muted rounded-lg border border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('cards')}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
                  viewMode === 'cards'
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Cards
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('table')}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Visualização em Tabela Detalhada"
              >
                <TableIcon className="h-3.5 w-3.5 mr-1" />
                Tabela
              </Button>
            </div>

            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono text-xs"
            >
              {filteredAssets.length} de {assets.length} ativos
            </Badge>
          </div>
        </div>

        {/* Linha de Filtros */}
        <div className="grid gap-2 sm:grid-cols-12 items-center">
          {/* Busca textual */}
          <div className="relative sm:col-span-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, serial, marca, modelo ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 text-xs h-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                title="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro por Tipo */}
          <div className="sm:col-span-3">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Tipo de Ativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos ({assets.length})</SelectItem>
                {assetTypes.map((t) => {
                  const count = assets.filter((a) => a.type === t).length
                  return (
                    <SelectItem key={t} value={t}>
                      {t} ({count})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Status */}
          <div className="sm:col-span-2">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="Ativo">Ativo ({metrics.ativos})</SelectItem>
                <SelectItem value="Em Manutenção">Em Manutenção ({metrics.manutencao})</SelectItem>
                <SelectItem value="Reserva">Reserva ({metrics.reserva})</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Descartado">Descartado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Localização */}
          <div className="sm:col-span-3">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Localização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Localizações</SelectItem>
                {assetLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Indicador de Filtros Ativos com Botão de Limpar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground">Filtros aplicados:</span>
              {searchTerm && (
                <Badge variant="secondary" className="text-[11px]">
                  Termo: &ldquo;{searchTerm}&rdquo;
                </Badge>
              )}
              {selectedType !== 'todos' && (
                <Badge variant="secondary" className="text-[11px]">
                  Tipo: {selectedType}
                </Badge>
              )}
              {selectedStatus !== 'todos' && (
                <Badge variant="secondary" className="text-[11px]">
                  Status: {selectedStatus}
                </Badge>
              )}
              {selectedLocation !== 'todos' && (
                <Badge variant="secondary" className="text-[11px]">
                  Local: {selectedLocation}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 h-7 px-2"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>

      {/* =========================================================================
          CORPO: Lista de Ativos em CARDS ou TABELA
          ========================================================================= */}
      {loading ? (
        <div className="py-14 text-center text-xs text-muted-foreground bg-card border rounded-xl space-y-2">
          <RefreshCw className="h-6 w-6 text-amber-500 animate-spin mx-auto" />
          <p className="font-medium text-foreground">Carregando inventário de TI...</p>
          <p className="text-muted-foreground text-[11px]">
            Consultando equipamentos e itens de configuração cadastrados.
          </p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="py-14 text-center text-xs text-muted-foreground bg-card border rounded-xl space-y-3 p-6">
          <div className="p-3 bg-muted/60 rounded-full w-fit mx-auto border border-border">
            <Server className="h-8 w-8 text-amber-500/80" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground">Nenhum ativo localizado</p>
            <p className="text-muted-foreground text-xs max-w-md mx-auto">
              {hasActiveFilters
                ? 'Nenhum equipamento corresponde aos filtros e termos de busca aplicados. Tente ajustar os parâmetros.'
                : 'Sua empresa ainda não possui itens de configuração de TI cadastrados no inventário.'}
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/40"
            >
              Limpar todos os filtros
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* VISUALIZAÇÃO EM TABELA */
        <div className="bg-card border rounded-xl overflow-hidden shadow-2xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold text-foreground">
                  Equipamento / IC
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground">Tipo</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Nº de Série</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Localização</TableHead>
                <TableHead className="text-xs font-bold text-foreground">
                  Unidade / Filial
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const isOnline = asset.status === 'Ativo'
                const isMaintenance = asset.status === 'Em Manutenção'
                const isReserve = asset.status === 'Reserva'

                return (
                  <TableRow
                    key={asset.id}
                    onClick={() => handleOpenDetail(asset)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors text-xs"
                  >
                    <TableCell className="font-medium">
                      <div className="space-y-0.5">
                        <span className="font-bold text-foreground block">{asset.name}</span>
                        <span className="text-[11px] text-muted-foreground block">
                          {[asset.brand, asset.model].filter(Boolean).join(' • ') || '—'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        {asset.type || 'Equipamento'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isOnline
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold'
                            : isMaintenance
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold'
                              : isReserve
                                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-semibold'
                                : 'bg-muted text-muted-foreground text-[10px]'
                        }
                      >
                        {asset.status || 'Ativo'}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono text-[11px] text-foreground select-all">
                      {asset.serial_number || '—'}
                    </TableCell>

                    <TableCell className="text-muted-foreground text-xs">
                      {asset.location ? (
                        <span className="flex items-center gap-1 text-foreground">
                          <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="truncate max-w-[180px]">{asset.location}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground text-xs">
                      {asset.expand?.unit?.name || 'Sede'}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetail(asset)
                        }}
                        className="text-xs text-amber-600 dark:text-amber-400 gap-1 h-7 px-2"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* VISUALIZAÇÃO EM CARDS */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const isOnline = asset.status === 'Ativo'
            const isMaintenance = asset.status === 'Em Manutenção'
            const isReserve = asset.status === 'Reserva'

            return (
              <Card
                key={asset.id}
                onClick={() => handleOpenDetail(asset)}
                className="bg-card border hover:border-amber-500/50 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <CardHeader className="p-4 pb-2 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-medium truncate max-w-[140px]"
                    >
                      {asset.type || 'Equipamento'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        isOnline
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold'
                          : isMaintenance
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold'
                            : isReserve
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-semibold'
                              : 'bg-muted text-muted-foreground text-[10px]'
                      }
                    >
                      {asset.status || 'Ativo'}
                    </Badge>
                  </div>

                  <CardTitle className="text-sm font-bold text-foreground line-clamp-1 pt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {asset.name}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground truncate">
                    {[asset.brand, asset.model].filter(Boolean).join(' • ') ||
                      'Marca/Modelo não informados'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-2 text-xs">
                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-[11px]">
                    {asset.serial_number && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Nº de Série:</span>
                        <span className="font-mono font-medium text-foreground select-all">
                          {asset.serial_number}
                        </span>
                      </div>
                    )}

                    {asset.location && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-amber-500 shrink-0" /> Local:
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[160px]">
                          {asset.location}
                        </span>
                      </div>
                    )}

                    {asset.expand?.unit?.name && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" /> Filial:
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[160px]">
                          {asset.expand.unit.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {asset.observations && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 italic pt-1 border-t border-border/40">
                      &ldquo;{asset.observations}&rdquo;
                    </p>
                  )}

                  {/* Rodapé do Card com ação de detalhes */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="text-[10px]">Clique para ver ficha completa</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Detalhes <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL DE DETALHES COMPLETOS DO ATIVO
          ========================================================================= */}
      <AssetDetailModal
        asset={selectedAsset}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onOpenTicketWithAsset={onOpenTicketWithAsset}
      />
    </div>
  )
}
