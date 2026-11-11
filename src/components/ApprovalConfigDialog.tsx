import { useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { MultiSelect } from '@/components/MultiSelect'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  createApprovalConfig,
  updateApprovalConfig,
  getFocalPointsAll,
  getInternalApproversAll,
  type ApprovalConfigRecord,
  type ApproverType,
} from '@/services/approval-configs'
import { getCompanies } from '@/services/companies'
import { getCategories } from '@/services/categories'

interface CompanyOption {
  id: string
  name: string
}

interface ActivityOption {
  id: string
  name: string
}

interface ApprovalConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado pela página após salvar, para recarregar a matriz */
  onSaved?: () => void
  /** Regra em edição (null = nova regra) */
  editingConfig?: ApprovalConfigRecord | null
  /** Empresa pré-selecionada pela matriz (não editável) */
  defaultCompanyId?: string
  /** Atividades selecionadas em massa na matriz (cria uma regra por atividade) */
  initialActivityIds?: string[]
}

interface ClientContact {
  id: string
  full_name?: string
  name?: string
  email?: string
  is_focal_point?: boolean
}

interface AppUser {
  id: string
  name?: string
  email?: string
  role?: string
  team?: string
}

export function ApprovalConfigDialog({
  open,
  onOpenChange,
  onSaved,
  editingConfig = null,
  defaultCompanyId = '',
  initialActivityIds,
}: ApprovalConfigDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [activities, setActivities] = useState<ActivityOption[]>([])

  const [companyId, setCompanyId] = useState('')
  const [activityId, setActivityId] = useState('')
  const [mode, setMode] = useState<'Individual' | 'Sequencial' | 'Paralela'>('Individual')
  const [timeoutMinutes, setTimeoutMinutes] = useState(60)
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [approverType, setApproverType] = useState<ApproverType>('focal_point')
  const [focalPointsAll, setFocalPointsAll] = useState<string[]>([])
  const [internalApproversAll, setInternalApproversAll] = useState<string[]>([])
  const [requireClientApproval, setRequireClientApproval] = useState(false)
  const [requireInternalApproval, setRequireInternalApproval] = useState(false)

  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loadingPeople, setLoadingPeople] = useState(false)

  const bulkActivityIds = useMemo(
    () => (!editingConfig && initialActivityIds?.length ? initialActivityIds : []),
    [editingConfig, initialActivityIds],
  )

  // Carrega empresas e atividades do catálogo
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      getCompanies('status = "Ativo"').catch(() => []),
      getCategories().catch(() => []),
    ]).then(([comps, cats]) => {
      if (cancelled) return
      setCompanies(
        (comps || []).map((c: any) => ({
          id: c.id,
          name: c.trade_name || c.legal_name || c.code || c.id,
        })),
      )
      setActivities((cats || []).map((c: any) => ({ id: c.id, name: c.name || c.id })))
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Popula o formulário ao abrir (edição) ou limpa (nova regra)
  useEffect(() => {
    if (!open) return
    if (editingConfig) {
      const cfg = editingConfig
      const focalAll = getFocalPointsAll(cfg)
      const internalAll = getInternalApproversAll(cfg)
      setCompanyId(cfg.company || defaultCompanyId || '')
      setActivityId(cfg.activity || '')
      setMode((cfg.mode as 'Individual' | 'Sequencial' | 'Paralela') || 'Individual')
      setTimeoutMinutes(cfg.escalation_timeout_minutes ?? 60)
      setDescription(cfg.description || '')
      setActive(cfg.active ?? true)
      setApproverType((cfg.approver_type as ApproverType) || 'focal_point')
      setFocalPointsAll(focalAll)
      setInternalApproversAll(internalAll)
      setRequireClientApproval(!!cfg.require_client_approval)
      setRequireInternalApproval(!!cfg.require_internal_approval)
    } else {
      setCompanyId(defaultCompanyId || '')
      setActivityId('')
      setMode('Individual')
      setTimeoutMinutes(60)
      setDescription('')
      setActive(true)
      setApproverType('focal_point')
      setFocalPointsAll([])
      setInternalApproversAll([])
      setRequireClientApproval(false)
      setRequireInternalApproval(false)
    }
  }, [open, editingConfig, defaultCompanyId])

  // Carrega pontos focais da empresa selecionada + usuários internos (aprovadores)
  useEffect(() => {
    if (!open || !companyId) {
      setContacts([])
      return
    }
    let cancelled = false
    setLoadingPeople(true)

    const loadContacts = pb
      .collection('client_contacts')
      .getFullList<ClientContact>({
        filter: `client = "${companyId}"`,
        sort: 'full_name',
      })
      .catch(() => [] as ClientContact[])

    const loadUsers = pb
      .collection('users')
      .getFullList<AppUser>({
        filter: 'role = "admin" || role = "gestor" || role = "operador"',
        sort: 'name',
      })
      .catch(() => [] as AppUser[])

    Promise.all([loadContacts, loadUsers]).then(([cts, us]) => {
      if (cancelled) return
      setContacts(cts || [])
      setUsers(us || [])
      setLoadingPeople(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, companyId])

  // Remove das listas selecionadas aprovadores que deixaram de existir nas opções
  useEffect(() => {
    setFocalPointsAll((prev) => prev.filter((id) => contacts.some((c) => c.id === id)))
  }, [contacts])
  useEffect(() => {
    setInternalApproversAll((prev) => prev.filter((id) => users.some((u) => u.id === id)))
  }, [users])

  const focalOptions = useMemo(
    () =>
      contacts.map((c) => ({
        value: c.id,
        label: `${c.full_name || c.name || 'Contato'}${c.email ? ` (${c.email})` : ''}`,
      })),
    [contacts],
  )

  const internalOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.name || u.email || 'Usuário'}${u.team ? ` — ${u.team}` : ''}`,
      })),
    [users],
  )

  const selectedLabels = useMemo(() => {
    const focal = focalPointsAll.map(
      (id) => focalOptions.find((o) => o.value === id)?.label || 'Ponto focal',
    )
    const internal = internalApproversAll.map(
      (id) => internalOptions.find((o) => o.value === id)?.label || 'Aprovador interno',
    )
    return { focal, internal }
  }, [focalPointsAll, internalApproversAll, focalOptions, internalOptions])

  const buildPayload = (actId: string): Partial<ApprovalConfigRecord> => ({
    company: companyId,
    clients: [companyId],
    activity: actId,
    mode,
    escalation_timeout_minutes: Number(timeoutMinutes) || 60,
    description,
    active,
    approver_type: approverType,
    // Listas multi-valoradas (regra "basta um", migração 0163)
    focal_points_all: approverType === 'focal_point' ? focalPointsAll : [],
    internal_approvers_all: approverType === 'internal_user' ? internalApproversAll : [],
    // Compatibilidade: o primeiro de cada lista é mantido no campo único legado
    approver_focal_point: approverType === 'focal_point' ? focalPointsAll[0] || '' : '',
    approver_user: approverType === 'internal_user' ? internalApproversAll[0] || '' : '',
    focal_points: approverType === 'focal_point' ? focalPointsAll : [],
    internal_approvers: approverType === 'internal_user' ? internalApproversAll : [],
    require_client_approval: requireClientApproval,
    require_internal_approval: requireInternalApproval,
  })

  const handleSave = async () => {
    if (!companyId) {
      toast({
        title: 'Selecione a empresa',
        description: 'A regra de aprovação precisa de uma empresa vinculada.',
        variant: 'destructive',
      })
      return
    }
    if (!editingConfig && !activityId && bulkActivityIds.length === 0) {
      toast({
        title: 'Selecione a atividade',
        description: 'A regra de aprovação precisa de uma atividade do catálogo.',
        variant: 'destructive',
      })
      return
    }
    if (approverType === 'focal_point' && focalPointsAll.length === 0) {
      toast({
        title: 'Selecione pelo menos um ponto focal',
        description: 'Marque um ou mais pontos focais da empresa selecionada.',
        variant: 'destructive',
      })
      return
    }
    if (approverType === 'internal_user' && internalApproversAll.length === 0) {
      toast({
        title: 'Selecione pelo menos um aprovador interno',
        description: 'Marque um ou mais aprovadores internos (TI).',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const targetActivities =
        !editingConfig && bulkActivityIds.length > 0 ? bulkActivityIds : [activityId]

      let successCount = 0
      let failCount = 0
      let lastError: unknown = null

      for (const actId of targetActivities) {
        const existing = !editingConfig
          ? await pb
              .collection('approval_configs')
              .getFirstListItem<ApprovalConfigRecord>(
                `company = "${companyId}" && activity = "${actId}"`,
              )
              .catch(() => null)
          : null

        try {
          if (editingConfig) {
            await updateApprovalConfig(editingConfig.id, buildPayload(actId))
          } else if (existing) {
            await updateApprovalConfig(existing.id, buildPayload(actId))
          } else {
            await createApprovalConfig(buildPayload(actId))
          }
          successCount++
        } catch (err) {
          lastError = err
          failCount++
        }
      }

      if (successCount === 0) {
        const message =
          lastError instanceof Error ? lastError.message : 'Erro ao salvar a regra de aprovação.'
        throw new Error(message)
      }

      toast({
        title: editingConfig ? 'Regra atualizada' : 'Regra criada',
        description:
          targetActivities.length > 1
            ? `${successCount} atividade(s) salva(s) com múltiplos aprovadores.`
            : 'Aprovação salva com múltiplos aprovadores.',
      })
      onSaved?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar a regra de aprovação.'
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? 'Editar Regra de Aprovação' : 'Nova Regra de Aprovação'}
          </DialogTitle>
          <DialogDescription>
            Regra &quot;basta um&quot;: todos os aprovadores selecionados recebem a pendência e a
            PRIMEIRA decisão (aprovação ou reprovação) resolve o chamado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Empresa</Label>
              <Select
                value={companyId}
                onValueChange={(v) => {
                  setCompanyId(v)
                  setFocalPointsAll([])
                }}
                disabled={!!defaultCompanyId || !!editingConfig}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Atividade do catálogo</Label>
              {editingConfig ? (
                <Select value={activityId} onValueChange={setActivityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : bulkActivityIds.length > 0 ? (
                <div className="flex flex-wrap gap-1 min-h-9 items-center border rounded-md px-2 py-1.5 bg-muted/30">
                  {bulkActivityIds.slice(0, 4).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {activities.find((a) => a.id === id)?.name || id}
                    </Badge>
                  ))}
                  {bulkActivityIds.length > 4 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{bulkActivityIds.length - 4}
                    </Badge>
                  )}
                </div>
              ) : (
                <Select value={activityId} onValueChange={setActivityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Modo</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as 'Individual' | 'Sequencial' | 'Paralela')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Sequencial">Sequencial</SelectItem>
                  <SelectItem value="Paralela">Paralela</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="approval-timeout">Prazo de escalada (minutos)</Label>
              <Input
                id="approval-timeout"
                type="number"
                min={0}
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="approval-description">Descrição da regra</Label>
            <Input
              id="approval-description"
              placeholder="Ex.: Aprovação de backup mensal"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Tipo de aprovador</Label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={approverType === 'focal_point'}
                    onCheckedChange={(v) => {
                      if (v) {
                        setApproverType('focal_point')
                        setRequireClientApproval(true)
                        setRequireInternalApproval(false)
                      }
                    }}
                  />
                  Ponto focal (cliente)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={approverType === 'internal_user'}
                    onCheckedChange={(v) => {
                      if (v) {
                        setApproverType('internal_user')
                        setRequireInternalApproval(true)
                        setRequireClientApproval(false)
                      }
                    }}
                  />
                  Interno (TI)
                </label>
              </div>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Pontos focais da empresa</Label>
                {loadingPeople && approverType === 'focal_point' && (
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                )}
              </div>
              {approverType === 'focal_point' ? (
                !companyId ? (
                  <p className="text-xs text-muted-foreground">
                    Selecione a empresa para listar os pontos focais.
                  </p>
                ) : (
                  <MultiSelect
                    options={focalOptions}
                    value={focalPointsAll}
                    onChange={setFocalPointsAll}
                    placeholder="Selecionar um ou mais pontos focais..."
                  />
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Tipo de aprovador &quot;Interno (TI)&quot; — sem pontos focais.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Aprovadores internos (TI)</Label>
                {loadingPeople && approverType === 'internal_user' && (
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                )}
              </div>
              {approverType === 'internal_user' ? (
                <MultiSelect
                  options={internalOptions}
                  value={internalApproversAll}
                  onChange={setInternalApproversAll}
                  placeholder="Selecionar um ou mais aprovadores internos..."
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Tipo de aprovador &quot;Ponto focal (cliente)&quot; — sem aprovadores internos.
                </p>
              )}
            </div>

            {(selectedLabels.focal.length > 0 || selectedLabels.internal.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedLabels.focal.map((label) => (
                  <Badge
                    key={`fp-${label}`}
                    variant="outline"
                    className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200"
                  >
                    {label}
                  </Badge>
                ))}
                {selectedLabels.internal.map((label) => (
                  <Badge
                    key={`ia-${label}`}
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200"
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={requireClientApproval} onCheckedChange={setRequireClientApproval} />
              Exigir aprovação do cliente
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={requireInternalApproval}
                onCheckedChange={setRequireInternalApproval}
              />
              Exigir aprovação interna (TI)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={active} onCheckedChange={setActive} />
              Regra ativa
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className={cn('min-w-28')}>
            {saving ? 'Salvando...' : editingConfig ? 'Salvar alterações' : 'Criar regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
