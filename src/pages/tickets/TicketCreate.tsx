import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTicket } from '@/services/tickets'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getEquipments, EquipmentRecord } from '@/services/equipments'
import { getActiveContracts, ContractRecord } from '@/services/contracts'
import { getClientContacts, ClientContactRecord } from '@/services/client-contacts'
import { getCompanyUnitsByCompany, CompanyUnitRecord } from '@/services/company-units'
import { calculateSlaDeadlines } from '@/lib/sla-utils'
import { useToast } from '@/hooks/use-toast'

export default function TicketCreate() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [units, setUnits] = useState<CompanyUnitRecord[]>([])
  const [company, setCompany] = useState('')
  const [selectedContact, setSelectedContact] = useState('')
  const [unit, setUnit] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Incidente')
  const [category, setCategory] = useState('')
  const [impact, setImpact] = useState('Médio')
  const [urgency, setUrgency] = useState('Média')
  const [requesterName, setRequesterName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [requesterPhone, setRequesterPhone] = useState('')
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([])
  const [equipment, setEquipment] = useState('')
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [contract, setContract] = useState('')

  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
    getCategories()
      .then(setCategories)
      .catch(() => {})
    getActiveContracts()
      .then(setContracts)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (company) {
      getClientContacts(company)
        .then(setContacts)
        .catch(() => {})
      getCompanyUnitsByCompany(company)
        .then(setUnits)
        .catch(() => {})
      getEquipments({ company })
        .then(setEquipments)
        .catch(() => {})
    } else {
      setContacts([])
      setUnits([])
      setEquipments([])
    }
    setSelectedContact('')
    setUnit('')
  }, [company])

  const handleContactChange = (contactId: string) => {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) {
      toast({ title: 'Selecione uma empresa', variant: 'destructive' })
      return
    }
    if (units.length > 0 && !selectedContact && !unit) {
      toast({ title: 'Selecione um solicitante ou filial', variant: 'destructive' })
      return
    }

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
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-4">
        <h2 className="text-xl font-bold">Abrir Novo Chamado</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Empresa / Cliente</label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Solicitante</label>
              <Select value={selectedContact} onValueChange={handleContactChange}>
                <SelectTrigger>
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
            <div className="space-y-1">
              <label className="text-xs font-semibold">Filial</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome do Solicitante</label>
              <Input
                required
                placeholder="Ex: Maria Oliveira"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">E-mail do Solicitante</label>
              <Input
                type="email"
                placeholder="maria@empresa.com"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Requisição de Serviço">Requisição de Serviço</SelectItem>
                  <SelectItem value="Dúvida">Dúvida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
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

          <div className="space-y-1">
            <label className="text-xs font-semibold">Ativo / Equipamento</label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Contrato</label>
              <Select value={contract} onValueChange={setContract}>
                <SelectTrigger>
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
            <div className="space-y-1">
              <label className="text-xs font-semibold">Impacto</label>
              <Select value={impact} onValueChange={setImpact}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alto">Alto</SelectItem>
                  <SelectItem value="Médio">Médio</SelectItem>
                  <SelectItem value="Baixo">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Urgência</label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
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

          <div className="space-y-1">
            <label className="text-xs font-semibold">Título do Chamado</label>
            <Input
              required
              placeholder="Ex: Falha ao acessar sistema de vendas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">Descrição detalhada</label>
            <Textarea
              required
              rows={4}
              placeholder="Descreva o problema ou solicitação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Abrir Chamado
          </Button>
        </form>
      </div>
    </div>
  )
}
