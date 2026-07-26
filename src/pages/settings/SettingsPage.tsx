import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
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
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Configurações</h2>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie suas preferências e perfil</p>
      </div>

      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Perfil do Usuário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5">
            <label className="itsm-label">Nome</label>
            <Input defaultValue={user?.name || ''} readOnly className="itsm-input bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <label className="itsm-label">E-mail</label>
            <Input defaultValue={user?.email || ''} readOnly className="itsm-input bg-slate-50" />
          </div>
          <div className="space-y-1.5">
            <label className="itsm-label">Perfil / Função</label>
            <Input
              defaultValue={user?.role || 'admin'}
              readOnly
              className="itsm-input bg-slate-50"
            />
          </div>
          <Button variant="outline" size="sm" className="itsm-btn-secondary">
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Notificações e Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Alertas de voz
              </Label>
              <p className="text-xs text-slate-500 max-w-md">
                Reproduz uma mensagem de voz quando um SLA está prestes a vencer ou um novo chamado
                chega à sua fila.
              </p>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={handleVoiceToggle} />
          </div>
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Tempo de aviso de SLA (minutos)
            </Label>
            <p className="text-xs text-slate-500 max-w-md">
              Define quantos minutos antes do prazo do SLA o alerta deve ser disparado. Padrão: 30
              minutos.
            </p>
            <Input
              type="number"
              min={1}
              max={1440}
              value={slaThreshold}
              onChange={(e) => handleSlaThresholdChange(e.target.value)}
              className="itsm-input w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Modelos de Chamados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <p className="text-xs text-slate-500">
            Gerencie modelos de resolução e comentários para agilizar o atendimento de chamados.
          </p>
          <Link to="/settings/ticket-templates">
            <Button variant="outline" size="sm" className="itsm-btn-secondary">
              <FileText className="mr-1.5 h-4 w-4" />
              Gerenciar Modelos
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
