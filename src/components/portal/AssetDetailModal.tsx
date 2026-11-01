import React, { useState, useEffect } from 'react'
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
  Wrench,
  MessageSquare,
  UserCheck,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
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
import { getAssetMaintenanceHistory, AssetMaintenanceItem } from '@/services/client-portal'

interface AssetDetailModalProps {
  asset: ConfigurationItemRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId?: string
  onOpenTicketWithAsset?: (asset: ConfigurationItemRecord) => void
  onViewTicketDetail?: (ticketId: string) => void
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

function getTicketStatusBadge(status?: string) {
  const s = status || 'Novo'
  if (['Resolvido', 'Encerrado'].includes(s)) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold"
      >
        {s}
      </Badge>
    )
  }
  if (['Em Atendimento', 'Atribuído', 'Em Triagem'].includes(s)) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold"
      >
        {s}
      </Badge>
    )
  }
  if (['Aguardando Cliente', 'Aguardando Aprovação', 'Aguardando Terceiro'].includes(s)) {
    return (
      <Badge
        variant="outline"
        className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-semibold"
      >
        {s}
      </Badge>
    )
  }
  if (['Cancelado'].includes(s)) {
    return (
      <Badge
        variant="outline"
        className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 text-[10px] font-semibold"
      >
        {s}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold"
    >
      {s}
    </Badge>
  )
}

export default function AssetDetailModal({
  asset,
  open,
  onOpenChange,
  companyId,
  onOpenTicketWithAsset,
  onViewTicketDetail,
}: AssetDetailModalProps) {
  const [history, setHistory] = useState<AssetMaintenanceItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({})

  const effectiveCompanyId = companyId || asset?.company

  // Carrega o histórico de manutenção sempre que o modal abre ou o ativo/empresa mudar
  useEffect(() => {
    if (!open || !asset?.id) {
      setHistory([])
      setHistoryError(null)
      return
    }

    let isMounted = true
    setLoadingHistory(true)
    setHistoryError(null)

    getAssetMaintenanceHistory(asset.id, effectiveCompanyId)
      .then((items) => {
        if (isMounted) {
          setHistory(items)
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar histórico de manutenção:', err)
        if (isMounted) {
          setHistoryError('Não foi possível carregar o histórico de atendimentos.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingHistory(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open, asset?.id, effectiveCompanyId])

  if (!asset) return null

  const companyName =
    asset.expand?.company?.trade_name || asset.expand?.company?.legal_name || 'Empresa Vinculada'
  const unitName = asset.expand?.unit?.name || 'Sede / Não informada'

  const toggleExpand = (id: string) => {
    setExpandedTickets((prev) => ({ ...prev, [id]: !prev[id] }))
  }

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

          {/* Bloco 4: Histórico de Manutenção do Ativo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                Histórico de Manutenção ({history.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Ordenado do mais recente para o mais antigo
              </span>
            </div>

            {loadingHistory ? (
              <div className="p-6 rounded-xl border border-border/50 bg-muted/20 text-center space-y-2">
                <Clock className="h-5 w-5 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs font-medium text-foreground">
                  Consultando histórico de atendimentos...
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Buscando chamados e intervenções vinculadas a este equipamento.
                </p>
              </div>
            ) : historyError ? (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {historyError}
                </div>
                <p className="text-[11px]">
                  Tente fechar e abrir a ficha novamente ou contate o suporte.
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                <div className="p-2.5 bg-amber-500/10 rounded-full w-fit mx-auto border border-amber-500/20">
                  <Wrench className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Nenhuma manutenção registrada para este ativo
                </p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  Este equipamento ainda não possui histórico de ordens de serviço ou chamados
                  vinculados.
                </p>
                {onOpenTicketWithAsset && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false)
                      onOpenTicketWithAsset(asset)
                    }}
                    className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 mt-1 h-7 px-2.5"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Abrir Primeiro Chamado
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((item) => {
                  const isExpanded = !!expandedTickets[item.id]
                  const hasMoreDetails =
                    Boolean(item.solution) ||
                    (Boolean(item.description) && Boolean(item.lastPublicInteraction))

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs hover:border-amber-500/40 transition-colors space-y-2 text-xs"
                    >
                      {/* Cabeçalho do item de histórico: Chamado, Data, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                              {item.number}
                            </span>
                            {item.type && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.type}
                              </Badge>
                            )}
                            {item.categoryName && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border-border text-muted-foreground"
                              >
                                {item.categoryName}
                              </Badge>
                            )}
                          </div>
                          <h5 className="font-semibold text-foreground text-xs leading-snug line-clamp-1">
                            {item.title}
                          </h5>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {getTicketStatusBadge(item.status)}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDateTime(item.created)}
                          </span>
                        </div>
                      </div>

                      {/* Resumo do Atendimento: Última interação pública OU Solução OU Descrição */}
                      <div className="bg-muted/40 rounded-lg p-2.5 border border-border/40 text-[11px] space-y-1.5">
                        {item.solution ? (
                          <div>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                              <CheckCircle className="h-3 w-3" /> Solução Aplicada:
                            </span>
                            <p className="text-foreground/90 mt-0.5 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                              {item.solution}
                            </p>
                          </div>
                        ) : item.lastPublicInteraction ? (
                          <div>
                            <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                              <MessageSquare className="h-3 w-3" /> Última Interação / Andamento:
                            </span>
                            <p className="text-foreground/90 mt-0.5 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                              {item.lastPublicInteraction}
                            </p>
                            {item.lastInteractionDate && (
                              <span className="text-[10px] text-muted-foreground block mt-1">
                                Registrado em {formatDateTime(item.lastInteractionDate)}
                              </span>
                            )}
                          </div>
                        ) : item.description ? (
                          <div>
                            <span className="font-semibold text-muted-foreground flex items-center gap-1 text-[10px] uppercase tracking-wider">
                              <FileText className="h-3 w-3 text-amber-500" /> Descrição da Abertura:
                            </span>
                            <p className="text-foreground/90 mt-0.5 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic text-[11px]">
                            Nenhum resumo descritivo registrado até o momento.
                          </p>
                        )}

                        {/* Conteúdo expandido opcional se tiver mais detalhes (ex: descrição e solução) */}
                        {isExpanded && (
                          <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
                            {item.description && (item.solution || item.lastPublicInteraction) && (
                              <div>
                                <span className="font-semibold text-muted-foreground block text-[10px] uppercase">
                                  Problema Relatado:
                                </span>
                                <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed mt-0.5">
                                  {item.description}
                                </p>
                              </div>
                            )}

                            {item.lastPublicInteraction && item.solution && (
                              <div>
                                <span className="font-semibold text-muted-foreground block text-[10px] uppercase">
                                  Última Interação com o Cliente:
                                </span>
                                <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed mt-0.5">
                                  {item.lastPublicInteraction}
                                </p>
                              </div>
                            )}

                            {item.resolution_date && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                Resolvido em: {formatDateTime(item.resolution_date)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Rodapé do card de histórico: Responsável + Ver Detalhes / Expandir */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1 text-xs truncate max-w-[200px]">
                          <UserCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {item.assignedToName
                              ? `Atendido por ${item.assignedToName}`
                              : 'Fila de Atendimento'}
                          </span>
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {hasMoreDetails && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm"
                            >
                              {isExpanded ? (
                                <>
                                  Menos detalhes <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  Mais detalhes <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          )}

                          {onViewTicketDetail && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                onOpenChange(false)
                                onViewTicketDetail(item.id)
                              }}
                              className="h-6 px-1.5 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-700 gap-1"
                              title="Abrir detalhes completos deste chamado"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver Chamado
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bloco 5: Rastreabilidade e Datas */}
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
