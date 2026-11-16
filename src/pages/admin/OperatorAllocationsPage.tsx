// Alocação de Operadores em Clientes (v0.0.442) — sede/filiais, exclusiva ou por período
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, MapPin, Pencil, Plus, Power, RefreshCw, Trash2, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CompanyRecord, getCompanies, getCompanyUnits } from '@/services/companies'
import { getOperators } from '@/services/operators'
import { OperatorItem } from '@/types/operators'
import {
  ALLOCATION_TYPE_LABELS,
  OperatorAllocation,
  OperatorAllocationRecurrence,
  createOperatorAllocation,
  deleteOperatorAllocation,
  formatRecurrence,
  isAllocationActiveNow,
  listOperatorAllocations,
  updateOperatorAllocation,
} from '@/services/operator-allocations'

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
]

const WEEKS = [1, 2, 3, 4, 5]

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
]

interface UnitRecord {
  id: string
  company: string
  name?: string
}

interface FormState {
  operator: string
  company: string
  unit: string
  allocation_type: 'permanente' | 'periodo'
  start_date: string
  end_date: string
  days_of_week: number[]
  weeks_of_month: number[]
  months: number[]
  notes: string
  active: boolean
}

const EMPTY_FORM: FormState = {
  operator: '',
  company: '',
  unit: '',
  allocation_type: 'permanente',
  start_date: '',
  end_date: '',
  days_of_week: [],
  weeks_of_month: [],
  months: [],
  notes: '',
  active: true,
}

function toISODate(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(`${value}T12:00:00`)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function fromISODate(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toggleIn(list: number[], value: number): number[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value].sort((a, b) => a - b)
}

export default function OperatorAllocationsPage() {
  const { toast } = useToast()
  const permissions = usePermissions()
  const canManage =
    permissions.isAdmin || permissions.canAccessItem('admin', 'admin_operator_allocations', 'edit')

  const [loading, setLoading] = useState(true)
  const [allocations, setAllocations] = useState<OperatorAllocation[]>([])
  const [operators, setOperators] = useState<OperatorItem[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [units, setUnits] = useState<UnitRecord[]>([])

  const [operatorFilter, setOperatorFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OperatorAllocation | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [allocs, ops, comps, unitsAll] = await Promise.all([
        listOperatorAllocations(),
        getOperators(),
        getCompanies(),
        pbListAllUnits(),
      ])
      setAllocations(allocs)
      setOperators(ops)
      setCompanies(comps)
      setUnits(unitsAll)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar alocações',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filtered = useMemo(() => {
    return allocations.filter((a) => {
      if (operatorFilter !== 'all' && a.operator !== operatorFilter) return false
      if (companyFilter !== 'all' && a.company !== companyFilter) return false
      return true
    })
  }, [allocations, operatorFilter, companyFilter])

  const operatorName = useCallback(
    (id: string) => {
      const op = operators.find((o) => o.id === id)
      if (op) return op.name || `${op.first_name || ''} ${op.last_name || ''}`.trim() || op.email
      return id
    },
    [operators],
  )

  const companyName = useCallback(
    (id: string) => {
      const c = companies.find((x) => x.id === id)
      if (c) return c.trade_name || c.legal_name
      return id
    },
    [companies],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (a: OperatorAllocation) => {
    setEditing(a)
    let rec: OperatorAllocationRecurrence = {}
    try {
      rec = a.recurrence_json ? JSON.parse(a.recurrence_json) : {}
    } catch {
      rec = {}
    }
    setForm({
      operator: a.operator,
      company: a.company,
      unit: a.unit || '',
      allocation_type: a.allocation_type,
      start_date: fromISODate(a.start_date),
      end_date: fromISODate(a.end_date),
      days_of_week: rec.days_of_week || [],
      weeks_of_month: rec.weeks_of_month || [],
      months: rec.months || [],
      notes: a.notes || '',
      active: a.active !== false,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.operator || !form.company) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione o operador e o cliente da alocação.',
        variant: 'destructive',
      })
      return
    }
    if (form.allocation_type === 'periodo' && !form.start_date) {
      toast({
        title: 'Vigência obrigatória',
        description: 'Informe a data de início da alocação por período.',
        variant: 'destructive',
      })
      return
    }
    const recurrence: OperatorAllocationRecurrence = {}
    if (form.days_of_week.length > 0) recurrence.days_of_week = form.days_of_week
    if (form.weeks_of_month.length > 0) recurrence.weeks_of_month = form.weeks_of_month
    if (form.months.length > 0) recurrence.months = form.months

    const payload: Record<string, unknown> = {
      operator: form.operator,
      company: form.company,
      unit: form.unit || undefined,
      allocation_type: form.allocation_type,
      start_date: toISODate(form.start_date),
      end_date: toISODate(form.end_date),
      recurrence_json: form.allocation_type === 'periodo' ? JSON.stringify(recurrence) : undefined,
      notes: form.notes.trim() || undefined,
    }
    if (!form.unit) delete payload.unit

    setSaving(true)
    try {
      if (editing) {
        await updateOperatorAllocation(editing.id, { ...payload, active: form.active })
        toast({ title: 'Alocação atualizada com sucesso!' })
      } else {
        await createOperatorAllocation({ ...payload, active: true })
        toast({ title: 'Alocação cadastrada com sucesso!' })
      }
      setDialogOpen(false)
      await loadAll()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar alocação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (a: OperatorAllocation) => {
    setTogglingId(a.id)
    try {
      await updateOperatorAllocation(a.id, { active: !a.active })
      toast({
        title: !a.active ? 'Alocação ativada' : 'Alocação desativada',
        description: !a.active
          ? 'A alocação voltou a valer dentro da vigência/recorrência dela.'
          : 'A alocação deixou de valer até ser reativada.',
      })
      await loadAll()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao alterar status',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (a: OperatorAllocation) => {
    if (!permissions.isAdmin) {
      toast({
        title: 'Permissão negada',
        description: 'Apenas administradores podem excluir alocações.',
        variant: 'destructive',
      })
      return
    }
    try {
      await deleteOperatorAllocation(a.id)
      toast({ title: 'Alocação excluída' })
      await loadAll()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao excluir alocação',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const toggleWeekday = (d: number) =>
    setForm((f) => ({ ...f, days_of_week: toggleIn(f.days_of_week, d) }))
  const toggleWeek = (w: number) =>
    setForm((f) => ({ ...f, weeks_of_month: toggleIn(f.weeks_of_month, w) }))
  const toggleMonth = (m: number) => setForm((f) => ({ ...f, months: toggleIn(f.months, m) }))

  const unitsForCompany = useMemo(
    () => units.filter((u) => u.company === form.company),
    [units, form.company],
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Alocação de Operadores
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operadores presenciais na sede/filiais de clientes: exclusivos/permanentes ou por
              período com recorrência
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            disabled={loading}
            className="h-9 hover:border-primary/40"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            Atualizar
          </Button>
          {canManage && (
            <Button
              onClick={openCreate}
              className="bg-primary hover:brightness-110 text-primary-foreground font-semibold h-9 shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Alocação
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select value={operatorFilter} onValueChange={setOperatorFilter}>
          <SelectTrigger className="h-9 bg-card text-xs">
            <SelectValue placeholder="Operador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Operadores</SelectItem>
            {operators.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name || o.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="h-9 bg-card text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.trade_name || c.legal_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-end text-xs text-muted-foreground px-1">
          Exibindo <strong className="mx-1">{filtered.length}</strong> de{' '}
          <strong className="mx-1">{allocations.length}</strong> alocações
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Nenhuma alocação encontrada</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {operatorFilter !== 'all' || companyFilter !== 'all'
                ? 'Nenhuma alocação corresponde aos filtros selecionados.'
                : 'Cadastre a primeira alocação de operador em cliente.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-xs">Operador</TableHead>
                <TableHead className="font-semibold text-xs">Cliente / Unidade</TableHead>
                <TableHead className="font-semibold text-xs">Tipo</TableHead>
                <TableHead className="font-semibold text-xs">Recorrência / Vigência</TableHead>
                <TableHead className="font-semibold text-xs text-center">Situação</TableHead>
                <TableHead className="text-right font-semibold text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const activeNow = isAllocationActiveNow(a)
                return (
                  <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-sm">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {a.expand?.operator?.name || operatorName(a.operator)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">
                          {a.expand?.company?.trade_name ||
                            a.expand?.company?.legal_name ||
                            companyName(a.company)}
                        </p>
                        {a.unit && (
                          <p className="text-[11px] text-muted-foreground">
                            Unidade: {a.expand?.unit?.name || a.unit}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${
                          a.allocation_type === 'permanente'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {ALLOCATION_TYPE_LABELS[a.allocation_type] || a.allocation_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">
                      {formatRecurrence(a)}
                      {(a.start_date || a.end_date) && (
                        <p className="text-[11px] mt-0.5">
                          Vigência: {a.start_date ? fromISODate(a.start_date) : '—'} até{' '}
                          {a.end_date ? fromISODate(a.end_date) : '—'}
                        </p>
                      )}
                      {a.notes && <p className="text-[11px] mt-0.5 italic">{a.notes}</p>}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {a.active ? (
                          activeNow ? (
                            <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">
                              Alocado hoje
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Agendada / fora da recorrência
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Inativa
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                            title={a.active ? 'Desativar alocação' : 'Ativar alocação'}
                            disabled={togglingId === a.id}
                            onClick={() => handleToggleActive(a)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar alocação"
                            onClick={() => openEdit(a)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                        )}
                        {permissions.isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                            title="Excluir alocação"
                            onClick={() => handleDelete(a)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Alocação' : 'Nova Alocação de Operador'}</DialogTitle>
            <DialogDescription>
              O operador alocado recebe somente chamados do cliente selecionado durante a vigência
              da alocação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Operador *</Label>
              <Select
                value={form.operator}
                onValueChange={(v) => setForm((f) => ({ ...f, operator: v }))}
              >
                <SelectTrigger className="h-9 bg-card text-xs">
                  <SelectValue placeholder="Selecione o operador" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name || o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select
                value={form.company}
                onValueChange={(v) => setForm((f) => ({ ...f, company: v, unit: '' }))}
              >
                <SelectTrigger className="h-9 bg-card text-xs">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name || c.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade (opcional)</Label>
              <Select
                value={form.unit || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, unit: v === 'none' ? '' : v }))}
                disabled={!form.company}
              >
                <SelectTrigger className="h-9 bg-card text-xs">
                  <SelectValue placeholder="Sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sede (sem unidade)</SelectItem>
                  {unitsForCompany.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Alocação *</Label>
              <Select
                value={form.allocation_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, allocation_type: v as FormState['allocation_type'] }))
                }
              >
                <SelectTrigger className="h-9 bg-card text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanente">Exclusiva / Permanente</SelectItem>
                  <SelectItem value="periodo">Por Período (recorrência)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Início da vigência {form.allocation_type === 'periodo' ? '*' : ''}</Label>
              <Input
                type="date"
                className="h-9 bg-card text-xs"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fim da vigência (opcional)</Label>
              <Input
                type="date"
                className="h-9 bg-card text-xs"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>

          {form.allocation_type === 'periodo' && (
            <div className="space-y-4 rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-xs font-semibold text-foreground">
                Recorrência (deixe tudo vazio para valer todos os dias da vigência)
              </p>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWeekday(d.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        form.days_of_week.includes(d.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Semanas do mês</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => toggleWeek(w)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        form.weeks_of_month.includes(w)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {w}ª semana
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Meses do ano</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => toggleMonth(m.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        form.months.includes(m.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              placeholder="Ex.: atendimento presencial na filial Zona Sul"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="bg-card text-xs"
            />
          </div>

          {editing && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">Alocação ativa</p>
                <p className="text-[11px] text-muted-foreground">
                  Alocações inativas não são consideradas na distribuição automática.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              {saving ? 'Salvando...' : 'Salvar Alocação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Lista todas as unidades de todos os clientes (para o select do formulário). */
async function pbListAllUnits(): Promise<UnitRecord[]> {
  const pb = (await import('@/lib/pocketbase/client')).default
  return pb.collection('company_units').getFullList<UnitRecord>({ sort: 'name' })
}
