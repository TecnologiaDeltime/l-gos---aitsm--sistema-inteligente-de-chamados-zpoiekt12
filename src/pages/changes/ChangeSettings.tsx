import { useState, useEffect } from 'react'
import { Settings, Bell, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const SETTINGS_KEY = 'itsm_change_settings'

interface ChangeSettings {
  notifyNewChange: boolean
  notifyApprovalNeeded: boolean
  notifyChangeApproved: boolean
  notifyChangeScheduled: boolean
  defaultApprovalWorkflow: boolean
  requireCommitteeForHighRisk: boolean
  autoCloseDays: number
}

const DEFAULTS: ChangeSettings = {
  notifyNewChange: true,
  notifyApprovalNeeded: true,
  notifyChangeApproved: true,
  notifyChangeScheduled: true,
  defaultApprovalWorkflow: true,
  requireCommitteeForHighRisk: true,
  autoCloseDays: 7,
}

export default function ChangeSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<ChangeSettings>(DEFAULTS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) })
    } catch {
      /* noop */
    }
  }, [])

  const update = (key: keyof ChangeSettings, value: boolean | number) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <Switch checked={checked} onCheckedChange={onChange} />
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Settings className="h-5 w-5" /> Configurações de Mudanças
      </h2>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Nova Mudança</Label>
              <p className="text-xs text-slate-500">
                Notificar quando uma nova mudança for registrada.
              </p>
            </div>
            <Toggle
              checked={settings.notifyNewChange}
              onChange={(v) => update('notifyNewChange', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Aprovação Necessária</Label>
              <p className="text-xs text-slate-500">
                Notificar aprovadores quando uma mudança precisar de aprovação.
              </p>
            </div>
            <Toggle
              checked={settings.notifyApprovalNeeded}
              onChange={(v) => update('notifyApprovalNeeded', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Mudança Aprovada/Recusada</Label>
              <p className="text-xs text-slate-500">
                Notificar o solicitante sobre a decisão de aprovação.
              </p>
            </div>
            <Toggle
              checked={settings.notifyChangeApproved}
              onChange={(v) => update('notifyChangeApproved', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Mudança Agendada</Label>
              <p className="text-xs text-slate-500">
                Notificar participantes quando uma mudança for agendada.
              </p>
            </div>
            <Toggle
              checked={settings.notifyChangeScheduled}
              onChange={(v) => update('notifyChangeScheduled', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Fluxo de Aprovação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Fluxo de Aprovação Padrão</Label>
              <p className="text-xs text-slate-500">
                Ativar fluxo de aprovação automático para mudanças não-padrão.
              </p>
            </div>
            <Toggle
              checked={settings.defaultApprovalWorkflow}
              onChange={(v) => update('defaultApprovalWorkflow', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Exigir Comitê para Risco Alto</Label>
              <p className="text-xs text-slate-500">
                Mudanças de risco Alto ou Crítico devem passar pelo comitê.
              </p>
            </div>
            <Toggle
              checked={settings.requireCommitteeForHighRisk}
              onChange={(v) => update('requireCommitteeForHighRisk', v)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Encerramento Automático (dias)</Label>
            <p className="text-xs text-slate-500">
              Encerrar mudanças resolvidas automaticamente após N dias sem reabertura.
            </p>
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.autoCloseDays}
              onChange={(e) => update('autoCloseDays', Math.max(1, parseInt(e.target.value) || 7))}
              className="w-32"
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
