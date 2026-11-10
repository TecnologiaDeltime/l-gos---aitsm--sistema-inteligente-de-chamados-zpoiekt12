import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Bot,
  Clock,
  Sparkles,
  Eye,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Info,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import {
  emailAutoReplyService,
  EmailAutoReplySettings,
  DEFAULT_RECEIPT_SUBJECT,
  DEFAULT_RECEIPT_BODY,
  DEFAULT_OUT_OF_OFFICE_SUBJECT,
  DEFAULT_OUT_OF_OFFICE_BODY,
  PreviewAutoReplyResponse,
} from '@/services/email-auto-reply'
import { emailAlertSettingsService, EmailAlertSetting } from '@/services/email-alert-settings'
import { EmailTemplateEditorDialog } from '@/components/settings/EmailTemplateEditorDialog'

interface EmailAutoReplySettingsTabProps {
  isGestor: boolean
}

export function EmailAutoReplySettingsTab({ isGestor }: EmailAutoReplySettingsTabProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingPreview, setGeneratingPreview] = useState(false)

  // Configurações
  const [settings, setSettings] = useState<EmailAutoReplySettings>({
    receipt_enabled: true,
    receipt_subject: DEFAULT_RECEIPT_SUBJECT,
    receipt_body: DEFAULT_RECEIPT_BODY,
    out_of_office_enabled: false,
    out_of_office_subject: DEFAULT_OUT_OF_OFFICE_SUBJECT,
    out_of_office_body: DEFAULT_OUT_OF_OFFICE_BODY,
    anti_loop_enabled: true,
  })

  // Sub-aba ativa (Recebimento vs Ausência)
  const [activeSubTab, setActiveSubTab] = useState<'receipt' | 'out_of_office'>('receipt')

  // Modal de Preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewAutoReplyResponse | null>(null)
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html')

  // Vínculo com a Central de Alertas (ticket_created)
  const [centralAlert, setCentralAlert] = useState<EmailAlertSetting | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const [data, alerts] = await Promise.all([
        emailAutoReplyService.getSettings(),
        emailAlertSettingsService.getAll().catch(() => []),
      ])
      setSettings(data)
      const ticketCreatedAlert = alerts.find((a) => a.alert_key === 'ticket_created') || null
      setCentralAlert(ticketCreatedAlert)
    } catch (err) {
      console.error('Falha ao carregar configurações de respostas automáticas:', err)
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar os dados de respostas automáticas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCentralAlert = async (updated: EmailAlertSetting) => {
    try {
      const saved = await emailAlertSettingsService.update(updated.id, updated)
      setCentralAlert(saved)
      // Sincroniza também assunto e corpo se o usuário desejar espelhar
      setSettings((prev) => ({
        ...prev,
        receipt_subject: saved.subject_template || prev.receipt_subject,
      }))
      toast({
        title: 'Template da Central atualizado!',
        description: 'O template oficial de abertura de chamados foi sincronizado com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar template da Central',
        description: err?.message || 'Falha ao atualizar alerta na Central de Alertas.',
        variant: 'destructive',
      })
      throw err
    }
  }

  const handleSave = async () => {
    if (!isGestor) {
      toast({
        title: 'Acesso negado',
        description: 'Apenas gestores ou administradores podem salvar configurações de e-mail.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const updated = await emailAutoReplyService.saveSettings(settings)
      setSettings(updated)
      toast({
        title: 'Configurações salvas!',
        description: 'As respostas automáticas de e-mail foram atualizadas com sucesso.',
      })
    } catch (err: any) {
      console.error('Falha ao salvar respostas automáticas:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao gravar configurações no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = (type: 'receipt' | 'out_of_office') => {
    if (type === 'receipt') {
      setSettings((prev) => ({
        ...prev,
        receipt_subject: DEFAULT_RECEIPT_SUBJECT,
        receipt_body: DEFAULT_RECEIPT_BODY,
      }))
      toast({
        title: 'Modelo restaurado',
        description: 'Assunto e corpo da Resposta de Recebimento voltaram ao padrão do sistema.',
      })
    } else {
      setSettings((prev) => ({
        ...prev,
        out_of_office_subject: DEFAULT_OUT_OF_OFFICE_SUBJECT,
        out_of_office_body: DEFAULT_OUT_OF_OFFICE_BODY,
      }))
      toast({
        title: 'Modelo restaurado',
        description: 'Assunto e corpo da Resposta de Ausência voltaram ao padrão do sistema.',
      })
    }
  }

  const insertVariable = (
    variableKey: string,
    field: 'subject' | 'body',
    type: 'receipt' | 'out_of_office',
  ) => {
    const token = `{{${variableKey}}}`
    if (type === 'receipt') {
      if (field === 'subject') {
        setSettings((prev) => ({
          ...prev,
          receipt_subject: (prev.receipt_subject || '') + token,
        }))
      } else {
        setSettings((prev) => ({
          ...prev,
          receipt_body: (prev.receipt_body || '') + token,
        }))
      }
    } else {
      if (field === 'subject') {
        setSettings((prev) => ({
          ...prev,
          out_of_office_subject: (prev.out_of_office_subject || '') + token,
        }))
      } else {
        setSettings((prev) => ({
          ...prev,
          out_of_office_body: (prev.out_of_office_body || '') + token,
        }))
      }
    }
    toast({
      title: 'Variável inserida',
      description: `Variável ${token} adicionada ao campo.`,
    })
  }

  const handleOpenPreview = async (type: 'receipt' | 'out_of_office') => {
    setGeneratingPreview(true)
    try {
      const subject = type === 'receipt' ? settings.receipt_subject : settings.out_of_office_subject
      const body = type === 'receipt' ? settings.receipt_body : settings.out_of_office_body

      const resp = await emailAutoReplyService.preview({
        type,
        subject,
        body,
        ticket_number: '1042',
        ticket_title: 'Falha de comunicação com o servidor de banco de dados',
        requester_name: 'Mariana Souza',
        company_name: 'Hospital Santa Helena',
        date: new Date().toLocaleDateString('pt-BR') + ' às 14:35',
        priority: 'Alta',
        activity: 'Suporte a Banco de Dados / Incidente Crítico',
        deadline: '4 horas (até hoje às 18:35)',
        operator: 'Ainda sem atribuição',
        status: 'Novo',
      })

      setPreviewData(resp)
      setPreviewOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar pré-visualização',
        description: err?.message || 'Falha ao renderizar template institucional.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingPreview(false)
    }
  }

  const variableButtons = [
    { key: 'numero', label: '{{numero}}', desc: 'Número do Chamado (ex: 1042)' },
    { key: 'assunto', label: '{{assunto}}', desc: 'Título/Assunto do e-mail' },
    { key: 'solicitante', label: '{{solicitante}}', desc: 'Nome do remetente' },
    { key: 'empresa', label: '{{empresa}}', desc: 'Empresa / Cliente vinculado' },
    { key: 'data', label: '{{data}}', desc: 'Data e Hora da abertura' },
    {
      key: 'prioridade',
      label: '{{prioridade}}',
      desc: 'Prioridade do chamado criado (ex: Alta, Média)',
    },
    {
      key: 'atividade',
      label: '{{atividade}}',
      desc: 'Atividade ou tipo do chamado (Catálogo de Serviços)',
    },
    {
      key: 'prazo',
      label: '{{prazo}}',
      desc: 'Prazo previsto de atendimento (SLA) formatado em pt-BR',
    },
    {
      key: 'operador',
      label: '{{operador}}',
      desc: 'Operador responsável atribuído (ou "Ainda sem atribuição")',
    },
    { key: 'status', label: '{{status}}', desc: 'Status atual do chamado (ex: Novo)' },
  ]

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        <p className="text-xs">Carregando configurações de respostas automáticas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner Informativo Superior */}
      <div className="rounded-xl p-4 border bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 text-xs space-y-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
          <Bot className="h-4 w-4" />
          <span>Respostas Automáticas de E-mail aos Clientes</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          Configure as mensagens automáticas enviadas imediatamente quando novos chamados são
          criados a partir de e-mails recebidos (via IMAP ou Microsoft Graph API). As respostas
          utilizam o{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">
            template institucional oficial
          </strong>{' '}
          com o logotipo configurado na identidade visual da empresa.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
            <ShieldCheck className="h-3 w-3" /> Anti-Loop Ativo (ignora no-reply, bounces e
            auto-replies)
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
            <CheckCircle2 className="h-3 w-3" /> Disparo Não-Bloqueante (a criação do chamado nunca
            é interrompida)
          </span>
        </div>
      </div>

      {/* Sincronização Unificada com a Central de Alertas */}
      <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100 text-xs">
        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <div className="flex-1 space-y-1">
          <AlertTitle className="font-bold text-xs flex items-center justify-between">
            <span>Template Unificado pela Central de Alertas</span>
            {centralAlert && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => setEditorOpen(true)}
              >
                <Sparkles className="h-3 w-3 text-amber-500" />
                Editar no Editor Visual da Central ({centralAlert.template_layout})
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </AlertTitle>
          <AlertDescription className="text-slate-600 dark:text-slate-300 text-[11.5px] leading-relaxed">
            As respostas automáticas e confirmações de abertura utilizam exclusivamente o template
            configurado na Central de Alertas por E-mail (layout:{' '}
            <strong className="text-slate-900 dark:text-white uppercase font-mono">
              {centralAlert?.template_layout || 'corporate'}
            </strong>
            ). Você pode personalizar fontes, cores, cabeçalho e variáveis em um único lugar
            clicando no botão ao lado ou pela aba &quot;Alertas por E-mail&quot;.
          </AlertDescription>
        </div>
      </Alert>

      {centralAlert && (
        <EmailTemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          setting={centralAlert}
          onSaved={handleSaveCentralAlert}
        />
      )}

      {/* Navegação entre Sub-abas */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as any)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 dark:bg-[#17181C] border border-slate-200 dark:border-slate-800 p-1">
          <TabsTrigger
            value="receipt"
            className="text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white font-medium"
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            1. Resposta de Recebimento
          </TabsTrigger>
          <TabsTrigger
            value="out_of_office"
            className="text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white font-medium"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            2. Resposta de Ausência
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------------------------- */}
        {/* SUB-ABA 1: RESPOSTA AUTOMÁTICA DE RECEBIMENTO */}
        {/* --------------------------------------------------------------------- */}
        <TabsContent value="receipt" className="space-y-5 pt-3">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-[#17181C]">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Confirmação Imediata de Recebimento
                    </CardTitle>
                    <Badge
                      variant={settings.receipt_enabled ? 'default' : 'secondary'}
                      className={
                        settings.receipt_enabled
                          ? 'bg-amber-600 text-white text-[10px]'
                          : 'text-slate-500 text-[10px]'
                      }
                    >
                      {settings.receipt_enabled ? 'Ativada' : 'Desativada'}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Disparada automaticamente ao remetente informando o número do chamado
                    recém-criado.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="toggle-receipt"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {settings.receipt_enabled ? 'Resposta Habilitada' : 'Resposta Desabilitada'}
                  </Label>
                  <Switch
                    id="toggle-receipt"
                    checked={settings.receipt_enabled}
                    onCheckedChange={(c) =>
                      setSettings((prev) => ({ ...prev, receipt_enabled: c }))
                    }
                    disabled={!isGestor}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* Barra de Variáveis Rápidas */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Variáveis Disponíveis (clique para inserir no corpo)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-slate-500 hover:text-amber-600"
                    onClick={() => handleResetDefaults('receipt')}
                    disabled={!isGestor}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar Padrão
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variableButtons.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:text-amber-600"
                      onClick={() => insertVariable(v.key, 'body', 'receipt')}
                      disabled={!isGestor}
                      title={v.desc}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Assunto */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Assunto do E-mail
                  </Label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 mr-1">Inserir no assunto:</span>
                    <button
                      type="button"
                      className="text-[10px] font-mono text-amber-600 hover:underline"
                      onClick={() => insertVariable('numero', 'subject', 'receipt')}
                    >
                      &#123;&#123;numero&#125;&#125;
                    </button>
                    <span className="text-slate-400 text-[10px]">•</span>
                    <button
                      type="button"
                      className="text-[10px] font-mono text-amber-600 hover:underline"
                      onClick={() => insertVariable('assunto', 'subject', 'receipt')}
                    >
                      &#123;&#123;assunto&#125;&#125;
                    </button>
                  </div>
                </div>
                <Input
                  value={settings.receipt_subject}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, receipt_subject: e.target.value }))
                  }
                  placeholder="Recebemos sua solicitação - Chamado #{{numero}}: {{assunto}}"
                  className="font-medium text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  disabled={!isGestor}
                />
              </div>

              {/* Corpo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Corpo da Mensagem (Texto e Variáveis)
                </Label>
                <Textarea
                  value={settings.receipt_body}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, receipt_body: e.target.value }))
                  }
                  rows={10}
                  className="font-mono text-xs leading-relaxed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  placeholder="Digite a mensagem de confirmação de recebimento..."
                  disabled={!isGestor}
                />
                <p className="text-[11px] text-slate-500">
                  Dica: Use marcadores &quot;• &quot; para criar listas automáticas com estilo
                  institucional no e-mail.
                </p>
              </div>

              {/* Ações da Sub-aba */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleOpenPreview('receipt')}
                  disabled={generatingPreview}
                >
                  {generatingPreview ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Pré-visualizar E-mail Institucional
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleSave}
                  disabled={saving || !isGestor}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------------------------- */}
        {/* SUB-ABA 2: RESPOSTA AUTOMÁTICA DE AUSÊNCIA (FORA DO EXPEDIENTE / FERIADO) */}
        {/* --------------------------------------------------------------------- */}
        <TabsContent value="out_of_office" className="space-y-5 pt-3">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-[#17181C]">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Resposta de Ausência (Fora do Expediente / Plantão)
                    </CardTitle>
                    <Badge
                      variant={settings.out_of_office_enabled ? 'default' : 'secondary'}
                      className={
                        settings.out_of_office_enabled
                          ? 'bg-amber-600 text-white text-[10px]'
                          : 'text-slate-500 text-[10px]'
                      }
                    >
                      {settings.out_of_office_enabled ? 'Ativa no Momento' : 'Inativa'}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Quando ativada, <strong>substitui</strong> a resposta padrão de recebimento por
                    um aviso informando que a equipe está fora do expediente regular.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="toggle-ooo"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {settings.out_of_office_enabled ? 'Ausência Ativada' : 'Ausência Desativada'}
                  </Label>
                  <Switch
                    id="toggle-ooo"
                    checked={settings.out_of_office_enabled}
                    onCheckedChange={(c) =>
                      setSettings((prev) => ({ ...prev, out_of_office_enabled: c }))
                    }
                    disabled={!isGestor}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* Alerta de Precedência */}
              {settings.out_of_office_enabled && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Modo Ausência em Operação:</strong> Todos os e-mails recebidos criarão
                    chamados normalmente e receberão esta mensagem específica de fora do expediente.
                  </span>
                </div>
              )}

              {/* Barra de Variáveis Rápidas */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Variáveis Disponíveis
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-slate-500 hover:text-amber-600"
                    onClick={() => handleResetDefaults('out_of_office')}
                    disabled={!isGestor}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar Padrão
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variableButtons.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:text-amber-600"
                      onClick={() => insertVariable(v.key, 'body', 'out_of_office')}
                      disabled={!isGestor}
                      title={v.desc}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Assunto */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Assunto do E-mail de Ausência
                  </Label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 mr-1">Inserir:</span>
                    <button
                      type="button"
                      className="text-[10px] font-mono text-amber-600 hover:underline"
                      onClick={() => insertVariable('numero', 'subject', 'out_of_office')}
                    >
                      &#123;&#123;numero&#125;&#125;
                    </button>
                  </div>
                </div>
                <Input
                  value={settings.out_of_office_subject}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, out_of_office_subject: e.target.value }))
                  }
                  placeholder="Recebemos seu e-mail [Fora do Expediente] - Chamado #{{numero}}"
                  className="font-medium text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  disabled={!isGestor}
                />
              </div>

              {/* Corpo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Corpo da Mensagem de Ausência
                </Label>
                <Textarea
                  value={settings.out_of_office_body}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, out_of_office_body: e.target.value }))
                  }
                  rows={10}
                  className="font-mono text-xs leading-relaxed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  placeholder="Digite a mensagem de ausência..."
                  disabled={!isGestor}
                />
              </div>

              {/* Ações da Sub-aba */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleOpenPreview('out_of_office')}
                  disabled={generatingPreview}
                >
                  {generatingPreview ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Pré-visualizar E-mail de Ausência
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleSave}
                  disabled={saving || !isGestor}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE PRÉ-VISUALIZAÇÃO (PREVIEW) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-[#17181C] border-slate-200 dark:border-slate-800">
          <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Eye className="h-4 w-4 text-amber-600" />
                Pré-visualização da Resposta Automática
              </DialogTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'html' ? 'default' : 'outline'}
                  className={`h-7 text-xs ${previewMode === 'html' ? 'bg-amber-600 text-white' : ''}`}
                  onClick={() => setPreviewMode('html')}
                >
                  Visual HTML (Cliente)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode === 'text' ? 'default' : 'outline'}
                  className={`h-7 text-xs ${previewMode === 'text' ? 'bg-amber-600 text-white' : ''}`}
                  onClick={() => setPreviewMode('text')}
                >
                  Texto Puro
                </Button>
              </div>
            </div>
            {previewData && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p>
                  <strong className="text-slate-700 dark:text-slate-300">Assunto:</strong>{' '}
                  {previewData.subject}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>
                    Destinatário:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {previewData.vars.solicitante}
                    </strong>
                  </span>
                  <span>
                    Empresa:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {previewData.vars.empresa}
                    </strong>
                  </span>
                  <span>
                    Chamado:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      #{previewData.vars.numero}
                    </strong>
                  </span>
                  <span>
                    Prioridade:{' '}
                    <strong className="text-amber-600 font-semibold">
                      {previewData.vars.prioridade}
                    </strong>
                  </span>
                  <span>
                    Status:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {previewData.vars.status}
                    </strong>
                  </span>
                  <span>
                    Operador:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {previewData.vars.operador}
                    </strong>
                  </span>
                  <span className="col-span-2 sm:col-span-2">
                    Atividade:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {previewData.vars.atividade}
                    </strong>
                  </span>
                  <span>
                    Prazo SLA:{' '}
                    <strong className="text-emerald-600 font-semibold">
                      {previewData.vars.prazo}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 bg-slate-100 dark:bg-slate-950">
            {previewData && previewMode === 'html' ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white">
                <iframe
                  title="Preview E-mail"
                  srcDoc={previewData.html}
                  className="w-full h-[480px] border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : previewData ? (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {previewData.text}
                </pre>
              </div>
            ) : null}
          </div>

          <DialogFooter className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Template institucional renderizado com identidade visual e logotipo do sistema.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPreviewOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
