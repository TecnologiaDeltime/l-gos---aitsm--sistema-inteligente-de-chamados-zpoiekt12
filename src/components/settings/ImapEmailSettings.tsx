import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Save,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Inbox,
  FolderSync,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Server,
  Lock,
  Eye,
  EyeOff,
  Send,
  ArrowRight,
  UserCheck,
  Tag,
  Copy,
  Check,
} from 'lucide-react'
import {
  EmailConfigRecord,
  ImapTestResponse,
  DryRunSimulationResult,
  EmailAuditLogRecord,
  ImapEncryption,
  SmtpEncryption,
  testEmailConnection,
  testSmtpConnection,
  runEmailDryRunSimulation,
  getEmailAuditLogs,
  sendTestEmail,
  SendTestEmailResponse,
  SmtpTestResponse,
} from '@/services/email-config'

interface ImapEmailSettingsProps {
  emailConfig: EmailConfigRecord
  setEmailConfig: React.Dispatch<React.SetStateAction<EmailConfigRecord | null>>
  emailConfigSaving: boolean
  onSaveConfig: () => Promise<void>
  isGestor: boolean
}

export function ImapEmailSettings({
  emailConfig,
  setEmailConfig,
  emailConfigSaving,
  onSaveConfig,
  isGestor,
}: ImapEmailSettingsProps) {
  const { toast } = useToast()

  // Credenciais e campos específicos
  const [imapPassword, setImapPassword] = useState(emailConfig.imap_password || '')
  const [showPassword, setShowPassword] = useState(false)
  const [smtpPassword, setSmtpPassword] = useState(
    emailConfig.smtp_password ?? emailConfig.imap_password ?? '',
  )
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)

  // Sincronização entre recepção e envio
  const [useSameAccountForSmtp, setUseSameAccountForSmtp] = useState(
    !emailConfig.smtp_user || emailConfig.smtp_user === emailConfig.imap_user,
  )

  const [testingConnection, setTestingConnection] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [runningDryRun, setRunningDryRun] = useState(false)
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  // Envio de e-mail de teste
  const [testTargetEmail, setTestTargetEmail] = useState(
    emailConfig.smtp_user || emailConfig.imap_user || '',
  )
  const [testSendResult, setTestSendResult] = useState<SendTestEmailResponse | null>(null)

  // Resultados
  const [testResponse, setTestResponse] = useState<ImapTestResponse | null>(null)
  const [smtpTestResponse, setSmtpTestResponse] = useState<SmtpTestResponse | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunSimulationResult | null>(null)
  const [auditLogs, setAuditLogs] = useState<EmailAuditLogRecord[]>([])
  const [activeTab, setActiveTab] = useState<
    'config' | 'sendtest' | 'test' | 'smtptest' | 'dryrun' | 'audit'
  >('config')

  // Carregar histórico de auditoria
  const loadAuditHistory = async () => {
    setLoadingAudit(true)
    try {
      const logs = await getEmailAuditLogs(10)
      setAuditLogs(logs)
    } catch {
      toast({ title: 'Não foi possível carregar os logs de auditoria.', variant: 'destructive' })
    } finally {
      setLoadingAudit(false)
    }
  }

  // Atualizar campo IMAP e opcionalmente replicar no SMTP se a opção estiver ativada
  const handleImapUserChange = (val: string) => {
    setEmailConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        imap_user: val,
        smtp_user: useSameAccountForSmtp ? val : prev.smtp_user,
      }
    })
  }

  const handleImapPasswordChange = (val: string) => {
    setImapPassword(val)
    setEmailConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        imap_password: val,
        smtp_password: useSameAccountForSmtp ? val : prev.smtp_password,
      }
    })
    if (useSameAccountForSmtp) {
      setSmtpPassword(val)
    }
  }

  // Toggle "Usar a mesma conta da recepção"
  const handleToggleSameAccount = (checked: boolean) => {
    setUseSameAccountForSmtp(checked)
    if (checked) {
      const syncedUser = emailConfig.imap_user || ''
      const syncedPass = imapPassword || emailConfig.imap_password || ''
      setSmtpPassword(syncedPass)
      setEmailConfig((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          smtp_user: syncedUser,
          smtp_password: syncedPass,
        }
      })
      toast({
        title: 'Contas sincronizadas',
        description: 'Usuário e senha de envio SMTP foram copiados da recepção IMAP.',
      })
    }
  }

  // Executar Teste Passo a Passo de Envio SMTP (5 passos)
  const handleRunSmtpTest = async () => {
    const host = emailConfig.smtp_host || 'smtp.office365.com'
    const user = emailConfig.smtp_user || emailConfig.imap_user || ''
    const pass = smtpPassword || emailConfig.smtp_password || imapPassword || ''
    const target = (testTargetEmail || user).trim()

    if (!host || !user) {
      toast({
        title: 'Parâmetros SMTP incompletos',
        description: 'Servidor SMTP e Usuário de Envio são obrigatórios para o teste.',
        variant: 'destructive',
      })
      return
    }

    setTestingSmtp(true)
    setSmtpTestResponse(null)
    setActiveTab('smtptest')

    try {
      const resp = await testSmtpConnection({
        smtp_host: host,
        smtp_port: emailConfig.smtp_port || 587,
        smtp_encryption: (emailConfig.smtp_encryption || 'STARTTLS') as SmtpEncryption,
        smtp_user: user,
        smtp_password: pass,
        smtp_sender_name: emailConfig.smtp_sender_name || 'Atendimento HelpDesk',
        smtp_reply_to: emailConfig.smtp_reply_to || user,
        to: target,
      })

      setSmtpTestResponse(resp)
      if (resp.success) {
        toast({
          title: 'Envio SMTP validado com sucesso!',
          description: resp.message,
        })
      } else {
        toast({
          title: 'Atenção no teste SMTP',
          description: resp.error || resp.message,
          variant: 'destructive',
        })
      }
      loadAuditHistory()
    } catch (err: any) {
      const errMsg =
        err.data?.error || err.message || 'Falha ao conectar e validar o servidor SMTP.'
      toast({
        title: 'Erro na validação SMTP',
        description: errMsg,
        variant: 'destructive',
      })
      if (err.data && err.data.steps) {
        setSmtpTestResponse(err.data)
      }
      loadAuditHistory()
    } finally {
      setTestingSmtp(false)
    }
  }

  // Executar Envio de E-mail de Teste
  const handleSendTestEmail = async () => {
    const target = testTargetEmail.trim()
    if (!target) {
      toast({
        title: 'Informe o e-mail de destino',
        description: 'Digite um endereço de e-mail válido para receber a mensagem de teste.',
        variant: 'destructive',
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(target)) {
      toast({
        title: 'Formato de e-mail inválido',
        description: 'O endereço digitado não tem uma estrutura de e-mail válida.',
        variant: 'destructive',
      })
      return
    }

    setSendingTestEmail(true)
    setTestSendResult(null)

    try {
      const resp = await sendTestEmail({ to: target })
      setTestSendResult(resp)
      if (resp.success) {
        toast({
          title: 'E-mail de teste enviado com sucesso!',
          description: `Mensagem entregue ao destinatário ${target}.`,
        })
      } else {
        toast({
          title: 'Falha no envio de e-mail de teste',
          description: resp.error || resp.message,
          variant: 'destructive',
        })
      }
      loadAuditHistory()
    } catch (err: any) {
      const errorMsg = err.data?.error || err.message || 'Erro desconhecido ao enviar e-mail.'
      setTestSendResult({
        success: false,
        message: 'Falha no envio do e-mail de teste.',
        target_email: target,
        error: errorMsg,
      })
      toast({
        title: 'Erro ao enviar e-mail de teste',
        description: errorMsg,
        variant: 'destructive',
      })
      loadAuditHistory()
    } finally {
      setSendingTestEmail(false)
    }
  }

  // Executar Teste de Conexão Passo a Passo
  const handleRunConnectionTest = async () => {
    if (!emailConfig.imap_host || !emailConfig.imap_user) {
      toast({
        title: 'Preencha Host e Usuário',
        description: 'Host IMAP e Usuário/E-mail são obrigatórios para testar.',
        variant: 'destructive',
      })
      return
    }

    setTestingConnection(true)
    setTestResponse(null)
    setActiveTab('test')

    try {
      const resp = await testEmailConnection({
        imap_host: emailConfig.imap_host,
        imap_port: emailConfig.imap_port,
        imap_user: emailConfig.imap_user,
        imap_password: imapPassword,
        imap_encryption: (emailConfig.imap_encryption ||
          (emailConfig.imap_ssl ? 'SSL/TLS' : 'STARTTLS')) as ImapEncryption,
        inbox_folder: emailConfig.inbox_folder || 'INBOX',
        processed_folder: emailConfig.processed_folder || 'Processados',
      })

      setTestResponse(resp)
      if (resp.success) {
        toast({
          title: 'Conexão IMAP validada!',
          description: resp.message,
        })
      } else {
        toast({
          title: 'Atenção na conexão IMAP',
          description: resp.message,
          variant: 'destructive',
        })
      }
      loadAuditHistory()
    } catch (err: any) {
      toast({
        title: 'Erro ao conectar ao servidor IMAP',
        description: err.message || 'Falha de comunicação.',
        variant: 'destructive',
      })
    } finally {
      setTestingConnection(false)
    }
  }

  // Executar Teste de Fluxo Ponta a Ponta (Dry-run / Simulação)
  const handleRunDryRun = async () => {
    setRunningDryRun(true)
    setDryRunResult(null)
    setActiveTab('dryrun')

    try {
      const res = await runEmailDryRunSimulation()
      if (res.success && res.result) {
        setDryRunResult(res.result)
        toast({
          title: 'Simulação concluída!',
          description: res.result.expected_destination,
        })
        loadAuditHistory()
      } else {
        toast({
          title: 'Erro na simulação',
          description: res.error || 'Não foi possível processar a mensagem.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao executar teste ponta a ponta',
        description: err.message || 'Falha na requisição.',
        variant: 'destructive',
      })
    } finally {
      setRunningDryRun(false)
    }
  }

  const handleCopyWebhook = () => {
    const baseUrl = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')
    const url = `${baseUrl}/backend/v1/emails/ingest`
    navigator.clipboard.writeText(url)
    setCopiedWebhook(true)
    toast({ title: 'URL do Webhook copiada para a área de transferência!' })
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  return (
    <Card className="itsm-card border-blue-200 dark:border-blue-900 shadow-sm">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Conexão IMAP Real & Caixa de E-mail
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Validação de conexão direta com a caixa do cliente e ingestão automatizada de
                chamados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {emailConfig.enabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Leitura Automática Ativa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Ingestão Pausada
              </span>
            )}
          </div>
        </div>

        {/* Abas Superiores de Navegação */}
        <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-slate-100 dark:border-slate-800/80 -mb-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'config' ? 'default' : 'ghost'}
            className={`h-8 text-xs ${activeTab === 'config' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Server className="h-3.5 w-3.5 mr-1.5" />
            Parâmetros da Caixa
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'smtptest' ? 'default' : 'ghost'}
            className={`h-8 text-xs ${activeTab === 'smtptest' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setActiveTab('smtptest')}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Validação SMTP (5 Passos)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'test' ? 'default' : 'ghost'}
            className={`h-8 text-xs ${activeTab === 'test' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setActiveTab('test')}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Validação IMAP (7 Passos)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'sendtest' ? 'default' : 'ghost'}
            className={`h-8 text-xs ${activeTab === 'sendtest' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setActiveTab('sendtest')}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Disparo Direto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'dryrun' ? 'default' : 'ghost'}
            className={`h-8 text-xs ${activeTab === 'dryrun' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setActiveTab('dryrun')}
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Teste Ponta a Ponta
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'audit' ? 'default' : 'ghost'}
            className={`h-8 text-xs ${activeTab === 'audit' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => {
              setActiveTab('audit')
              if (auditLogs.length === 0) loadAuditHistory()
            }}
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            Histórico & Diagnóstico
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* ABA 1: PARÂMETROS DA CAIXA */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            {/* Painel de Status do Último Ciclo da Rotina Automática */}
            <div className="rounded-xl p-4 border bg-gradient-to-r from-slate-50 to-blue-50/40 dark:from-slate-900/60 dark:to-blue-950/20 border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Status da Ingestão Automática (Ciclos de 2 min)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (emailConfig as any).last_check_status === 'Sucesso' ||
                      (emailConfig as any).last_check_status === 'success'
                        ? 'default'
                        : (emailConfig as any).last_check_status?.includes('Falha')
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="text-[11px] font-semibold"
                  >
                    Último Ciclo: {(emailConfig as any).last_check_status || 'Aguardando 1º ciclo'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border">
                  <span className="text-[11px] text-slate-500 block">Última Checagem</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {(emailConfig as any).last_check_at
                      ? new Date((emailConfig as any).last_check_at).toLocaleTimeString('pt-BR')
                      : 'Nunca'}
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border">
                  <span className="text-[11px] text-slate-500 block">Último Lote</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {(emailConfig as any).last_processed_count ?? 0} processado(s)
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border">
                  <span className="text-[11px] text-slate-500 block">Total Ingeridos</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {(emailConfig as any).total_ingested_count ?? 0} chamados
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border">
                  <span className="text-[11px] text-slate-500 block">Total Retidos</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {(emailConfig as any).total_retained_count ?? 0} retidos
                  </span>
                </div>
              </div>

              {(emailConfig as any).last_check_error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <div>
                    <strong className="block font-semibold">
                      Diagnóstico do Erro no Último Ciclo:
                    </strong>
                    <span>{(emailConfig as any).last_check_error}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Guia de Configuração para Microsoft 365 / Office 365 */}
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
                <Server className="h-4 w-4 text-blue-600" />
                <span>Instruções Importantes para Caixas Microsoft 365 (imap.office365.com)</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300 text-[11px]">
                <li>
                  <strong>Autenticação Básica vs Senha de Aplicativo:</strong> O Microsoft 365
                  desabilitou autenticação básica padrão. É obrigatório criar uma{' '}
                  <em>Senha de Aplicativo (App Password)</em> na conta se a organização utilizar
                  MFA/2FA, ou conceder acesso IMAP no Microsoft 365 Admin Center.
                </li>
                <li>
                  <strong>Nome da Pasta de Entrada:</strong> O padrão do Office 365 é{' '}
                  <code>INBOX</code>. Se você utilizar uma pasta personalizada como{' '}
                  <code>Atendimento</code>, ela deve existir exatamente com essa grafia no webmail
                  do Outlook. O sistema possui fallback automático para a <code>INBOX</code> caso a
                  pasta não seja localizada.
                </li>
                <li>
                  <strong>Porta e Criptografia:</strong> Porta <strong>993</strong> com{' '}
                  <strong>SSL/TLS</strong> direta habilitada.
                </li>
                <li>
                  <strong>Domínios Liberados:</strong> E-mails de remetentes cujo domínio esteja em{' '}
                  <em>Clientes → Domínios de E-mail</em> geram chamados automaticamente. E-mails de
                  outros domínios são enviados para <em>Chamados Retidos (/tickets/retained)</em>{' '}
                  para proteção contra spam.
                </li>
              </ul>
            </div>

            {/* Toggle Mestre */}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  Habilitar Leitura Automática Periódica (Cron)
                </Label>
                <p className="text-xs text-slate-500">
                  Quando ativo, a rotina interna verifica a caixa a cada{' '}
                  {emailConfig.check_interval_minutes || 2} minutos e ingere novas solicitações.
                </p>
              </div>
              <Switch
                checked={emailConfig.enabled}
                onCheckedChange={(c) => setEmailConfig({ ...emailConfig, enabled: c })}
                disabled={!isGestor}
              />
            </div>

            {/* SEÇÃO A: RECEPÇÃO DE E-MAILS (IMAP) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Recepção de E-mails (IMAP)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configuração da caixa para leitura e ingestão automática de chamados
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  Entrada
                </Badge>
              </div>

              {/* Grid de Configurações IMAP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-slate-400" />
                    Servidor IMAP (Host)
                  </Label>
                  <Input
                    type="text"
                    placeholder="ex: imap.office365.com"
                    value={emailConfig.imap_host || ''}
                    onChange={(e) => setEmailConfig({ ...emailConfig, imap_host: e.target.value })}
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Porta do Servidor IMAP
                  </Label>
                  <Input
                    type="number"
                    placeholder="993"
                    value={emailConfig.imap_port || 993}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        imap_port: parseInt(e.target.value, 10) || 993,
                      })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Criptografia da Conexão
                  </Label>
                  <Select
                    value={
                      emailConfig.imap_encryption || (emailConfig.imap_ssl ? 'SSL/TLS' : 'STARTTLS')
                    }
                    onValueChange={(val: ImapEncryption) =>
                      setEmailConfig({
                        ...emailConfig,
                        imap_encryption: val,
                        imap_ssl: val === 'SSL/TLS',
                        imap_port:
                          val === 'SSL/TLS'
                            ? 993
                            : val === 'STARTTLS'
                              ? 143
                              : emailConfig.imap_port || 143,
                      })
                    }
                    disabled={!isGestor}
                  >
                    <SelectTrigger className="itsm-input">
                      <SelectValue placeholder="Selecione o tipo de criptografia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SSL/TLS">SSL/TLS (Porta 993 recomendada)</SelectItem>
                      <SelectItem value="STARTTLS">STARTTLS (Porta 143 recomendada)</SelectItem>
                      <SelectItem value="Nenhuma">Nenhuma / Aberta (Insegura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Usuário / E-mail da Caixa
                  </Label>
                  <Input
                    type="email"
                    placeholder="suporte@cliente.com.br"
                    value={emailConfig.imap_user || ''}
                    onChange={(e) => handleImapUserChange(e.target.value)}
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      Senha da Caixa (App Password)
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Ocultar senha
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          Mostrar senha
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={imapPassword}
                      onChange={(e) => handleImapPasswordChange(e.target.value)}
                      className="itsm-input pr-10"
                      disabled={!isGestor}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Gravada de forma segura nas configurações da organização. Para Google ou
                    Microsoft 365, utilize uma Senha de Aplicativo (App Password).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Inbox className="h-3.5 w-3.5 text-slate-400" />
                    Pasta de Entrada (Padrão INBOX)
                  </Label>
                  <Input
                    type="text"
                    placeholder="INBOX"
                    value={emailConfig.inbox_folder || 'INBOX'}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, inbox_folder: e.target.value })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FolderSync className="h-3.5 w-3.5 text-slate-400" />
                    Pasta de E-mails Processados
                  </Label>
                  <Input
                    type="text"
                    placeholder="Processados ou INBOX.Processed"
                    value={emailConfig.processed_folder || 'Processados'}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, processed_folder: e.target.value })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Intervalo de Verificação (minutos)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={emailConfig.check_interval_minutes || 2}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        check_interval_minutes: parseInt(e.target.value, 10) || 2,
                      })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO B: ENVIO DE E-MAIL (SMTP) */}
            <div className="space-y-4 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Envio de E-mail (SMTP)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configuração da caixa de saída para notificações de chamados, SLAs e respostas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border">
                  <Switch
                    id="same-account-toggle"
                    checked={useSameAccountForSmtp}
                    onCheckedChange={handleToggleSameAccount}
                    disabled={!isGestor}
                  />
                  <Label
                    htmlFor="same-account-toggle"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Usar a mesma conta da recepção
                  </Label>
                </div>
              </div>

              {/* Dicas Microsoft 365 para SMTP */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold">
                  <Server className="h-4 w-4 text-emerald-600" />
                  <span>Configuração Recomendada Microsoft 365 (SMTP)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded border">
                    <span className="text-slate-400 block font-semibold">Servidor Host</span>
                    <strong className="text-slate-900 dark:text-slate-100 font-mono">
                      smtp.office365.com
                    </strong>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded border">
                    <span className="text-slate-400 block font-semibold">Porta & Criptografia</span>
                    <strong className="text-slate-900 dark:text-slate-100 font-mono">
                      587 (STARTTLS)
                    </strong>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded border">
                    <span className="text-slate-400 block font-semibold">Autenticação com 2FA</span>
                    <strong className="text-emerald-700 dark:text-emerald-300">
                      Senha de Aplicativo
                    </strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Para contas Microsoft 365 com 2FA obrigatório, crie uma Senha de Aplicativo em{' '}
                  <a
                    href="https://mysignins.microsoft.com/security-info"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 dark:text-emerald-300 underline font-medium"
                  >
                    mysignins.microsoft.com/security-info
                  </a>{' '}
                  ou certifique-se de que o protocolo <em>SMTP autenticado</em> está habilitado para
                  a caixa no Microsoft 365 Admin Center.
                </p>
              </div>

              {/* Grid de Configurações SMTP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-slate-400" />
                    Servidor SMTP (Host)
                  </Label>
                  <Input
                    type="text"
                    placeholder="smtp.office365.com"
                    value={emailConfig.smtp_host || ''}
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtp_host: e.target.value })}
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Porta SMTP (Padrão 587)
                  </Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={emailConfig.smtp_port ?? 587}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        smtp_port: parseInt(e.target.value, 10) || 587,
                      })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                  <p className="text-[10px] text-slate-400">
                    Aceita portas 587 (STARTTLS), 465 (SSL/TLS) ou 25 (padrão provedor).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Criptografia SMTP
                  </Label>
                  <Select
                    value={emailConfig.smtp_encryption || 'STARTTLS'}
                    onValueChange={(val: SmtpEncryption) =>
                      setEmailConfig({
                        ...emailConfig,
                        smtp_encryption: val,
                        smtp_port:
                          val === 'SSL/TLS'
                            ? 465
                            : val === 'STARTTLS'
                              ? 587
                              : emailConfig.smtp_port || 587,
                      })
                    }
                    disabled={!isGestor}
                  >
                    <SelectTrigger className="itsm-input">
                      <SelectValue placeholder="Selecione o tipo de criptografia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STARTTLS">STARTTLS (Porta 587 - Padrão M365)</SelectItem>
                      <SelectItem value="SSL/TLS">SSL/TLS (Porta 465)</SelectItem>
                      <SelectItem value="Nenhuma">Nenhuma / Aberta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Usuário / E-mail de Envio SMTP
                  </Label>
                  <Input
                    type="email"
                    placeholder="atendimento@empresa.com.br"
                    value={
                      useSameAccountForSmtp
                        ? emailConfig.imap_user || ''
                        : emailConfig.smtp_user || ''
                    }
                    onChange={(e) => setEmailConfig({ ...emailConfig, smtp_user: e.target.value })}
                    className={`itsm-input ${useSameAccountForSmtp ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
                    disabled={!isGestor || useSameAccountForSmtp}
                  />
                  {useSameAccountForSmtp && (
                    <p className="text-[10px] text-slate-400">
                      Copiado automaticamente da conta IMAP de recepção.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      Senha SMTP (App Password)
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {showSmtpPassword ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          Mostrar
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showSmtpPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={
                        useSameAccountForSmtp
                          ? imapPassword || emailConfig.imap_password || ''
                          : smtpPassword
                      }
                      onChange={(e) => {
                        setSmtpPassword(e.target.value)
                        setEmailConfig({ ...emailConfig, smtp_password: e.target.value })
                      }}
                      className={`itsm-input pr-10 ${useSameAccountForSmtp ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
                      disabled={!isGestor || useSameAccountForSmtp}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={showSmtpPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showSmtpPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {useSameAccountForSmtp
                      ? 'Reutilizando a senha da recepção IMAP. Desmarque o toggle acima para informar outra senha.'
                      : 'Utilize a Senha de Aplicativo gerada para a conta de envio.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nome de Exibição do Remetente
                  </Label>
                  <Input
                    type="text"
                    placeholder="Atendimento HelpDesk"
                    value={emailConfig.smtp_sender_name || ''}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, smtp_sender_name: e.target.value })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                  <p className="text-[10px] text-slate-400">
                    Aparece no campo "De:" para os solicitantes (ex: Suporte TI &lt;email&gt;).
                  </p>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Responder para (Reply-To, opcional)
                  </Label>
                  <Input
                    type="email"
                    placeholder="suporte@empresa.com.br (deixe vazio para usar a própria conta)"
                    value={emailConfig.smtp_reply_to || ''}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, smtp_reply_to: e.target.value })
                    }
                    className="itsm-input"
                    disabled={!isGestor}
                  />
                </div>
              </div>
            </div>

            {/* Barra de Ações */}
            {isGestor && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={async () => {
                      await onSaveConfig()
                    }}
                    disabled={emailConfigSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Save className="mr-1.5 h-4 w-4" />
                    {emailConfigSaving ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRunSmtpTest}
                    disabled={testingSmtp || !emailConfig.smtp_host}
                    className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                  >
                    <Send
                      className={`mr-1.5 h-4 w-4 text-emerald-600 ${testingSmtp ? 'animate-spin' : ''}`}
                    />
                    {testingSmtp ? 'Testando Envio...' : 'Testar Envio (SMTP)'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRunConnectionTest}
                    disabled={testingConnection || !emailConfig.imap_host}
                    className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <RefreshCw
                      className={`mr-1.5 h-4 w-4 ${testingConnection ? 'animate-spin' : ''}`}
                    />
                    {testingConnection ? 'Testando Conexão...' : 'Testar Recepção (IMAP)'}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRunDryRun}
                    disabled={runningDryRun}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  >
                    <Play
                      className={`mr-1.5 h-4 w-4 ${runningDryRun ? 'animate-pulse text-indigo-500' : ''}`}
                    />
                    {runningDryRun ? 'Simulando Fluxo...' : 'Teste Ponta a Ponta'}
                  </Button>
                </div>
              </div>
            )}

            {/* Alternativa Webhook */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Endpoint Webhook HTTP (Alternativa Direta)
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Para provedores como AWS SES, SendGrid ou servidores locais com encaminhamento
                    imediato via POST.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${(import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')}/backend/v1/emails/ingest`}
                  className="itsm-input bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyWebhook}
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
          </div>
        )}

        {/* ABA 2: ENVIAR E-MAIL DE TESTE (NOVO) */}
        {activeTab === 'sendtest' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-1">
              <h4 className="text-sm font-bold text-blue-950 dark:text-blue-200 flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Validação do Envio de E-mails (SMTP)
              </h4>
              <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
                Dispare um e-mail de teste real para verificar se o servidor de saída está
                autenticado, sem bloqueio de portas e apto a entregar notificações e alertas de
                chamados aos destinatários.
              </p>
            </div>

            <div className="p-5 rounded-xl border bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  E-mail de Destino para o Teste
                </Label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Input
                    type="email"
                    placeholder="seu.email@empresa.com.br"
                    value={testTargetEmail}
                    onChange={(e) => setTestTargetEmail(e.target.value)}
                    className="itsm-input flex-1"
                    disabled={sendingTestEmail || !isGestor}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSendTestEmail()
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={sendingTestEmail || !testTargetEmail || !isGestor}
                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    <Send className={`mr-1.5 h-4 w-4 ${sendingTestEmail ? 'animate-spin' : ''}`} />
                    {sendingTestEmail ? 'Enviando Teste...' : 'Enviar E-mail de Teste'}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Um e-mail com assunto <code>[Teste] Verificação de envio — Sistema ITSM</code>{' '}
                  será despachado contendo a data/hora e identificação da caixa configurada.
                </p>
              </div>

              {/* Informações da caixa de origem que será utilizada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">Caixa de Origem / Conta:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {emailConfig.smtp_user || emailConfig.imap_user || 'SMTP Padrão do Sistema'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Servidor Host de Saída:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {emailConfig.smtp_host || 'SMTP Padrão do Sistema'} (Porta{' '}
                    {emailConfig.smtp_port || 587})
                  </span>
                </div>
              </div>

              {/* Feedback do Envio de Teste */}
              {testSendResult && (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    testSendResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {testSendResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">
                          {testSendResult.success
                            ? 'E-mail de teste enviado com sucesso!'
                            : 'Falha no envio do e-mail de teste'}
                        </p>
                        {testSendResult.smtp_used && (
                          <Badge
                            variant={
                              testSendResult.smtp_used === 'dedicated_mailbox'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {testSendResult.smtp_used === 'dedicated_mailbox'
                              ? 'Caixa dedicada'
                              : 'Fallback ServiceOne'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs">{testSendResult.error || testSendResult.message}</p>
                      <div className="text-[11px] opacity-80 pt-1 space-y-0.5">
                        <p>
                          <strong>Destinatário:</strong> {testSendResult.target_email}
                        </p>
                        {testSendResult.sent_at && (
                          <p>
                            <strong>Data do disparo:</strong>{' '}
                            {new Date(testSendResult.sent_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                        {testSendResult.sender_email && (
                          <p>
                            <strong>Remetente:</strong>{' '}
                            {testSendResult.sender_name
                              ? `${testSendResult.sender_name} <${testSendResult.sender_email}>`
                              : testSendResult.sender_email}
                          </p>
                        )}
                        {testSendResult.smtp_host && (
                          <p>
                            <strong>Host utilizado:</strong> {testSendResult.smtp_host}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: VALIDAÇÃO SMTP PASSO A PASSO (5 PASSOS) */}
        {activeTab === 'smtptest' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-600" />
                  Diagnóstico de Envio SMTP Passo a Passo (5 Etapas)
                </h4>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  Executa em tempo real os 5 passos do envio: Parâmetros, Conexão Host/Porta,
                  Handshake TLS/STARTTLS, Autenticação de Credenciais e Disparo Real.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleRunSmtpTest}
                disabled={testingSmtp || !emailConfig.smtp_host}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${testingSmtp ? 'animate-spin' : ''}`} />
                {testingSmtp ? 'Validando SMTP...' : 'Executar Validação SMTP'}
              </Button>
            </div>

            {/* Configuração do Destino para a Etapa 5 (Envio Real) */}
            <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 space-y-3">
              <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Destinatário para o Teste de Disparo Real (Etapa 5)
              </Label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Input
                  type="email"
                  placeholder="destinatario@empresa.com.br"
                  value={testTargetEmail}
                  onChange={(e) => setTestTargetEmail(e.target.value)}
                  className="itsm-input flex-1"
                  disabled={testingSmtp || !isGestor}
                />
                <Button
                  onClick={handleRunSmtpTest}
                  disabled={testingSmtp || !emailConfig.smtp_host || !isGestor}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Send className={`mr-1.5 h-4 w-4 ${testingSmtp ? 'animate-spin' : ''}`} />
                  {testingSmtp ? 'Testando...' : 'Iniciar Teste 5 Passos'}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                Será disparado um e-mail de prova para este endereço se as etapas de conexão e
                credenciais forem aprovadas.
              </p>
            </div>

            {testingSmtp && (
              <div className="p-8 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border">
                <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Conectando ao servidor SMTP {emailConfig.smtp_host || 'smtp.office365.com'}:
                  {emailConfig.smtp_port || 587}...
                </p>
                <p className="text-xs text-slate-400">
                  Executando handshake TLS, autenticação EHLO e validação de credenciais
                </p>
              </div>
            )}

            {smtpTestResponse && !testingSmtp && (
              <div className="space-y-4">
                {/* Resumo do Status SMTP */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    smtpTestResponse.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
                  }`}
                >
                  {smtpTestResponse.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold">{smtpTestResponse.message}</p>
                      {smtpTestResponse.smtp_used && (
                        <Badge
                          variant={
                            smtpTestResponse.smtp_used === 'dedicated_mailbox'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {smtpTestResponse.smtp_used === 'dedicated_mailbox'
                            ? 'Caixa dedicada'
                            : 'Fallback ServiceOne'}
                        </Badge>
                      )}
                    </div>
                    {smtpTestResponse.error && (
                      <p className="text-xs font-mono text-red-700 dark:text-red-300">
                        {smtpTestResponse.error}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90 pt-1">
                      {smtpTestResponse.host && (
                        <span>
                          <strong>Host:</strong> {smtpTestResponse.host}:{smtpTestResponse.port}
                        </span>
                      )}
                      {smtpTestResponse.user && (
                        <span>
                          <strong>Usuário:</strong> {smtpTestResponse.user}
                        </span>
                      )}
                      {smtpTestResponse.target_email && (
                        <span>
                          <strong>Destinatário de Teste:</strong> {smtpTestResponse.target_email}
                        </span>
                      )}
                      {smtpTestResponse.duration_ms !== undefined && (
                        <span>
                          <strong>Tempo total:</strong> {smtpTestResponse.duration_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista dos 5 Passos SMTP */}
                {smtpTestResponse.steps && smtpTestResponse.steps.length > 0 && (
                  <div className="border rounded-xl divide-y dark:divide-slate-800 bg-white dark:bg-slate-900/60 shadow-sm overflow-hidden">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Etapas da Validação SMTP (5 Passos)</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {smtpTestResponse.steps.filter((s) => s.status === 'success').length} de{' '}
                        {smtpTestResponse.steps.length} aprovadas
                      </span>
                    </div>
                    {smtpTestResponse.steps.map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className="p-3.5 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          {step.status === 'success' && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          )}
                          {step.status === 'warning' && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          {step.status === 'failed' && (
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          )}
                          {step.status === 'skipped' && (
                            <span className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 shrink-0 mt-0.5">
                              -
                            </span>
                          )}
                          {step.status === 'pending' && (
                            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {idx + 1}. {step.name}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">{step.message}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {step.duration_ms > 0 && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {step.duration_ms}ms
                            </span>
                          )}
                          <Badge
                            variant={
                              step.status === 'success'
                                ? 'default'
                                : step.status === 'warning'
                                  ? 'secondary'
                                  : step.status === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                            }
                            className="text-[10px] uppercase font-bold"
                          >
                            {step.status === 'success'
                              ? 'Aprovado'
                              : step.status === 'warning'
                                ? 'Aviso'
                                : step.status === 'failed'
                                  ? 'Falha'
                                  : step.status === 'pending'
                                    ? 'Em Andamento'
                                    : 'Ignorado'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!smtpTestResponse && !testingSmtp && (
              <div className="p-8 text-center space-y-2 border border-dashed rounded-xl text-slate-400">
                <Send className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">Nenhum teste de envio SMTP executado nesta sessão.</p>
                <p className="text-[11px] text-slate-400">
                  Clique no botão acima para validar as 5 etapas de envio (parâmetros, host, TLS,
                  autenticação e envio real).
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: VALIDAÇÃO PASSO A PASSO (IMAP TEST) */}
        {activeTab === 'test' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Diagnóstico de Conexão IMAP Passo a Passo
                </h4>
                <p className="text-xs text-slate-500">
                  Executa em tempo real os 7 testes essenciais: Socket TCP, Criptografia, Login,
                  Seleção de Pasta, Contagem de Mensagens, Leitura e Rotina Cron.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleRunConnectionTest}
                disabled={testingConnection || !emailConfig.imap_host}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${testingConnection ? 'animate-spin' : ''}`}
                />
                {testingConnection ? 'Executando Testes...' : 'Executar Validação Agora'}
              </Button>
            </div>

            {testingConnection && (
              <div className="p-8 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border">
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Conectando ao servidor IMAP {emailConfig.imap_host}:{emailConfig.imap_port}...
                </p>
                <p className="text-xs text-slate-400">
                  Avaliando resposta de socket, handshake e autenticação
                </p>
              </div>
            )}

            {testResponse && !testingConnection && (
              <div className="space-y-4">
                {/* Resumo do Status */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    testResponse.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
                  }`}
                >
                  {testResponse.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-bold">{testResponse.message}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
                      <span>
                        <strong>Servidor:</strong> {testResponse.host}:{testResponse.port}
                      </span>
                      <span>
                        <strong>Usuário:</strong> {testResponse.user}
                      </span>
                      <span>
                        <strong>Criptografia:</strong> {testResponse.encryption}
                      </span>
                      <span>
                        <strong>Pasta:</strong> {testResponse.inbox_folder}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista dos 7 Passos */}
                <div className="border rounded-xl divide-y dark:divide-slate-800 bg-white dark:bg-slate-900/60 shadow-sm overflow-hidden">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Etapas de Verificação Detalhada
                  </div>
                  {testResponse.steps.map((step, idx) => (
                    <div
                      key={step.id || idx}
                      className="p-3.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        {step.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        )}
                        {step.status === 'warning' && (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        {step.status === 'failed' && (
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        {step.status === 'skipped' && (
                          <span className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 shrink-0 mt-0.5">
                            -
                          </span>
                        )}
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {idx + 1}. {step.name}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">{step.message}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {step.duration_ms > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {step.duration_ms}ms
                          </span>
                        )}
                        <Badge
                          variant={
                            step.status === 'success'
                              ? 'default'
                              : step.status === 'warning'
                                ? 'secondary'
                                : step.status === 'failed'
                                  ? 'destructive'
                                  : 'outline'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {step.status === 'success'
                            ? 'Aprovado'
                            : step.status === 'warning'
                              ? 'Aviso'
                              : step.status === 'failed'
                                ? 'Falha'
                                : 'Ignorado'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Últimas 5 Mensagens Amostradas */}
                {testResponse.latest_messages && testResponse.latest_messages.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Inbox className="h-4 w-4 text-blue-500" />
                      Últimas Mensagens Identificadas na Caixa (
                      {testResponse.latest_messages.length})
                    </Label>
                    <div className="border rounded-xl overflow-hidden divide-y dark:divide-slate-800 text-xs">
                      {testResponse.latest_messages.map((msg, mIdx) => (
                        <div
                          key={mIdx}
                          className="p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {msg.subject || '(Sem assunto)'}
                            </p>
                            <p className="text-slate-500 truncate text-[11px]">
                              De:{' '}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {msg.from}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
                            <span>{new Date(msg.date).toLocaleString('pt-BR')}</span>
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {msg.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!testResponse && !testingConnection && (
              <div className="p-8 text-center space-y-2 border border-dashed rounded-xl text-slate-400">
                <ShieldCheck className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">Nenhum teste de conexão executado nesta sessão.</p>
                <p className="text-[11px] text-slate-400">
                  Clique no botão acima para validar passo a passo a comunicação com a caixa real.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: TESTE PONTA A PONTA (DRY-RUN) */}
        {activeTab === 'dryrun' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Play className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Simulação de Fluxo Ponta a Ponta (Dry-Run Seguro)
                </h4>
                <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80">
                  Executa o pipeline exato do <code>email_ingestion</code> sem criar chamado
                  duplicado no banco. Revela o destino, identificação do cliente e triagem de fila.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleRunDryRun}
                disabled={runningDryRun}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                <Play className={`mr-1.5 h-3.5 w-3.5 ${runningDryRun ? 'animate-pulse' : ''}`} />
                {runningDryRun ? 'Simulando...' : 'Processar Mensagem Recente'}
              </Button>
            </div>

            {runningDryRun && (
              <div className="p-8 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border">
                <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Analisando mensagem mais recente pelo pipeline de ingestão...
                </p>
                <p className="text-xs text-slate-400">
                  Verificando domínios autorizados, cadastro de solicitante e roteamento ITSM
                </p>
              </div>
            )}

            {dryRunResult && !runningDryRun && (
              <div className="space-y-4">
                {/* Cartão de Veredito */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600 text-white font-bold text-xs uppercase px-2.5 py-1">
                        Destino Previsto: {dryRunResult.expected_destination}
                      </Badge>
                      {dryRunResult.ticket_routing.is_reply && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                          Resposta a Ticket
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Simulado em:{' '}
                      {new Date(dryRunResult.simulation_time).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {dryRunResult.explanation}
                  </p>
                </div>

                {/* Grade de 4 Pilares de Análise */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mensagem Amostrada */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900/60 space-y-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <Mail className="h-3.5 w-3.5 text-blue-500" />
                      1. Mensagem Processada
                    </Label>
                    <div className="space-y-1 text-xs">
                      <p>
                        <strong>De:</strong> {dryRunResult.message_sampled.from}{' '}
                        {dryRunResult.message_sampled.from_name
                          ? `(${dryRunResult.message_sampled.from_name})`
                          : ''}
                      </p>
                      <p>
                        <strong>Assunto:</strong> {dryRunResult.message_sampled.subject}
                      </p>
                      <p className="text-slate-500 text-[11px] bg-slate-50 dark:bg-slate-800/40 p-2 rounded border mt-1">
                        "{dryRunResult.message_sampled.body_preview}"
                      </p>
                    </div>
                  </div>

                  {/* Verificação de Domínio */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900/60 space-y-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      2. Validação de Domínio
                    </Label>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Domínio Extraído:</span>
                        <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                          {dryRunResult.domain_check.domain || 'Nenhum'}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Permissão em client_email_domains:</span>
                        <Badge
                          variant={dryRunResult.domain_check.allowed ? 'default' : 'destructive'}
                          className="text-[10px]"
                        >
                          {dryRunResult.domain_check.allowed ? 'Autorizado' : 'Não Cadastrado'}
                        </Badge>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        <strong>Cliente Identificado:</strong>{' '}
                        {dryRunResult.domain_check.company_name}
                      </p>
                    </div>
                  </div>

                  {/* Solicitante Identificado */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900/60 space-y-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                      3. Solicitante / Contato
                    </Label>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Nome Resolvido:</span>
                        <span className="font-semibold">
                          {dryRunResult.requester_identification.resolved_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Vínculo de Usuário:</span>
                        <span>
                          {dryRunResult.requester_identification.matched_user
                            ? 'Usuário do Sistema'
                            : dryRunResult.requester_identification.matched_contact
                              ? 'Contato de Cliente'
                              : 'Novo Contato'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Telefone:</span>
                        <span>
                          {dryRunResult.requester_identification.phone || 'Não informado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Roteamento e Fila */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900/60 space-y-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <Tag className="h-3.5 w-3.5 text-purple-500" />
                      4. Roteamento ITSM
                    </Label>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Fila de Atendimento:</span>
                        <span className="font-semibold">
                          {dryRunResult.ticket_routing.suggested_queue}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tipo / Prioridade:</span>
                        <span>
                          {dryRunResult.ticket_routing.type} /{' '}
                          {dryRunResult.ticket_routing.priority}
                        </span>
                      </div>
                      {dryRunResult.ticket_routing.existing_ticket && (
                        <p className="text-blue-600 dark:text-blue-400 text-[11px]">
                          Vincularia ao Chamado #
                          {dryRunResult.ticket_routing.existing_ticket.number} (
                          {dryRunResult.ticket_routing.existing_ticket.title})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!dryRunResult && !runningDryRun && (
              <div className="p-8 text-center space-y-2 border border-dashed rounded-xl text-slate-400">
                <Play className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">Nenhuma simulação ponta a ponta executada nesta sessão.</p>
                <p className="text-[11px] text-slate-400">
                  Clique em "Processar Mensagem Recente" para validar o comportamento sem risco de
                  duplicidade.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 4: HISTÓRICO DE AUDITORIA & DIAGNÓSTICO */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-blue-500" />
                  Registro de Auditoria dos Testes de E-mail
                </h4>
                <p className="text-[11px] text-slate-500">
                  Histórico imutável de testes IMAP e simulações para verificação por
                  administradores.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAuditHistory}
                disabled={loadingAudit}
                className="h-7 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingAudit ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {loadingAudit && (
              <p className="text-xs text-slate-400 p-4 text-center">
                Carregando logs de auditoria...
              </p>
            )}

            {!loadingAudit && auditLogs.length === 0 && (
              <div className="p-6 text-center border border-dashed rounded-xl text-slate-400 text-xs">
                Nenhum log de teste registrado até o momento. Execute um teste de conexão ou ponta a
                ponta para registrar.
              </div>
            )}

            {!loadingAudit && auditLogs.length > 0 && (
              <div className="border rounded-xl divide-y dark:divide-slate-800 overflow-hidden text-xs">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors space-y-1.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            log.status === 'success'
                              ? 'default'
                              : log.status === 'warning'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="text-[10px] font-bold uppercase"
                        >
                          {log.test_type === 'connection_test'
                            ? 'Teste Conexão IMAP'
                            : log.test_type === 'teste-envio'
                              ? 'Envio de Teste (SMTP)'
                              : 'Simulação Ponta a Ponta'}
                        </Badge>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.summary_message || 'Execução de teste'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.created).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>
                        <strong>Executor:</strong>{' '}
                        {log.executed_by_name || log.executed_by_email || 'Administrador'}
                      </span>
                      {log.host && (
                        <span>
                          <strong>Servidor:</strong> {log.host}:{log.port}
                        </span>
                      )}
                      {log.user_account && (
                        <span>
                          <strong>Conta:</strong> {log.user_account}
                        </span>
                      )}
                      {log.encryption && (
                        <span>
                          <strong>Criptografia:</strong> {log.encryption}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
