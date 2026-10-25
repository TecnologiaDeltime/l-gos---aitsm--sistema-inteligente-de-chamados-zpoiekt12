import { useEffect, useState, useMemo } from 'react'
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  ListTree,
  Mail,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApprovalConfigDialog } from '@/components/ApprovalConfigDialog'
import {
  getApprovalConfigs,
  deleteApprovalConfig,
  updateApprovalConfig,
  ApprovalConfigRecord,
} from '@/services/approval-configs'
import { getApprovals, ApprovalRecord } from '@/services/approvals'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { Link } from 'react-router-dom'

export default function TicketApprovalsPage() {
  const { toast } = useToast()
  const { isAdmin, isGestor } = usePermissions()
  const canManage = isAdmin || isGestor

  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules')
  const [configs, setConfigs] = useState<ApprovalConfigRecord[]>([])
  const [approvalsHistory, setApprovalsHistory] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ApprovalConfigRecord | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [cfgs, apps] = await Promise.all([getApprovalConfigs(), getApprovals()])
      setConfigs(cfgs || [])
      setApprovalsHistory(apps || [])
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar aprovações',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('approval_configs', () => loadData())
  useRealtime('approvals', () => loadData())

  const handleNewRule = () => {
    setEditingConfig(null)
    setDialogOpen(true)
  }

  const handleEditRule = (cfg: ApprovalConfigRecord) => {
    setEditingConfig(cfg)
    setDialogOpen(true)
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra de aprovação?')) return
    try {
      await deleteApprovalConfig(id)
      toast({ title: 'Regra excluída com sucesso!' })
      loadData()
    } catch {
      toast({ title: 'Erro ao excluir regra', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (cfg: ApprovalConfigRecord) => {
    try {
      await updateApprovalConfig(cfg.id, { active: !cfg.active })
      toast({ title: cfg.active ? 'Regra desativada' : 'Regra reativada' })
      loadData()
    } catch {
      toast({ title: 'Erro ao alterar status da regra', variant: 'destructive' })
    }
  }

  // Filtro de regras
  const filteredConfigs = useMemo(() => {
    return configs.filter((c) => {
      const actName = c.expand?.activity?.name?.toLowerCase() || ''
      const desc = c.description?.toLowerCase() || ''
      const mode = c.mode?.toLowerCase() || ''
      const term = searchTerm.toLowerCase()
      return actName.includes(term) || desc.includes(term) || mode.includes(term)
    })
  }, [configs, searchTerm])

  // Filtro do histórico de aprovações
  const filteredApprovals = useMemo(() => {
    return approvalsHistory.filter((a) => {
      const ticketNum = a.expand?.ticket?.number || ''
      const title = a.expand?.ticket?.title?.toLowerCase() || ''
      const reqName = a.expand?.requester?.name?.toLowerCase() || ''
      const term = searchTerm.toLowerCase()
      return ticketNum.includes(term) || title.includes(term) || reqName.includes(term)
    })
  }, [approvalsHistory, searchTerm])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Aprovações de Chamados
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre regras de aprovação por atividade com fluxo individual, sequencial
            (contingência) ou paralelo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {canManage && (
            <Button onClick={handleNewRule} className="bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Regra de Aprovação
            </Button>
          )}
        </div>
      </div>

      {/* Abas: Regras / Histórico */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="rules" className="gap-1.5 text-xs font-semibold">
              <ListTree className="h-3.5 w-3.5" />
              Regras Configuradas ({configs.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" />
              Histórico de Solicitações ({approvalsHistory.length})
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por atividade, chamado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        {/* TAB 1: REGRAS DE APROVAÇÃO */}
        <TabsContent value="rules" className="space-y-4 m-0">
          {filteredConfigs.length === 0 ? (
            <Card className="text-center p-8 bg-white dark:bg-slate-900 border-dashed">
              <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nenhuma regra de aprovação cadastrada
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Crie regras associando atividades (Ex: "Computador com lentidão" ou "Liberação de
                pasta VPN") aos aprovadores responsáveis.
              </p>
              {canManage && (
                <Button
                  onClick={handleNewRule}
                  size="sm"
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Criar Primeira Regra
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredConfigs.map((cfg) => {
                const actName = cfg.expand?.activity?.name || 'Todas as atividades'
                const clientsList = cfg.expand?.clients || []
                const fps = cfg.expand?.focal_points || []
                const ops = cfg.expand?.internal_approvers || []
                const modeColor =
                  cfg.mode === 'Sequencial'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : cfg.mode === 'Paralela'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200'

                return (
                  <Card
                    key={cfg.id}
                    className={`border transition-shadow hover:shadow-md ${!cfg.active ? 'opacity-60 bg-slate-50' : 'bg-white'}`}
                  >
                    <CardHeader className="p-4 pb-3 border-b flex flex-row items-start justify-between gap-2 space-y-0">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {actName}
                          </span>
                          {!cfg.active && (
                            <Badge variant="outline" className="text-red-600 text-[10px]">
                              Inativa
                            </Badge>
                          )}
                        </div>
                        {cfg.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            {cfg.description}
                          </p>
                        )}
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold shrink-0 ${modeColor}`}
                      >
                        Modo {cfg.mode || 'Individual'}
                      </Badge>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 text-xs">
                      {/* Prazo de Contingência (quando Sequencial) */}
                      {cfg.mode === 'Sequencial' && (
                        <div className="flex items-center gap-1.5 text-amber-700 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Contingência: escala para o próximo nível após{' '}
                            <strong>{cfg.escalation_timeout_minutes || 60} minutos</strong> sem
                            resposta
                          </span>
                        </div>
                      )}

                      {/* Lista de Aprovadores: Pontos Focais e Internos */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          {cfg.mode === 'Sequencial'
                            ? 'Ordem da Sequência de Aprovação:'
                            : 'Aprovadores Designados:'}
                        </span>

                        {fps.length === 0 && ops.length === 0 ? (
                          <span className="text-slate-400 italic">Nenhum aprovador vinculado</span>
                        ) : (
                          <div className="space-y-1">
                            {/* Pontos Focais */}
                            {fps.map((fp, idx) => (
                              <div
                                key={fp.id}
                                className="flex items-center justify-between p-1.5 rounded bg-slate-50 border text-[11px]"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  {cfg.mode === 'Sequencial' && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-bold px-1.5"
                                    >
                                      {idx + 1}º
                                    </Badge>
                                  )}
                                  <span className="font-medium text-slate-800">{fp.full_name}</span>
                                  <span className="text-slate-400 truncate">({fp.email})</span>
                                </div>
                                <Badge variant="secondary" className="text-[9px] shrink-0">
                                  Ponto Focal
                                </Badge>
                              </div>
                            ))}

                            {/* Internos */}
                            {ops.map((op, idx) => {
                              const pos = fps.length + idx + 1
                              return (
                                <div
                                  key={op.id}
                                  className="flex items-center justify-between p-1.5 rounded bg-blue-50/60 border border-blue-100 text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {cfg.mode === 'Sequencial' && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] font-bold px-1.5 bg-amber-50 text-amber-800"
                                      >
                                        {pos}º
                                      </Badge>
                                    )}
                                    <span className="font-medium text-slate-800">{op.name}</span>
                                    <span className="text-slate-400 truncate">({op.email})</span>
                                  </div>
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] shrink-0 uppercase bg-blue-100 text-blue-800"
                                  >
                                    Interno (
                                    {op.role === 'admin'
                                      ? 'Admin'
                                      : op.role === 'gestor'
                                        ? 'Gestão'
                                        : 'Operador'}
                                    )
                                  </Badge>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Escopo de Clientes */}
                      <div className="pt-2 border-t flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {clientsList.length === 0
                              ? 'Aplica-se a todos os clientes'
                              : `${clientsList.length} cliente(s) específico(s)`}
                          </span>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleToggleActive(cfg)}
                            >
                              {cfg.active ? 'Desativar' : 'Ativar'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleEditRule(cfg)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteRule(cfg.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: HISTÓRICO DE SOLICITAÇÕES */}
        <TabsContent value="history" className="space-y-4 m-0">
          <Card className="bg-white dark:bg-slate-900 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="w-28">Chamado</TableHead>
                  <TableHead>Assunto / Solicitação</TableHead>
                  <TableHead>Modo / Nível</TableHead>
                  <TableHead>Aprovador Destinado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma solicitação de aprovação encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApprovals.map((app) => {
                    const tkt = app.expand?.ticket
                    const targetName =
                      app.expand?.target_contact?.full_name ||
                      app.expand?.approver?.name ||
                      app.target_email ||
                      'Não identificado'

                    const isPending = app.status === 'Pendente'
                    const isApproved = app.status === 'Aprovado'
                    const isRejected = app.status === 'Reprovado'

                    return (
                      <TableRow key={app.id} className="text-xs">
                        <TableCell className="font-bold text-blue-600">
                          {tkt?.id ? (
                            <Link to={`/tickets/${tkt.id}`} className="hover:underline">
                              #{tkt.number}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 line-clamp-1">
                            {tkt?.title || 'Sem título'}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {app.justification || tkt?.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {app.mode || 'Individual'} {app.stage ? `(Nível ${app.stage})` : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800">{targetName}</div>
                          {app.target_email && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {app.target_email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isApproved ? 'default' : isRejected ? 'destructive' : 'secondary'
                            }
                            className={isApproved ? 'bg-green-600 text-white' : ''}
                          >
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {new Date(app.created).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.token && (
                            <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                              <Link to={`/approval/${app.token}`} target="_blank">
                                Abrir Link
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Criação/Edição de Regra */}
      <ApprovalConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadData}
        editingConfig={editingConfig}
      />
    </div>
  )
}
