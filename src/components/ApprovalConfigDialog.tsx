import { useEffect, useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ApprovalConfigRecord,
  ApprovalMode,
  ApproverType,
  createApprovalConfig,
  updateApprovalConfig,
} from '@/services/approval-configs'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getAllClientContacts, ClientContactRecord } from '@/services/client-contacts'
import { getOperators } from '@/services/operators'
import { useToast } from '@/hooks/use-toast'
import { ShieldCheck, Building2, ListTree, UserCheck, Clock, AlertTriangle } from 'lucide-react'

interface ApprovalConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingConfig?: ApprovalConfigRecord | null
  defaultCompanyId?: string
}

export function ApprovalConfigDialog({
  open,
  onOpenChange,
  onSaved,
  editingConfig,
  defaultCompanyId,
}: ApprovalConfigDialogProps) {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [internalOperators, setInternalOperators] = useState<any[]>([])

  // 1. Empresa selecionada no topo
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')

  // 2. Atividade do catálogo
  const [activityId, setActivityId] = useState<string>('')

  // 3. Tipo de aprovador: 'focal_point' ou 'internal_user'
  const [approverType, setApproverType] = useState<ApproverType>('focal_point')
  const [approverFocalPointId, setApproverFocalPointId] = useState<string>('')
  const [approverUserId, setApproverUserId] = useState<string>('')

  // Configurações complementares
  const [mode, setMode] = useState<ApprovalMode>('Individual')
  const [escalationTimeoutMinutes, setEscalationTimeoutMinutes] = useState<number>(60)
  const [description, setDescription] = useState<string>('')
  const [active, setActive] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)

  // Carrega opções de empresas, atividades, contatos e operadores
  useEffect(() => {
    if (!open) return
    Promise.all([
      getCategories(),
      getCompanies('status = "Ativo"'),
      getAllClientContacts(),
      getOperators({}),
    ])
      .then(([cats, comps, conts, ops]) => {
        setCategories(cats || [])
        setCompanies(comps || [])
        setContacts(conts || [])
        const eligible = (ops || []).filter((u: any) =>
          ['admin', 'gestor', 'tecnico', 'operador'].includes(u.role),
        )
        setInternalOperators(eligible)
      })
      .catch(() => {})
  }, [open])

  // Preenche dados ao abrir/editar
  useEffect(() => {
    if (!open) return

    if (editingConfig) {
      const compId =
        editingConfig.company ||
        (Array.isArray(editingConfig.clients) && editingConfig.clients.length > 0
          ? editingConfig.clients[0]
          : '') ||
        defaultCompanyId ||
        ''
      setSelectedCompanyId(compId)
      setActivityId(editingConfig.activity || '')

      const initialType: ApproverType =
        editingConfig.approver_type ||
        (editingConfig.approver_focal_point ||
        (Array.isArray(editingConfig.focal_points) && editingConfig.focal_points.length > 0)
          ? 'focal_point'
          : 'internal_user')
      setApproverType(initialType)

      setApproverFocalPointId(
        editingConfig.approver_focal_point ||
          (Array.isArray(editingConfig.focal_points) && editingConfig.focal_points.length > 0
            ? editingConfig.focal_points[0]
            : ''),
      )

      setApproverUserId(
        editingConfig.approver_user ||
          (Array.isArray(editingConfig.internal_approvers) &&
          editingConfig.internal_approvers.length > 0
            ? editingConfig.internal_approvers[0]
            : ''),
      )

      setMode(editingConfig.mode || 'Individual')
      setEscalationTimeoutMinutes(editingConfig.escalation_timeout_minutes || 60)
      setDescription(editingConfig.description || '')
      setActive(editingConfig.active !== false)
    } else {
      setSelectedCompanyId(defaultCompanyId || '')
      setActivityId('')
      setApproverType('focal_point')
      setApproverFocalPointId('')
      setApproverUserId('')
      setMode('Individual')
      setEscalationTimeoutMinutes(60)
      setDescription('')
      setActive(true)
    }
  }, [editingConfig, open, defaultCompanyId])

  // Árvore de atividades do catálogo
  const activityOptions = useMemo(() => {
    const parentMap: Record<string, string> = {}
    categories.forEach((c) => {
      parentMap[c.id] = c.name
    })

    return categories
      .map((c) => ({
        id: c.id,
        name: c.parent ? `${parentMap[c.parent] || 'Atividade Principal'} → ${c.name}` : c.name,
        isSub: !!c.parent,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  // Pontos focais filtrados EXCLUSIVAMENTE pela empresa selecionada no topo
  const companyFocalPoints = useMemo(() => {
    if (!selectedCompanyId) return []
    return contacts.filter((c) => c.client === selectedCompanyId)
  }, [contacts, selectedCompanyId])

  // Nome da empresa selecionada para exibição contextual
  const selectedCompanyName = useMemo(() => {
    const comp = companies.find((c) => c.id === selectedCompanyId)
    return comp ? comp.trade_name || comp.legal_name || comp.code || 'Empresa' : ''
  }, [companies, selectedCompanyId])

  // Se trocar a empresa e o ponto focal selecionado não pertencer a ela, reseta o ponto focal
  useEffect(() => {
    if (selectedCompanyId && approverFocalPointId) {
      const exists = companyFocalPoints.some((c) => c.id === approverFocalPointId)
      if (!exists) {
        setApproverFocalPointId('')
      }
    }
  }, [selectedCompanyId, companyFocalPoints, approverFocalPointId])

  const handleSave = async () => {
    if (!selectedCompanyId) {
      toast({
        title: 'Selecione a empresa',
        description: 'Primeiramente selecione a empresa a qual a regra de aprovação se aplica.',
        variant: 'destructive',
      })
      return
    }

    if (!activityId) {
      toast({
        title: 'Selecione a atividade',
        description: 'Escolha a atividade do catálogo sujeita a aprovação.',
        variant: 'destructive',
      })
      return
    }

    if (approverType === 'focal_point' && !approverFocalPointId) {
      toast({
        title: 'Selecione o ponto focal',
        description:
          'Selecione qual ponto focal cadastrado no cliente será responsável por aprovar a atividade.',
        variant: 'destructive',
      })
      return
    }

    if (approverType === 'internal_user' && !approverUserId) {
      toast({
        title: 'Selecione o aprovador interno',
        description: 'Selecione um usuário interno responsável por aprovar esta atividade.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const focalPointsArray =
        approverType === 'focal_point' && approverFocalPointId ? [approverFocalPointId] : []
      const internalApproversArray =
        approverType === 'internal_user' && approverUserId ? [approverUserId] : []

      const payload: Partial<ApprovalConfigRecord> = {
        company: selectedCompanyId,
        clients: [selectedCompanyId],
        activity: activityId,
        approver_type: approverType,
        approver_focal_point: approverType === 'focal_point' ? approverFocalPointId : null,
        approver_user: approverType === 'internal_user' ? approverUserId : null,
        focal_points: focalPointsArray,
        internal_approvers: internalApproversArray,
        require_client_approval: approverType === 'focal_point',
        require_internal_approval: approverType === 'internal_user',
        mode,
        escalation_timeout_minutes: Number(escalationTimeoutMinutes) || 60,
        description,
        active,
      }

      if (editingConfig) {
        await updateApprovalConfig(editingConfig.id, payload)
        toast({ title: 'Regra de aprovação da atividade atualizada com sucesso!' })
      } else {
        await createApprovalConfig(payload)
        toast({ title: 'Regra de aprovação cadastrada com sucesso!' })
      }

      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar regra',
        description: err?.message || 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            {editingConfig ? 'Editar Aprovador da Atividade' : 'Definir Aprovador por Atividade'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione a empresa no topo, a atividade do catálogo e quem será o aprovador responsável
            (ponto focal cadastrado no cliente ou aprovador interno de contingência).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1. SELEÇÃO DA EMPRESA NO TOPO (Item 1 do pedido) */}
          <div className="p-3.5 rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
            <Label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              1. Selecionar Empresa / Cliente *
            </Label>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
              Primeiramente selecione a empresa. Todo o restante desta regra e os pontos focais
              disponíveis serão relativos a ela.
            </p>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-white dark:bg-slate-900 font-medium">
                <SelectValue placeholder="Selecione a empresa cliente..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {companies.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.trade_name || comp.legal_name || comp.code}
                    {comp.document ? ` (${comp.document})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. ATIVIDADE DO CATÁLOGO (Item 2 do pedido) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <ListTree className="h-4 w-4 text-slate-500" />
              2. Atividade do Catálogo de Serviços *
            </Label>
            <p className="text-[11px] text-slate-500">
              A unidade de aprovação é a atividade selecionada na abertura do chamado (subcategoria
              ou atividade principal).
            </p>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger className="bg-white dark:bg-slate-900">
                <SelectValue placeholder="Selecione a atividade do catálogo..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {activityOptions.map((act) => (
                  <SelectItem key={act.id} value={act.id}>
                    {act.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. QUEM APROVA A ATIVIDADE (Item 3 do pedido: Ponto Focal ou Aprovador Interno) */}
          <div className="space-y-3 rounded-lg border p-3.5 bg-slate-50/70 dark:bg-slate-800/40">
            <div>
              <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-blue-600" />
                3. Responsável por Aprovar Esta Atividade
              </Label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Escolha quem dos pontos focais cadastrados será responsável por aprovar a atividade,
                ou indique um aprovador interno caso não seja possível um ponto focal.
              </p>
            </div>

            <RadioGroup
              value={approverType}
              onValueChange={(v) => setApproverType(v as ApproverType)}
              className="grid sm:grid-cols-2 gap-2.5 pt-1"
            >
              <div
                className={`flex items-start space-x-2.5 p-3 rounded-md border cursor-pointer transition-colors ${
                  approverType === 'focal_point'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setApproverType('focal_point')}
              >
                <RadioGroupItem value="focal_point" id="type-focal-point" className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="type-focal-point"
                    className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-slate-100"
                  >
                    Ponto Focal do Cliente
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Contatos cadastrados no cliente selecionado
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start space-x-2.5 p-3 rounded-md border cursor-pointer transition-colors ${
                  approverType === 'internal_user'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => setApproverType('internal_user')}
              >
                <RadioGroupItem value="internal_user" id="type-internal-user" className="mt-0.5" />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="type-internal-user"
                    className="text-xs font-semibold cursor-pointer text-slate-900 dark:text-slate-100"
                  >
                    Aprovador Interno TI
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Usuário interno da equipe (gestor/operador)
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* SELEÇÃO DO PONTO FOCAL */}
            {approverType === 'focal_point' && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Ponto Focal Responsável ({selectedCompanyName || 'Empresa não selecionada'}) *
                </Label>

                {!selectedCompanyId ? (
                  <div className="p-2.5 rounded border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Selecione primeiro a empresa no topo para listar seus pontos focais.
                  </div>
                ) : companyFocalPoints.length === 0 ? (
                  <div className="p-3 rounded border border-amber-200 bg-amber-50 text-amber-900 text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                      Nenhum ponto focal cadastrado para {selectedCompanyName}.
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Você pode cadastrar contatos no cliente ou escolher a opção{' '}
                      <strong>"Aprovador Interno TI"</strong> acima como responsável por esta
                      atividade.
                    </p>
                  </div>
                ) : (
                  <Select value={approverFocalPointId} onValueChange={setApproverFocalPointId}>
                    <SelectTrigger className="bg-white dark:bg-slate-900 font-medium">
                      <SelectValue placeholder="Selecione quem aprova esta atividade..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {companyFocalPoints.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.full_name} ({contact.email || 'sem e-mail'})
                          {contact.is_focal_point ? ' [Ponto Focal]' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* SELEÇÃO DO APROVADOR INTERNO */}
            {approverType === 'internal_user' && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Aprovador Interno Responsável (Usuário TI) *
                </Label>
                <Select value={approverUserId} onValueChange={setApproverUserId}>
                  <SelectTrigger className="bg-white dark:bg-slate-900 font-medium">
                    <SelectValue placeholder="Selecione o usuário interno que aprova..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {internalOperators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name} ({op.email}) — Perfil:{' '}
                        {op.role === 'admin'
                          ? 'Administrador'
                          : op.role === 'gestor'
                            ? 'Gestão'
                            : 'Operador'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Configurações Adicionais: Tempo e Observações */}
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Prazo Limite para Decisão (Minutos)
              </Label>
              <Select
                value={String(escalationTimeoutMinutes)}
                onValueChange={(v) => setEscalationTimeoutMinutes(Number(v))}
              >
                <SelectTrigger className="bg-white dark:bg-slate-900 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora (60 min)</SelectItem>
                  <SelectItem value="120">2 horas (120 min)</SelectItem>
                  <SelectItem value="240">4 horas (240 min)</SelectItem>
                  <SelectItem value="480">8 horas (480 min)</SelectItem>
                  <SelectItem value="1440">24 horas (1 dia)</SelectItem>
                  <SelectItem value="2880">48 horas (2 dias)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observação / Justificativa</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Política da empresa para esta atividade..."
                rows={1}
                className="text-xs min-h-[38px] bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/40">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Regra da Atividade Ativa
              </p>
              <p className="text-[11px] text-slate-500">
                Se desativada, novos chamados desta atividade não solicitarão aprovação.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {saving ? 'Salvando...' : editingConfig ? 'Atualizar Regra' : 'Salvar Regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
