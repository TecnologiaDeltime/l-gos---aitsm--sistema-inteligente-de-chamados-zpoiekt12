import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Save,
  Play,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatHoursToHHMMSS } from '@/lib/duration'
import {
  getClientConsumptionAgentByCompany,
  saveClientConsumptionAgent,
  triggerConsumptionAgentEvaluation,
  type ClientConsumptionAgentRecord,
} from '@/services/client-consumption-agent'

interface ClientConsumptionSectionProps {
  companyId: string
  companyName?: string
  canEdit?: boolean
}

export function ClientConsumptionSection({
  companyId,
  companyName = 'Cliente',
  canEdit = true,
}: ClientConsumptionSectionProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [agent, setAgent] = useState<ClientConsumptionAgentRecord | null>(null)

  const [form, setForm] = useState({
    enabled: true,
    deviationHighPct: 30,
    deviationLowPct: 30,
    learningWindowMonths: 3,
  })

  const { toast } = useToast()

  const loadAgent = async () => {
    setLoading(true)
    try {
      const data = await getClientConsumptionAgentByCompany(companyId)
      setAgent(data)
      if (data) {
        setForm({
          enabled: data.enabled !== false,
          deviationHighPct: data.deviation_high_pct ?? 30,
          deviationLowPct: data.deviation_low_pct ?? 30,
          learningWindowMonths: data.learning_window_months ?? 3,
        })
      }
    } catch {
      toast({
        title: 'Erro ao carregar agente de consumo do cliente',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId) {
      loadAgent()
    }
  }, [companyId])

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const updated = await saveClientConsumptionAgent({
        id: agent?.id,
        company: companyId,
        enabled: form.enabled,
        deviation_high_pct: Number(form.deviationHighPct),
        deviation_low_pct: Number(form.deviationLowPct),
        learning_window_months: Number(form.learningWindowMonths),
      })
      setAgent(updated)
      toast({
        title: 'Parâmetros do agente de consumo salvos',
      })
    } catch {
      toast({
        title: 'Erro ao salvar parâmetros do agente',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      await triggerConsumptionAgentEvaluation({
        companyId: companyId,
        forceAlert: false,
      })
      toast({
        title: 'Avaliação concluída',
        description: 'Média histórica recalculada e desvios avaliados.',
      })
      await loadAgent()
    } catch {
      toast({
        title: 'Erro ao avaliar consumo do cliente',
        variant: 'destructive',
      })
    } finally {
      setEvaluating(false)
    }
  }

  const isHigh = agent?.current_status === 'high'
  const isLow = agent?.current_status === 'low'
  const isNormal = agent?.current_status === 'normal'

  return (
    <Card className="itsm-card border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <BrainCircuit className="h-5 w-5 text-amber-500" />
              Agente Inteligente de Consumo de Horas
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Monitoramento preditivo de horas de franquia para {companyName}. Notifica Qualidade e
              Gestores em caso de desvio.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={evaluating || loading}
              className="gap-1.5 text-xs"
            >
              <Play className={`h-3.5 w-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              {evaluating ? 'Recalculando...' : 'Recalcular Média'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {loading ? (
          <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
            <span className="text-xs">Carregando dados do agente...</span>
          </div>
        ) : (
          <>
            {/* CARDS COM MÉDIA APRENDIDA E STATUS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 font-medium">Média Histórica Aprendida</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {agent && agent.learned_average_hours > 0
                    ? `${formatHoursToHHMMSS(agent.learned_average_hours)} / mês`
                    : 'Aguardando avaliação'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {agent?.learned_reference_period || 'Sem dados anteriores'}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 font-medium">Consumo no Mês Atual</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {agent?.current_period_consumed_hours !== undefined
                    ? formatHoursToHHMMSS(agent.current_period_consumed_hours)
                    : '00:00:00'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Débito de franquia acumulado</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 font-medium">Diagnóstico do Agente</p>
                <div className="mt-1">
                  {isHigh && (
                    <Badge className="bg-red-600 hover:bg-red-700 text-white gap-1">
                      <TrendingUp className="h-3 w-3" />+{agent?.current_period_deviation_pct}%
                      Elevado
                    </Badge>
                  )}
                  {isLow && (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {agent?.current_period_deviation_pct}% Abaixo
                    </Badge>
                  )}
                  {isNormal && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Dentro do Padrão ({agent?.current_period_deviation_pct}%)
                    </Badge>
                  )}
                  {(!agent || agent.current_status === 'no_data') && (
                    <Badge variant="outline" className="text-xs text-slate-400">
                      Histórico insuficiente
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* FORMULÁRIO DE CONFIGURAÇÃO */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Habilitar Monitoramento deste Cliente
                  </Label>
                  <p className="text-xs text-slate-500">
                    Ativa alertas para gestores e qualidade caso ocorra desvio
                  </p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(val) => setForm((prev) => ({ ...prev, enabled: val }))}
                  disabled={!canEdit}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tolerância Acima (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={200}
                      value={form.deviationHighPct}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, deviationHighPct: Number(e.target.value) }))
                      }
                      disabled={!canEdit}
                      className="h-9"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Alerta vermelho acima de +{form.deviationHighPct}%
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tolerância Abaixo (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={95}
                      value={form.deviationLowPct}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, deviationLowPct: Number(e.target.value) }))
                      }
                      disabled={!canEdit}
                      className="h-9"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Alerta amarelo abaixo de -{form.deviationLowPct}%
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Janela Histórica</Label>
                  <Select
                    value={String(form.learningWindowMonths)}
                    onValueChange={(val) =>
                      setForm((prev) => ({ ...prev, learningWindowMonths: Number(val) }))
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Meses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 meses</SelectItem>
                      <SelectItem value="3">3 meses (Padrão)</SelectItem>
                      <SelectItem value="4">4 meses</SelectItem>
                      <SelectItem value="6">6 meses</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400">Meses de base histórica</p>
                </div>
              </div>

              {canEdit && (
                <div className="pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                    size="sm"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar Configuração do Agente'}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
