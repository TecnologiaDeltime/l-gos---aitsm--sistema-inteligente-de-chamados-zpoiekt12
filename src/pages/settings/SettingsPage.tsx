import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import {
  FileText,
  Bell,
  Save,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import {
  getEmailConfig,
  saveEmailConfig,
  testEmailConnection,
  ingestEmailWebhook,
  EmailConfigRecord,
} from '@/services/email-config'
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
import {
  getStaleTicketAlertSettings,
  saveStaleTicketAlertSettings,
  StaleTicketAlertSettings,
} from '@/services/stale-ticket-alert-settings'
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

  // Estado dos alertas de chamados sem atualização.
  const [staleLoading, setStaleLoading] = useState(true)
  const [staleSaving, setStaleSaving] = useState(false)
  const [stale, setStale] = useState<StaleTicketAlertSettings | null>(null)

  // Estado da Caixa de E-mail de Entrada (IMAP)
  const [emailConfigLoading, setEmailConfigLoading] = useState(true)
  const [emailConfigSaving, setEmailConfigSaving] = useState(false)
  const [emailConfig, setEmailConfig] = useState<EmailConfigRecord | null>(null)
  const [imapPassword, setImapPassword] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  // Estado do Teste de Ingestão de E-mail (Simulação)
  const [simFrom, setSimFrom] = useState('cliente@acme.com.br')
  const [simFromName, setSimFromName] = useState('João da Silva')
  const [simSubject, setSimSubject] = useState('Computador não liga após atualização')
  const [simBody, setSimBody] = useState(
    'Olá equipe de suporte, meu computador reiniciou e agora fica apenas na tela preta. Podem me ajudar?',
  )
  const [simulatingEmail, setSimulatingEmail] = useState(false)

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
    getStaleTicketAlertSettings()
      .then((s) => setStale(s))
      .catch(() => {})
      .finally(() => setStaleLoading(false))
    getEmailConfig()
      .then((cfg) => {
        if (cfg) {
          setEmailConfig(cfg)
        } else {
          setEmailConfig({
            id: '',
            imap_host: 'imap.gmail.com',
            imap_port: 993,
            imap_user: 'suporte@empresa.com.br',
            imap_ssl: true,
            check_interval_minutes: 2,
            enabled: false,
            created: '',
            updated: '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setEmailConfigLoading(false))
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

  const handleEmailConfigSave = async () => {
    if (!emailConfig) return
    setEmailConfigSaving(true)
    try {
      const saved = await saveEmailConfig({
        imap_host: emailConfig.imap_host,
        imap_port: emailConfig.imap_port,
        imap_user: emailConfig.imap_user,
        imap_ssl: emailConfig.imap_ssl,
        check_interval_minutes: emailConfig.check_interval_minutes,
        enabled: emailConfig.enabled,
      })
      setEmailConfig(saved)
      toast({ title: 'Configurações da caixa de e-mail salvas com sucesso!' })
    } catch {
      toast({ title: 'Erro ao salvar configurações de e-mail', variant: 'destructive' })
    } finally {
      setEmailConfigSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!emailConfig) return
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res: any = await testEmailConnection({
        imap_host: emailConfig.imap_host,
        imap_port: emailConfig.imap_port,
        imap_user: emailConfig.imap_user,
        imap_password: imapPassword,
        imap_ssl: emailConfig.imap_ssl,
      })
      setTestResult({
        success: true,
        message: res.message || 'Conexão validada com sucesso!',
      })
      toast({ title: 'Conexão IMAP testada com sucesso!' })
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Falha ao conectar ao servidor IMAP.',
      })
      toast({ title: 'Erro no teste de conexão', variant: 'destructive' })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSimulateIngest = async () => {
    if (!simFrom || !simSubject) {
      toast({ title: 'Informe o remetente e o assunto para o teste', variant: 'destructive' })
      return
    }
    setSimulatingEmail(true)
    try {
      const res: any = await ingestEmailWebhook({
        from: simFrom,
        from_name: simFromName,
        subject: simSubject,
        body: simBody,
        token: emailConfig?.webhook_token,
      })
      if (res.status === 'created') {
        toast({
          title: `Chamado #${res.ticket_number || 'Criado'} gerado via e-mail!`,
          description: res.message,
        })
      } else if (res.status === 'retained') {
        toast({
          title: 'Chamado retido para moderação!',
          description: 'O domínio do e-mail não pertence à lista de clientes autorizados.',
        })
      } else {
        toast({ title: 'Processado com sucesso!', description: res.message })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao processar e-mail simulado',
        description: err.message || 'Falha na ingestão.',
        variant: 'destructive',
      })
    } finally {
      setSimulatingEmail(false)
    }
  }

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.origin}/backend/v1/emails/ingest`
    navigator.clipboard.writeText(url)
    setCopiedWebhook(true)
    toast({ title: 'URL do Webhook copiada para a área de transferência!' })
    setTimeout(() => setCopiedWebhook(false), 2500)
  }

  const handleStaleSave = async () => {
    if (!stale) return
    setStaleSaving(true)
    try {
      const saved = await saveStaleTicketAlertSettings({
        enabled: stale.enabled,
        popup_enabled: stale.popup_enabled,
        voice_enabled: stale.voice_enabled,
        hours_without_update: stale.hours_without_update,
      })
      setStale(saved)
      toast({ title: 'Configurações de alertas de chamados sem atualização salvas' })
    } catch {
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' })
    } finally {
      setStaleSaving(false)
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
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-blue-600" />
            Alertas de Chamados sem Atualização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <p className="text-xs text-slate-500 max-w-md">
            Configura os alertas disparados quando um chamado aberto está há mais de X horas sem
            nenhuma atualização (interação). O alerta é enviado ao operador responsável e exibido em
            tempo real no sistema via popup e/ou voz. As alterações são persistidas no backend.
          </p>
          {staleLoading ? (
            <p className="text-xs text-slate-400">Carregando configurações...</p>
          ) : stale ? (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Habilitar alertas de chamados sem atualização
                  </Label>
                  <p className="text-xs text-slate-500 max-w-md">
                    Liga/desliga todo o sistema de alertas de chamados sem movimento.
                  </p>
                </div>
                <Switch
                  checked={stale.enabled}
                  onCheckedChange={(c) => setStale({ ...stale, enabled: c })}
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
                    checked={stale.popup_enabled}
                    onCheckedChange={(c) => setStale({ ...stale, popup_enabled: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">Voz</Label>
                  <Switch
                    checked={stale.voice_enabled}
                    onCheckedChange={(c) => setStale({ ...stale, voice_enabled: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Horas sem atualização
                  </Label>
                  <p className="text-xs text-slate-500">
                    Tempo mínimo sem interação para disparar o alerta (padrão: 8h).
                  </p>
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={stale.hours_without_update}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!isNaN(n) && n >= 1) setStale({ ...stale, hours_without_update: n })
                    }}
                    className="itsm-input w-32"
                    disabled={!permissions.isGestor}
                  />
                </div>
              </div>

              {permissions.isGestor && (
                <Button
                  onClick={handleStaleSave}
                  disabled={staleSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {staleSaving ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              )}
            </>
          ) : (
            <p className="text-xs text-red-500">
              Não foi possível carregar as configurações de alertas de chamados sem atualização.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Seção 1: Caixa de E-mail de Entrada (IMAP) */}
      <Card className="itsm-card border-blue-200 dark:border-blue-900 shadow-sm">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Caixa de E-mail de Entrada (IMAP)
            </CardTitle>
            {emailConfig?.enabled && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Ingestão Ativa
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <p className="text-xs text-slate-500">
            Configure a caixa de correio eletrônico que receberá solicitações de clientes e gerará
            automaticamente os chamados no sistema através do agente de ingestão.
          </p>

          {emailConfigLoading ? (
            <p className="text-xs text-slate-400">Carregando configurações de e-mail...</p>
          ) : emailConfig ? (
            <>
              {/* Toggle Mestre */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3.5 border border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Habilitar Leitura Automática de E-mails
                  </Label>
                  <p className="text-xs text-slate-500">
                    Quando ativo, o agente verifica a caixa periodicamente e converte novas
                    mensagens em tickets.
                  </p>
                </div>
                <Switch
                  checked={emailConfig.enabled}
                  onCheckedChange={(c) => setEmailConfig({ ...emailConfig, enabled: c })}
                  disabled={!permissions.isGestor}
                />
              </div>

              {/* Grid de Campos IMAP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Servidor IMAP (Host)
                  </Label>
                  <Input
                    type="text"
                    placeholder="imap.gmail.com ou imap.office365.com"
                    value={emailConfig.imap_host}
                    onChange={(e) => setEmailConfig({ ...emailConfig, imap_host: e.target.value })}
                    className="itsm-input"
                    disabled={!permissions.isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Porta IMAP
                  </Label>
                  <Input
                    type="number"
                    placeholder="993"
                    value={emailConfig.imap_port}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        imap_port: parseInt(e.target.value, 10) || 993,
                      })
                    }
                    className="itsm-input"
                    disabled={!permissions.isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Usuário / E-mail da Caixa
                  </Label>
                  <Input
                    type="email"
                    placeholder="suporte@empresa.com.br"
                    value={emailConfig.imap_user}
                    onChange={(e) => setEmailConfig({ ...emailConfig, imap_user: e.target.value })}
                    className="itsm-input"
                    disabled={!permissions.isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Senha da Caixa (App Password)
                  </Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    className="itsm-input"
                    disabled={!permissions.isGestor}
                  />
                  <p className="text-[11px] text-slate-400">
                    Para Gmail/Office365, utilize uma Senha de Aplicativo dedicada.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Intervalo de Verificação (minutos)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={emailConfig.check_interval_minutes}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        check_interval_minutes: parseInt(e.target.value, 10) || 2,
                      })
                    }
                    className="itsm-input"
                    disabled={!permissions.isGestor}
                  />
                  <p className="text-[11px] text-slate-400">
                    Padrão recomendado: a cada 2 minutos.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-6">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Conexão Segura SSL/TLS
                    </Label>
                    <p className="text-[11px] text-slate-400">Padrão ativado para porta 993</p>
                  </div>
                  <Switch
                    checked={emailConfig.imap_ssl}
                    onCheckedChange={(c) => setEmailConfig({ ...emailConfig, imap_ssl: c })}
                    disabled={!permissions.isGestor}
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              {permissions.isGestor && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    onClick={handleEmailConfigSave}
                    disabled={emailConfigSaving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="mr-1.5 h-4 w-4" />
                    {emailConfigSaving ? 'Salvando...' : 'Salvar Configurações de E-mail'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !emailConfig.imap_host}
                  >
                    <RefreshCw
                      className={`mr-1.5 h-4 w-4 ${testingConnection ? 'animate-spin' : ''}`}
                    />
                    {testingConnection ? 'Testando Conexão...' : 'Testar Conexão IMAP'}
                  </Button>
                </div>
              )}

              {/* Resultado do Teste */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Endpoint Webhook & Integração Externa */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Endpoint Webhook HTTP (Encaminhamento / Ingestão Direta)
                  </Label>
                  <p className="text-xs text-slate-500">
                    Caso prefira configurar um encaminhamento automático (e.g. AWS SES, Mailgun,
                    Sendgrid, Zapier ou servidor de correio da empresa), envie um POST JSON para o
                    webhook abaixo:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/backend/v1/emails/ingest`}
                    className="itsm-input bg-slate-50 text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0"
                  >
                    {copiedWebhook ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Simulador de Ingestão de E-mail */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4 rounded-xl border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                    Testar Ingestão de E-mail (Simulador)
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Simula o recebimento de um e-mail para validar as regras de domínio permitido,
                    cruzamento com solicitante e geração do chamado com triagem de IA.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      De (E-mail Remetente)
                    </Label>
                    <Input
                      type="email"
                      value={simFrom}
                      onChange={(e) => setSimFrom(e.target.value)}
                      placeholder="solicitante@empresa.com.br"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Nome do Remetente (Opcional)
                    </Label>
                    <Input
                      type="text"
                      value={simFromName}
                      onChange={(e) => setSimFromName(e.target.value)}
                      placeholder="Nome do Solicitante"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Assunto do E-mail
                  </Label>
                  <Input
                    type="text"
                    value={simSubject}
                    onChange={(e) => setSimSubject(e.target.value)}
                    placeholder="Assunto da solicitação"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Corpo da Mensagem
                  </Label>
                  <textarea
                    rows={3}
                    value={simBody}
                    onChange={(e) => setSimBody(e.target.value)}
                    placeholder="Descreva o problema ou solicitação..."
                    className="w-full text-xs rounded-md border border-input bg-background p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleSimulateIngest}
                  disabled={simulatingEmail || !simFrom || !simSubject}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  {simulatingEmail ? 'Simulando Recebimento...' : 'Simular Recebimento de E-mail'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-red-500">
              Não foi possível carregar as configurações de e-mail.
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
