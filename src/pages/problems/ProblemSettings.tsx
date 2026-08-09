import { useState, useEffect } from 'react'
import { Settings, ShieldCheck, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const SETTINGS_KEY = 'itsm_problem_settings'

interface ProblemSettingsData {
  effectivenessPeriodDays: number
  recurrenceThreshold: number
  recurrenceDaysWindow: number
  notifyNewProblem: boolean
  notifyEffectivenessEnding: boolean
  notifyLastDay: boolean
  requireEvidenceOnClosure: boolean
  autoStartEffectiveness: boolean
}

const DEFAULTS: ProblemSettingsData = {
  effectivenessPeriodDays: 15,
  recurrenceThreshold: 5,
  recurrenceDaysWindow: 30,
  notifyNewProblem: true,
  notifyEffectivenessEnding: true,
  notifyLastDay: true,
  requireEvidenceOnClosure: true,
  autoStartEffectiveness: true,
}

export default function ProblemSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<ProblemSettingsData>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch {
      /* noop */
    }
  }, [])

  const update = (key: keyof ProblemSettingsData, value: boolean | number) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Settings className="h-5 w-5" /> Configurações de Problemas
      </h2>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Análise de Efetividade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período de Análise de Efetividade (dias)</Label>
            <p className="text-xs text-slate-500">
              Período padrão para monitoramento da efetividade da solução de contorno.
            </p>
            <Input
              type="number"
              min={1}
              max={90}
              value={settings.effectivenessPeriodDays}
              onChange={(e) =>
                update('effectivenessPeriodDays', Math.max(1, parseInt(e.target.value) || 15))
              }
              className="w-32"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Iniciar Análise Automaticamente</Label>
              <p className="text-xs text-slate-500">
                Iniciar o período de efetividade ao implantar a solução de contorno.
              </p>
            </div>
            <Switch
              checked={settings.autoStartEffectiveness}
              onCheckedChange={(v) => update('autoStartEffectiveness', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Exigir Evidências no Encerramento</Label>
              <p className="text-xs text-slate-500">
                Exigir anexos de evidências ao encerrar o problema.
              </p>
            </div>
            <Switch
              checked={settings.requireEvidenceOnClosure}
              onCheckedChange={(v) => update('requireEvidenceOnClosure', v)}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Regra de Recorrência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Limite de Incidentes Similares</Label>
              <Input
                type="number"
                min={1}
                value={settings.recurrenceThreshold}
                onChange={(e) =>
                  update('recurrenceThreshold', Math.max(1, parseInt(e.target.value) || 5))
                }
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Janela de Dias</Label>
              <Input
                type="number"
                min={1}
                value={settings.recurrenceDaysWindow}
                onChange={(e) =>
                  update('recurrenceDaysWindow', Math.max(1, parseInt(e.target.value) || 30))
                }
                className="w-32"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Se {settings.recurrenceThreshold} incidentes similares ocorrerem em{' '}
            {settings.recurrenceDaysWindow} dias para o mesmo serviço, o sistema sugerirá criar um
            Problema.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Novo Problema</Label>
              <p className="text-xs text-slate-500">
                Notificar quando um novo problema for registrado.
              </p>
            </div>
            <Switch
              checked={settings.notifyNewProblem}
              onCheckedChange={(v) => update('notifyNewProblem', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Efetividade Próxima do Fim</Label>
              <p className="text-xs text-slate-500">
                Notificar 7 e 3 dias antes do fim do período de efetividade.
              </p>
            </div>
            <Switch
              checked={settings.notifyEffectivenessEnding}
              onCheckedChange={(v) => update('notifyEffectivenessEnding', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Último Dia de Avaliação</Label>
              <p className="text-xs text-slate-500">
                Notificar no último dia do período de efetividade.
              </p>
            </div>
            <Switch
              checked={settings.notifyLastDay}
              onCheckedChange={(v) => update('notifyLastDay', v)}
            />
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => toast({ title: 'Configurações salvas!' })}>
        Salvar Configurações
      </Button>
    </div>
  )
}
