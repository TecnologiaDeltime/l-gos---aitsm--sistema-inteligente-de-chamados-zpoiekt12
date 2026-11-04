import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bot,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Sliders,
  Play,
  Building2,
  Clock,
  HelpCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import {
  getAllClientConsumptionAgents,
  saveClientConsumptionAgent,
  triggerConsumptionAgentEvaluation,
  type ClientConsumptionAgentRecord,
} from '@/services/client-consumption-agent'

interface ClientConsumptionAgentTabProps {
  canConfigure?: boolean
  canEdit?: boolean
}

export function ClientConsumptionAgentTab({
  canConfigure = true,
  canEdit = true,
}: ClientConsumptionAgentTabProps) {
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [agents, setAgents] = useState<ClientConsumptionAgentRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'high' | 'low' | 'normal' | 'no_data'>(
    'all',
  )

  // Modal de edição por cliente
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null)
  const [editForm, setEditForm] = useState({
    id: '',
    companyId: '',
    enabled: true,
    deviationHighPct: 30,
    deviationLowPct: 30,
    learningWindowMonths: 3,
  })

  const { toast } = useToast()
  const canModify = canConfigure || canEdit

  const loadData = async () => {
    setLoading(true)
    try {
      const [compList, agentList] = await Promise.all([
        getCompanies(),
        getAllClientConsumptionAgents(),
      ])
      setCompanies(compList)
      setAgents(agentList)
    } catch {
      toast({
        title: 'Erro ao carregar dados do agente de consumo',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Mapa de agent por companyId
  const agentByCompanyId = useMemo(() => {
    const map = new Map<string, ClientConsumptionAgentRecord>()
    agents.forEach((ag) => {
      map.set(ag.company, ag)
    })
    return map
  }, [agents])

  // Lista unificada
  const items = useMemo(() => {
    return companies.map((c) => {
      const ag = agentByCompanyId.get(c.id)
      return {
        company: c,
        agent: ag,
        enabled: ag ? ag.enabled !== false : true,
        deviationHigh: ag?.deviation_high_pct ?? 30,
        deviationLow: ag?.deviation_low_pct ?? 30,
        windowMonths: ag?.learning_window_months ?? 3,
        averageHours: ag?.learned_average_hours ?? 0,
        referencePeriod: ag?.learned_reference_period || 'Aguardando avaliação',
        currentHours: ag?.current_period_consumed_hours ?? 0,
        deviationPct: ag?.current_period_deviation_pct ?? 0,
        status: ag?.current_status || 'no_data',
        lastEval: ag?.last_evaluation_at,
        lastAlertAt: ag?.last_alerted_at,
      }
    })
  }, [companies, agentByCompanyId])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const name = (item.company.trade_name || item.company.legal_name || '').toLowerCase()
      const code = (item.company.code || '').toLowerCase()
      const matchesSearch =
        name.includes(searchTerm.toLowerCase()) || code.includes(searchTerm.toLowerCase())
      if (!matchesSearch) return false

      if (statusFilter === 'all') return true
      return item.status === statusFilter
    })
  }, [items, searchTerm, statusFilter])

  // KPIs
  const stats = useMemo(() => {
    let high = 0
    let low = 0
    let normal = 0
    let disabled = 0

    items.forEach((it) => {
      if (!it.enabled) disabled++
      else if (it.status === 'high') high++
      else if (it.status === 'low') low++
      else if (it.status === 'normal') normal++
    })

    return { total: items.length, high, low, normal, disabled }
  }, [items])

  const handleToggleEnabled = async (item: (typeof items)[0]) => {
    if (!canModify) return
    const newEnabled = !item.enabled
    setSavingId(item.company.id)
    try {
      await saveClientConsumptionAgent({
        id: item.agent?.id,
        company: item.company.id,
        enabled: newEnabled,
        deviation_high_pct: item.deviationHigh,
        deviation_low_pct: item.deviationLow,
        learning_window_months: item.windowMonths,
      })
      toast({
        title: newEnabled ? 'Monitoramento ativado' : 'Monitoramento desativado',
        description: `Cliente: ${item.company.trade_name || item.company.legal_name}`,
      })
      await loadData()
    } catch {
      toast({
        title: 'Erro ao atualizar monitoramento',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleOpenEdit = (comp: CompanyRecord, ag?: ClientConsumptionAgentRecord) => {
    setEditingCompany(comp)
    setEditForm({
      id: ag?.id || '',
      companyId: comp.id,
      enabled: ag ? ag.enabled !== false : true,
      deviationHighPct: ag?.deviation_high_pct ?? 30,
      deviationLowPct: ag?.deviation_low_pct ?? 30,
      learningWindowMonths: ag?.learning_window_months ?? 3,
    })
  }

  const handleSaveModal = async () => {
    if (!editingCompany || !canModify) return
    setSavingId(editingCompany.id)
    try {
      await saveClientConsumptionAgent({
        id: editForm.id || undefined,
        company: editingCompany.id,
        enabled: editForm.enabled,
        deviation_high_pct: Number(editForm.deviationHighPct),
        deviation_low_pct: Number(editForm.deviationLowPct),
        learning_window_months: Number(editForm.learningWindowMonths),
      })
      toast({
        title: 'Configurações do cliente salvas com sucesso',
      })
      setEditingCompany(null)
      await loadData()
    } catch {
      toast({
        title: 'Erro ao salvar configurações do cliente',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleRunEvaluation = async (companyId?: string) => {
    setEvaluating(true)
    try {
      const res = await triggerConsumptionAgentEvaluation({
        companyId: companyId,
        forceAlert: false,
      })
      toast({
        title: 'Avaliação concluída pelo Agente',
        description: `${res.evaluatedCount} cliente(s) avaliado(s). Notificações disparadas se houver desvio.`,
      })
      await loadData()
    } catch {
      toast({
        title: 'Erro ao executar avaliação do agente',
        variant: 'destructive',
      })
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO AGENTE */}
      <Card className="itsm-card border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-slate-100">
                <BrainCircuit className="h-6 w-6 text-amber-500" />
                Agente Inteligente de Consumo de Horas (Clientes)
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 max-w-2xl">
                Aprende continuamente a média histórica de horas debitadas da franquia de cada
                cliente e notifica automaticamente os usuários com perfil <strong>
                  Qualidade
                </strong>{' '}
                e <strong>Gestor</strong> ao detectar consumo elevado ou muito abaixo do padrão.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              {canModify && (
                <Button
                  size="sm"
                  onClick={() => handleRunEvaluation()}
                  disabled={evaluating || loading}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                >
                  <Play className={`h-4 w-4 ${evaluating ? 'animate-spin' : ''}`} />
                  {evaluating ? 'Avaliando...' : 'Avaliar Todos Agora'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* CARDS DE INDICADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="itsm-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total de Clientes</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
          </div>
        </Card>

        <Card className="itsm-card p-4 flex items-center gap-3 border-red-500/30 bg-red-500/5">
          <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-red-600 font-medium">Consumo Elevado</p>
            <p className="text-2xl font-bold text-red-600">{stats.high}</p>
          </div>
        </Card>

        <Card className="itsm-card p-4 flex items-center gap-3 border-amber-500/30 bg-amber-500/5">
          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-amber-600 font-medium">Consumo Muito Abaixo</p>
            <p className="text-2xl font-bold text-amber-600">{stats.low}</p>
          </div>
        </Card>

        <Card className="itsm-card p-4 flex items-center gap-3 border-emerald-500/30 bg-emerald-500/5">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-emerald-600 font-medium">Dentro do Padrão</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.normal}</p>
          </div>
        </Card>
      </div>

      {/* FILTROS E BUSCA */}
      <Card className="itsm-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={statusFilter}
                onValueChange={(val: 'all' | 'high' | 'low' | 'normal' | 'no_data') =>
                  setStatusFilter(val)
                }
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="high">Consumo Elevado</SelectItem>
                  <SelectItem value="low">Consumo Abaixo</SelectItem>
                  <SelectItem value="normal">Dentro do Padrão</SelectItem>
                  <SelectItem value="no_data">Sem Histórico Suficiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LISTAGEM DE CLIENTES E PARÂMETROS APRENDIDOS */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-500" />
              Monitoramento e Aprendizado por Cliente
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {filteredItems.length} cliente(s)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-500" />
              <p className="text-sm">Carregando dados do agente de consumo...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Building2 className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-sm font-medium">
                Nenhum cliente encontrado com os filtros atuais.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => {
                const compName = item.company.trade_name || item.company.legal_name || 'Cliente'
                const isHigh = item.status === 'high'
                const isLow = item.status === 'low'
                const isNormal = item.status === 'normal'

                return (
                  <div
                    key={item.company.id}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    {/* Identificação do Cliente */}
                    <div className="space-y-1 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {compName}
                        </span>
                        {item.company.code && (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.company.code}
                          </Badge>
                        )}
                        {!item.enabled && (
                          <Badge variant="outline" className="text-xs text-slate-400">
                            Pausado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Período base: <span>{item.referencePeriod}</span> ({item.windowMonths}{' '}
                        meses)
                      </p>
                    </div>

                    {/* Média Aprendida & Consumo Atual */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full lg:w-auto">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-[11px] text-slate-500 font-medium">Média Aprendida</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {item.averageHours > 0 ? `${item.averageHours.toFixed(1)}h/mês` : '—'}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-[11px] text-slate-500 font-medium">Mês Atual</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {item.currentHours.toFixed(1)}h
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center col-span-2 sm:col-span-1">
                        <p className="text-[11px] text-slate-500 font-medium">Status / Desvio</p>
                        <div className="flex items-center justify-center gap-1">
                          {isHigh && (
                            <Badge className="bg-red-600 hover:bg-red-700 text-white text-[11px]">
                              +{item.deviationPct}% Elevado
                            </Badge>
                          )}
                          {isLow && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[11px]">
                              {item.deviationPct}% Abaixo
                            </Badge>
                          )}
                          {isNormal && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]">
                              {item.deviationPct > 0
                                ? `+${item.deviationPct}%`
                                : `${item.deviationPct}%`}{' '}
                              Normal
                            </Badge>
                          )}
                          {item.status === 'no_data' && (
                            <Badge variant="outline" className="text-xs text-slate-400">
                              Sem dados
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Controles & Configurações */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`switch-${item.company.id}`}
                          className="text-xs text-slate-500"
                        >
                          {item.enabled ? 'Ativo' : 'Pausado'}
                        </Label>
                        <Switch
                          id={`switch-${item.company.id}`}
                          checked={item.enabled}
                          disabled={!canModify || savingId === item.company.id}
                          onCheckedChange={() => handleToggleEnabled(item)}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(item.company, item.agent)}
                        className="gap-1.5 text-xs"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        Configurar (±{item.deviationHigh}%)
                      </Button>

                      {canModify && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRunEvaluation(item.company.id)}
                          disabled={evaluating}
                          title="Recalcular média e avaliar este cliente"
                          className="h-8 w-8 p-0"
                        >
                          <Play className="h-3.5 w-3.5 text-amber-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CONFIGURAÇÃO INDIVIDUAL DO CLIENTE */}
      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-amber-500" />
              Configurar Agente de Consumo
            </DialogTitle>
            <DialogDescription>
              {editingCompany?.trade_name || editingCompany?.legal_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Monitoramento do Cliente</Label>
                <p className="text-xs text-slate-500">
                  Ativa ou suspende os alertas para este cliente
                </p>
              </div>
              <Switch
                checked={editForm.enabled}
                onCheckedChange={(val) => setEditForm((prev) => ({ ...prev, enabled: val }))}
                disabled={!canModify}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Tolerância para Consumo Elevado (%)</Label>
                <Badge variant="destructive" className="text-[10px]">
                  Alerta Vermelho
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={200}
                  value={editForm.deviationHighPct}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      deviationHighPct: Number(e.target.value),
                    }))
                  }
                  disabled={!canModify}
                  className="w-full"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Notifica quando o consumo no mês superar a média histórica em{' '}
                <strong>+{editForm.deviationHighPct}%</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Tolerância para Consumo Abaixo (%)</Label>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">
                  Alerta Amarelo
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={95}
                  value={editForm.deviationLowPct}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      deviationLowPct: Number(e.target.value),
                    }))
                  }
                  disabled={!canModify}
                  className="w-full"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Notifica quando o consumo no mês ficar abaixo da média em{' '}
                <strong>-{editForm.deviationLowPct}%</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Janela de Aprendizado Histórico</Label>
              <Select
                value={String(editForm.learningWindowMonths)}
                onValueChange={(val) =>
                  setEditForm((prev) => ({
                    ...prev,
                    learningWindowMonths: Number(val),
                  }))
                }
                disabled={!canModify}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período de aprendizado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Últimos 2 meses</SelectItem>
                  <SelectItem value="3">Últimos 3 meses (Recomendado)</SelectItem>
                  <SelectItem value="4">Últimos 4 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses (Visão semestral)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                O agente calcula a média ponderada das horas de acompanhamento (débito de franquia)
                nesses meses.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>
              Cancelar
            </Button>
            {canModify && (
              <Button
                onClick={handleSaveModal}
                disabled={savingId === editingCompany?.id}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {savingId === editingCompany?.id ? 'Salvando...' : 'Salvar Parâmetros'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
