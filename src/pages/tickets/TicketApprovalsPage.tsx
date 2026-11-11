import { useEffect, useState, useMemo } from 'react'
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  ListTree,
  UserCheck,
  RefreshCw,
  Save,
  Check,
  X,
  Layers,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApprovalConfigDialog } from '@/components/ApprovalConfigDialog'
import { MultiSelect } from '@/components/MultiSelect'
import {
  getApprovalConfigs,
  deleteApprovalConfig,
  updateApprovalConfig,
  createApprovalConfig,
  getFocalPointsAll,
  getInternalApproversAll,
  ApprovalConfigRecord,
} from '@/services/approval-configs'
import { getApprovals, ApprovalRecord, decideApproval } from '@/services/approvals'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getAllClientContacts, ClientContactRecord } from '@/services/client-contacts'
import { getOperators } from '@/services/operators'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth } from '@/hooks/use-auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Link } from 'react-router-dom'

interface RowState {
  configId?: string
  activityId: string
  approverType: 'focal_point' | 'internal_user' | 'none'
  selectedFpIds: string[] // pontos focais selecionados (regra "basta um")
  selectedInternalIds: string[] // aprovadores internos selecionados
  active: boolean
  isDirty?: boolean
  saving?: boolean
}

const emptyRow = (activityId: string): RowState => ({
  activityId,
  approverType: 'none',
  selectedFpIds: [],
  selectedInternalIds: [],
  active: true,
  isDirty: false,
})

export default function TicketApprovalsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { isAdmin, isGestor, canEdit, canConfigure } = usePermissions()
  const canManage =
    isAdmin ||
    isGestor ||
    canConfigure('tickets.tickets_approval_flow') ||
    canConfigure('tickets.tickets_aprovacoes')
  const canDecide =
    isAdmin ||
    isGestor ||
    canEdit('tickets.tickets_approval_flow') ||
    canEdit('tickets.tickets_aprovacoes')

  const [activeTab, setActiveTab] = useState<'matrix' | 'pending' | 'history'>('matrix')

  // Dados mestres
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [allContacts, setAllContacts] = useState<ClientContactRecord[]>([])
  const [internalOperators, setInternalOperators] = useState<any[]>([])
  const [configs, setConfigs] = useState<ApprovalConfigRecord[]>([])
  const [approvalsHistory, setApprovalsHistory] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 1. EMPRESA SELECIONADA NO TOPO (Item 1 do pedido do usuário)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')

  // Filtros de busca na tabela
  const [activitySearch, setActivitySearch] = useState('')

  // Edição em lote/linha na matriz de atividades
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  // APROVAÇÃO EM MASSA: atividades marcadas com checkbox + aprovadores do lote
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
  const [bulkApproverType, setBulkApproverType] = useState<'focal_point' | 'internal_user'>(
    'focal_point',
  )
  const [bulkFpIds, setBulkFpIds] = useState<string[]>([])
  const [bulkInternalIds, setBulkInternalIds] = useState<string[]>([])
  const [bulkApplying, setBulkApplying] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  // Modal de edição avançada/individual
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ApprovalConfigRecord | null>(null)

  // Modal de decisão de aprovação pendente
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRecord | null>(null)
  const [decisionAction, setDecisionAction] = useState<'approved' | 'rejected'>('approved')
  const [rejectionReason, setRejectionReason] = useState('')
  const [deciding, setDeciding] = useState(false)

  // Carrega todos os dados iniciais
  const loadData = async () => {
    setLoading(true)
    try {
      const [comps, cats, conts, ops, cfgs, apps] = await Promise.all([
        getCompanies('status = "Ativo"'),
        getCategories(),
        getAllClientContacts(),
        getOperators({}),
        getApprovalConfigs(),
        getApprovals(),
      ])

      setCompanies(comps || [])
      setCategories(cats || [])
      setAllContacts(conts || [])
      const eligible = (ops || []).filter((u: any) =>
        ['admin', 'gestor', 'tecnico', 'operador'].includes(u.role),
      )
      setInternalOperators(eligible)
      setConfigs(cfgs || [])
      setApprovalsHistory(apps || [])

      // Se ainda não selecionou empresa, seleciona a primeira por padrão
      if (!selectedCompanyId && comps && comps.length > 0) {
        setSelectedCompanyId(comps[0].id)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar dados',
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

  // Pontos focais da empresa selecionada
  const companyFocalPoints = useMemo(() => {
    if (!selectedCompanyId) return []
    return allContacts.filter((c) => c.client === selectedCompanyId)
  }, [allContacts, selectedCompanyId])

  // Nome da empresa selecionada
  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId)
  }, [companies, selectedCompanyId])

  // Atividades do catálogo (hierárquicas com subatividades)
  const catalogActivities = useMemo(() => {
    const parentMap: Record<string, string> = {}
    categories.forEach((c) => {
      parentMap[c.id] = c.name
    })

    return categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        fullName: c.parent ? `${parentMap[c.parent] || 'Atividade'} → ${c.name}` : c.name,
        parentName: c.parent ? parentMap[c.parent] || 'Geral' : 'Principal',
        isSub: !!c.parent,
        active: c.active !== false,
      }))
      .filter((c) => c.active)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [categories])

  // Regras vinculadas à empresa selecionada
  const companyConfigs = useMemo(() => {
    if (!selectedCompanyId) return []
    return configs.filter((c) => {
      if (c.company && c.company === selectedCompanyId) return true
      if (Array.isArray(c.clients) && c.clients.includes(selectedCompanyId)) return true
      return false
    })
  }, [configs, selectedCompanyId])

  // Mapeia o estado de cada linha da tabela de atividades quando a empresa selecionada ou configs mudam
  useEffect(() => {
    if (!selectedCompanyId) return

    const initialRows: Record<string, RowState> = {}

    catalogActivities.forEach((act) => {
      // Procura se já existe regra para esta atividade + empresa
      const existing = companyConfigs.find((cfg) => cfg.activity === act.id)

      if (existing) {
        // Normaliza via helpers: usa *_all, depois legados, depois aprovador único
        const fpAll = getFocalPointsAll(existing)
        const internalAll = getInternalApproversAll(existing)
        let approverType: 'focal_point' | 'internal_user' | 'none' = 'none'
        if (fpAll.length > 0) approverType = 'focal_point'
        else if (internalAll.length > 0) approverType = 'internal_user'

        initialRows[act.id] = {
          configId: existing.id,
          activityId: act.id,
          approverType,
          selectedFpIds: approverType === 'focal_point' ? fpAll : [],
          selectedInternalIds: approverType === 'internal_user' ? internalAll : [],
          active: existing.active !== false,
          isDirty: false,
        }
      } else {
        // Nenhuma regra configurada ainda para esta atividade nesta empresa
        initialRows[act.id] = emptyRow(act.id)
      }
    })

    setRowStates(initialRows)
  }, [selectedCompanyId, companyConfigs, catalogActivities])

  // Ao trocar de empresa, limpa a seleção em massa e os aprovadores do lote
  useEffect(() => {
    setSelectedActivityIds([])
    setBulkApproverType('focal_point')
    setBulkFpIds([])
    setBulkInternalIds([])
  }, [selectedCompanyId])

  // ===== APROVAÇÃO EM MASSA =====

  // Marca/desmarca uma atividade na seleção do lote
  const toggleActivitySelection = (activityId: string) => {
    setSelectedActivityIds((prev) =>
      prev.includes(activityId) ? prev.filter((id) => id !== activityId) : [...prev, activityId],
    )
  }

  // Seleciona todas as atividades (respeitando o filtro de busca atual)
  const toggleSelectAllActivities = () => {
    const visibleIds = filteredActivities.map((a) => a.id)
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedActivityIds.includes(id))

    if (allVisibleSelected) {
      setSelectedActivityIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedActivityIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // Handler genérico de alteração da linha (marca dirty)
  const setRowState = (activityId: string, patch: Partial<RowState>) => {
    setRowStates((prev) => {
      const current = prev[activityId] || emptyRow(activityId)
      return { ...prev, [activityId]: { ...current, ...patch, isDirty: true } }
    })
  }

  // Alteração do TIPO de aprovador na linha
  const handleRowTypeChange = (activityId: string, value: string) => {
    // value: 'none' | 'focal_point' | 'internal_user'
    setRowState(activityId, {
      approverType: value as RowState['approverType'],
      ...(value === 'focal_point'
        ? { selectedInternalIds: [] }
        : value === 'internal_user'
          ? { selectedFpIds: [] }
          : { selectedFpIds: [], selectedInternalIds: [] }),
    })
  }

  // Salvar uma linha individualmente
  const handleSaveRow = async (activityId: string) => {
    const row = rowStates[activityId]
    if (!row || !selectedCompanyId) return

    setRowStates((prev) => ({
      ...prev,
      [activityId]: { ...prev[activityId], saving: true },
    }))

    try {
      const fps = (row.selectedFpIds || []).filter(Boolean)
      const internals = (row.selectedInternalIds || []).filter(Boolean)

      if (row.approverType === 'none' || (fps.length === 0 && internals.length === 0)) {
        // Se usuário desmarcou todos os aprovadores e já existia regra, remove
        if (row.configId) {
          await deleteApprovalConfig(row.configId)
          toast({ title: 'Aprovação desativada para esta atividade' })
        }
        setRowStates((prev) => ({
          ...prev,
          [activityId]: {
            ...prev[activityId],
            configId: undefined,
            isDirty: false,
            saving: false,
          },
        }))
        loadData()
        return
      }

      // Regra "basta um": listas multi-valoradas com o primeiro aprovador
      // espelhado nos campos legados (compatibilidade)
      const approverType: 'focal_point' | 'internal_user' =
        fps.length > 0 ? 'focal_point' : 'internal_user'

      const payload: Partial<ApprovalConfigRecord> = {
        company: selectedCompanyId,
        clients: [selectedCompanyId],
        activity: activityId,
        approver_type: approverType,
        focal_points_all: approverType === 'focal_point' ? fps : [],
        internal_approvers_all: approverType === 'internal_user' ? internals : [],
        approver_focal_point: approverType === 'focal_point' ? fps[0] : '',
        approver_user: approverType === 'internal_user' ? internals[0] : '',
        focal_points: approverType === 'focal_point' ? fps : [],
        internal_approvers: approverType === 'internal_user' ? internals : [],
        require_client_approval: approverType === 'focal_point',
        require_internal_approval: approverType === 'internal_user',
        active: row.active,
        mode: 'Individual',
        escalation_timeout_minutes: 60,
      }

      if (row.configId) {
        await updateApprovalConfig(row.configId, payload)
        toast({ title: 'Aprovador da atividade atualizado!' })
      } else {
        const created = await createApprovalConfig(payload)
        toast({ title: 'Aprovador definido com sucesso!' })
        setRowStates((prev) => ({
          ...prev,
          [activityId]: { ...prev[activityId], configId: created.id },
        }))
      }

      setRowStates((prev) => ({
        ...prev,
        [activityId]: { ...prev[activityId], isDirty: false, saving: false },
      }))
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message,
        variant: 'destructive',
      })
      setRowStates((prev) => ({
        ...prev,
        [activityId]: { ...prev[activityId], saving: false },
      }))
    }
  }

  // ===== AÇÃO DE LOTE: APLICAR APROVADORES A TODAS AS ATIVIDADES SELECIONADAS =====
  const handleApplyBulkApprover = async () => {
    const bulkFps = bulkApproverType === 'focal_point' ? bulkFpIds.filter(Boolean) : []
    const bulkInternals =
      bulkApproverType === 'internal_user' ? bulkInternalIds.filter(Boolean) : []
    if (
      (bulkFps.length === 0 && bulkInternals.length === 0) ||
      selectedActivityIds.length === 0 ||
      !selectedCompanyId
    )
      return

    setBulkApplying(true)
    const companyConfigList = configs.filter((c) => {
      if (c.company && c.company === selectedCompanyId) return true
      if (Array.isArray(c.clients) && c.clients.includes(selectedCompanyId)) return true
      return false
    })

    const bulkApproverTypeResolved: 'focal_point' | 'internal_user' =
      bulkFps.length > 0 ? 'focal_point' : 'internal_user'

    let successCount = 0
    let failCount = 0

    for (const activityId of selectedActivityIds) {
      const existing = companyConfigList.find((cfg) => cfg.activity === activityId)

      const payload: Partial<ApprovalConfigRecord> = {
        company: selectedCompanyId,
        clients: [selectedCompanyId],
        activity: activityId,
        approver_type: bulkApproverTypeResolved,
        focal_points_all: bulkApproverTypeResolved === 'focal_point' ? bulkFps : [],
        internal_approvers_all: bulkApproverTypeResolved === 'internal_user' ? bulkInternals : [],
        approver_focal_point: bulkApproverTypeResolved === 'focal_point' ? bulkFps[0] : '',
        approver_user: bulkApproverTypeResolved === 'internal_user' ? bulkInternals[0] : '',
        focal_points: bulkApproverTypeResolved === 'focal_point' ? bulkFps : [],
        internal_approvers: bulkApproverTypeResolved === 'internal_user' ? bulkInternals : [],
        require_client_approval: bulkApproverTypeResolved === 'focal_point',
        require_internal_approval: bulkApproverTypeResolved === 'internal_user',
        active: true,
        mode: 'Individual',
        escalation_timeout_minutes: 60,
      }

      try {
        if (existing) {
          await updateApprovalConfig(existing.id, payload)
        } else {
          await createApprovalConfig(payload)
        }
        successCount++
      } catch (err: any) {
        console.error(`Erro ao salvar aprovação da atividade ${activityId}:`, err)
        failCount++
      }
    }

    setBulkApplying(false)
    setBulkConfirmOpen(false)

    if (successCount > 0) {
      toast({
        title: 'Aprovador aplicado em massa!',
        description: `${successCount} atividade(s) atualizada(s)${
          failCount > 0 ? `, ${failCount} falha(s)` : ''
        }.`,
      })
      loadData()
      setSelectedActivityIds([])
      setBulkFpIds([])
      setBulkInternalIds([])
    } else {
      toast({
        title: 'Erro ao aplicar em massa',
        description: 'Nenhuma atividade foi atualizada. Verifique a conexão e tente novamente.',
        variant: 'destructive',
      })
    }
  }

  // Salvar todas as linhas com alterações pendentes
  const dirtyActivityIds = useMemo(() => {
    return Object.keys(rowStates).filter((actId) => rowStates[actId]?.isDirty)
  }, [rowStates])

  const handleSaveAllDirty = async () => {
    if (dirtyActivityIds.length === 0) return

    let successCount = 0
    for (const actId of dirtyActivityIds) {
      await handleSaveRow(actId)
      successCount++
    }

    toast({
      title: 'Alterações salvas!',
      description: `${successCount} atividade(s) atualizada(s) para esta empresa.`,
    })
  }

  // Filtragem de atividades na tabela
  const filteredActivities = useMemo(() => {
    if (!activitySearch.trim()) return catalogActivities
    const term = activitySearch.toLowerCase()
    return catalogActivities.filter(
      (a) =>
        a.fullName.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        a.parentName.toLowerCase().includes(term),
    )
  }, [catalogActivities, activitySearch])

  // Pendências de aprovação
  const pendingApprovals = useMemo(() => {
    return approvalsHistory.filter((a) => a.status === 'Pendente')
  }, [approvalsHistory])

  // Abertura de modal de decisão de aprovação
  const handleOpenDecision = (app: ApprovalRecord, action: 'approved' | 'rejected') => {
    setSelectedApproval(app)
    setDecisionAction(action)
    setRejectionReason('')
    setDecisionModalOpen(true)
  }

  const handleConfirmDecision = async () => {
    if (!selectedApproval) return

    if (decisionAction === 'rejected' && !rejectionReason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da reprovação.',
        variant: 'destructive',
      })
      return
    }

    setDeciding(true)
    try {
      // decideApproval aceita id/token como primeiro param
      await decideApproval(
        selectedApproval.token || selectedApproval.id,
        decisionAction,
        decisionAction === 'rejected' ? rejectionReason : undefined,
      )

      toast({
        title:
          decisionAction === 'approved'
            ? 'Aprovação autorizada com sucesso!'
            : 'Aprovação recusada!',
      })
      setDecisionModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao processar decisão',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setDeciding(false)
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Regras de Aprovação por Atividade
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Selecione a empresa cliente e defina qual ponto focal aprova cada atividade do catálogo.
            Caso não haja ponto focal cadastrado, escolha um aprovador interno da equipe TI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {canManage && (
            <Button
              onClick={() => {
                setEditingConfig(null)
                setDialogOpen(true)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Configurar Regra Avançada
            </Button>
          )}
        </div>
      </div>

      {/* ITEM 1 DO PEDIDO: SELEÇÃO DA EMPRESA NO TOPO */}
      <Card className="border-amber-200/80 bg-gradient-to-r from-amber-50/60 to-orange-50/30 dark:from-amber-950/20 dark:to-slate-900">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5 uppercase tracking-wide">
                <Building2 className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                Empresa Cliente Selecionada
              </Label>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80">
                Selecione a empresa para configurar ou visualizar os aprovadores de cada atividade.
                Toda a tela se refere exclusivamente a ela.
              </p>
            </div>

            <div className="w-full md:w-80">
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 font-semibold shadow-sm">
                  <SelectValue placeholder="Selecione uma empresa..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {companies.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.trade_name || comp.legal_name || comp.code}
                      {comp.document ? ` (${comp.document})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumo dos pontos focais da empresa selecionada */}
          <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/80 dark:bg-slate-900 font-medium">
                {companyFocalPoints.length} ponto(s) focal(is) cadastrado(s)
              </Badge>
              {companyFocalPoints.length === 0 && (
                <span className="text-amber-800 dark:text-amber-300 text-[11px]">
                  (Nenhum contato cadastrado no cliente — use a opção de Aprovador Interno TI)
                </span>
              )}
            </div>

            {dirtyActivityIds.length > 0 && canManage && (
              <Button
                size="sm"
                onClick={handleSaveAllDirty}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-8"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Salvar Todas as Linhas Alteradas ({dirtyActivityIds.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ABAS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="matrix" className="gap-1.5 text-xs font-semibold">
              <ListTree className="h-3.5 w-3.5 text-amber-600" />
              Matriz de Atividades do Catálogo ({catalogActivities.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5 text-xs font-semibold">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              Fila de Pendências ({pendingApprovals.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" />
              Histórico Geral ({approvalsHistory.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === 'matrix' && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Filtrar atividade do catálogo..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-white dark:bg-slate-900"
              />
            </div>
          )}
        </div>

        {/* ABA 1: MATRIZ DE ATIVIDADES X APROVADOR (Ponto Focal ou Interno) */}
        <TabsContent value="matrix" className="space-y-4 m-0">
          {/* BARRA DE AÇÃO EM MASSA (aparece quando há atividades marcadas) */}
          {canManage && selectedActivityIds.length > 0 && (
            <Card className="border-purple-300 dark:border-purple-800 bg-gradient-to-r from-purple-50/70 to-indigo-50/40 dark:from-purple-950/30 dark:to-slate-900 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                      <span className="text-sm font-bold text-purple-900 dark:text-purple-200">
                        Aprovação em Massa — {selectedActivityIds.length} atividade(s)
                        selecionada(s)
                      </span>
                    </div>
                    <p className="text-xs text-purple-800/80 dark:text-purple-300/80">
                      Escolha o aprovador que valerá para todas as atividades marcadas e clique em
                      &quot;Aplicar a selecionadas&quot;. A regra existente de cada atividade será
                      atualizada (ou criada, se ainda não houver).
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 w-full lg:w-auto">
                    <div className="w-full sm:w-72 space-y-1">
                      <Label className="text-[11px] font-semibold text-purple-900 dark:text-purple-200 mb-1 block">
                        Aprovadores do Lote
                      </Label>
                      <Select
                        value={bulkApproverType}
                        onValueChange={(v) =>
                          setBulkApproverType(v as 'focal_point' | 'internal_user')
                        }
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-800 text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="focal_point">Ponto Focal (cliente)</SelectItem>
                          <SelectItem value="internal_user">Aprovador Interno TI</SelectItem>
                        </SelectContent>
                      </Select>
                      {bulkApproverType === 'focal_point' ? (
                        <MultiSelect
                          options={companyFocalPoints.map((fp) => ({
                            value: fp.id,
                            label: `${fp.full_name}${fp.is_focal_point ? ' [Ponto Focal]' : ''}`,
                          }))}
                          value={bulkFpIds}
                          onChange={setBulkFpIds}
                          placeholder="Selecionar ponto(s) focal(is)..."
                        />
                      ) : (
                        <MultiSelect
                          options={internalOperators.map((op) => ({
                            value: op.id,
                            label: `${op.name} (${op.email})`,
                          }))}
                          value={bulkInternalIds}
                          onChange={setBulkInternalIds}
                          placeholder="Selecionar aprovador(es) interno(s)..."
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={
                          (bulkApproverType === 'focal_point'
                            ? bulkFpIds.length === 0
                            : bulkInternalIds.length === 0) || bulkApplying
                        }
                        onClick={() => setBulkConfirmOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9"
                      >
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        {bulkApplying ? 'Aplicando...' : 'Aplicar a selecionadas'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bulkApplying}
                        onClick={() => {
                          setEditingConfig(null)
                          setDialogOpen(true)
                        }}
                        className="text-xs h-9 border-purple-300 text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:text-purple-300"
                        title="Abrir formulário avançado com as atividades selecionadas"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                        Avançado
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={bulkApplying}
                        onClick={() => {
                          setSelectedActivityIds([])
                          setBulkApproverType('focal_point')
                          setBulkFpIds([])
                          setBulkInternalIds([])
                        }}
                        className="text-xs h-9 text-slate-500 hover:text-slate-800"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Limpar seleção
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <CardHeader className="p-4 pb-3 border-b bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span>Atividades do Catálogo — {selectedCompany?.trade_name || 'Empresa'}</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Defina diretamente para cada linha quem será o responsável por aprovar: escolha
                    um Ponto Focal cadastrado no cliente ou um Aprovador Interno TI.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Badge variant="outline" className="bg-white">
                    {companyConfigs.length} atividade(s) com aprovação ativa
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          filteredActivities.length > 0 &&
                          filteredActivities.every((a) => selectedActivityIds.includes(a.id))
                        }
                        onCheckedChange={toggleSelectAllActivities}
                        disabled={!canManage || filteredActivities.length === 0}
                        aria-label="Selecionar todas as atividades"
                      />
                    </TableHead>
                    <TableHead className="w-[320px]">Atividade / Subatividade</TableHead>
                    <TableHead className="w-[140px]">Tipo de Aprovador</TableHead>
                    <TableHead className="min-w-[280px]">
                      Aprovador Responsável (Ponto Focal ou Interno)
                    </TableHead>
                    <TableHead className="w-[120px] text-center">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                        Nenhuma atividade encontrada com o termo pesquisado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActivities.map((act) => {
                      const row = rowStates[act.id] || emptyRow(act.id)

                      // Primeiros selecionados (para exibição de contato)
                      const selectedFp =
                        row.approverType === 'focal_point'
                          ? companyFocalPoints.find((c) => c.id === row.selectedFpIds?.[0])
                          : null
                      const selectedOp =
                        row.approverType === 'internal_user'
                          ? internalOperators.find((u) => u.id === row.selectedInternalIds?.[0])
                          : null

                      return (
                        <TableRow
                          key={act.id}
                          className={`text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                            row.isDirty ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                          }`}
                        >
                          {/* Coluna 0: Checkbox de seleção para aprovação em massa */}
                          <TableCell className="w-[50px]">
                            <Checkbox
                              checked={selectedActivityIds.includes(act.id)}
                              onCheckedChange={() => toggleActivitySelection(act.id)}
                              disabled={!canManage}
                              aria-label={`Selecionar atividade ${act.fullName}`}
                            />
                          </TableCell>

                          {/* Coluna 1: Atividade */}
                          <TableCell className="font-medium">
                            <div className="text-slate-900 dark:text-slate-100 font-semibold">
                              {act.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {act.isSub ? `Subatividade de ${act.parentName}` : 'Atividade Direta'}
                            </div>
                          </TableCell>

                          {/* Coluna 2: Tipo de Aprovador */}
                          <TableCell>
                            {canManage ? (
                              <Select
                                value={row.approverType}
                                onValueChange={(val) => handleRowTypeChange(act.id, val)}
                                disabled={row.saving}
                              >
                                <SelectTrigger
                                  className={`h-8 text-[11px] w-[130px] ${
                                    row.approverType === 'focal_point'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                                      : row.approverType === 'internal_user'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                                        : 'bg-slate-50 text-slate-400 border-slate-200'
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                  <SelectItem value="none">Sem Aprovação</SelectItem>
                                  <SelectItem value="focal_point">Ponto Focal</SelectItem>
                                  <SelectItem value="internal_user">Interno TI</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : row.approverType === 'focal_point' ? (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold"
                              >
                                Ponto Focal
                              </Badge>
                            ) : row.approverType === 'internal_user' ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold"
                              >
                                Interno TI
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-slate-50 text-slate-400 border-slate-200 text-[10px]"
                              >
                                Sem Aprovação
                              </Badge>
                            )}
                          </TableCell>

                          {/* Coluna 3: Aprovadores (multi-seleção — regra "basta um") */}
                          <TableCell>
                            {row.approverType === 'none' ? (
                              <span className="text-[11px] text-slate-400 italic">
                                Sem aprovação obrigatória
                              </span>
                            ) : row.approverType === 'focal_point' ? (
                              <MultiSelect
                                options={companyFocalPoints.map((fp) => ({
                                  value: fp.id,
                                  label: `${fp.full_name}${fp.is_focal_point ? ' [Ponto Focal]' : ''}`,
                                }))}
                                value={row.selectedFpIds || []}
                                onChange={(ids) => setRowState(act.id, { selectedFpIds: ids })}
                                disabled={!canManage || row.saving}
                                placeholder="Selecionar ponto(s) focal(is)..."
                              />
                            ) : (
                              <MultiSelect
                                options={internalOperators.map((op) => ({
                                  value: op.id,
                                  label: `${op.name} (${op.email})`,
                                }))}
                                value={row.selectedInternalIds || []}
                                onChange={(ids) =>
                                  setRowState(act.id, { selectedInternalIds: ids })
                                }
                                disabled={!canManage || row.saving}
                                placeholder="Selecionar aprovador(es) interno(s)..."
                              />
                            )}

                            {/* Detalhe do primeiro contato selecionado */}
                            {selectedFp && (
                              <p className="text-[11px] text-purple-700 mt-1 truncate">
                                1º: {selectedFp.email || 'Não informado'}
                                {selectedFp.cell_phone ? ` | Cel: ${selectedFp.cell_phone}` : ''}
                              </p>
                            )}
                            {selectedOp && (
                              <p className="text-[11px] text-blue-700 mt-1 truncate">
                                1º: {selectedOp.email} | Perfil: {selectedOp.role}
                              </p>
                            )}
                          </TableCell>

                          {/* Coluna 4: Status / Ativo */}
                          <TableCell className="text-center">
                            {row.approverType !== 'none' ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold ${
                                  row.active
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {row.active ? 'Ativa' : 'Inativa'}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-slate-400">Livre</span>
                            )}
                          </TableCell>

                          {/* Coluna 5: Ação / Salvar */}
                          <TableCell className="text-right">
                            {canManage && (
                              <div className="flex items-center justify-end gap-1">
                                {row.isDirty ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveRow(act.id)}
                                    disabled={row.saving}
                                    className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white font-medium"
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    {row.saving ? 'Salvando...' : 'Salvar'}
                                  </Button>
                                ) : row.configId ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                                    onClick={() => {
                                      const cfg = configs.find((c) => c.id === row.configId)
                                      if (cfg) {
                                        setEditingConfig(cfg)
                                        setDialogOpen(true)
                                      }
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-1" /> Detalhes
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 2: FILA DE PENDÊNCIAS */}
        <TabsContent value="pending" className="space-y-4 m-0">
          <Card className="bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <TableHead className="w-28">Chamado</TableHead>
                  <TableHead>Assunto / Solicitação</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Aprovador Responsável</TableHead>
                  <TableHead>Status Chamado</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead className="text-right">Decisão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                      <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2 opacity-70" />
                      Nenhuma solicitação de aprovação pendente no momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingApprovals.map((app) => {
                    const tkt = app.expand?.ticket
                    const targetName =
                      app.expand?.target_contact?.full_name ||
                      app.expand?.approver?.name ||
                      app.target_email ||
                      'Não identificado'
                    const isInternal =
                      app.approval_role === 'internal' ||
                      (!app.approval_role && !app.target_contact && !!app.approver)

                    return (
                      <TableRow key={app.id} className="text-xs">
                        <TableCell className="font-bold text-amber-600">
                          {tkt?.id ? (
                            <Link to={`/tickets/${tkt.id}`} className="hover:underline">
                              #{tkt.number}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 dark:text-slate-100 line-clamp-1">
                            {tkt?.title || 'Sem título'}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {app.justification || tkt?.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              isInternal
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40'
                                : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40'
                            }`}
                          >
                            {isInternal ? 'Interna (TI)' : 'Cliente (Ponto Focal)'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {targetName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {app.expand?.target_contact?.email ||
                              app.expand?.approver?.email ||
                              app.target_email ||
                              ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300"
                          >
                            {tkt?.status || 'Aguardando Aprovação'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {new Date(app.created).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {canDecide ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                onClick={() => handleOpenDecision(app, 'approved')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                onClick={() => handleOpenDecision(app, 'rejected')}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Recusar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Somente leitura</span>
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

        {/* ABA 3: HISTÓRICO GERAL */}
        <TabsContent value="history" className="space-y-4 m-0">
          <Card className="bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <TableHead className="w-28">Chamado</TableHead>
                  <TableHead>Assunto / Solicitação</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Aprovador Destinado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead className="text-right">Decisão Registrada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalsHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      Nenhuma solicitação de aprovação encontrada no histórico.
                    </TableCell>
                  </TableRow>
                ) : (
                  approvalsHistory.map((app) => {
                    const tkt = app.expand?.ticket
                    const targetName =
                      app.expand?.target_contact?.full_name ||
                      app.expand?.approver?.name ||
                      app.target_email ||
                      'Não identificado'

                    return (
                      <TableRow key={app.id} className="text-xs">
                        <TableCell className="font-bold text-amber-600">
                          {tkt?.id ? (
                            <Link to={`/tickets/${tkt.id}`} className="hover:underline">
                              #{tkt.number}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 dark:text-slate-100 line-clamp-1">
                            {tkt?.title || 'Sem título'}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {app.justification || tkt?.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {app.approval_role === 'internal'
                              ? 'Interna TI'
                              : 'Cliente (Ponto Focal)'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{targetName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              app.status === 'Aprovado'
                                ? 'bg-green-50 text-green-700 border-green-300'
                                : app.status === 'Reprovado'
                                  ? 'bg-red-50 text-red-700 border-red-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {new Date(app.created).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right text-slate-600">
                          {app.status === 'Pendente' ? (
                            <span className="text-amber-600 font-medium">Aguardando</span>
                          ) : (
                            <div className="text-[11px]">
                              <span>{app.status}</span>
                              {app.rejection_reason && (
                                <p className="text-[10px] text-red-600 truncate max-w-[180px] ml-auto">
                                  {app.rejection_reason}
                                </p>
                              )}
                            </div>
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

      {/* MODAL DE CONFIRMAÇÃO DE APLICAÇÃO EM MASSA */}
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              Confirmar Aplicação em Massa
            </DialogTitle>
            <DialogDescription className="text-xs">
              Você está prestes a atualizar as regras de aprovação para{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {selectedActivityIds.length} atividade(s)
              </strong>{' '}
              da empresa{' '}
              <strong className="text-slate-800 dark:text-slate-100">
                {selectedCompany?.trade_name || 'selecionada'}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-1">
              <div className="font-semibold text-purple-900 dark:text-purple-200">
                Aprovador(es) a serem definidos (regra &quot;basta um&quot;):
              </div>
              <div className="text-purple-800 dark:text-purple-300 space-y-0.5">
                {(() => {
                  const bulkFps =
                    bulkApproverType === 'focal_point' ? bulkFpIds.filter(Boolean) : []
                  const bulkInternals =
                    bulkApproverType === 'internal_user' ? bulkInternalIds.filter(Boolean) : []

                  const fpNames = bulkFps.map((fpId) => {
                    const fp = companyFocalPoints.find((c) => c.id === fpId)
                    return fp
                      ? `Ponto Focal: ${fp.full_name} (${fp.email || 'sem e-mail'})`
                      : 'Ponto Focal Selecionado'
                  })
                  const internalNames = bulkInternals.map((uId) => {
                    const u = internalOperators.find((op) => op.id === uId)
                    return u
                      ? `Aprovador Interno TI: ${u.name} (${u.email})`
                      : 'Aprovador Interno Selecionado'
                  })

                  const names = [...fpNames, ...internalNames]
                  if (names.length === 0) return 'Nenhum'
                  return names.map((n, i) => <div key={i}>• {n}</div>)
                })()}
              </div>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border rounded p-2 bg-slate-50 dark:bg-slate-900">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">
                Atividades que receberão esta regra:
              </div>
              {selectedActivityIds.map((actId) => {
                const act = catalogActivities.find((a) => a.id === actId)
                return (
                  <div
                    key={actId}
                    className="text-[11px] text-slate-700 dark:text-slate-300 truncate"
                  >
                    • {act?.fullName || actId}
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-slate-500">
              Esta ação gravará diretamente cada configuração na base de regras e atualizará a
              matriz automaticamente.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkConfirmOpen(false)}
              disabled={bulkApplying}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleApplyBulkApprover}
              disabled={bulkApplying}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {bulkApplying ? 'Aplicando Regras...' : 'Confirmar e Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIGURAÇÃO DE REGRA */}
      <ApprovalConfigDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open && selectedActivityIds.length > 0 && !editingConfig) {
            // mantém ou limpa conforme fechamento
          }
        }}
        onSaved={() => {
          loadData()
          setSelectedActivityIds([])
          setBulkApproverType('focal_point')
          setBulkFpIds([])
          setBulkInternalIds([])
        }}
        editingConfig={editingConfig}
        defaultCompanyId={selectedCompanyId}
        initialActivityIds={editingConfig ? undefined : selectedActivityIds}
      />

      {/* MODAL DE DECISÃO DE APROVAÇÃO (APROVAR / RECUSAR) */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionAction === 'approved' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Autorizar Aprovação do Chamado
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Recusar Aprovação do Chamado
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chamado #{selectedApproval?.expand?.ticket?.number} -{' '}
              {selectedApproval?.expand?.ticket?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {decisionAction === 'rejected' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-red-700">
                  Motivo da Reprovação (Obrigatório) *
                </Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explique o motivo da reprovação para o solicitante..."
                  rows={3}
                  className="text-xs border-red-200 focus-visible:ring-red-400"
                />
              </div>
            )}

            {decisionAction === 'approved' && (
              <p className="text-xs text-slate-600">
                Ao autorizar, esta solicitação de aprovação será marcada como atendida. Se todas as
                aprovações forem concluídas, o chamado será liberado para a fila de atendimento.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDecisionModalOpen(false)}
              disabled={deciding}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDecision}
              disabled={deciding}
              className={
                decisionAction === 'approved'
                  ? 'bg-green-600 hover:bg-green-700 text-white font-semibold'
                  : 'bg-red-600 hover:bg-red-700 text-white font-semibold'
              }
            >
              {deciding
                ? 'Processando...'
                : decisionAction === 'approved'
                  ? 'Confirmar Aprovação'
                  : 'Confirmar Reprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
