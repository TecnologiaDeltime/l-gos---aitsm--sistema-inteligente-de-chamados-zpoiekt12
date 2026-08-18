import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import { FileText, Bell, Save } from 'lucide-react'
import {
  getVoiceAlertsEnabled,
  setVoiceAlertsEnabled,
  getSlaThresholdMinutes,
  setSlaThresholdMinutes,
} from '@/lib/notification-settings'
import {
  getSlaAlertSettings,
  saveSlaAlertSettings,
  SlaAlertSettings,
} from '@/services/sla-alert-settings'
import {
  getConsumptionAlertConfig,
  saveConsumptionAlertConfig,
  ConsumptionAlertConfig,
} from '@/services/consumption-alert-config'
import { usePermissions } from '@/hooks/use-permissions'
import { Hourglass } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [slaThreshold, setSlaThreshold] = useState(30)
  const permissions = usePermissions()

  // Estado dos alertas de SLA de Resposta.
  const [slaAlertLoading, setSlaAlertLoading] = useState(true)
  const [slaAlertSaving, setSlaAlertSaving] = useState(false)
  const [slaAlert, setSlaAlert] = useState<SlaAlertSettings | null>(null)

  // Estado dos alertas de consumo de horas por nível.
  const [consumptionLoading, setConsumptionLoading] = useState(true)
  const [consumptionSaving, setConsumptionSaving] = useState(false)
  const [consumption, setConsumption] = useState<ConsumptionAlertConfig | null>(null)

  useEffect(() => {
    setVoiceEnabled(getVoiceAlertsEnabled())
    setSlaThreshold(getSlaThresholdMinutes())
    getSlaAlertSettings()
      .then((s) => setSlaAlert(s))
      .catch(() => {})
      .finally(() => setSlaAlertLoading(false))
    getConsumptionAlertConfig()
      .then((c) => setConsumption(c))
      .catch(() => {})
      .finally(() => setConsumptionLoading(false))
  }, [])

  const handleConsumptionSave = async () => {
    if (!consumption) return
    setConsumptionSaving(true)
    try {
      const saved = await saveConsumptionAlertConfig({
        enabled: consumption.enabled,
        notify_admins: consumption.notify_admins,
        notify_focal_points: consumption.notify_focal_points,
        notify_ticket_responsible: consumption.notify_ticket_responsible,
        notify_quality_team: consumption.notify_quality_team,
        notify_company_responsible: consumption.notify_company_responsible,
        quality_team_emails: consumption.quality_team_emails,
        threshold_80_enabled: consumption.threshold_80_enabled,
        threshold_90_enabled: consumption.threshold_90_enabled,
        threshold_100_enabled: consumption.threshold_100_enabled,
      })
      setConsumption(saved)
      toast({ title: 'Configurações de alerta de consumo salvas' })
    } catch {
      toast({ title: 'Erro ao salvar configurações de consumo', variant: 'destructive' })
    } finally {
      setConsumptionSaving(false)
    }
  }

  const handleSlaAlertSave = async () => {
    if (!slaAlert) return
    setSlaAlertSaving(true)
    try {
      const saved = await saveSlaAlertSettings({
        enabled: slaAlert.enabled,
        popup_enabled: slaAlert.popup_enabled,
        email_enabled: slaAlert.email_enabled,
        voice_enabled: slaAlert.voice_enabled,
        minutes_before_expiry: slaAlert.minutes_before_expiry,
        interval_minutes: slaAlert.interval_minutes,
      })
      setSlaAlert(saved)
      toast({ title: 'Configurações de alerta de SLA salvas' })
    } catch {
      toast({ title: 'Erro ao salvar configurações de SLA', variant: 'destructive' })
    } finally {
      setSlaAlertSaving(false)
    }
  }

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
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Alertas de SLA de Resposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <p className="text-xs text-slate-500 max-w-md">
            Configura os alertas disparados quando o SLA de Resposta de um chamado está prestes a
            vencer. As alterações são persistidas no backend e aplicadas a todos os operadores.
          </p>
          {slaAlertLoading ? (
            <p className="text-xs text-slate-400">Carregando configurações...</p>
          ) : slaAlert ? (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Habilitar alertas de SLA Resposta
                  </Label>
                  <p className="text-xs text-slate-500 max-w-md">
                    Liga/desliga todo o sistema de alertas de SLA de Resposta.
                  </p>
                </div>
                <Switch
                  checked={slaAlert.enabled}
                  onCheckedChange={(c) => setSlaAlert({ ...slaAlert, enabled: c })}
                  disabled={!permissions.isGestor}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Canais de notificação
                </p>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Popup no sistema
                  </Label>
                  <Switch
                    checked={slaAlert.popup_enabled}
                    onCheckedChange={(c) => setSlaAlert({ ...slaAlert, popup_enabled: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">E-mail</Label>
                  <Switch
                    checked={slaAlert.email_enabled}
                    onCheckedChange={(c) => setSlaAlert({ ...slaAlert, email_enabled: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">Voz</Label>
                  <Switch
                    checked={slaAlert.voice_enabled}
                    onCheckedChange={(c) => setSlaAlert({ ...slaAlert, voice_enabled: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Minutos antes do vencimento
                  </Label>
                  <p className="text-xs text-slate-500">
                    Quando começar a alertar (padrão: 60 min).
                  </p>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={slaAlert.minutes_before_expiry}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!isNaN(n) && n >= 1)
                        setSlaAlert({ ...slaAlert, minutes_before_expiry: n })
                    }}
                    className="itsm-input w-32"
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Intervalo entre alertas (min)
                  </Label>
                  <p className="text-xs text-slate-500">
                    Frequência de repetição (padrão: 10 min).
                  </p>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={slaAlert.interval_minutes}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!isNaN(n) && n >= 1) setSlaAlert({ ...slaAlert, interval_minutes: n })
                    }}
                    className="itsm-input w-32"
                    disabled={!permissions.isGestor}
                  />
                </div>
              </div>

              {permissions.isGestor && (
                <Button
                  onClick={handleSlaAlertSave}
                  disabled={slaAlertSaving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {slaAlertSaving ? 'Salvando...' : 'Salvar Configurações de SLA'}
                </Button>
              )}
            </>
          ) : (
            <p className="text-xs text-red-500">
              Não foi possível carregar as configurações de SLA.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-orange-600" />
            Alertas de Consumo de Horas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <p className="text-xs text-slate-500 max-w-md">
            Configura os alertas disparados quando o consumo de horas contratuais por nível de
            atendimento (Nível 1, 2, 3, Consultoria, Backoffice, Administrativo) atinge os limiares
            de 80%, 90% ou 100%. As alterações são persistidas no backend.
          </p>
          {consumptionLoading ? (
            <p className="text-xs text-slate-400">Carregando configurações...</p>
          ) : consumption ? (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Habilitar alertas de consumo
                  </Label>
                  <p className="text-xs text-slate-500 max-w-md">
                    Liga/desliga todo o sistema de alertas de consumo de horas por nível.
                  </p>
                </div>
                <Switch
                  checked={consumption.enabled}
                  onCheckedChange={(c) => setConsumption({ ...consumption, enabled: c })}
                  disabled={!permissions.isGestor}
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Limiares de alerta
                </p>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Notificar ao atingir 80%
                  </Label>
                  <Switch
                    checked={consumption.threshold_80_enabled}
                    onCheckedChange={(c) =>
                      setConsumption({ ...consumption, threshold_80_enabled: c })
                    }
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Notificar ao atingir 90%
                  </Label>
                  <Switch
                    checked={consumption.threshold_90_enabled}
                    onCheckedChange={(c) =>
                      setConsumption({ ...consumption, threshold_90_enabled: c })
                    }
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Notificar ao atingir 100%
                  </Label>
                  <Switch
                    checked={consumption.threshold_100_enabled}
                    onCheckedChange={(c) =>
                      setConsumption({ ...consumption, threshold_100_enabled: c })
                    }
                    disabled={!permissions.isGestor}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Quem deve ser notificado
                </p>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Administradores e Gestores
                  </Label>
                  <Switch
                    checked={consumption.notify_admins}
                    onCheckedChange={(c) => setConsumption({ ...consumption, notify_admins: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Pontos Focais do Cliente
                  </Label>
                  <Switch
                    checked={consumption.notify_focal_points}
                    onCheckedChange={(c) =>
                      setConsumption({ ...consumption, notify_focal_points: c })
                    }
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Responsável da Empresa (Cliente Gestor)
                  </Label>
                  <Switch
                    checked={consumption.notify_company_responsible}
                    onCheckedChange={(c) =>
                      setConsumption({ ...consumption, notify_company_responsible: c })
                    }
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">
                    Responsável do Chamado
                  </Label>
                  <Switch
                    checked={consumption.notify_ticket_responsible}
                    onCheckedChange={(c) =>
                      setConsumption({ ...consumption, notify_ticket_responsible: c })
                    }
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-600 dark:text-slate-400">
                      Equipe da Qualidade
                    </Label>
                    <Switch
                      checked={consumption.notify_quality_team}
                      onCheckedChange={(c) =>
                        setConsumption({ ...consumption, notify_quality_team: c })
                      }
                      disabled={!permissions.isGestor}
                    />
                  </div>
                  {consumption.notify_quality_team && (
                    <div className="space-y-1.5">
                      <label className="itsm-label">
                        E-mails da equipe da qualidade (separados por vírgula)
                      </label>
                      <Input
                        type="text"
                        value={consumption.quality_team_emails || ''}
                        onChange={(e) =>
                          setConsumption({ ...consumption, quality_team_emails: e.target.value })
                        }
                        placeholder="qualidade@empresa.com.br, auditor@empresa.com.br"
                        className="itsm-input"
                        disabled={!permissions.isGestor}
                      />
                    </div>
                  )}
                </div>
              </div>

              {permissions.isGestor && (
                <Button
                  onClick={handleConsumptionSave}
                  disabled={consumptionSaving}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {consumptionSaving ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              )}
            </>
          ) : (
            <p className="text-xs text-red-500">
              Não foi possível carregar as configurações de consumo.
            </p>
          )}
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
