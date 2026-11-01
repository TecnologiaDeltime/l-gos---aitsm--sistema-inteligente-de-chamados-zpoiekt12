import React, { useState } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfigurationItemRecord } from '@/services/configuration-items'

interface PortalAssetsTabProps {
  assets: ConfigurationItemRecord[]
  loading: boolean
}

export default function PortalAssetsTab({ assets, loading }: PortalAssetsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('todos')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')

  const assetTypes = Array.from(new Set(assets.map((a) => a.type).filter(Boolean)))

  const filteredAssets = assets.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = selectedType === 'todos' || item.type === selectedType
    const matchesStatus = selectedStatus === 'todos' || item.status === selectedStatus

    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className="space-y-4">
      {/* Header com filtros de busca */}
      <div className="bg-card border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Server className="h-5 w-5 text-amber-500" />
              Ativos e Itens de Configuração (CMDB)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inventário de infraestrutura de TI, equipamentos e itens cadastrados para a sua
              empresa.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-600 dark:text-amber-400 self-start sm:self-auto"
          >
            Total: {assets.length} ativos
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, serial, modelo ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Tipo de Ativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos ({assets.length})</SelectItem>
              {assetTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
              <SelectItem value="Reserva">Reserva</SelectItem>
              <SelectItem value="Descartado">Descartado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl">
          Carregando ativos e itens do CMDB...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl space-y-2">
          <Server className="h-8 w-8 text-muted-foreground mx-auto opacity-60" />
          <p className="font-semibold text-sm text-foreground">Nenhum ativo localizado</p>
          <p className="text-muted-foreground">
            Nenhum equipamento corresponde aos filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const isOnline = asset.status === 'Ativo'
            const isMaintenance = asset.status === 'Em Manutenção'

            return (
              <Card
                key={asset.id}
                className="bg-card border hover:border-amber-500/40 transition-colors shadow-2xs flex flex-col justify-between"
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
                          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]'
                          : isMaintenance
                            ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]'
                            : 'bg-muted text-muted-foreground text-[10px]'
                      }
                    >
                      {asset.status || 'Ativo'}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold text-foreground line-clamp-1 pt-1">
                    {asset.name}
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    {[asset.brand, asset.model].filter(Boolean).join(' • ') ||
                      'Marca/Modelo não informados'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-2 text-xs">
                  <div className="space-y-1 pt-1 border-t border-border/50 text-[11px]">
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
                          <MapPin className="h-3 w-3 text-amber-500" /> Local:
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[160px]">
                          {asset.location}
                        </span>
                      </div>
                    )}
                    {asset.expand?.unit?.name && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Unidade/Filial:</span>
                        <span className="font-medium text-foreground truncate max-w-[160px]">
                          {asset.expand.unit.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {asset.observations && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 italic pt-1 border-t border-border/40">
                      "{asset.observations}"
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
