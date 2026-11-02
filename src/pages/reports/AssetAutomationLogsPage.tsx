import { useEffect, useState, useMemo } from 'react'
import {
  Search,
  RefreshCw,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Server,
  User,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getAssetAutomationLogs,
  AssetAutomationLogRecord,
  AssetAutomationActionType,
} from '@/services/asset-automation-logs'

const ACTION_LABELS: Record<
  AssetAutomationActionType,
  { label: string; color: string; badgeCls: string }
> = {
  exclusao_usuario: {
    label: 'Exclusão de Usuário',
    color: '#D97706',
    badgeCls:
      'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300',
  },
  exclusao_ativo: {
    label: 'Exclusão de Equipamento',
    color: '#DC2626',
    badgeCls: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-300',
  },
  mudanca_status: {
    label: 'Mudança para Disponível',
    color: '#10B981',
    badgeCls:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300',
  },
  cancelamento_exclusao_usuario: {
    label: 'Cancelamento (Usuário)',
    color: '#6B7280',
    badgeCls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
  },
  cancelamento_exclusao_ativo: {
    label: 'Cancelamento (Ativo)',
    color: '#6B7280',
    badgeCls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
  },
}

export default function AssetAutomationLogsPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<AssetAutomationLogRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Detalhe
  const [selectedLog, setSelectedLog] = useState<AssetAutomationLogRecord | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await getAssetAutomationLogs({
        actionType: actionFilter !== 'all' ? actionFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined,
      })
      setLogs(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar auditoria',
        description: err?.message || 'Falha ao buscar logs de automação.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [actionFilter, startDate, endDate])

  useRealtime('asset_automation_logs', () => {
    loadData()
  })

  // Filtro textual local para resposta instantânea
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((log) => {
      const op = (log.operator_name || '').toLowerCase()
      const eq = (log.equipment_name || '').toLowerCase()
      const usr = (log.target_user_name || '').toLowerCase()
      const desc = (log.description || '').toLowerCase()
      return op.includes(q) || eq.includes(q) || usr.includes(q) || desc.includes(q)
    })
  }, [logs, search])

  // Contadores analíticos
  const stats = useMemo(() => {
    const total = filteredLogs.length
    const statusChanges = filteredLogs.filter((l) => l.action_type === 'mudanca_status').length
    const userDeletions = filteredLogs.filter((l) => l.action_type === 'exclusao_usuario').length
    const assetDeletions = filteredLogs.filter((l) => l.action_type === 'exclusao_ativo').length
    const cancellations = filteredLogs.filter(
      (l) =>
        l.action_type === 'cancelamento_exclusao_usuario' ||
        l.action_type === 'cancelamento_exclusao_ativo',
    ).length
    return { total, statusChanges, userDeletions, assetDeletions, cancellations }
  }, [filteredLogs])

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast({ title: 'Nenhum registro para exportar' })
      return
    }

    const headers = [
      'Data/Hora',
      'Operador',
      'Tipo de Acao',
      'Equipamento',
      'Usuario Vinculado',
      'Descricao',
    ]

    const rows = filteredLogs.map((l) => [
      new Date(l.created).toLocaleString('pt-BR'),
      `"${(l.operator_name || 'Sistema').replace(/"/g, '""')}"`,
      `"${(ACTION_LABELS[l.action_type]?.label || l.action_type).replace(/"/g, '""')}"`,
      `"${(l.equipment_name || '-').replace(/"/g, '""')}"`,
      `"${(l.target_user_name || '-').replace(/"/g, '""')}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `auditoria_automacao_ativos_${new Date().toISOString().split('T')[0]}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: 'Exportação CSV gerada com sucesso!' })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header com tema grafite e âmbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(217,119,6,0.15)]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Auditoria de Automações de Ativos
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Histórico detalhado de exclusões de usuários e equipamentos, transições para
                Disponível e cancelamentos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 hover:border-amber-500/40"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin text-amber-500' : ''}`}
            />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <span className="text-xs text-muted-foreground font-medium">Total de Registros</span>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            Mudança p/ Disponível
          </span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.statusChanges}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-xs">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Exclusões de Usuário
          </span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.userDeletions}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 shadow-xs">
          <span className="text-xs text-red-700 dark:text-red-400 font-medium">
            Exclusões de Ativo
          </span>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {stats.assetDeletions}
          </p>
        </div>
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
          <span className="text-xs text-muted-foreground font-medium">Cancelamentos</span>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{stats.cancellations}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por operador, ativo, usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>

        <div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 text-xs bg-background">
              <SelectValue placeholder="Tipo de Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Ações</SelectItem>
              <SelectItem value="exclusao_usuario">Exclusão de Usuário</SelectItem>
              <SelectItem value="exclusao_ativo">Exclusão de Equipamento</SelectItem>
              <SelectItem value="mudanca_status">Mudança para Disponível</SelectItem>
              <SelectItem value="cancelamento_exclusao_usuario">Cancelamento (Usuário)</SelectItem>
              <SelectItem value="cancelamento_exclusao_ativo">Cancelamento (Ativo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-xs bg-background"
            placeholder="Data Inicial"
          />
        </div>

        <div>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 text-xs bg-background"
            placeholder="Data Final"
          />
        </div>
      </div>

      {/* Tabela de Logs */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Nenhum registro de automação
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              As ações de exclusão de usuários e ativos, cancelamentos e alterações automáticas para
              "Disponível" serão registradas aqui em tempo real.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-xs">Data / Hora</TableHead>
                <TableHead className="font-semibold text-xs">Tipo de Ação</TableHead>
                <TableHead className="font-semibold text-xs">Operador</TableHead>
                <TableHead className="font-semibold text-xs">Equipamento</TableHead>
                <TableHead className="font-semibold text-xs">Usuário Vinculado</TableHead>
                <TableHead className="font-semibold text-xs">Descrição</TableHead>
                <TableHead className="text-right font-semibold text-xs">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const actionMeta = ACTION_LABELS[log.action_type] || {
                  label: log.action_type,
                  badgeCls: 'bg-muted text-foreground',
                }

                return (
                  <TableRow
                    key={log.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${actionMeta.badgeCls}`}
                      >
                        {actionMeta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-xs">
                      {log.operator_name || 'Sistema'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.equipment_name ? (
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Server className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>{log.equipment_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.target_user_name ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{log.target_user_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground max-w-xs truncate"
                      title={log.description}
                    >
                      {log.description || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLog(log)
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de Detalhes do Log */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-amber-600" />
              Detalhes do Registro de Auditoria
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ação executada em{' '}
              {selectedLog ? new Date(selectedLog.created).toLocaleString('pt-BR') : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div>
                  <span className="text-muted-foreground">Tipo de Ação:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {ACTION_LABELS[selectedLog.action_type]?.label || selectedLog.action_type}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Operador Responsável:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {selectedLog.operator_name || 'Sistema'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Equipamento:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {selectedLog.equipment_name || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Usuário Vinculado:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {selectedLog.target_user_name || '—'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground font-medium">Descrição Completa:</span>
                <p className="p-2.5 rounded-md bg-card border border-border mt-1 text-foreground leading-relaxed">
                  {selectedLog.description || 'Sem descrição adicional.'}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-muted-foreground font-medium">Metadados Técnicos:</span>
                  <pre className="p-2.5 rounded-md bg-muted/70 text-[11px] font-mono overflow-x-auto max-h-48 border border-border mt-1">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
