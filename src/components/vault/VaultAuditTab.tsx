import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Download,
  Filter,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  KeyRound,
  Trash2,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react'
import {
  VaultAuditLog,
  VaultAuditAction,
  VaultAuditStatus,
  getVaultAuditLogs,
  getAllVaultAuditLogs,
} from '@/services/vault'
import { getOperators } from '@/services/operators'
import { useToast } from '@/hooks/use-toast'

export function VaultAuditTab() {
  const { toast } = useToast()

  const [logs, setLogs] = useState<VaultAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)

  // Filtros
  const [search, setSearch] = useState('')
  const [operatorId, setOperatorId] = useState('all')
  const [action, setAction] = useState('all')
  const [status, setStatus] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [operators, setOperators] = useState<{ id: string; name: string; email: string }[]>([])

  useEffect(() => {
    getOperators()
      .then((users) => {
        setOperators(
          users.map((u) => ({
            id: u.id,
            name:
              u.name ||
              (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : '') ||
              u.email,
            email: u.email,
          })),
        )
      })
      .catch(() => {})
  }, [])

  const loadLogs = async (currentPage = page) => {
    setLoading(true)
    try {
      const res = await getVaultAuditLogs({
        page: currentPage,
        perPage: 20,
        search,
        operatorId,
        action,
        status,
        startDate,
        endDate,
      })
      setLogs(res.items)
      setTotalItems(res.totalItems)
      setTotalPages(res.totalPages)
    } catch {
      toast({ title: 'Erro ao carregar auditoria do cofre', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    loadLogs(1)
  }, [search, operatorId, action, status, startDate, endDate])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadLogs(newPage)
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const allLogs = await getAllVaultAuditLogs({
        search,
        operatorId,
        action,
        status,
        startDate,
        endDate,
      })

      if (allLogs.length === 0) {
        toast({ title: 'Nenhum registro para exportar.' })
        return
      }

      const headers = [
        'Data e Horário',
        'Operador',
        'E-mail Operador',
        'Ação',
        'Status',
        'Item / Credencial',
        'Cliente',
        'Motivo / Detalhe',
        'IP',
      ]

      const rows = allLogs.map((l) => [
        `"${new Date(l.created).toLocaleString('pt-BR')}"`,
        `"${l.operator_name || l.expand?.operator?.name || ''}"`,
        `"${l.operator_email || l.expand?.operator?.email || ''}"`,
        `"${formatAction(l.action)}"`,
        `"${l.status}"`,
        `"${l.credential_name || ''}"`,
        `"${l.client_name || ''}"`,
        `"${(l.reason || '').replace(/"/g, '""')}"`,
        `"${l.ip_address || ''}"`,
      ])

      const csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute(
        'download',
        `auditoria_cofre_senhas_${new Date().toISOString().slice(0, 10)}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({ title: 'Relatório CSV de auditoria exportado com sucesso!' })
    } catch {
      toast({ title: 'Erro ao exportar auditoria CSV', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const formatAction = (act: VaultAuditAction) => {
    switch (act) {
      case 'PASSWORD_VIEWED':
        return 'Senha Visualizada'
      case 'PASSWORD_VIEW_FAILED_AUTH':
        return 'Falha na Reautenticação'
      case 'PASSWORD_VIEW_DENIED_PROFILE':
        return 'Acesso Negado por Perfil'
      case 'CREDENTIAL_CREATED':
        return 'Credencial Criada'
      case 'CREDENTIAL_UPDATED':
        return 'Credencial Editada'
      case 'CREDENTIAL_DELETED':
        return 'Credencial Excluída'
      default:
        return act
    }
  }

  const getActionBadge = (act: VaultAuditAction) => {
    switch (act) {
      case 'PASSWORD_VIEWED':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200">
            <Eye className="h-3 w-3 mr-1" />
            Senha Revelada
          </Badge>
        )
      case 'PASSWORD_VIEW_FAILED_AUTH':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Falha na Autenticação
          </Badge>
        )
      case 'PASSWORD_VIEW_DENIED_PROFILE':
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Sem Perfil Autorizado
          </Badge>
        )
      case 'CREDENTIAL_CREATED':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200">
            <KeyRound className="h-3 w-3 mr-1" />
            Criação de Credencial
          </Badge>
        )
      case 'CREDENTIAL_UPDATED':
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200">
            <RefreshCw className="h-3 w-3 mr-1" />
            Edição de Credencial
          </Badge>
        )
      case 'CREDENTIAL_DELETED':
        return (
          <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300">
            <Trash2 className="h-3 w-3 mr-1" />
            Exclusão de Credencial
          </Badge>
        )
      default:
        return <Badge variant="outline">{act}</Badge>
    }
  }

  const getStatusBadge = (st: VaultAuditStatus) => {
    switch (st) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Sucesso
          </span>
        )
      case 'DENIED':
        return (
          <span className="inline-flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 gap-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            Negado
          </span>
        )
      case 'FAILED':
        return (
          <span className="inline-flex items-center text-xs font-semibold text-red-600 dark:text-red-400 gap-1">
            <XCircle className="h-3.5 w-3.5" />
            Falhou
          </span>
        )
      default:
        return <span>{st}</span>
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Exportação */}
      <Card className="itsm-card">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* Busca textual */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por operador, credencial, motivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="itsm-input pl-8 text-xs"
              />
            </div>

            {/* Filtro de Operador */}
            <div>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger className="itsm-select text-xs">
                  <SelectValue placeholder="Operador..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">Todos os operadores</SelectItem>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Ação */}
            <div>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="itsm-select text-xs">
                  <SelectValue placeholder="Tipo de ação..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="PASSWORD_VIEWED">Senha Visualizada</SelectItem>
                  <SelectItem value="PASSWORD_VIEW_FAILED_AUTH">Falha Autenticação</SelectItem>
                  <SelectItem value="PASSWORD_VIEW_DENIED_PROFILE">Negado por Perfil</SelectItem>
                  <SelectItem value="CREDENTIAL_CREATED">Criação</SelectItem>
                  <SelectItem value="CREDENTIAL_UPDATED">Edição</SelectItem>
                  <SelectItem value="CREDENTIAL_DELETED">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Status */}
            <div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="itsm-select text-xs">
                  <SelectValue placeholder="Status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="SUCCESS">Sucesso</SelectItem>
                  <SelectItem value="DENIED">Negado</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão de Exportação CSV */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={exporting || loading}
                className="w-full text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </Button>
            </div>
          </div>

          {/* Filtro de Período (Datas) */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Filtrar por Período:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">De:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Até:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            {(startDate ||
              endDate ||
              search ||
              operatorId !== 'all' ||
              action !== 'all' ||
              status !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setOperatorId('all')
                  setAction('all')
                  setStatus('all')
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs h-8 text-slate-500 hover:text-slate-800"
              >
                Limpar Filtros
              </Button>
            )}
            <span className="ml-auto text-slate-400 text-[11px]">
              Total de registros: <strong>{totalItems}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs de Auditoria */}
      <Card className="itsm-card">
        <CardHeader className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Trilha de Auditoria e Histórico de Acessos ao Cofre
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadLogs()}
            disabled={loading}
            className="h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Carregando registros de auditoria...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <ShieldAlert className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                Nenhum registro de auditoria encontrado para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Data e Horário</th>
                    <th className="py-2.5 px-4">Operador</th>
                    <th className="py-2.5 px-4">Ação</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Credencial / Cliente</th>
                    <th className="py-2.5 px-4">Detalhes / Motivo</th>
                    <th className="py-2.5 px-4">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {new Date(log.created).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.operator_name ||
                                log.expand?.operator?.name ||
                                'Operador desconhecido'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {log.operator_email || log.expand?.operator?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {log.credential_name || 'Item do Cofre'}
                        </p>
                        {log.client_name && (
                          <p className="text-[11px] text-slate-400">{log.client_name}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                        <span className="line-clamp-2" title={log.reason}>
                          {log.reason || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {log.ip_address || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalItems} itens)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || loading}
                  className="h-8 text-xs"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="h-8 text-xs"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
