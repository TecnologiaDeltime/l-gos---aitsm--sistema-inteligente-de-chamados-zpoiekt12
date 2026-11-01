import React from 'react'
import {
  Server,
  Monitor,
  Printer,
  Wifi,
  Network,
  HardDrive,
  ShieldAlert,
  Zap,
  PhoneCall,
  Scan,
  Projector,
  Radio,
  Sliders,
  Box,
  FileText,
  Calendar,
  Building2,
  GitBranch,
  MapPin,
  Hash,
  Info,
  Clock,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Plus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ConfigurationItemRecord } from '@/services/configuration-items'
import { formatDateTime } from '@/lib/date-format'

interface AssetDetailModalProps {
  asset: ConfigurationItemRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenTicketWithAsset?: (asset: ConfigurationItemRecord) => void
}

function getAssetIcon(type?: string) {
  switch (type) {
    case 'Servidor':
      return <Server className="h-5 w-5 text-amber-500" />
    case 'Impressora':
      return <Printer className="h-5 w-5 text-amber-500" />
    case 'Roteador':
    case 'Switch':
      return <Network className="h-5 w-5 text-amber-500" />
    case 'Access Point':
      return <Wifi className="h-5 w-5 text-amber-500" />
    case 'Storage/NAS':
      return <HardDrive className="h-5 w-5 text-amber-500" />
    case 'Firewall':
      return <ShieldAlert className="h-5 w-5 text-amber-500" />
    case 'No-Break':
    case 'Estabilizador':
      return <Zap className="h-5 w-5 text-amber-500" />
    case 'Telefone IP':
      return <PhoneCall className="h-5 w-5 text-amber-500" />
    case 'Scanner':
      return <Scan className="h-5 w-5 text-amber-500" />
    case 'Projetor':
      return <Projector className="h-5 w-5 text-amber-500" />
    case 'Monitor':
      return <Monitor className="h-5 w-5 text-amber-500" />
    case 'Câmera IP':
      return <Radio className="h-5 w-5 text-amber-500" />
    case 'Controladora':
    case 'Rack':
      return <Sliders className="h-5 w-5 text-amber-500" />
    default:
      return <Box className="h-5 w-5 text-amber-500" />
  }
}

function getStatusBadge(status?: string) {
  switch (status) {
    case 'Ativo':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs font-semibold"
        >
          <CheckCircle2 className="h-3 w-3" />
          Ativo
        </Badge>
      )
    case 'Em Manutenção':
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs font-semibold"
        >
          <AlertTriangle className="h-3 w-3" />
          Em Manutenção
        </Badge>
      )
    case 'Reserva':
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 text-xs font-semibold"
        >
          <Clock className="h-3 w-3" />
          Reserva
        </Badge>
      )
    case 'Inativo':
      return (
        <Badge
          variant="outline"
          className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 gap-1 text-xs font-semibold"
        >
          <XCircle className="h-3 w-3" />
          Inativo
        </Badge>
      )
    case 'Descartado':
      return (
        <Badge
          variant="outline"
          className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 text-xs font-semibold"
        >
          <XCircle className="h-3 w-3" />
          Descartado
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <HelpCircle className="h-3 w-3" />
          {status || 'Não Informado'}
        </Badge>
      )
  }
}

export default function AssetDetailModal({
  asset,
  open,
  onOpenChange,
  onOpenTicketWithAsset,
}: AssetDetailModalProps) {
  if (!asset) return null

  const companyName =
    asset.expand?.company?.trade_name || asset.expand?.company?.legal_name || 'Empresa Vinculada'
  const unitName = asset.expand?.unit?.name || 'Sede / Não informada'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 pb-2 border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex-shrink-0">
                {getAssetIcon(asset.type)}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                  {asset.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {[asset.brand, asset.model].filter(Boolean).join(' • ') ||
                    'Equipamento de infraestrutura'}
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {getStatusBadge(asset.status)}
              <Badge variant="secondary" className="text-[11px] font-medium">
                {asset.type || 'Equipamento'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Bloco 1: Identificação e Dados Técnicos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-amber-500" />
              Especificações Técnicas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-xl border border-border/50 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Tipo do IC:</span>
                <span className="font-semibold text-foreground">{asset.type || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Número de Série:</span>
                <span className="font-mono font-medium text-foreground select-all">
                  {asset.serial_number || 'Não informado'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Marca / Fabricante:</span>
                <span className="font-medium text-foreground">{asset.brand || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Modelo:</span>
                <span className="font-medium text-foreground">{asset.model || '—'}</span>
              </div>
            </div>
          </div>

          {/* Bloco 2: Localização e Estrutura Organizacional */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-amber-500" />
              Localização e Unidade
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/30 p-3 rounded-xl border border-border/50 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Empresa:</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  {companyName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Unidade / Filial:</span>
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  {unitName}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block text-[11px]">
                  Localização Física / Sala / Andar:
                </span>
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-500" />
                  {asset.location || 'Localização não informada no cadastro'}
                </span>
              </div>
            </div>
          </div>

          {/* Bloco 3: Observações de Configuração */}
          {asset.observations && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-amber-500" />
                Notas &amp; Observações
              </h4>
              <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {asset.observations}
              </div>
            </div>
          )}

          {/* Bloco 4: Rastreabilidade e Datas */}
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Cadastrado em:{' '}
              <strong className="text-foreground">{formatDateTime(asset.created)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Última atualização:{' '}
              <strong className="text-foreground">{formatDateTime(asset.updated)}</strong>
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          {onOpenTicketWithAsset && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onOpenTicketWithAsset(asset)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Abrir Chamado para este Ativo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
