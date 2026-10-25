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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  ApprovalConfigRecord,
  ApprovalMode,
  createApprovalConfig,
  updateApprovalConfig,
} from '@/services/approval-configs'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getAllClientContacts, ClientContactRecord } from '@/services/client-contacts'
import { getOperators } from '@/services/operators'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Trash2,
  ArrowDown,
  Users,
  ShieldCheck,
  Clock,
  Building2,
  ListTree,
} from 'lucide-react'

interface ApprovalConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingConfig?: ApprovalConfigRecord | null
}

export function ApprovalConfigDialog({
  open,
  onOpenChange,
  onSaved,
  editingConfig,
}: ApprovalConfigDialogProps) {
  const { toast } = useToast()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [internalOperators, setInternalOperators] = useState<any[]>([])

  const [activityId, setActivityId] = useState<string>('')
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [mode, setMode] = useState<ApprovalMode>('Individual')
  const [escalationTimeoutMinutes, setEscalationTimeoutMinutes] = useState<number>(60)
  const [focalPoints, setFocalPoints] = useState<string[]>([])
  const [internalApprovers, setInternalApprovers] = useState<string[]>([])
  const [description, setDescription] = useState<string>('')
  const [active, setActive] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)

  // Carrega opções do formulário
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
        // Filtra operadores com perfis Gestão, Administrador ou Helpdesk (tecnico/operador)
        const eligible = (ops || []).filter((u: any) =>
          ['admin', 'gestor', 'tecnico', 'operador'].includes(u.role),
        )
        setInternalOperators(eligible)
      })
      .catch(() => {})
  }, [open])

  // Preenche dados ao editar
  useEffect(() => {
    if (editingConfig) {
      setActivityId(editingConfig.activity || '')
      setSelectedClients(editingConfig.clients || [])
      setMode(editingConfig.mode || 'Individual')
      setEscalationTimeoutMinutes(editingConfig.escalation_timeout_minutes || 60)
      setFocalPoints(editingConfig.focal_points || [])
      setInternalApprovers(editingConfig.internal_approvers || [])
      setDescription(editingConfig.description || '')
      setActive(editingConfig.active !== false)
    } else {
      setActivityId('')
      setSelectedClients([])
      setMode('Individual')
      setEscalationTimeoutMinutes(60)
      setFocalPoints([])
      setInternalApprovers([])
      setDescription('')
      setActive(true)
    }
  }, [editingConfig, open])

  // Lista de atividades (subcategorias e categorias)
  const activityOptions = useMemo(() => {
    const parentMap: Record<string, string> = {}
    categories.forEach((c) => {
      parentMap[c.id] = c.name
    })

    return categories.map((c) => ({
      id: c.id,
      name: c.parent ? `${parentMap[c.parent] || 'Categoria'} → ${c.name}` : c.name,
      isSub: !!c.parent,
    }))
  }, [categories])

  // Contatos de pontos focais filtrados pelas empresas selecionadas (se houver seleção de empresas)
  const eligibleFocalPoints = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedClients.length > 0 && !selectedClients.includes(c.client)) {
        return false
      }
      return true
    })
  }, [contacts, selectedClients])

  const handleAddFocalPoint = (contactId: string) => {
    if (!contactId || focalPoints.includes(contactId)) return
    setFocalPoints([...focalPoints, contactId])
  }

  const handleRemoveFocalPoint = (contactId: string) => {
    setFocalPoints(focalPoints.filter((id) => id !== contactId))
  }

  const handleAddInternalApprover = (userId: string) => {
    if (!userId || internalApprovers.includes(userId)) return
    setInternalApprovers([...internalApprovers, userId])
  }

  const handleRemoveInternalApprover = (userId: string) => {
    setInternalApprovers(internalApprovers.filter((id) => id !== userId))
  }

  const handleToggleClient = (companyId: string) => {
    if (selectedClients.includes(companyId)) {
      setSelectedClients(selectedClients.filter((id) => id !== companyId))
    } else {
      setSelectedClients([...selectedClients, companyId])
    }
  }

  const handleSave = async () => {
    if (!activityId) {
      toast({
        title: 'Selecione a atividade',
        description: 'A regra de aprovação deve ser vinculada a uma atividade.',
        variant: 'destructive',
      })
      return
    }

    if (focalPoints.length === 0 && internalApprovers.length === 0) {
      toast({
        title: 'Adicione pelo menos um aprovador',
        description: 'Defina ao menos um ponto focal do cliente ou aprovador interno.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: Partial<ApprovalConfigRecord> = {
        activity: activityId,
        clients: selectedClients,
        mode,
        escalation_timeout_minutes: Number(escalationTimeoutMinutes) || 60,
        focal_points: focalPoints,
        internal_approvers: internalApprovers,
        description,
        active,
      }

      if (editingConfig) {
        await updateApprovalConfig(editingConfig.id, payload)
        toast({ title: 'Regra de aprovação atualizada com sucesso!' })
      } else {
        await createApprovalConfig(payload)
        toast({ title: 'Regra de aprovação criada com sucesso!' })
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            {editingConfig ? 'Editar Regra de Aprovação' : 'Nova Regra de Aprovação'}
          </DialogTitle>
          <DialogDescription>
            Configure para cada atividade o aprovador responsável, o modo de decisão e aprovadores
            internos de contingência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Atividade da Regra */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <ListTree className="h-4 w-4 text-slate-500" />
              Atividade Apontada no Chamado *
            </Label>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a atividade (Ex: Computador com lentidão)" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {activityOptions.map((act) => (
                  <SelectItem key={act.id} value={act.id}>
                    {act.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              Quando um chamado for aberto apontando esta atividade/subcategoria, a aprovação será
              solicitada automaticamente.
            </p>
          </div>

          {/* Modo de Aprovação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Modo de Aprovação *</Label>
            <Select value={mode} onValueChange={(v: ApprovalMode) => setMode(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Individual">Individual (um aprovador decide sozinho)</SelectItem>
                <SelectItem value="Sequencial">
                  Sequencial (1º principal; 2º e 3º entram como contingência se o 1º não aprovar em
                  tempo)
                </SelectItem>
                <SelectItem value="Paralela">
                  Paralela (todos recebem juntos; o primeiro que aprovar encerra)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prazo de Contingência (quando Sequencial) */}
          {mode === 'Sequencial' && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-700" />
                <Label className="text-xs font-bold text-amber-900">
                  Prazo de Espera antes do Escalonamento (Minutos)
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={escalationTimeoutMinutes}
                  onChange={(e) => setEscalationTimeoutMinutes(Number(e.target.value))}
                  className="w-32 bg-white"
                />
                <span className="text-xs text-amber-800">
                  {escalationTimeoutMinutes >= 60
                    ? `Equivale a ${(escalationTimeoutMinutes / 60).toFixed(1)} hora(s)`
                    : `${escalationTimeoutMinutes} minutos`}
                </span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Se o 1º aprovador estiver ausente ou não responder dentro deste prazo, o chamado
                escala automaticamente para o 2º aprovador e depois para o 3º, evitando bloqueios no
                atendimento.
              </p>
            </div>
          )}

          {/* Pontos Focais do Cliente */}
          <div className="space-y-2 rounded-lg border p-3.5 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                Pontos Focais do Cliente (Aprovadores Externos)
              </Label>
              <span className="text-[11px] text-slate-500">
                {mode === 'Sequencial' ? 'Ordem da sequência' : 'Destinatários'}
              </span>
            </div>

            <Select value="" onValueChange={handleAddFocalPoint}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="+ Adicionar ponto focal como aprovador..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {eligibleFocalPoints.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.full_name} ({contact.email || 'sem e-mail'})
                    {contact.is_focal_point ? ' [Ponto Focal]' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {focalPoints.length > 0 ? (
              <div className="space-y-1.5 mt-2">
                {focalPoints.map((id, index) => {
                  const cont = contacts.find((c) => c.id === id)
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-2 rounded bg-white border text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {mode === 'Sequencial' && (
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {index + 1}º
                          </Badge>
                        )}
                        <span className="font-semibold text-slate-800">
                          {cont?.full_name || id}
                        </span>
                        <span className="text-slate-400">({cont?.email || 'sem e-mail'})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveFocalPoint(id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Nenhum ponto focal adicionado ainda.</p>
            )}
          </div>

          {/* Aprovadores Internos Configuráveis */}
          <div className="space-y-2 rounded-lg border p-3.5 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Aprovadores Internos (Gestão, Administrador ou Helpdesk / Operador)
              </Label>
              <span className="text-[11px] text-slate-500">
                {mode === 'Sequencial' ? 'Contingência 2º/3º ou regra' : 'Aprovadores do time'}
              </span>
            </div>

            <Select value="" onValueChange={handleAddInternalApprover}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="+ Adicionar operador interno como aprovador..." />
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

            {internalApprovers.length > 0 ? (
              <div className="space-y-1.5 mt-2">
                {internalApprovers.map((id, index) => {
                  const op = internalOperators.find((u) => u.id === id)
                  const seqPos = focalPoints.length + index + 1
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-2 rounded bg-white border text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {mode === 'Sequencial' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold bg-amber-50 text-amber-800"
                          >
                            {seqPos}º (Interno)
                          </Badge>
                        )}
                        <span className="font-semibold text-slate-800">{op?.name || id}</span>
                        <span className="text-slate-400">({op?.email})</span>
                        <Badge variant="secondary" className="text-[9px] uppercase">
                          {op?.role || 'interno'}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveInternalApprover(id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Nenhum aprovador interno selecionado.</p>
            )}
          </div>

          {/* Clientes / Empresas Específicas */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-slate-500" />
              Empresas / Clientes Aplicáveis (opcional)
            </Label>
            <p className="text-[11px] text-slate-500">
              Selecione clientes específicos ou deixe em branco para aplicar a todos os clientes que
              utilizarem esta atividade.
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border rounded-md bg-white">
              {companies.map((c) => {
                const checked = selectedClients.includes(c.id)
                return (
                  <Badge
                    key={c.id}
                    variant={checked ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${checked ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                    onClick={() => handleToggleClient(c.id)}
                  >
                    {c.trade_name || c.legal_name || c.code}
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* Descrição / Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Observações Internas (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Política aprovada pela diretoria para liberação de acessos críticos..."
              rows={2}
              className="text-xs"
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
            <div>
              <p className="text-xs font-bold text-slate-800">Regra Ativa</p>
              <p className="text-[11px] text-slate-500">
                Se desativada, novos chamados desta atividade não passarão por aprovação.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Salvando...' : editingConfig ? 'Atualizar Regra' : 'Criar Regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
