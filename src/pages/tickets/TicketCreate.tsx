import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Tag,
  User,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getCompanies, getCompanyDepartments, type CompanyRecord } from '@/services/companies'
import { getContracts, type ContractRecord } from '@/services/contracts'
import { getCategories, type CategoryRecord } from '@/services/categories'
import { getEquipments, type EquipmentRecord } from '@/services/equipments'
import { getClientContacts, type ClientContactRecord } from '@/services/client-contacts'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { createTicket } from '@/services/tickets'
import { getUsers, type UserItem } from '@/services/users'
import { markTicketAsSelfCreated } from '@/lib/ticket-alerts'
import { calculateSlaFromMinutes } from '@/lib/sla-utils'
import { computePriority } from '@/lib/itil-matrix'
import { PriorityBadge } from '@/components/PriorityBadge'
import { resolveDepartment, type DepartmentOption } from '@/lib/department-resolver'

const STEPS = [
  { id: 0, label: 'Solicitante', icon: User },
  { id: 1, label: 'Classificação', icon: Tag },
  { id: 2, label: 'Detalhes', icon: ClipboardList },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{children}</label>
  )
}

function StepIndicator({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((step, idx) => {
        const isActive = idx === current
        const isComplete = idx < current
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300',
                  isActive && 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200',
                  isComplete && 'border-green-600 bg-green-600 text-white',
                  !isActive &&
                    !isComplete &&
                    'border-slate-300 bg-white text-slate-400 dark:bg-slate-800 dark:border-slate-600',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:block transition-colors duration-200',
                  isActive ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-slate-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < max - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 w-8 rounded-full transition-colors duration-300 sm:w-16',
                  idx < current ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TicketCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [units, setUnits] = useState<CompanyUnitRecord[]>([])

  const [company, setCompany] = useState('')
  const [selectedContact, setSelectedContact] = useState('')
  const [unit, setUnit] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [requesterPhone, setRequesterPhone] = useState('')
  const [type, setType] = useState('Incidente')
  const [mainCategory, setMainCategory] = useState('')
  const [subActivity, setSubActivity] = useState('')
  const [autoImpact, setAutoImpact] = useState('')
  const [autoUrgency, setAutoUrgency] = useState('')
  const [autoPriority, setAutoPriority] = useState('')
  const [equipment, setEquipment] = useState('')
  const [contract, setContract] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [technicians, setTechnicians] = useState<UserItem[]>([])
  const [assignedTo, setAssignedTo] = useState('')

  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const mainCategories = useMemo(
    () => categories.filter((c) => !c.parent && c.active !== false),
    [categories],
  )
  const availableSubActivities = useMemo(
    () => categories.filter((c) => c.parent === mainCategory && c.active !== false),
    [categories, mainCategory],
  )
  // Contratos filtrados pela empresa selecionada (client-side)
  const availableContracts = useMemo(
    () => contracts.filter((c) => c.company === company),
    [contracts, company],
  )

  const handleCompanyChange = useCallback(
    (companyId: string) => {
      setCompany(companyId)
      // Limpa o contrato e refaz o filtro pela nova empresa
      setContract('')
      if (!companyId) return
      const filtered = contracts.filter((c) => c.company === companyId)
      if (filtered.length === 0) return
      // Prefere o primeiro contrato "Ativo"; se não houver, o primeiro disponível
      const active = filtered.find((c) => (c.status || '').toLowerCase() === 'ativo')
      setContract((active || filtered[0]).id)
    },
    [contracts],
  )

  useEffect(() => {
    const load = async () => {
      const [comps, cats, conts, techs] = await Promise.all([
        getCompanies(),
        getCategories(),
        getContracts().catch(() => []),
        getUsers("role='tecnico' || role='gestor' || role='admin'").catch(() => []),
      ])
      setCompanies(comps)
      setCategories(cats)
      setContracts(conts as ContractRecord[])
      setTechnicians(techs as UserItem[])
    }
    load()
  }, [])

  useEffect(() => {
    if (!company) {
      setContacts([])
      setUnits([])
      setEquipments([])
      return
    }
    const load = async () => {
      try {
        const [c, u, eq] = await Promise.all([
          getClientContacts(company),
          getCompanyUnitsByCompany(company),
          getEquipments({ company } as never).catch(() => []),
        ])
        setContacts(c)
        setUnits(u)
        setEquipments(eq as EquipmentRecord[])
      } catch {
        setContacts([])
        setUnits([])
        setEquipments([])
      }
    }
    load()
  }, [company])

  useEffect(() => {
    if (!company) {
      setDepartments([])
      setDepartment('')
      setDeptLoading(false)
      return
    }
    let cancelled = false
    setDeptLoading(true)
    const resolve = async () => {
      try {
        const depts = await getCompanyDepartments(company).catch(() => [])
        if (cancelled) return
        setDepartments(depts as DepartmentOption[])
        const resolved = await resolveDepartment({
          companyId: company,
          requesterEmail: requesterEmail || undefined,
          unitId: unit || undefined,
        })
        if (cancelled) return
        setDepartment(resolved?.id || '')
      } catch {
        if (!cancelled) {
          toast({
            title: 'Erro ao buscar setores. Selecione manualmente.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setDeptLoading(false)
      }
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [company, requesterEmail, unit, toast])

  const handleContactChange = useCallback(
    (contactId: string) => {
      setSelectedContact(contactId)
      const c = contacts.find((x) => x.id === contactId)
      if (c) {
        setRequesterName(c.full_name)
        setRequesterEmail(c.email || '')
        setRequesterPhone(c.phone || c.cell_phone || '')
        if (c.unit) setUnit(c.unit)
        if (c.departments && c.departments.length > 0) {
          setDepartment(c.departments[0])
        }
        const matchedEquipment = equipments.find(
          (eq) =>
            (eq.device_type === 'Desktop' || eq.device_type === 'Notebook') &&
            ((eq.responsible_user &&
              eq.responsible_user.trim().toLowerCase() === c.full_name.trim().toLowerCase()) ||
              (eq.owner && eq.owner.trim().toLowerCase() === c.full_name.trim().toLowerCase())),
        )
        setEquipment(matchedEquipment ? matchedEquipment.id : '')
      } else {
        setRequesterName('')
        setRequesterEmail('')
        setRequesterPhone('')
        setDepartment('')
        setEquipment('')
      }
    },
    [contacts, equipments],
  )

  const handleMainCategoryChange = (id: string) => {
    setMainCategory(id)
    setSubActivity('')
    setAutoImpact('')
    setAutoUrgency('')
    setAutoPriority('')
  }

  const handleSubActivityChange = (id: string) => {
    setSubActivity(id)
    const sub = categories.find((c) => c.id === id)
    if (sub) {
      setAutoImpact(sub.impact || '')
      setAutoUrgency(sub.urgency || '')
      setAutoPriority(sub.priority || computePriority(sub.impact || '', sub.urgency || ''))
    }
  }

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      if (!company) {
        toast({ title: 'Selecione uma empresa', variant: 'destructive' })
        return false
      }
    }
    if (step === 1) {
      if (!type) {
        toast({ title: 'Selecione o tipo', variant: 'destructive' })
        return false
      }
      if (!subActivity) {
        toast({ title: 'Selecione uma atividade', variant: 'destructive' })
        return false
      }
      if (!assignedTo) {
        toast({ title: 'Selecione um operador', variant: 'destructive' })
        return false
      }
    }
    if (step === 2) {
      if (!title.trim() || !description.trim()) {
        toast({ title: 'Preencha título e descrição', variant: 'destructive' })
        return false
      }
    }
    return true
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const prevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(0) || !validateStep(2)) return

    setSubmitting(true)
    try {
      const sub = categories.find((c) => c.id === subActivity)
      const sla = sub
        ? calculateSlaFromMinutes(sub.sla_response_minutes, sub.sla_solution_minutes)
        : {}
      const created = await createTicket({
        number: 'PENDENTE',
        company,
        unit: unit || undefined,
        department: department && department !== 'none' ? department : undefined,
        title,
        description,
        type,
        category: mainCategory || undefined,
        subcategory: subActivity || undefined,
        equipment: equipment || undefined,
        contract: contract || undefined,
        impact: autoImpact || 'Médio',
        urgency: autoUrgency || 'Média',
        priority: autoPriority || 'Média',
        status: 'Novo',
        assigned_to: assignedTo,
        requester_name: requesterName || 'Solicitante',
        requester_email: requesterEmail,
        requester_phone: requesterPhone,
        source: 'Portal',
        sla_status: 'Dentro do Prazo',
        sla_response_deadline: sla.sla_response_deadline,
        sla_solution_deadline: sla.sla_solution_deadline,
      })
      markTicketAsSelfCreated(created.id)
      toast({ title: 'Chamado aberto com sucesso!' })
      navigate('/tickets')
    } catch {
      toast({ title: 'Erro ao criar chamado', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Abrir Novo Chamado
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Preencha as informações abaixo para registrar seu chamado
        </p>
      </div>

      <div className="mb-8">
        <StepIndicator current={currentStep} max={STEPS.length} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {currentStep === 0 && (
          <div className="animate-fade-in space-y-5 rounded-2xl bg-white p-6 dark:bg-slate-900 sm:p-8">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Informações do Solicitante
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Selecione a empresa e o solicitante do chamado
              </p>
            </div>
            <div className="space-y-2">
              <FieldLabel>Empresa / Cliente</FieldLabel>
              <Select value={company} onValueChange={handleCompanyChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Solicitante</FieldLabel>
                <Select value={selectedContact} onValueChange={handleContactChange}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione o solicitante" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Filial</FieldLabel>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione a filial" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Setor</FieldLabel>
              {deptLoading ? (
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  <span className="text-sm text-slate-400">Buscando setores...</span>
                </div>
              ) : (
                <Select value={department} onValueChange={setDepartment} disabled={!company}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue
                      placeholder={company ? 'Selecione o setor' : 'Selecione uma empresa primeiro'}
                    />
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
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Nome do Solicitante</FieldLabel>
                <Input
                  required
                  className="rounded-lg"
                  placeholder="Ex: Maria Oliveira"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>E-mail do Solicitante</FieldLabel>
                <Input
                  type="email"
                  className="rounded-lg"
                  placeholder="maria@empresa.com"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Telefone do Solicitante</FieldLabel>
              <Input
                className="rounded-lg"
                placeholder="(00) 00000-0000"
                value={requesterPhone}
                onChange={(e) => setRequesterPhone(e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="animate-fade-in space-y-5 rounded-2xl bg-white p-6 dark:bg-slate-900 sm:p-8">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Classificação
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Selecione a atividade para preencher impacto, urgência e prioridade automaticamente
              </p>
            </div>
            <div className="space-y-2">
              <FieldLabel>Tipo</FieldLabel>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Requisição de Serviço">Requisição de Serviço</SelectItem>
                  <SelectItem value="Dúvida">Dúvida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Categoria Principal</FieldLabel>
                <Select value={mainCategory} onValueChange={handleMainCategoryChange}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Atividade *</FieldLabel>
                <Select
                  value={subActivity}
                  onValueChange={handleSubActivityChange}
                  disabled={!mainCategory}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue
                      placeholder={
                        mainCategory ? 'Selecione a atividade' : 'Primeiro selecione a categoria'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubActivities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {subActivity && (
              <div className="grid gap-4 sm:grid-cols-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <div className="space-y-1">
                  <FieldLabel>Impacto</FieldLabel>
                  <Badge variant="outline" className="text-xs">
                    {autoImpact}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Urgência</FieldLabel>
                  <Badge variant="outline" className="text-xs">
                    {autoUrgency}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Prioridade</FieldLabel>
                  <PriorityBadge priority={autoPriority} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <FieldLabel>Ativo / Equipamento</FieldLabel>
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione o equipamento (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.name} {eq.hostname ? `(${eq.hostname})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Contrato</FieldLabel>
                <Select value={contract} onValueChange={setContract} disabled={!company}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue
                      placeholder={
                        company
                          ? availableContracts.length
                            ? 'Selecione o contrato (opcional)'
                            : 'Nenhum contrato para esta empresa'
                          : 'Selecione uma empresa primeiro'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.number} — {c.expand?.company?.trade_name || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Operador / Técnico *</FieldLabel>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione o operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="animate-fade-in space-y-5 rounded-2xl bg-white p-6 dark:bg-slate-900 sm:p-8">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Detalhes do Chamado
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Descreva o problema ou solicitação
              </p>
            </div>
            <div className="space-y-2">
              <FieldLabel>Título do Chamado</FieldLabel>
              <Input
                required
                className="rounded-lg"
                placeholder="Ex: Falha ao acessar sistema de vendas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Descrição detalhada</FieldLabel>
              <Textarea
                required
                rows={5}
                className="rounded-lg resize-none"
                placeholder="Descreva o problema ou solicitação..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Resumo:</span> {type} ·{' '}
                {autoPriority || 'Sem prioridade'}
                {subActivity && ' · Atividade selecionada'}
                {contract && ' · Contrato vinculado'}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="gap-1.5 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <span className="text-xs font-medium text-slate-400">
            Passo {currentStep + 1} de {STEPS.length}
          </span>
          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              className="gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              Avançar <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? 'Abrindo...' : 'Abrir Chamado'} <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
