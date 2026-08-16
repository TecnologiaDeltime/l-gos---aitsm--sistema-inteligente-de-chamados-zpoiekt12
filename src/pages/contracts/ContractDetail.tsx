import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createContract,
  CONTRACT_HOURS_LEVELS,
  uniqueAgreementSlug,
  type CustomAgreementEntry,
} from '@/services/contracts'
import { getCompanies, CompanyRecord } from '@/services/companies'
import { HoursBalanceBar } from '@/components/contracts/HoursBalance'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { parseDurationToSeconds, parseDurationToHours, formatSeconds } from '@/lib/duration'

export default function ContractDetail() {
  const [number, setNumber] = useState(`CT-2024-${Math.floor(100 + Math.random() * 900)}`)
  const [company, setCompany] = useState('')
  const [type, setType] = useState('Pacote Mensal')
  // "Horas Mensais" só se aplica a "Pacote de Horas"; demais tipos iniciam vazio.
  const [hours, setHours] = useState('')
  const [hoursByLevel, setHoursByLevel] = useState<Record<string, string>>({
    hours_level1: '',
    hours_level2: '',
    hours_level3: '',
    hours_consultoria: '',
    hours_backoffice: '',
    hours_administrativo: '',
  })
  const [customAgreements, setCustomAgreements] = useState<CustomAgreementEntry[]>([])
  // Chaves dos acordos de atendimento base removidos pelo usuário no formulário.
  const [removedLevels, setRemovedLevels] = useState<string[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])

  // Total de horas contratadas fixado pelo botão "Aplicar" — usado como saldo.
  const [appliedHours, setAppliedHours] = useState<number | null>(null)
  // Toggle de alocação por acordo de atendimento (novo contrato começa desligado).
  const [hasAgreements, setHasAgreements] = useState(false)

  // Soma em tempo real (em SEGUNDOS) das horas distribuídas nos acordos
  // (níveis + personalizados). Os campos do formulário estão em HH:MM:SS.
  const allocatedHours = useMemo(() => {
    const levelSum = CONTRACT_HOURS_LEVELS.reduce((sum, lvl) => {
      const s = parseDurationToSeconds(hoursByLevel[lvl.key])
      return sum + (s ?? 0)
    }, 0)
    const customSum = customAgreements.reduce((sum, a) => {
      if (!a.active) return sum
      const s = parseDurationToSeconds(a.hours)
      return sum + (s ?? 0)
    }, 0)
    return levelSum + customSum
  }, [hoursByLevel, customAgreements])

  const applyHours = () => {
    const n = parseDurationToSeconds(hours)
    setAppliedHours(n !== null && n >= 0 ? n : null)
  }

  // O campo "Horas Mensais" só é relevante (e habilitado) para "Pacote de Horas".
  const hoursEnabled = type === 'Pacote de Horas'

  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) {
      toast({ title: 'Selecione uma empresa', variant: 'destructive' })
      return
    }

    const levelPayload: Record<string, number | null> = {}
    CONTRACT_HOURS_LEVELS.forEach((level) => {
      const v = hoursByLevel[level.key]
      if (v === '' || v === undefined || v === null) {
        levelPayload[level.key] = null
      } else {
        // Converte HH:MM:SS para horas fracionadas (number) antes de salvar.
        levelPayload[level.key] = parseDurationToHours(v)
      }
    })

    // Acordos base removidos também têm suas horas zeradas para consistência.
    removedLevels.forEach((key) => {
      levelPayload[key] = null
    })

    await createContract({
      number,
      company,
      type,
      monthly_hours: parseDurationToHours(hours),
      status: 'Ativo',
      sla_response_time: 30,
      sla_solution_time: 240,
      ...levelPayload,
      custom_agreements: customAgreements.map((a) => {
        const h = a.hours
        const parsed = h === '' || h === undefined || h === null ? null : parseDurationToHours(h)
        return { ...a, hours: parsed }
      }),
      removed_levels: removedLevels,
    })

    toast({ title: 'Contrato salvo com sucesso!' })
    navigate('/contracts')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Novo Contrato</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Número do Contrato</Label>
            <Input required value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Empresa / Cliente</Label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo de Contrato</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v)
                  // "Pacote de Horas" habilita as horas mensais; demais tipos desabilitam e zeram.
                  if (v !== 'Pacote de Horas') {
                    setHours('')
                    setAppliedHours(null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pacote Mensal">Pacote Mensal</SelectItem>
                  <SelectItem value="Por Chamado">Por Chamado</SelectItem>
                  <SelectItem value="Pacote de Horas">Pacote de Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Horas Mensais</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="HH:MM:SS"
                  inputMode="numeric"
                  value={hours}
                  disabled={!hoursEnabled}
                  onChange={(e) => setHours(e.target.value)}
                  onBlur={(e) => {
                    const s = parseDurationToSeconds(e.target.value)
                    if (s !== null) setHours(formatSeconds(s))
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={!hoursEnabled}
                  onClick={applyHours}
                >
                  <Check className="mr-1 h-4 w-4" /> Aplicar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Clique em “Aplicar” para fixar o total de horas contratadas e acompanhar o saldo.
                Formato HH:MM:SS (ex.: 00:01:36 = 1min36s).
              </p>
            </div>
          </div>

          {appliedHours !== null && appliedHours > 0 && (
            <HoursBalanceBar total={appliedHours} allocated={allocatedHours} />
          )}

          {/* Toggle: este contrato possui alocação por acordo de atendimento? */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div>
              <label className="text-xs font-semibold">
                Este contrato possui alocação de horas por acordo de atendimento?
              </label>
              <p className="text-[11px] text-muted-foreground">
                Quando desligado, a distribuição de horas fica oculta.
              </p>
            </div>
            <Switch checked={hasAgreements} onCheckedChange={setHasAgreements} />
          </div>

          {/* Distribuição de horas por acordo de atendimento */}
          {hasAgreements && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold">
                  Distribuição de horas por acordo de atendimento
                </label>
                <p className="text-xs text-muted-foreground">
                  Marque os acordos contratados e informe a quantidade de horas acordadas.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CONTRACT_HOURS_LEVELS.filter((level) => !removedLevels.includes(level.key)).map(
                  (level) => {
                    const active =
                      hoursByLevel[level.key] !== '' &&
                      hoursByLevel[level.key] !== undefined &&
                      hoursByLevel[level.key] !== null
                    return (
                      <div
                        key={level.key}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <Checkbox
                          id={`new-${level.key}`}
                          checked={active}
                          onCheckedChange={(checked) =>
                            setHoursByLevel((prev) => ({
                              ...prev,
                              [level.key]: checked ? prev[level.key] || '00:00:00' : '',
                            }))
                          }
                        />
                        <label
                          htmlFor={`new-${level.key}`}
                          className="text-xs font-medium cursor-pointer select-none min-w-[110px]"
                        >
                          {level.label}
                        </label>
                        <Input
                          className={cn('h-9 text-sm', !active && 'opacity-40 pointer-events-none')}
                          placeholder="HH:MM:SS"
                          inputMode="numeric"
                          value={hoursByLevel[level.key] ?? ''}
                          disabled={!active}
                          onChange={(e) =>
                            setHoursByLevel((prev) => ({
                              ...prev,
                              [level.key]: e.target.value,
                            }))
                          }
                          onBlur={(e) => {
                            const s = parseDurationToSeconds(e.target.value)
                            if (s !== null) {
                              setHoursByLevel((prev) => ({
                                ...prev,
                                [level.key]: formatSeconds(s),
                              }))
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          title={`Remover ${level.label}`}
                          onClick={() => {
                            setRemovedLevels((prev) => [...prev, level.key])
                            setHoursByLevel((prev) => ({ ...prev, [level.key]: '' }))
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
                      id={`new-custom-${ag.slug}`}
                      checked={ag.active}
                      onCheckedChange={(checked) =>
                        setCustomAgreements((prev) =>
                          prev.map((a, i) =>
                            i === idx
                              ? {
                                  ...a,
                                  active: !!checked,
                                  hours: checked ? (a.hours ?? '00:00:00') : null,
                                }
                              : a,
                          ),
                        )
                      }
                    />
                    <Input
                      className="h-9 text-sm min-w-[110px]"
                      placeholder="Nome do acordo"
                      value={ag.name}
                      onChange={(e) =>
                        setCustomAgreements((prev) =>
                          prev.map((a, i) => (i === idx ? { ...a, name: e.target.value } : a)),
                        )
                      }
                    />
                    <Input
                      className={cn('h-9 text-sm', !ag.active && 'opacity-40 pointer-events-none')}
                      placeholder="HH:MM:SS"
                      inputMode="numeric"
                      value={ag.hours ?? ''}
                      disabled={!ag.active}
                      onChange={(e) =>
                        setCustomAgreements((prev) =>
                          prev.map((a, i) =>
                            i === idx
                              ? {
                                  ...a,
                                  hours: e.target.value === '' ? null : e.target.value,
                                }
                              : a,
                          ),
                        )
                      }
                      onBlur={(e) => {
                        if (e.target.value === '') return
                        const s = parseDurationToSeconds(e.target.value)
                        if (s !== null) {
                          setCustomAgreements((prev) =>
                            prev.map((a, i) => (i === idx ? { ...a, hours: formatSeconds(s) } : a)),
                          )
                        }
                      }}
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
            </div>
          )}

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Salvar Contrato
          </Button>
        </form>
      </div>
    </div>
  )
}
