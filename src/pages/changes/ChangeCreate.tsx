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
import { createChange } from '@/services/changes'
import { getChangeTypes, type ChangeTypeRecord } from '@/services/change-types'
import { getActiveChangeTemplates, type ChangeTemplateRecord } from '@/services/change-templates'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getCategories, type CategoryRecord } from '@/services/categories'
import { getUsers, type UserItem } from '@/services/users'
import {
  CHANGE_PRIORITIES,
  CHANGE_IMPACTS,
  CHANGE_URGENCIES,
  RISK_LEVELS,
} from '@/lib/change-constants'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

export default function ChangeCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [types, setTypes] = useState<ChangeTypeRecord[]>([])
  const [templates, setTemplates] = useState<ChangeTemplateRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    change_type: '',
    template: '',
    priority: 'Média',
    impact: 'Médio',
    urgency: 'Média',
    risk_level: 'Baixo',
    risk_assessment: '',
    company: '',
    responsible: '',
    planned_start: '',
    planned_end: '',
    execution_plan: '',
    rollback_plan: '',
  })

  useEffect(() => {
    Promise.all([
      getChangeTypes(),
      getActiveChangeTemplates(),
      getCompanies(),
      getCategories(),
      getUsers("role='tecnico' || role='gestor' || role='admin'"),
    ])
      .then(([t, tmpl, c, cat, u]) => {
        setTypes(t)
        setTemplates(tmpl)
        setCompanies(c)
        setCategories(cat)
        setUsers(u as UserItem[])
      })
      .catch(() => {})
  }, [])

  const handleTemplateChange = (id: string) => {
    setForm({ ...form, template: id })
    const tmpl = templates.find((t) => t.id === id)
    if (tmpl) {
      setForm((prev) => ({
        ...prev,
        template: id,
        priority: tmpl.default_priority || prev.priority,
        impact: tmpl.default_impact || prev.impact,
        urgency: tmpl.default_urgency || prev.urgency,
        risk_level: tmpl.default_risk_level || prev.risk_level,
        execution_plan: tmpl.procedure || prev.execution_plan,
        rollback_plan: tmpl.rollback_procedure || prev.rollback_plan,
        change_type: tmpl.change_type || prev.change_type,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.title.trim() || !form.description.trim()) return
    setSubmitting(true)
    setErrors({})
    try {
      const num = `MUD-2026-${Math.floor(10000 + Math.random() * 90000)}`
      await createChange({
        number: num,
        title: form.title,
        description: form.description,
        change_type: form.change_type || undefined,
        template: form.template || undefined,
        priority: form.priority,
        impact: form.impact,
        urgency: form.urgency,
        risk_level: form.risk_level,
        risk_assessment: form.risk_assessment || undefined,
        requester: user.id,
        responsible: form.responsible || undefined,
        company: form.company || undefined,
        category: undefined,
        planned_start: form.planned_start || undefined,
        planned_end: form.planned_end || undefined,
        execution_plan: form.execution_plan || undefined,
        rollback_plan: form.rollback_plan || undefined,
        status: 'Solicitada',
        approval_status: 'Não Requerida',
      })
      toast({ title: 'Mudança registrada com sucesso!' })
      navigate('/changes')
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao criar mudança', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/changes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-xl font-bold">Nova Solicitação de Mudança</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <Label className="text-sm">Título *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
        </div>
        <div>
          <Label className="text-sm">Descrição *</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
          {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Tipo de Mudança</Label>
            <Select
              value={form.change_type}
              onValueChange={(v) => setForm({ ...form, change_type: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={form.template} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Impacto</Label>
            <Select value={form.impact} onValueChange={(v) => setForm({ ...form, impact: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_IMPACTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Urgência</Label>
            <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_URGENCIES.map((p) => (
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
            <Label className="text-xs">Nível de Risco</Label>
            <Select
              value={form.risk_level}
              onValueChange={(v) => setForm({ ...form, risk_level: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Responsável</Label>
            <Select
              value={form.responsible}
              onValueChange={(v) => setForm({ ...form, responsible: v })}
            >
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
        </div>
        <div>
          <Label className="text-xs">Avaliação de Risco</Label>
          <Textarea
            value={form.risk_assessment}
            onChange={(e) => setForm({ ...form, risk_assessment: e.target.value })}
            rows={2}
            placeholder="Descreva os riscos identificados..."
          />
        </div>
        <div>
          <Label className="text-xs">Cliente</Label>
          <Select value={form.company} onValueChange={(v) => setForm({ ...form, company: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)" />
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Início Planejado</Label>
            <Input
              type="datetime-local"
              value={form.planned_start}
              onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Fim Planejado</Label>
            <Input
              type="datetime-local"
              value={form.planned_end}
              onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Plano de Execução</Label>
          <Textarea
            value={form.execution_plan}
            onChange={(e) => setForm({ ...form, execution_plan: e.target.value })}
            rows={3}
          />
        </div>
        <div>
          <Label className="text-xs">Plano de Rollback</Label>
          <Textarea
            value={form.rollback_plan}
            onChange={(e) => setForm({ ...form, rollback_plan: e.target.value })}
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/changes')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar Mudança'}{' '}
            <Check className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
