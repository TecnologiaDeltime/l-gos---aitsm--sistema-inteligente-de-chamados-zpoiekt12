import { useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, GitBranch, Layers, Info } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTicket, TicketRecord } from '@/services/tickets'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getContract, ContractRecord } from '@/services/contracts'
import { getCompanyDepartments, CompanyDepartmentRecord } from '@/services/companies'
import { calculateSlaFromMinutes } from '@/lib/sla-utils'
import { computePriority } from '@/lib/itil-matrix'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { PriorityBadge } from '@/components/PriorityBadge'

interface SlaDeadlines {
  sla_response_deadline?: string
  sla_solution_deadline?: string
}

interface ChildTicketDialogProps {
  parent: TicketRecord
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function ChildTicketDialog({
  parent,
  open,
  onOpenChange,
  onCreated,
}: ChildTicketDialogProps) {
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState(parent.department || '')
  const [departments, setDepartments] = useState<CompanyDepartmentRecord[]>([])

  // Categorias do catálogo de atividades
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [mainCategory, setMainCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')

  // Contrato herdado do pai (carregado para exibição e SLA fallback)
  const [parentContractData, setParentContractData] = useState<ContractRecord | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // Categorias pai (atividades principais)
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent && c.active !== false && !c.deleted),
    [categories],
  )

  // Subatividades pertencentes à categoria principal selecionada
  const subcategoriesOfMain = useMemo(() => {
    if (!mainCategory) return []
    return categories.filter((c) => c.parent === mainCategory && c.active !== false && !c.deleted)
  }, [categories, mainCategory])

  // Objeto da subcategoria selecionada
  const selectedSub = useMemo(
    () => categories.find((c) => c.id === subCategory) || null,
    [categories, subCategory],
  )

  // Objeto da categoria principal selecionada
  const selectedCat = useMemo(
    () => categories.find((c) => c.id === mainCategory) || null,
    [categories, mainCategory],
  )

  // Valores derivados automaticamente da atividade do catálogo (com fallback no chamado pai)
  const derivedType = selectedSub?.type || selectedCat?.type || parent.type || 'Incidente'
  const derivedImpact = selectedSub?.impact || selectedCat?.impact || parent.impact || 'Médio'
  const derivedUrgency = selectedSub?.urgency || selectedCat?.urgency || parent.urgency || 'Média'
  const derivedPriority =
    selectedSub?.priority ||
    (derivedImpact && derivedUrgency ? computePriority(derivedImpact, derivedUrgency) : '') ||
    parent.priority ||
    'Média'
  const derivedQueue = selectedSub?.queue || selectedCat?.queue || parent.queue || undefined

  useEffect(() => {
    if (!open) return

    setTitle('')
    setDescription('')
    setDepartment(parent.department || '')

    // Carrega catálogo de atividades
    setLoadingCatalog(true)
    getCategories()
      .then((catList) => {
        setCategories(catList)
        // Herda categoria e subcategoria do pai por padrão, se existirem
        if (parent.category) {
          setMainCategory(parent.category)
          if (parent.subcategory) {
            setSubCategory(parent.subcategory)
          } else {
            setSubCategory('')
          }
        } else {
          setMainCategory('')
          setSubCategory('')
        }
      })
      .catch(() => setCategories([]))
      .finally(() => setLoadingCatalog(false))

    // Carrega dados do contrato herdado do pai (se houver)
    if (parent.contract) {
      if (parent.expand?.contract) {
        setParentContractData(parent.expand.contract)
      } else {
        getContract(parent.contract)
          .then(setParentContractData)
          .catch(() => setParentContractData(null))
      }
    } else {
      setParentContractData(null)
    }

    // Setores da empresa do pai
    if (parent.company) {
      getCompanyDepartments(parent.company)
        .then(setDepartments)
        .catch(() => setDepartments([]))
    }
  }, [open, parent])

  const handleMainCategoryChange = (catId: string) => {
    setMainCategory(catId)
    setSubCategory('')
  }

  const handleSubCategoryChange = (subId: string) => {
    setSubCategory(subId)
    const sub = categories.find((c) => c.id === subId)
    if (sub?.parent && sub.parent !== mainCategory) {
      setMainCategory(sub.parent)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Preencha título e descrição', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      // Cálculo do SLA: prioriza a subatividade/atividade do catálogo; fallback para o contrato herdado
      let sla: SlaDeadlines = {}
      if (
        (selectedSub?.sla_response_minutes && selectedSub.sla_response_minutes > 0) ||
        (selectedSub?.sla_solution_minutes && selectedSub.sla_solution_minutes > 0)
      ) {
        sla = calculateSlaFromMinutes(
          selectedSub.sla_response_minutes || undefined,
          selectedSub.sla_solution_minutes || undefined,
        )
      } else if (
        (selectedCat?.sla_response_minutes && selectedCat.sla_response_minutes > 0) ||
        (selectedCat?.sla_solution_minutes && selectedCat.sla_solution_minutes > 0)
      ) {
        sla = calculateSlaFromMinutes(
          selectedCat.sla_response_minutes || undefined,
          selectedCat.sla_solution_minutes || undefined,
        )
      } else if (parentContractData) {
        sla = calculateSlaFromMinutes(
          parentContractData.sla_response_time,
          parentContractData.sla_solution_time,
        )
      }

      await createTicket({
        number: 'PENDENTE',
        company: parent.company,
        unit: parent.unit || undefined,
        department: department && department !== 'none' ? department : undefined,
        title: title.trim(),
        description: description.trim(),
        // Tipo, Impacto, Urgência e Prioridade derivados automaticamente do catálogo
        type: derivedType,
        impact: derivedImpact,
        urgency: derivedUrgency,
        priority: derivedPriority,
        // Categoria e Subcategoria selecionadas do catálogo
        category: mainCategory || undefined,
        subcategory: subCategory || undefined,
        queue: derivedQueue,
        // Contrato HERDADO do pai
        contract: parent.contract || undefined,
        equipment: parent.equipment || undefined,
        configuration_item: parent.configuration_item || undefined,
        status: 'Novo',
        assigned_to: parent.assigned_to || undefined,
        requester_name: parent.requester_name,
        requester_email: parent.requester_email,
        requester_phone: parent.requester_phone,
        source: parent.source || 'Manual',
        sla_status: 'Dentro do Prazo',
        parent_ticket_id: parent.id,
        sla_response_deadline: sla.sla_response_deadline,
        sla_solution_deadline: sla.sla_solution_deadline,
      } as any)

      toast({ title: 'Chamado filho criado com sucesso!' })
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      toast({
        title: 'Erro ao criar chamado filho',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-amber-600" />
            Abrir Chamado Filho
          </DialogTitle>
          <DialogDescription>
            O novo chamado será vinculado ao chamado pai{' '}
            <span className="font-semibold text-foreground">{parent.number}</span> e herdará
            empresa, contrato, contato e parametrizações da atividade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Instalação de software na estação B..."
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Descrição <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Descreva o escopo e detalhes do chamado filho..."
            />
          </div>

          {/* Categoria e Subcategoria alimentadas pelo catálogo de atividades */}
          <div className="space-y-3 rounded-lg border bg-slate-50/70 p-3.5 dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catálogo de Atividades
              </span>
              {loadingCatalog && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Categoria (Atividade Principal)</Label>
                <Select
                  value={mainCategory || '_none'}
                  onValueChange={(val) => handleMainCategoryChange(val === '_none' ? '' : val)}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nenhuma / Manter do pai —</SelectItem>
                    {parentCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Subcategoria (Subatividade)</Label>
                <Select
                  value={subCategory || '_none'}
                  onValueChange={(val) => handleSubCategoryChange(val === '_none' ? '' : val)}
                  disabled={!mainCategory || subcategoriesOfMain.length === 0}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue
                      placeholder={
                        !mainCategory
                          ? 'Selecione a categoria primeiro'
                          : subcategoriesOfMain.length === 0
                            ? 'Nenhuma subcategoria disponível'
                            : 'Selecione a subcategoria...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nenhuma / Geral —</SelectItem>
                    {subcategoriesOfMain.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pré-visualização automática dos parâmetros definidos pelo catálogo */}
            <div className="rounded-md border bg-background/80 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span>
                  Tipo, impacto, urgência e prioridade definidos automaticamente pelo catálogo de
                  atividades:
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Tipo</span>
                  <Badge variant="secondary" className="font-normal text-[11px] mt-0.5">
                    {derivedType}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Impacto</span>
                  <Badge variant="outline" className="font-normal text-[11px] mt-0.5">
                    {derivedImpact}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Urgência</span>
                  <Badge variant="outline" className="font-normal text-[11px] mt-0.5">
                    {derivedUrgency}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Prioridade</span>
                  <div className="mt-0.5">
                    <PriorityBadge priority={derivedPriority} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Setor solicitante */}
          {departments.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Setor</Label>
              <Select value={department || 'none'} onValueChange={setDepartment}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dados herdados do chamado pai (Contrato herdado, Empresa e Solicitante) */}
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Dados herdados do chamado pai ({parent.number}):
            </p>
            <p>
              <span className="font-medium">Empresa:</span>{' '}
              {parent.expand?.company?.trade_name || 'Não informada'}
            </p>
            <p>
              <span className="font-medium">Contrato:</span>{' '}
              {parentContractData?.number
                ? `${parentContractData.number}${
                    parentContractData.type ? ` (${parentContractData.type})` : ''
                  }`
                : parent.contract
                  ? 'Herdado do pai'
                  : 'Sem contrato vinculado'}
            </p>
            <p>
              <span className="font-medium">Solicitante:</span> {parent.requester_name}
              {parent.requester_email ? ` (${parent.requester_email})` : ''}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Criar Chamado Filho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Helper exportado para que o TicketDetail verifique o bloqueio de encerramento
 * do ticket pai antes de abrir o diálogo de resolução.
 * Retorna a lista de filhos pendentes (vazia = pode encerrar).
 */
export async function checkPendingChildren(parentId: string): Promise<TicketRecord[]> {
  const { getChildTickets, CHILD_CLOSED_STATUSES } = await import('@/services/tickets')
  try {
    const children = await getChildTickets(parentId)
    return children.filter((c) => !CHILD_CLOSED_STATUSES.includes(c.status))
  } catch {
    return []
  }
}
