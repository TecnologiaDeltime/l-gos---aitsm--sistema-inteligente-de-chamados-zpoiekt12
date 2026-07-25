import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  getVoiceAlertsEnabled,
  setVoiceAlertsEnabled,
  getSlaThresholdMinutes,
  setSlaThresholdMinutes,
} from '@/lib/notification-settings'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [slaThreshold, setSlaThreshold] = useState(30)

  useEffect(() => {
    setVoiceEnabled(getVoiceAlertsEnabled())
    setSlaThreshold(getSlaThresholdMinutes())
  }, [])

  const handleVoiceToggle = (checked: boolean) => {
    setVoiceEnabled(checked)
    setVoiceAlertsEnabled(checked)
    toast({ title: checked ? 'Alertas de voz ativados' : 'Alertas de voz desativados' })
  }

  const handleSlaThresholdChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1) {
      setSlaThreshold(num)
      setSlaThresholdMinutes(num)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Nome</label>
            <Input defaultValue={user?.name || ''} readOnly />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">E-mail</label>
            <Input defaultValue={user?.email || ''} readOnly />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Perfil / Função</label>
            <Input defaultValue={user?.role || 'admin'} readOnly />
          </div>
          <Button variant="outline" size="sm">
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações e Alertas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Alertas de voz</Label>
              <p className="text-xs text-slate-500">
                Reproduz uma mensagem de voz quando um SLA está prestes a vencer ou um novo chamado
                chega à sua fila.
              </p>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={handleVoiceToggle} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tempo de aviso de SLA (minutos)</Label>
            <p className="text-xs text-slate-500">
              Define quantos minutos antes do prazo do SLA o alerta deve ser disparado. Padrão: 30
              minutos.
            </p>
            <Input
              type="number"
              min={1}
              max={1440}
              value={slaThreshold}
              onChange={(e) => handleSlaThresholdChange(e.target.value)}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
