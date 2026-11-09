import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useSearchParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Bell,
  Save,
  Mail,
  User,
  Settings,
  Hourglass,
  Lock,
  Palette,
  CalendarClock,
} from 'lucide-react'
import {
  getEmailConfig,
  saveEmailConfig,
  EmailConfigRecord,
  isGuidSecretId,
  GRAPH_SECRET_ID_WARNING,
} from '@/services/email-config'
import { ImapEmailSettings } from '@/components/settings/ImapEmailSettings'
import VaultPage from '@/pages/vault/VaultPage'
import { SecuritySettingsTab } from '@/components/settings/SecuritySettingsTab'
import ProfilesPage from '@/pages/profiles/ProfilesPage'
import { ClientNotificationSettingsTab } from '@/components/settings/ClientNotificationSettingsTab'
import { DesignSettingsTab } from '@/components/settings/DesignSettingsTab'
import ClientPortalSettingsTab from '@/components/settings/ClientPortalSettingsTab'
import { AiTicketSettingsTab } from '@/components/settings/AiTicketSettingsTab'
import { ClientConsumptionAgentTab } from '@/components/settings/ClientConsumptionAgentTab'
import { AutoAssignSettingsTab } from '@/components/settings/AutoAssignSettingsTab'
import { ProjectDeadlinesSettingsTab } from '@/components/settings/ProjectDeadlinesSettingsTab'
import { PrtgSettingsTab } from '@/components/settings/PrtgSettingsTab'
import { PortalTriageSettingsTab } from '@/components/settings/PortalTriageSettingsTab'
import {
  ShieldCheck,
  Globe,
  Shield,
  Bot,
  BrainCircuit,
  Users,
  Activity,
  Sparkles,
} from 'lucide-react'
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
import pb from '@/lib/pocketbase/client'
import {
  getPushPermissionState,
  getPushPreference,
  isPushSupported,
  requestPushPermission,
  setPushPreferenceLocally,
} from '@/lib/push-notifications'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [slaThreshold, setSlaThreshold] = useState(30)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSaving, setPushSaving] = useState(false)
  const [pushDenied, setPushDenied] = useState(false)
  const permissions = usePermissions()

  // Aba ativa de primeiro nível em Configurações
  const initialTab =
    searchParams.get('tab') === 'portal'
      ? 'portal'
      : searchParams.get('tab') === 'design'
        ? 'design'
        : searchParams.get('tab') === 'ai_reply'
          ? 'ai_reply'
          : searchParams.get('tab') === 'email'
            ? 'email'
            : searchParams.get('tab') === 'client_notif'
              ? 'client_notif'
              : searchParams.get('tab') === 'vault'
                ? 'vault'
                : searchParams.get('tab') === 'security'
                  ? 'security'
                  : searchParams.get('tab') === 'consumption_agent'
                    ? 'consumption_agent'
                    : searchParams.get('tab') === 'auto_assign'
                      ? 'auto_assign'
                      : searchParams.get('tab') === 'prtg'
                        ? 'prtg'
                        : searchParams.get('tab') === 'project-deadlines'
                          ? 'project-deadlines'
                          : searchParams.get('tab') === 'portal_triage'
                            ? 'portal_triage'
                            : 'general'
  const [mainTab, setMainTab] = useState<
    | 'general'
    | 'portal'
    | 'portal_triage'
    | 'design'
    | 'ai_reply'
    | 'client_notif'
    | 'email'
    | 'vault'
    | 'security'
    | 'profiles'
    | 'consumption_agent'
    | 'auto_assign'
    | 'prtg'
    | 'project-deadlines'
  >(initialTab as any)

  const handleTabChange = (
    tab:
      | 'general'
      | 'portal'
      | 'portal_triage'
      | 'design'
      | 'ai_reply'
      | 'client_notif'
      | 'email'
      | 'vault'
      | 'security'
      | 'profiles'
      | 'consumption_agent'
      | 'auto_assign'
      | 'prtg'
      | 'project-deadlines',
  ) => {
    setMainTab(tab)
    setSearchParams(
      tab === 'portal'
        ? { tab: 'portal' }
        : tab === 'portal_triage'
          ? { tab: 'portal_triage' }
          : tab === 'design'
            ? { tab: 'design' }
            : tab === 'ai_reply'
              ? { tab: 'ai_reply' }
              : tab === 'client_notif'
                ? { tab: 'client_notif' }
                : tab === 'email'
                  ? { tab: 'email' }
                  : tab === 'vault'
                    ? { tab: 'vault' }
                    : tab === 'security'
                      ? { tab: 'security' }
                      : tab === 'profiles'
                        ? { tab: 'profiles' }
                        : tab === 'consumption_agent'
                          ? { tab: 'consumption_agent' }
                          : tab === 'auto_assign'
                            ? { tab: 'auto_assign' }
                            : tab === 'prtg'
                              ? { tab: 'prtg' }
                              : tab === 'project-deadlines'
                                ? { tab: 'project-deadlines' }
                                : {},
    )
  }

  // Sincronizar se o parâmetro de URL mudar
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl === 'portal' && mainTab !== 'portal') {
      setMainTab('portal')
    } else if (tabFromUrl === 'portal_triage' && mainTab !== 'portal_triage') {
      setMainTab('portal_triage')
    } else if (tabFromUrl === 'design' && mainTab !== 'design') {
      setMainTab('design')
    } else if (tabFromUrl === 'ai_reply' && mainTab !== 'ai_reply') {
      setMainTab('ai_reply')
    } else if (tabFromUrl === 'client_notif' && mainTab !== 'client_notif') {
      setMainTab('client_notif')
    } else if (tabFromUrl === 'email' && mainTab !== 'email') {
      setMainTab('email')
    } else if (tabFromUrl === 'vault' && mainTab !== 'vault') {
      setMainTab('vault')
    } else if (tabFromUrl === 'security' && mainTab !== 'security') {
      setMainTab('security')
    } else if (tabFromUrl === 'profiles' && mainTab !== 'profiles') {
      setMainTab('profiles')
    } else if (tabFromUrl === 'consumption_agent' && mainTab !== 'consumption_agent') {
      setMainTab('consumption_agent')
    } else if (tabFromUrl === 'auto_assign' && mainTab !== 'auto_assign') {
      setMainTab('auto_assign')
    } else if (tabFromUrl === 'prtg' && mainTab !== 'prtg') {
      setMainTab('prtg')
    } else if (tabFromUrl === 'project-deadlines' && mainTab !== 'project-deadlines') {
      setMainTab('project-deadlines')
    }
  }, [searchParams])

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

  // Estado inicial do toggle "Notificações push": campo persistido no usuário
  // (push_enabled) com fallback para a preferência local do navegador.
  useEffect(() => {
    if (!user) return
    setPushEnabled(
      user.push_enabled !== undefined ? !!user.push_enabled : getPushPreference(user.id),
    )
    setPushDenied(getPushPermissionState() === 'denied')
  }, [user?.id, user?.push_enabled])

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
            imap_host: 'imap.office365.com',
            imap_port: 993,
            imap_user: 'suporte@empresa.com.br',
            imap_ssl: true,
            check_interval_minutes: 2,
            enabled: false,
            smtp_host: 'smtp.office365.com',
            smtp_port: 587,
            smtp_encryption: 'STARTTLS',
            smtp_user: 'suporte@empresa.com.br',
            smtp_sender_name: 'Atendimento HelpDesk',
            smtp_reply_to: 'suporte@empresa.com.br',
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

    const isGraph = (emailConfig.reception_mode || 'graph') === 'graph'
    if (isGraph && isGuidSecretId(emailConfig.graph_client_secret)) {
      toast({
        title: 'Atenção ao Segredo do Cliente',
        description: GRAPH_SECRET_ID_WARNING,
        variant: 'destructive',
      })
    }

    setEmailConfigSaving(true)
    try {
      const saved = await saveEmailConfig({
        reception_mode: emailConfig.reception_mode,
        graph_tenant_id: emailConfig.graph_tenant_id,
        graph_client_id: emailConfig.graph_client_id,
        graph_client_secret: emailConfig.graph_client_secret,
        graph_mailbox: emailConfig.graph_mailbox,
        imap_host: emailConfig.imap_host,
        imap_port: emailConfig.imap_port,
        imap_user: emailConfig.imap_user,
        imap_password: emailConfig.imap_password,
        imap_ssl: emailConfig.imap_ssl,
        imap_encryption: emailConfig.imap_encryption,
        inbox_folder: emailConfig.inbox_folder || 'INBOX',
        processed_folder: emailConfig.processed_folder || 'Processados',
        check_interval_minutes: emailConfig.check_interval_minutes,
        enabled: emailConfig.enabled,
        smtp_host: emailConfig.smtp_host,
        smtp_port: emailConfig.smtp_port,
        smtp_encryption: emailConfig.smtp_encryption,
        smtp_user: emailConfig.smtp_user,
        smtp_password: emailConfig.smtp_password,
        smtp_sender_name: emailConfig.smtp_sender_name,
        smtp_reply_to: emailConfig.smtp_reply_to,
      })
      setEmailConfig(saved)
      toast({ title: 'Configurações da caixa de e-mail salvas com sucesso!' })
    } catch {
      toast({ title: 'Erro ao salvar configurações de e-mail', variant: 'destructive' })
    } finally {
      setEmailConfigSaving(false)
    }
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

  /**
   * Toggle "Notificações push": salva a preferência no usuário (campo push_enabled,
   * migração 0140) e pede permissão ao navegador ao ligar. Com a permissão negada,
   * a orientação de liberar nas configurações do navegador é exibida sob o toggle.
   */
  const handlePushToggle = async (checked: boolean) => {
    if (!user || pushSaving) return
    setPushSaving(true)
    try {
      if (checked) {
        const permission = await requestPushPermission()
        if (permission === 'denied') {
          setPushDenied(true)
          setPushEnabled(false)
          setPushPreferenceLocally(false)
          await pb.collection('users').update(user.id, { push_enabled: false })
          await refreshUser()
          toast({
            title: 'Permissão negada pelo navegador',
            description:
              'Para receber notificações push, libere o Lógos AITSM nas configurações de ' +
              'notificações do seu navegador (ícone de cadeado na barra de endereço) e tente ' +
              'ativar novamente.',
            variant: 'destructive',
            duration: 12000,
          })
          return
        }
        if (permission === 'unsupported') {
          setPushEnabled(false)
          toast({
            title: 'Navegador sem suporte',
            description:
              'Este navegador não suporta notificações push (disponível em navegadores ' +
              'desktop e PWA instalado).',
            variant: 'destructive',
          })
          return
        }
        if (permission !== 'granted') {
          setPushEnabled(false)
          toast({
            title: 'Permissão não concedida',
            description:
              'A permissão de notificações não foi concedida. Tente ativar novamente para ' +
              'o navegador pedir de novo.',
            variant: 'destructive',
          })
          return
        }
        setPushDenied(false)
      } else {
        setPushPreferenceLocally(false)
      }
      setPushEnabled(checked)
      setPushPreferenceLocally(checked)
      await pb.collection('users').update(user.id, { push_enabled: checked })
      await refreshUser()
      toast({
        title: checked ? 'Notificações push ativadas' : 'Notificações push desativadas',
        description: checked
          ? 'Você receberá notificações do navegador quando a aba estiver em segundo plano.'
          : undefined,
      })
    } catch {
      toast({
        title: 'Erro ao salvar preferência de push',
        description: 'Não foi possível salvar a preferência. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setPushSaving(false)
    }
  }

  const handleSlaThresholdChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1) {
      setSlaThreshold(num)
      setSlaThresholdMinutes(num)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho e Navegação de Primeiro Nível */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Configurações</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie preferências do sistema, perfil e integrações de comunicação
          </p>
        </div>

        {/* Abas de Primeiro Nível em Configurações */}
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-secondary/60 border border-border self-start sm:self-auto">
          {permissions.canAccessItem('settings', 'settings_general') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'general' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('general')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'general'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Gerais
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_portal') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'portal' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('portal')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'portal'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Portal do Cliente
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_portal_triage') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'portal_triage' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('portal_triage')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'portal_triage'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Triagem do Portal (IA)
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_design') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'design' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('design')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'design'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-xs shadow-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Palette className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Design & Cores
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_ai_reply') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'ai_reply' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('ai_reply')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'ai_reply'
                  ? 'bg-amber-500/20 text-primary border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Inteligência Artificial (IA)
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_consumption_agent') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'consumption_agent' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('consumption_agent')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'consumption_agent'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BrainCircuit className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Agente de Consumo
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_auto_assign') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'auto_assign' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('auto_assign')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'auto_assign'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Distribuição Automática
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_prtg_monitoring') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'prtg' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('prtg')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'prtg'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Monitoramento (PRTG)
            </Button>
          )}

          {permissions.canAccessItem('projects', 'projects_deadlines_notifications') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'project-deadlines' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('project-deadlines')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'project-deadlines'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-xs shadow-amber-500/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Prazos de Projetos
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_client_notif') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'client_notif' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('client_notif')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'client_notif'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bell className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
              Notificações
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_security') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'security' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('security')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'security'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              Segurança & Sessão
            </Button>
          )}

          {permissions.canAccessItem('vault', 'vault_cofre') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'vault' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('vault')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'vault'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Lock className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
              Cofre de Senhas
            </Button>
          )}

          {permissions.canAccessItem('settings', 'settings_email') && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'email' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('email')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'email'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5 text-primary" />
              IMAP & E-mail
            </Button>
          )}

          {permissions.canManageProfiles && (
            <Button
              type="button"
              size="sm"
              variant={mainTab === 'profiles' ? 'default' : 'ghost'}
              onClick={() => handleTabChange('profiles')}
              className={`h-8 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'profiles'
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Perfis de Acesso
            </Button>
          )}
        </div>
      </div>

      {/* SEÇÃO PERFIS DE ACESSO */}
      {mainTab === 'profiles' && permissions.canManageProfiles && (
        <div className="space-y-6">
          <ProfilesPage embeddedTab />
        </div>
      )}

      {/* SEÇÃO PORTAL DO CLIENTE */}
      {mainTab === 'portal' && permissions.canAccessItem('settings', 'settings_portal') && (
        <ClientPortalSettingsTab />
      )}

      {/* SEÇÃO TRIAGEM AUTOMÁTICA POR IA DO PORTAL */}
      {mainTab === 'portal_triage' &&
        permissions.canAccessItem('settings', 'settings_portal_triage') && (
          <PortalTriageSettingsTab
            canConfigure={permissions.canConfigure('settings_portal_triage')}
            canEdit={permissions.canEdit('settings_portal_triage')}
          />
        )}

      {/* SEÇÃO AGENTE DE CONSUMO */}
      {mainTab === 'consumption_agent' &&
        permissions.canAccessItem('settings', 'settings_consumption_agent') && (
          <ClientConsumptionAgentTab
            canConfigure={permissions.canConfigure('settings_consumption_agent')}
            canEdit={permissions.canEdit('settings_consumption_agent')}
          />
        )}

      {/* SEÇÃO DISTRIBUIÇÃO AUTOMÁTICA */}
      {mainTab === 'auto_assign' &&
        permissions.canAccessItem('settings', 'settings_auto_assign') && (
          <AutoAssignSettingsTab
            canConfigure={permissions.canConfigure('settings_auto_assign')}
            canEdit={permissions.canEdit('settings_auto_assign')}
          />
        )}

      {/* SEÇÃO MONITORAMENTO PRTG */}
      {mainTab === 'prtg' && permissions.canAccessItem('settings', 'settings_prtg_monitoring') && (
        <PrtgSettingsTab canConfigure={permissions.canConfigure('settings_prtg_monitoring')} />
      )}

      {/* SEÇÃO PRAZOS DE PROJETOS (notificações de prazo) */}
      {mainTab === 'project-deadlines' &&
        permissions.canAccessItem('projects', 'projects_deadlines_notifications') && (
          <ProjectDeadlinesSettingsTab
            canConfigure={permissions.canConfigure('projects.projects_deadlines_notifications')}
            canEdit={permissions.canEdit('projects.projects_deadlines_notifications')}
          />
        )}

      {/* SEÇÃO DESIGN & APARÊNCIA */}
      {mainTab === 'design' && permissions.canAccessItem('settings', 'settings_design') && (
        <DesignSettingsTab isAdminOrGestor={permissions.isGestor} />
      )}

      {/* SEÇÃO INTELIGÊNCIA ARTIFICIAL (IA) */}
      {mainTab === 'ai_reply' && permissions.canAccessItem('settings', 'settings_ai_reply') && (
        <AiTicketSettingsTab isAdminOrGestor={permissions.isGestor} />
      )}

      {/* SEÇÃO NOTIFICAÇÕES DO CLIENTE */}
      {mainTab === 'client_notif' &&
        permissions.canAccessItem('settings', 'settings_client_notif') && (
          <ClientNotificationSettingsTab isAdminOrGestor={permissions.isGestor} />
        )}

      {/* SEÇÃO SEGURANÇA & SESSÃO (Expiração, Força Bruta, 2FA) */}
      {mainTab === 'security' && permissions.canAccessItem('settings', 'settings_security') && (
        <SecuritySettingsTab isAdmin={permissions.isAdmin} />
      )}

      {/* SEÇÃO 0: COFRE DE SENHAS */}
      {mainTab === 'vault' && permissions.canAccessItem('vault', 'vault_cofre') && (
        <div className="space-y-6">
          <VaultPage embeddedTab />
        </div>
      )}

      {/* SEÇÃO 1 (INDEPENDENTE): CONEXÃO IMAP REAL & CAIXA DE E-MAIL */}
      {mainTab === 'email' && permissions.canAccessItem('settings', 'settings_email') && (
        <div className="space-y-6">
          {emailConfigLoading ? (
            <Card className="itsm-card">
              <CardContent className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Carregando parâmetros da caixa de e-mail...
                </p>
              </CardContent>
            </Card>
          ) : emailConfig ? (
            <ImapEmailSettings
              emailConfig={emailConfig}
              setEmailConfig={setEmailConfig}
              emailConfigSaving={emailConfigSaving}
              onSaveConfig={handleEmailConfigSave}
              isGestor={permissions.isGestor}
            />
          ) : (
            <Card className="itsm-card">
              <CardContent className="p-6">
                <p className="text-xs text-red-500">
                  Não foi possível carregar as configurações de e-mail.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SEÇÃO 2: CONFIGURAÇÕES GERAIS (Perfil, SLA, Alertas, Modelos) */}
      {mainTab === 'general' && (
        <div className="space-y-6 max-w-2xl">
          <Card className="itsm-card">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Perfil do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1.5">
                <label className="itsm-label">Nome</label>
                <Input
                  defaultValue={user?.name || ''}
                  readOnly
                  className="itsm-input bg-slate-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="itsm-label">E-mail</label>
                <Input
                  defaultValue={user?.email || ''}
                  readOnly
                  className="itsm-input bg-slate-50"
                />
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
                    Reproduz uma mensagem de voz quando um SLA está prestes a vencer ou um novo
                    chamado chega à sua fila.
                  </p>
                </div>
                <Switch checked={voiceEnabled} onCheckedChange={handleVoiceToggle} />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Notificações push
                  </Label>
                  <p className="text-xs text-slate-500 max-w-md">
                    Envia notificações do navegador (push) quando a aba do Lógos AITSM estiver em
                    segundo plano — nova mensagem de chat, chamado delegado ou SLA prestes a vencer.
                    Disponível em navegadores desktop e PWA instalado.
                  </p>
                  {pushDenied && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 max-w-md">
                      As notificações deste site estão bloqueadas nas configurações do navegador.
                      Libere o Lógos AITSM clicando no ícone de cadeado na barra de endereço (ou nas
                      configurações de sites do navegador) e ative o toggle novamente.
                    </p>
                  )}
                </div>
                <Switch
                  checked={pushEnabled}
                  disabled={pushSaving || !isPushSupported()}
                  onCheckedChange={handlePushToggle}
                />
              </div>
              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tempo de aviso de SLA (minutos)
                </Label>
                <p className="text-xs text-slate-500 max-w-md">
                  Define quantos minutos antes do prazo do SLA o alerta deve ser disparado. Padrão:
                  30 minutos.
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
                Configura os alertas disparados quando o SLA de Resposta de um chamado está prestes
                a vencer. As alterações são persistidas no backend e aplicadas a todos os
                operadores.
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
                atendimento (Nível 1, 2, 3, Consultoria, Backoffice, Administrativo) atinge os
                limiares de 80%, 90% ou 100%. As alterações são persistidas no backend.
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
                        onCheckedChange={(c) =>
                          setConsumption({ ...consumption, notify_admins: c })
                        }
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
                              setConsumption({
                                ...consumption,
                                quality_team_emails: e.target.value,
                              })
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
                nenhuma atualização (interação). O alerta é enviado ao operador responsável e
                exibido em tempo real no sistema via popup e/ou voz. As alterações são persistidas
                no backend.
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
      )}
    </div>
  )
}
