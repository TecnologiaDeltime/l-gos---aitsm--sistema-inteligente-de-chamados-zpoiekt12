import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, ClipboardList, Tag, User } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getContracts, type ContractRecord } from '@/services/contracts'
import { getCategories, type CategoryRecord } from '@/services/categories'
import { getEquipments, type EquipmentRecord } from '@/services/equipments'
import { getClientContacts, type ClientContactRecord } from '@/services/client-contacts'
import { getCompanyUnitsByCompany, type CompanyUnitRecord } from '@/services/company-units'
import { createTicket } from '@/services/tickets'
import { calculateSlaDeadlines } from '@/lib/sla-utils'

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
  const [category, setCategory] = useState('')
  const [equipment, setEquipment] = useState('')
  const [contract, setContract] = useState('')
  const [impact, setImpact] = useState('Médio')
  const [urgency, setUrgency] = useState('Média')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [comps, cats, conts] = await Promise.all([
        getCompanies(),
        getCategories(),
        getContracts({ expand: 'company' } as never).catch(() => []),
      ])
      setCompanies(comps)
      setCategories(cats)
      setContracts(conts as ContractRecord[])
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

  const handleContactChange = useCallback(
    (contactId: string) => {
      setSelectedContact(contactId)
      const c = contacts.find((x) => x.id === contactId)
      if (c) {
        setRequesterName(c.full_name)
        setRequesterEmail(c.email || '')
        setRequesterPhone(c.phone || c.cell_phone || '')
        if (c.unit) setUnit(c.unit)
      } else {
        setRequesterName('')
        setRequesterEmail('')
        setRequesterPhone('')
      }
    },
    [contacts],
  )

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      if (!company) {
        toast({ title: 'Selecione uma empresa', variant: 'destructive' })
        return false
      }
      if (units.length > 0 && !selectedContact && !unit) {
        toast({ title: 'Selecione um solicitante ou filial', variant: 'destructive' })
        return false
      }
    }
    if (step === 1) {
      if (!type) {
        toast({ title: 'Selecione o tipo', variant: 'destructive' })
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
      const num = `2026-${Math.floor(10000 + Math.random() * 90000)}`
      const sc = contracts.find((c) => c.id === contract)
      const sla = sc ? calculateSlaDeadlines(sc) : {}
      await createTicket({
        number: num,
        company,
        unit: unit || undefined,
        title,
        description,
        type,
        category: category || undefined,
        equipment: equipment || undefined,
        contract: contract || undefined,
        impact,
        urgency,
        priority: impact === 'Alto' && urgency === 'Alta' ? 'P1' : 'P3',
        status: 'Novo',
        requester_name: requesterName || 'Solicitante',
        requester_email: requesterEmail,
        requester_phone: requesterPhone,
        source: 'Portal',
        sla_status: 'Dentro do Prazo',
        sla_response_deadline: sla.sla_response_deadline,
        sla_solution_deadline: sla.sla_solution_deadline,
      })
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
        {/* Step 0 — Solicitante */}
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
              <Select value={company} onValueChange={setCompany}>
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

        {/* Step 1 — Classificação */}
        {currentStep === 1 && (
          <div className="animate-fade-in space-y-5 rounded-2xl bg-white p-6 dark:bg-slate-900 sm:p-8">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Classificação
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Defina o tipo, categoria e impacto do chamado
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <FieldLabel>Categoria</FieldLabel>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                <Select value={contract} onValueChange={setContract}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione o contrato (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.number} — {c.expand?.company?.trade_name || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Impacto</FieldLabel>
                <Select value={impact} onValueChange={setImpact}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Urgência</FieldLabel>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Detalhes */}
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
                <span className="font-medium">Resumo:</span> {type} · {impact}/{urgency}
                {category && ' · Categoria selecionada'}
                {contract && ' · Contrato vinculado'}
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="gap-1.5 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
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
              Avançar
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? 'Abrindo...' : 'Abrir Chamado'}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
