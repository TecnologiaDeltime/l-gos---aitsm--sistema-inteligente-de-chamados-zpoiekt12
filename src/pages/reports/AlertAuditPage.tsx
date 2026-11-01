import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileSearch,
  Download,
  RefreshCw,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  Hourglass,
  Layers,
  Search,
  Info,
  ShieldAlert,
  VolumeX,
  Volume2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { exportToCsv } from '@/lib/export-utils'
import { formatDate } from '@/lib/sla-report-utils'
import {
  getAlertAuditLogs,
  AlertAuditLogRecord,
  AlertType,
  AlertAuditAction,
} from '@/services/alert-audit'
import { getUsers, UserItem } from '@/services/users'

export default function AlertAuditPage() {
  const { toast } = useToast()

  // Filtros
  const [startDate, setStartDate] = useState(formatDate(new Date(Date.now() - 30 * 86400000)))
  const [endDate, setEndDate] = useState(formatDate(new Date()))
  const [alertType, setAlertType] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [operatorSearch, setOperatorSearch] = useState<string>('')

  // Estado dos dados
  const [logs, setLogs] = useState<AlertAuditLogRecord[]>([])
  const [operators, setOperators] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [auditLogs, allUsers] = await Promise.all([
        getAlertAuditLogs({
          startDate,
          endDate,
          alertType,
          action: actionFilter,
        }),
        getUsers(),
      ])
      setLogs(auditLogs)
      setOperators(allUsers)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar auditoria de alertas',
        description: err.message || 'Falha ao buscar dados',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, alertType, actionFilter, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Atualização em tempo real quando houver novos registros
  useRealtime('alert_audit_logs', () => {
    loadData()
  })

  // Filtro de operador no cliente (busca flexível por nome ou email)
  const filteredLogs = useMemo(() => {
    if (!operatorSearch.trim()) return logs

    const term = operatorSearch.toLowerCase().trim()
    return logs.filter((log) => {
      const op = log.expand?.operator
      const name = op?.name?.toLowerCase() || ''
      const email = op?.email?.toLowerCase() || ''
      return name.includes(term) || email.includes(term)
    })
  }, [logs, operatorSearch])

  // Cards de Resumo
  const stats = useMemo(() => {
    const total = filteredLogs.length
    let staleCount = 0
    let slaResponseCount = 0
    let slaResolutionCount = 0
    let consumptionCount = 0
    let openedCount = 0
    let viewedCount = 0
    let dismissedCount = 0

    filteredLogs.forEach((log) => {
      if (log.alert_type === 'STALE_TICKET') staleCount++
      else if (log.alert_type === 'SLA_RESPONSE') slaResponseCount++
      else if (log.alert_type === 'SLA_RESOLUTION') slaResolutionCount++
      else if (log.alert_type === 'CONSUMPTION') consumptionCount++

      if (log.action === 'OPENED') openedCount++
      else if (log.action === 'VIEWED') viewedCount++
      else if (log.action === 'DISMISSED') dismissedCount++
    })

    const engaged = openedCount + viewedCount
    const engagementRate = total > 0 ? Math.round((engaged / total) * 100) : 0

    return {
      total,
      staleCount,
      slaResponseCount,
      slaResolutionCount,
      consumptionCount,
      openedCount,
      viewedCount,
      dismissedCount,
      engaged,
      engagementRate,
    }
  }, [filteredLogs])

  // Helper para Badge do Tipo de Alerta
  const renderAlertTypeBadge = (type: AlertType) => {
    switch (type) {
      case 'STALE_TICKET':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          >
            <Hourglass className="h-3 w-3 mr-1 text-slate-500" /> Sem Atualização
          </Badge>
        )
      case 'SLA_RESPONSE':
        return (
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          >
            <Clock className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" /> SLA Resposta
          </Badge>
        )
      case 'SLA_RESOLUTION':
        return (
          <Badge
            variant="outline"
            className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
          >
            <AlertTriangle className="h-3 w-3 mr-1 text-purple-600" /> SLA Solução
          </Badge>
        )
      case 'CONSUMPTION':
        return (
          <Badge
            variant="outline"
            className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
          >
            <TrendingUp className="h-3 w-3 mr-1 text-orange-600" /> Consumo de Horas
          </Badge>
        )
      case 'RETAINED_TICKETS':
        return (
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          >
            <ShieldAlert className="h-3 w-3 mr-1 text-amber-600" /> Chamados Retidos
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  // Helper para Badge da Ação
  const renderActionBadge = (action: AlertAuditAction) => {
    switch (action) {
      case 'OPENED':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Aberto
          </Badge>
        )
      case 'VIEWED':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
            <ExternalLink className="h-3 w-3 mr-1" /> Visualizado
          </Badge>
        )
      case 'DISMISSED':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">
            <Clock className="h-3 w-3 mr-1" /> Dispensado
          </Badge>
        )
      case 'MUTE_ALERTS':
        return (
          <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-medium">
            <VolumeX className="h-3 w-3 mr-1" /> Silenciou Notificações
          </Badge>
        )
      case 'UNMUTE_ALERTS':
        return (
          <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-medium">
            <Volume2 className="h-3 w-3 mr-1" /> Reativou Notificações
          </Badge>
        )
      default:
        return <Badge variant="secondary">{action}</Badge>
    }
  }

  // Helper para Resumo dos Metadados
  const renderMetadataSummary = (log: AlertAuditLogRecord) => {
    const meta = log.metadata || {}
    const items: string[] = []

    if (log.action === 'MUTE_ALERTS' || log.action === 'UNMUTE_ALERTS') {
      return (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {meta.message ||
            (log.action === 'MUTE_ALERTS'
              ? 'Silenciou a voz e popups em tela'
              : 'Reativou som, voz e popups')}
        </span>
      )
    }

    if (log.alert_type === 'STALE_TICKET') {
      if (meta.hoursStale != null) items.push(`${meta.hoursStale}h parado`)
      if (meta.companyName) items.push(`Empresa: ${meta.companyName}`)
    } else if (log.alert_type === 'SLA_RESPONSE' || log.alert_type === 'SLA_RESOLUTION') {
      if (meta.remainingMinutes != null) items.push(`${meta.remainingMinutes} min restantes`)
      if (meta.companyName) items.push(`Empresa: ${meta.companyName}`)
    } else if (log.alert_type === 'CONSUMPTION') {
      if (meta.percentage != null) items.push(`${meta.percentage}% consumido`)
      if (meta.level) items.push(meta.level)
      if (meta.contractNumber) items.push(`Contrato: ${meta.contractNumber}`)
    } else if (log.alert_type === 'RETAINED_TICKETS') {
      if (meta.retainedCount != null) items.push(`${meta.retainedCount} retido(s) pendente(s)`)
    }

    if (items.length === 0) {
      if (meta.message)
        return (
          <span className="text-xs text-muted-foreground truncate max-w-xs">{meta.message}</span>
        )
      return <span className="text-muted-foreground">—</span>
    }

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    )
  }

  // Exportação CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return

    const rows = filteredLogs.map((log) => {
      const op = log.expand?.operator
      const tkt = log.expand?.ticket
      const meta = log.metadata || {}

      let detailsStr = ''
      if (log.action === 'MUTE_ALERTS' || log.action === 'UNMUTE_ALERTS') {
        detailsStr =
          log.action === 'MUTE_ALERTS' ? 'Silenciou notificações' : 'Reativou notificações'
      } else if (log.alert_type === 'STALE_TICKET') {
        detailsStr = `${meta.hoursStale || '—'}h sem atualização`
      } else if (log.alert_type === 'SLA_RESPONSE' || log.alert_type === 'SLA_RESOLUTION') {
        detailsStr = `${meta.remainingMinutes || '—'} min restantes`
      } else if (log.alert_type === 'CONSUMPTION') {
        detailsStr = `${meta.percentage || '—'}% - ${meta.level || 'Geral'}`
      } else if (log.alert_type === 'RETAINED_TICKETS') {
        detailsStr = `${meta.retainedCount || '1'} chamado(s) retido(s)`
      }

      return {
        Data: new Date(log.created).toLocaleString('pt-BR'),
        'Tipo de Alerta': log.alert_type,
        Ticket: tkt
          ? `#${tkt.number} - ${tkt.title}`
          : meta.ticketNumber
            ? `#${meta.ticketNumber}`
            : '—',
        Operador: op?.name || op?.email || '—',
        Email: op?.email || '—',
        Ação: log.action,
        Detalhes: detailsStr,
        Mensagem: meta.message || '—',
      }
    })

    const headers = [
      'Data',
      'Tipo de Alerta',
      'Ticket',
      'Operador',
      'Email',
      'Ação',
      'Detalhes',
      'Mensagem',
    ]
    exportToCsv(`auditoria_alertas_${startDate}_a_${endDate}.csv`, rows, headers)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-amber-600 dark:text-amber-400" /> Auditoria de
            Alertas
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe o engajamento dos operadores com alertas de chamados estagnados, SLAs e
            consumo de horas.
          </p>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={loading || filteredLogs.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Filtros de Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Alerta</Label>
              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="STALE_TICKET">Sem Atualização</SelectItem>
                  <SelectItem value="SLA_RESPONSE">SLA Resposta</SelectItem>
                  <SelectItem value="SLA_RESOLUTION">SLA Solução</SelectItem>
                  <SelectItem value="CONSUMPTION">Consumo de Horas</SelectItem>
                  <SelectItem value="RETAINED_TICKETS">Chamados Retidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ação do Operador</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="OPENED">Abertas</SelectItem>
                  <SelectItem value="VIEWED">Visualizadas</SelectItem>
                  <SelectItem value="DISMISSED">Dispensadas</SelectItem>
                  <SelectItem value="MUTE_ALERTS">Silenciou Notificações</SelectItem>
                  <SelectItem value="UNMUTE_ALERTS">Reativou Notificações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Operador (Nome / Email)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar operador..."
                  value={operatorSearch}
                  onChange={(e) => setOperatorSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-600 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total de Interações</p>
              <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">no período selecionado</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Taxa de Engajamento</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">{stats.engagementRate}%</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.engaged} abertas/vistas vs {stats.dismissedCount} dispensadas
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Alertas de SLA</p>
              <h3 className="text-2xl font-bold mt-1 text-purple-600">
                {stats.slaResponseCount + stats.slaResolutionCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.slaResponseCount} resposta / {stats.slaResolutionCount} solução
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Outros Alertas</p>
              <h3 className="text-2xl font-bold mt-1 text-orange-600">
                {stats.staleCount + stats.consumptionCount}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.staleCount} sem atualização / {stats.consumptionCount} consumo
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center text-orange-600">
              <Hourglass className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Auditoria */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Registros de Auditoria</CardTitle>
          <span className="text-xs text-muted-foreground">
            Mostrando {filteredLogs.length} registro(s)
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-base font-medium text-foreground">
                Nenhum registro de auditoria encontrado
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Interações com os popups de alerta (abrir chamado, ver detalhes ou dispensar) serão
                registradas automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-40">Data/Hora</TableHead>
                    <TableHead className="text-xs w-36">Tipo de Alerta</TableHead>
                    <TableHead className="text-xs">Ticket / Referência</TableHead>
                    <TableHead className="text-xs">Operador</TableHead>
                    <TableHead className="text-xs w-28">Ação</TableHead>
                    <TableHead className="text-xs">Detalhes Contextuais</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const op = log.expand?.operator
                    const tkt = log.expand?.ticket

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        {/* Data/Hora */}
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {new Date(log.created).toLocaleString('pt-BR')}
                        </TableCell>

                        {/* Tipo de Alerta */}
                        <TableCell className="text-xs">
                          {renderAlertTypeBadge(log.alert_type)}
                        </TableCell>

                        {/* Ticket / Referência */}
                        <TableCell className="text-xs">
                          {tkt ? (
                            <Link
                              to={`/tickets/${tkt.id}`}
                              className="font-medium text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>#{tkt.number}</span>
                              <span className="text-muted-foreground font-normal truncate max-w-[200px]">
                                - {tkt.title}
                              </span>
                            </Link>
                          ) : log.metadata?.ticketNumber ? (
                            <span className="font-medium">#{log.metadata.ticketNumber}</span>
                          ) : log.metadata?.contractNumber ? (
                            <Link
                              to="/horas-clientes"
                              className="font-medium text-orange-600 dark:text-orange-400 hover:underline"
                            >
                              Contrato {log.metadata.contractNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Operador */}
                        <TableCell className="text-xs font-medium">
                          <div className="flex flex-col">
                            <span className="text-foreground">{op?.name || 'Operador'}</span>
                            <span className="text-[11px] text-muted-foreground font-normal">
                              {op?.email || '—'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="text-xs">{renderActionBadge(log.action)}</TableCell>

                        {/* Detalhes Contextuais */}
                        <TableCell className="text-xs">{renderMetadataSummary(log)}</TableCell>
                      </TableRow>
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
