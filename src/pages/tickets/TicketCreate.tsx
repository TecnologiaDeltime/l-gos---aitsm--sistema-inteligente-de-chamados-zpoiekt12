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

import { getCategories, type CategoryRecord } from '@/services/categories'
import { getEquipments, type EquipmentRecord } from '@/services/equipments'
import {
  getConfigurationItemsByCompany,
  type ConfigurationItemRecord,
} from '@/services/configuration-items'
import { getClientContacts, type ClientContactRecord } from '@/services/client-contacts'
import { useAuth } from '@/hooks/use-auth'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { createTicket } from '@/services/tickets'
import { getQueues, type QueueRecord, QUEUE_LEVELS } from '@/services/queues'
import { getUsers, type UserItem } from '@/services/users'
import { Inbox } from 'lucide-react'
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
  const { user } = useAuth()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [configurationItems, setConfigurationItems] = useState<ConfigurationItemRecord[]>([])
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
  const [itemType, setItemType] = useState<'none' | 'asset' | 'ci'>('none')
  const [equipment, setEquipment] = useState('')
  const [configurationItem, setConfigurationItem] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [technicians, setTechnicians] = useState<UserItem[]>([])
  const [assignedTo, setAssignedTo] = useState('')
  const [queueId, setQueueId] = useState('')
  const [allQueues, setAllQueues] = useState<QueueRecord[]>([])

  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const parentCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => {
      if (!c.parent) map.set(c.id, c.name)
    })
    return map
  }, [categories])

  const availableActivities = useMemo(() => {
    const subs = categories.filter((c) => c.parent && c.active !== false)
    if (subs.length > 0) return subs
    return categories.filter((c) => c.active !== false)
  }, [categories])

  /**
   * Filas/Equipes de atendimento ativas cadastradas em Gerenciamento de Filas.
   * Se a fila tiver vínculo com empresa específica, filtra pela empresa selecionada (se houver);
   * filas sem empresa definida ficam disponíveis globalmente para qualquer empresa.
   */
  const availableQueues = useMemo(() => {
    const active = allQueues.filter((q) => q.active !== false)
    if (!company) return active
    return active.filter((q) => !q.company || q.company === company)
  }, [company, allQueues])

  const handleCompanyChange = useCallback(
    (companyId: string) => {
      setCompany(companyId)
      // Ajusta a fila selecionada se ela não pertencer mais à empresa
      if (companyId) {
        setQueueId((prev) => {
          if (!prev) return ''
          const q = allQueues.find((item) => item.id === prev)
          if (q && q.company && q.company !== companyId) {
            return ''
          }
          return prev
        })
      }
    },
    [allQueues],
  )

  useEffect(() => {
    const load = async () => {
      const [comps, cats, techs, queues] = await Promise.all([
        getCompanies(),
        getCategories(),
        getUsers("role='tecnico' || role='gestor' || role='admin'").catch(() => []),
        getQueues().catch(() => []),
      ])
      setCompanies(comps)
      setCategories(cats)
      setTechnicians(techs as UserItem[])
      setAllQueues(queues as QueueRecord[])
    }
    load()
  }, [])

  useEffect(() => {
    if (!company) {
      setContacts([])
      setUnits([])
      setEquipments([])
      setConfigurationItems([])
      return
    }
    const load = async () => {
      try {
        const [c, u, eq, ciList] = await Promise.all([
          getClientContacts(company),
          getCompanyUnitsByCompany(company),
          getEquipments({ company } as never).catch(() => []),
          getConfigurationItemsByCompany(company).catch(() => []),
        ])
        setContacts(c)
        setUnits(u)
        setEquipments(eq as EquipmentRecord[])
        setConfigurationItems(ciList as ConfigurationItemRecord[])
      } catch {
        setContacts([])
        setUnits([])
        setEquipments([])
        setConfigurationItems([])
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
            (!eq.device_type ||
              ['Desktop', 'Notebook', 'Tablet', 'Celular'].includes(eq.device_type)) &&
            ((eq.responsible_user &&
              eq.responsible_user.trim().toLowerCase() === c.full_name.trim().toLowerCase()) ||
              (eq.owner && eq.owner.trim().toLowerCase() === c.full_name.trim().toLowerCase())),
        )
        if (matchedEquipment) {
          setEquipment(matchedEquipment.id)
          setItemType('asset')
        }
      } else {
        setRequesterName('')
        setRequesterEmail('')
        setRequesterPhone('')
        setDepartment('')
      }
    },
    [contacts, equipments],
  )

  // Filtragem de ativos conforme regra de Ponto Focal
  const availableEquipments = useMemo(() => {
    // Apenas dispositivos (Desktop, Notebook, Tablet, Celular)
    const deviceAssets = equipments.filter(
      (eq) =>
        !eq.device_type || ['Desktop', 'Notebook', 'Tablet', 'Celular'].includes(eq.device_type),
    )

    // Verifica se o operador logado é ponto focal nos contatos da empresa
    const userEmail = (user?.email || '').trim().toLowerCase()
    const userName = (user?.name || '').trim().toLowerCase()
    const isCurrentUserFocalPoint = contacts.some(
      (c) =>
        c.is_focal_point &&
        ((c.email && c.email.trim().toLowerCase() === userEmail) ||
          (c.full_name && c.full_name.trim().toLowerCase() === userName)),
    )

    if (isCurrentUserFocalPoint) {
      // Ponto focal vê todos os ativos da empresa
      return deviceAssets
    }

    // Não é ponto focal: filtra apenas os do solicitante selecionado (se houver solicitante)
    if (!requesterName) {
      return deviceAssets
    }

    const reqName = requesterName.trim().toLowerCase()
    return deviceAssets.filter(
      (eq) =>
        (eq.responsible_user && eq.responsible_user.trim().toLowerCase() === reqName) ||
        (eq.owner && eq.owner.trim().toLowerCase() === reqName),
    )
  }, [equipments, contacts, user, requesterName])

  const handleSubActivityChange = (id: string) => {
    setSubActivity(id)
    const sub = categories.find((c) => c.id === id)
    if (sub) {
      if (sub.parent) {
        setMainCategory(sub.parent)
      } else {
        setMainCategory(sub.id)
      }
      // O tipo do chamado é derivado da atividade cadastrada no catálogo
      if (sub.type) {
        setType(sub.type)
      }
      setAutoImpact(sub.impact || '')
      setAutoUrgency(sub.urgency || '')
      setAutoPriority(sub.priority || computePriority(sub.impact || '', sub.urgency || ''))

      // Pré-seleciona a Equipe Responsável cadastrada na atividade (ou herdada do pai)
      const designatedQueue =
        sub.queue || (sub.parent ? categories.find((c) => c.id === sub.parent)?.queue : undefined)
      if (designatedQueue) {
        setQueueId(designatedQueue)
      }
    } else {
      setMainCategory('')
      setAutoImpact('')
      setAutoUrgency('')
      setAutoPriority('')
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
      if (!subActivity) {
        toast({ title: 'Selecione uma atividade do catálogo', variant: 'destructive' })
        return false
      }
      if (!queueId) {
        toast({ title: 'Selecione a equipe responsável', variant: 'destructive' })
        return false
      }
      // Operador agora é opcional
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
        : { sla_response_deadline: undefined, sla_solution_deadline: undefined }
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
        equipment: itemType === 'asset' && equipment ? equipment : undefined,
        configuration_item: itemType === 'ci' && configurationItem ? configurationItem : undefined,
        queue: queueId || undefined,
        impact: autoImpact || 'Médio',
        urgency: autoUrgency || 'Média',
        priority: autoPriority || 'Média',
        status: 'Novo',
        assigned_to: assignedTo || undefined,
        requester_name: requesterName || 'Solicitante',
        requester_email: requesterEmail,
        requester_phone: requesterPhone,
        source: 'Portal',
        sla_status: 'Dentro do Prazo',
        sla_response_deadline: sla.sla_response_deadline,
        sla_solution_deadline: sla.sla_solution_deadline,
      } as any)
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
                Selecione a atividade do catálogo para definir tipo, impacto, urgência e prioridade
                automaticamente
              </p>
            </div>
            <div className="space-y-2">
              <FieldLabel>Atividade do Catálogo *</FieldLabel>
              <Select value={subActivity} onValueChange={handleSubActivityChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione a atividade do catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {availableActivities.map((c) => {
                    const group = c.parent ? parentCategoryMap.get(c.parent) : null
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {group ? `${group} › ${c.name}` : c.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {subActivity && (
              <div className="grid gap-4 sm:grid-cols-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <div className="space-y-1">
                  <FieldLabel>Tipo</FieldLabel>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {type || 'Incidente'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Impacto</FieldLabel>
                  <Badge variant="outline" className="text-xs">
                    {autoImpact || '—'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Urgência</FieldLabel>
                  <Badge variant="outline" className="text-xs">
                    {autoUrgency || '—'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <FieldLabel>Prioridade</FieldLabel>
                  <PriorityBadge priority={autoPriority} />
                </div>
              </div>
            )}
            {/* Tipo de Item (Nenhum, Ativo, Item de Configuração) */}
            <div className="space-y-3 rounded-lg border p-3.5 bg-slate-50/50 dark:bg-slate-800/30">
              <FieldLabel>Tipo de Item</FieldLabel>
              <RadioGroup
                value={itemType}
                onValueChange={(val: 'none' | 'asset' | 'ci') => {
                  setItemType(val)
                  if (val === 'none') {
                    setEquipment('')
                    setConfigurationItem('')
                  } else if (val === 'asset') {
                    setConfigurationItem('')
                  } else if (val === 'ci') {
                    setEquipment('')
                  }
                }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="item-type-none" />
                  <label htmlFor="item-type-none" className="text-xs font-medium cursor-pointer">
                    Nenhum
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="asset" id="item-type-asset" />
                  <label htmlFor="item-type-asset" className="text-xs font-medium cursor-pointer">
                    Ativo (computador, notebook, celular)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ci" id="item-type-ci" />
                  <label htmlFor="item-type-ci" className="text-xs font-medium cursor-pointer">
                    Item de Configuração (impressora, rede, switch)
                  </label>
                </div>
              </RadioGroup>

              {itemType === 'asset' && (
                <div className="space-y-1.5 pt-2">
                  <FieldLabel>Ativo do Solicitante / Empresa</FieldLabel>
                  <Select value={equipment} onValueChange={setEquipment}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue
                        placeholder={
                          availableEquipments.length === 0
                            ? 'Nenhum ativo disponível'
                            : 'Selecione o ativo...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEquipments.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name} {eq.device_type ? `[${eq.device_type}]` : ''}{' '}
                          {eq.hostname ? `(${eq.hostname})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {itemType === 'ci' && (
                <div className="space-y-1.5 pt-2">
                  <FieldLabel>Item de Configuração de Infraestrutura</FieldLabel>
                  <Select value={configurationItem} onValueChange={setConfigurationItem}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue
                        placeholder={
                          configurationItems.length === 0
                            ? 'Nenhum item de configuração cadastrado para esta empresa'
                            : 'Selecione o item de configuração...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {configurationItems.map((ci) => (
                        <SelectItem key={ci.id} value={ci.id}>
                          {ci.name} · {ci.type} {ci.brand ? `(${ci.brand})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Equipe Responsável (Fila) *</FieldLabel>
                {availableQueues.length === 0 ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300">
                    <Inbox className="h-3.5 w-3.5 shrink-0" />
                    Nenhuma equipe cadastrada em Gerenciamento de Filas
                  </div>
                ) : (
                  <Select value={queueId} onValueChange={setQueueId}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Selecione a equipe responsável *" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableQueues.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name} {q.level ? `· ${q.level}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-slate-400">
                  Obrigatório para direcionar o chamado para a equipe/fila responsável.
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel>Operador Designado (opcional)</FieldLabel>
                <Select
                  value={assignedTo || 'none'}
                  onValueChange={(val) => setAssignedTo(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Nenhum (atribuir depois)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum operador (atribuir depois)</SelectItem>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  Opcional. Se não selecionado, o chamado aguardará atribuição na fila da equipe.
                </p>
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
                {queueId && ' · Fila vinculada'}
                {itemType === 'asset' && equipment && (
                  <> · Ativo: {equipments.find((e) => e.id === equipment)?.name || 'Selecionado'}</>
                )}
                {itemType === 'ci' && configurationItem && (
                  <>
                    {' '}
                    · CI:{' '}
                    {(() => {
                      const foundCi = configurationItems.find((c) => c.id === configurationItem)
                      return foundCi ? `${foundCi.name} (${foundCi.type})` : 'Selecionado'
                    })()}
                  </>
                )}
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
