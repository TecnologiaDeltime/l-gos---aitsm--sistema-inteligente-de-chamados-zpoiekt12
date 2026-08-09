import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createProblem } from '@/services/problems'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getCategories, type CategoryRecord } from '@/services/categories'
import { getUsers, type UserItem } from '@/services/users'
import { getActiveContracts, type ContractRecord } from '@/services/contracts'
import {
  PROBLEM_ORIGINS,
  PROBLEM_FREQUENCIES,
  PROBLEM_PRIORITIES,
  PROBLEM_IMPACTS,
  PROBLEM_URGENCIES,
  computeProblemPriority,
} from '@/lib/problem-constants'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function ProblemCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    symptom: '',
    expected_behavior: '',
    current_behavior: '',
    impact_description: '',
    frequency: '',
    first_occurrence_date: '',
    last_occurrence_date: '',
    origin: '',
    origin_record_id: '',
    priority: 'Média',
    impact: 'Médio',
    urgency: 'Média',
    responsible: '',
    company: '',
    contract: '',
    service: '',
    category: '',
    subcategory: '',
  })

  useEffect(() => {
    Promise.all([getCompanies(), getCategories(), getUsers(), getActiveContracts()])
      .then(([c, cat, u, ctr]) => {
        setCompanies(c)
        setCategories(cat)
        setUsers(u as UserItem[])
        setContracts(ctr)
      })
      .catch(() => {})
  }, [])

  const setVal = (k: string, v: string) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v }
      if (k === 'impact' || k === 'urgency') {
        next.priority = computeProblemPriority(next.impact, next.urgency)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.title.trim() || !form.description.trim()) return
    setSubmitting(true)
    setErrors({})
    try {
      await createProblem({
        number: 'TEMP',
        title: form.title,
        description: form.description,
        symptom: form.symptom || undefined,
        expected_behavior: form.expected_behavior || undefined,
        current_behavior: form.current_behavior || undefined,
        impact_description: form.impact_description || undefined,
        frequency: form.frequency || undefined,
        first_occurrence_date: form.first_occurrence_date || undefined,
        last_occurrence_date: form.last_occurrence_date || undefined,
        origin: form.origin || undefined,
        origin_record_id: form.origin_record_id || undefined,
        priority: form.priority,
        impact: form.impact,
        urgency: form.urgency,
        requester: user.id,
        responsible: form.responsible || undefined,
        company: form.company || undefined,
        contract: form.contract || undefined,
        service: form.service || undefined,
        category: form.category || undefined,
        subcategory: form.subcategory || undefined,
        status: 'Novo',
      })
      toast({ title: 'Problema registrado com sucesso!' })
      navigate('/problems')
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao criar problema', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/problems"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-xl font-bold">Novo Problema</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <Label className="text-sm">Título *</Label>
          <Input value={form.title} onChange={(e) => setVal('title', e.target.value)} />
          {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
        </div>
        <div>
          <Label className="text-sm">Descrição *</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setVal('description', e.target.value)}
            rows={3}
          />
          {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
        </div>
        <div>
          <Label className="text-sm">Sintoma</Label>
          <Input value={form.symptom} onChange={(e) => setVal('symptom', e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Comportamento Esperado</Label>
            <Textarea
              value={form.expected_behavior}
              onChange={(e) => setVal('expected_behavior', e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Comportamento Atual</Label>
            <Textarea
              value={form.current_behavior}
              onChange={(e) => setVal('current_behavior', e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Impacto Operacional</Label>
          <Input
            value={form.impact_description}
            onChange={(e) => setVal('impact_description', e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={form.origin} onValueChange={(v) => setVal('origin', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_ORIGINS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Registro de Origem (ID)</Label>
            <Input
              value={form.origin_record_id}
              onChange={(e) => setVal('origin_record_id', e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Frequência</Label>
            <Select value={form.frequency} onValueChange={(v) => setVal('frequency', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Primeira Ocorrência</Label>
            <Input
              type="date"
              value={form.first_occurrence_date}
              onChange={(e) => setVal('first_occurrence_date', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Última Ocorrência</Label>
            <Input
              type="date"
              value={form.last_occurrence_date}
              onChange={(e) => setVal('last_occurrence_date', e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Impacto</Label>
            <Select value={form.impact} onValueChange={(v) => setVal('impact', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_IMPACTS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Urgência</Label>
            <Select value={form.urgency} onValueChange={(v) => setVal('urgency', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_URGENCIES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridade (calculada)</Label>
            <Select value={form.priority} onValueChange={(v) => setVal('priority', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Responsável</Label>
            <Select value={form.responsible} onValueChange={(v) => setVal('responsible', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={form.company} onValueChange={(v) => setVal('company', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Contrato</Label>
            <Select value={form.contract} onValueChange={(v) => setVal('contract', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Serviço Afetado</Label>
            <Input value={form.service} onChange={(e) => setVal('service', e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setVal('category', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Subcategoria</Label>
            <Select value={form.subcategory} onValueChange={(v) => setVal('subcategory', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/problems')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar Problema'}{' '}
            <Check className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
