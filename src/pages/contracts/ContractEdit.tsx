import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowLeft, Save, AlertCircle, Plus, Trash2, Check } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  getContract,
  updateContract,
  ContractRecord,
  CONTRACT_TYPES,
  CONTRACT_STATUSES,
  SERVICE_DAYS,
  PRIORITY_OPTIONS,
  CONTRACT_HOURS_LEVELS,
  uniqueAgreementSlug,
  type CustomAgreementEntry,
} from '@/services/contracts'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { HoursBalanceBar } from '@/components/contracts/HoursBalance'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { key: 'basic', label: 'Informações Básicas' },
  { key: 'hours', label: 'Horas e Valores' },
  { key: 'distribution', label: 'Distribuição de Horas por Nível' },
  { key: 'sla', label: 'Parâmetros de SLA' },
  { key: 'services', label: 'Serviços e Políticas' },
  { key: 'notes', label: 'Observações' },
]

export default function ContractEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { canManageContracts } = usePermissions()

  const [contract, setContract] = useState<ContractRecord | null>(null)
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [form, setForm] = useState<Record<string, any>>({})
  const [customAgreements, setCustomAgreements] = useState<CustomAgreementEntry[]>([])
  // Chaves (ContractHoursLevel.key) dos acordos base removidos pelo usuário.
  const [removedLevels, setRemovedLevels] = useState<string[]>([])

  // Total de horas contratadas fixado pelo botão "Aplicar" — usado como saldo.
  const [appliedHours, setAppliedHours] = useState<number | null>(null)
  // Toggle de alocação por acordo de atendimento. Quando null, ainda não foi
  // determinado a partir dos dados carregados (ver loadContract).
  const [hasAgreements, setHasAgreements] = useState<boolean>(false)

  const loadContract = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setFetchError(null)
    try {
      const data = await getContract(id)
      setContract(data)
      setForm({
        number: data.number || '',
        company: data.company || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        status: data.status || 'Ativo',
        type: data.type || 'Pacote Mensal',
        monthly_hours: data.monthly_hours ?? '',
        accumulative_hours: data.accumulative_hours ?? false,
        overtime_hour_value: data.overtime_hour_value ?? '',
        monthly_hour_limit: data.monthly_hour_limit ?? '',
        service_hours_start: data.service_hours_start || '',
        service_hours_end: data.service_hours_end || '',
        service_days: data.service_days || 'Seg-Sex',
        on_duty_coverage: data.on_duty_coverage ?? false,
        sla_response_time: data.sla_response_time ?? '',
        sla_solution_time: data.sla_solution_time ?? '',
        sla_update_time: data.sla_update_time ?? '',
        sla_field_service_time: data.sla_field_service_time ?? '',
        priorities_available: data.priorities_available || [],
        included_services: data.included_services || '',
        excluded_services: data.excluded_services || '',
        overtime_policy: data.overtime_policy || '',
        travel_policy: data.travel_policy || '',
        technical_visit_policy: data.technical_visit_policy || '',
        hours_level1: data.hours_level1 ?? '',
        hours_level2: data.hours_level2 ?? '',
        hours_level3: data.hours_level3 ?? '',
        hours_consultoria: data.hours_consultoria ?? '',
        hours_backoffice: data.hours_backoffice ?? '',
        hours_administrativo: data.hours_administrativo ?? '',
        notes: data.notes || '',
      })
      setCustomAgreements(Array.isArray(data.custom_agreements) ? data.custom_agreements : [])

      // Saldo inicial: usa monthly_hours carregado como total contratado.
      const mh = typeof data.monthly_hours === 'number' ? data.monthly_hours : null
      setAppliedHours(mh)

      // Toggle automático: liga quando o contrato já tem distribuição salva.
      const hasBaseLevel = CONTRACT_HOURS_LEVELS.some((lvl) => {
        const v = data[lvl.key]
        return v !== null && v !== undefined && Number(v) > 0
      })
      const hasCustom = (data.custom_agreements || []).some(
        (a) => a && a.active && Number(a.hours ?? 0) > 0,
      )
      setHasAgreements(hasBaseLevel || hasCustom)
    } catch {
      setFetchError('Não foi possível carregar o contrato. Verifique se ele ainda existe.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  const set = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  // Soma em tempo real das horas distribuídas nos acordos (níveis + personalizados).
  const allocatedHours = useMemo(() => {
    const levelSum = CONTRACT_HOURS_LEVELS.reduce((sum, lvl) => {
      const v = form[lvl.key]
      const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : 0
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
    const customSum = customAgreements.reduce((sum, a) => {
      if (!a.active) return sum
      const n = typeof a.hours === 'number' ? a.hours : 0
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
    return levelSum + customSum
  }, [form, customAgreements])

  const applyHours = () => {
    const v = form.monthly_hours
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
    setAppliedHours(Number.isFinite(n) && n >= 0 ? n : null)
  }

  const togglePriority = (p: string) => {
    const current: string[] = form.priorities_available || []
    set(
      'priorities_available',
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    const errors: FieldErrors = {}
    if (!form.number?.trim()) errors.number = 'Número é obrigatório'
    if (!form.company) errors.company = 'Empresa é obrigatória'
    if (!form.status) errors.status = 'Status é obrigatório'
    if (!form.type) errors.type = 'Tipo é obrigatório'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      const payload: Record<string, any> = { ...form }
      for (const key of [
        'monthly_hours',
        'overtime_hour_value',
        'monthly_hour_limit',
        'sla_response_time',
        'sla_solution_time',
        'sla_update_time',
        'sla_field_service_time',
        'hours_level1',
        'hours_level2',
        'hours_level3',
        'hours_consultoria',
        'hours_backoffice',
        'hours_administrativo',
      ]) {
        if (payload[key] === '' || payload[key] === undefined) {
          payload[key] = null
        } else {
          payload[key] = Number(payload[key])
        }
      }
      // Acordos base removidos também têm suas horas zeradas para consistência.
      removedLevels.forEach((key) => {
        payload[key] = null
      })
      payload.custom_agreements = customAgreements
      payload.removed_levels = removedLevels
      await updateContract(id, payload)
      toast({ title: 'Contrato atualizado com sucesso!' })
      navigate('/contracts')
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao atualizar contrato', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!canManageContracts) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">
          Você não tem permissão para editar contratos.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/contracts')}>
          Voltar para Lista
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">{fetchError}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/contracts')}>
          Voltar para Lista
        </Button>
      </div>
    )
  }

  const Err = ({ field }: { field: string }) =>
    fieldErrors[field] ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p> : null

  const inputCls = 'h-9 text-sm'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Editar Contrato
            </h2>
            <p className="text-sm text-slate-500">{contract?.number}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[0].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Número do Contrato *</Label>
              <Input
                className={inputCls}
                value={form.number || ''}
                onChange={(e) => set('number', e.target.value)}
              />
              <Err field="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empresa *</Label>
              <Select value={form.company || ''} onValueChange={(v) => set('company', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err field="company" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status *</Label>
              <Select value={form.status || ''} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err field="status" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Contrato *</Label>
              <Select value={form.type || ''} onValueChange={(v) => set('type', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err field="type" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de Início</Label>
              <Input
                type="date"
                className={inputCls}
                value={form.start_date || ''}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data de Término</Label>
              <Input
                type="date"
                className={inputCls}
                value={form.end_date || ''}
                onChange={(e) => set('end_date', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Hours and Values */}
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[1].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Horas Mensais</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className={inputCls}
                  value={form.monthly_hours ?? ''}
                  onChange={(e) =>
                    set('monthly_hours', e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={applyHours}
                >
                  <Check className="mr-1 h-4 w-4" /> Aplicar
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Clique em “Aplicar” para fixar o total de horas contratadas e acompanhar o saldo.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Limite de Horas Mensais</Label>
              <Input
                type="number"
                className={inputCls}
                value={form.monthly_hour_limit ?? ''}
                onChange={(e) =>
                  set('monthly_hour_limit', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor Hora Extra</Label>
              <Input
                type="number"
                step="0.01"
                className={inputCls}
                value={form.overtime_hour_value ?? ''}
                onChange={(e) =>
                  set('overtime_hour_value', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dias de Atendimento</Label>
              <Select value={form.service_days || ''} onValueChange={(v) => set('service_days', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_DAYS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Início do Horário</Label>
              <Input
                type="time"
                className={inputCls}
                value={form.service_hours_start || ''}
                onChange={(e) => set('service_hours_start', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim do Horário</Label>
              <Input
                type="time"
                className={inputCls}
                value={form.service_hours_end || ''}
                onChange={(e) => set('service_hours_end', e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={!!form.accumulative_hours}
                onCheckedChange={(v) => set('accumulative_hours', v)}
              />
              <Label className="text-xs">Horas Acumulativas</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!form.on_duty_coverage}
                onCheckedChange={(v) => set('on_duty_coverage', v)}
              />
              <Label className="text-xs">Cobertura de Plantão</Label>
            </div>
          </div>
        </div>

        {/* Hours Distribution by Level */}
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[2].label}
          </h3>

          {/* Toggle: este contrato possui alocação por acordo de atendimento? */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div>
              <label className="text-xs font-semibold">
                Este contrato possui alocação de horas por acordo de atendimento?
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Quando desligado, a distribuição de horas fica oculta.
              </p>
            </div>
            <Switch checked={hasAgreements} onCheckedChange={setHasAgreements} />
          </div>

          {appliedHours !== null && appliedHours > 0 && (
            <HoursBalanceBar total={appliedHours} allocated={allocatedHours} />
          )}

          {hasAgreements && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Marque os acordos contratados e informe a quantidade de horas acordadas para cada
                um.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {CONTRACT_HOURS_LEVELS.filter((level) => !removedLevels.includes(level.key)).map(
                  (level) => {
                    const active =
                      form[level.key] !== '' &&
                      form[level.key] !== undefined &&
                      form[level.key] !== null
                    return (
                      <div
                        key={level.key}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <Checkbox
                          id={`dist-${level.key}`}
                          checked={active}
                          onCheckedChange={(checked) =>
                            set(level.key, checked ? form[level.key] || 0 : '')
                          }
                        />
                        <label
                          htmlFor={`dist-${level.key}`}
                          className="text-xs font-medium cursor-pointer select-none min-w-[110px]"
                        >
                          {level.label}
                        </label>
                        <Input
                          type="number"
                          className={cn(inputCls, !active && 'opacity-40 pointer-events-none')}
                          placeholder="Horas"
                          value={form[level.key] ?? ''}
                          disabled={!active}
                          onChange={(e) =>
                            set(level.key, e.target.value === '' ? '' : Number(e.target.value))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          title={`Remover ${level.label}`}
                          onClick={() => {
                            setRemovedLevels((prev) => [...prev, level.key])
                            set(level.key, '')
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  },
                )}
                {customAgreements.map((ag, idx) => (
                  <div
                    key={ag.slug}
                    className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/30"
                  >
                    <Checkbox
                      id={`dist-custom-${ag.slug}`}
                      checked={ag.active}
                      onCheckedChange={(checked) =>
                        setCustomAgreements((prev) =>
                          prev.map((a, i) =>
                            i === idx
                              ? { ...a, active: !!checked, hours: checked ? (a.hours ?? 0) : null }
                              : a,
                          ),
                        )
                      }
                    />
                    <Input
                      className={cn(inputCls, 'min-w-[110px]')}
                      placeholder="Nome do acordo"
                      value={ag.name}
                      onChange={(e) =>
                        setCustomAgreements((prev) =>
                          prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a)),
                        )
                      }
                    />
                    <Input
                      type="number"
                      className={cn(inputCls, !ag.active && 'opacity-40 pointer-events-none')}
                      placeholder="Horas"
                      value={ag.hours ?? ''}
                      disabled={!ag.active}
                      onChange={(e) =>
                        setCustomAgreements((prev) =>
                          prev.map((a, i) =>
                            i === idx
                              ? {
                                  ...a,
                                  hours: e.target.value === '' ? null : Number(e.target.value),
                                }
                              : a,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() =>
                        setCustomAgreements((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() =>
                  setCustomAgreements((prev) => [
                    ...prev,
                    {
                      slug: uniqueAgreementSlug('Novo Acordo', prev),
                      name: '',
                      hours: null,
                      active: true,
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar acordo de atendimento
              </Button>
            </>
          )}
        </div>

        {/* SLA Parameters */}
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[3].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">SLA Resposta (min)</Label>
              <Input
                type="number"
                className={inputCls}
                value={form.sla_response_time ?? ''}
                onChange={(e) =>
                  set('sla_response_time', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SLA Solução (min)</Label>
              <Input
                type="number"
                className={inputCls}
                value={form.sla_solution_time ?? ''}
                onChange={(e) =>
                  set('sla_solution_time', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SLA Atualização (min)</Label>
              <Input
                type="number"
                className={inputCls}
                value={form.sla_update_time ?? ''}
                onChange={(e) =>
                  set('sla_update_time', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SLA Campo (min)</Label>
              <Input
                type="number"
                className={inputCls}
                value={form.sla_field_service_time ?? ''}
                onChange={(e) =>
                  set('sla_field_service_time', e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Label className="text-xs">Prioridades Disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((p) => {
                const selected = (form.priorities_available || []).includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePriority(p)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Services and Policies */}
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[4].label}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Serviços Incluídos</Label>
              <Textarea
                rows={3}
                value={form.included_services || ''}
                onChange={(e) => set('included_services', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serviços Excluídos</Label>
              <Textarea
                rows={3}
                value={form.excluded_services || ''}
                onChange={(e) => set('excluded_services', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Política de Horas Extras</Label>
              <Textarea
                rows={3}
                value={form.overtime_policy || ''}
                onChange={(e) => set('overtime_policy', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Política de Deslocamento</Label>
              <Textarea
                rows={3}
                value={form.travel_policy || ''}
                onChange={(e) => set('travel_policy', e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Política de Visita Técnica</Label>
              <Textarea
                rows={3}
                value={form.technical_visit_policy || ''}
                onChange={(e) => set('technical_visit_policy', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {SECTIONS[5].label}
          </h3>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={4}
              value={form.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
