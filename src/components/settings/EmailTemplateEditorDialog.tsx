import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  EmailAlertSetting,
  EmailTemplateLayout,
  updateEmailAlertSetting,
  EMAIL_ALERT_SAMPLE_DATA,
} from '@/services/email-alert-settings'
import { EmailLivePreview } from '@/components/settings/EmailLivePreview'
import {
  LayoutTemplate,
  Palette,
  Eye,
  Code2,
  Save,
  RotateCcw,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
} from 'lucide-react'

interface EmailTemplateEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setting: EmailAlertSetting | null
  onSaved: (updated: EmailAlertSetting) => void
  canEdit?: boolean
}

const PRESET_COLORS = [
  { name: 'Âmbar Oficial Lógos', hex: '#D97706' },
  { name: 'Azul Corporativo', hex: '#2563EB' },
  { name: 'Verde Sucesso', hex: '#16A34A' },
  { name: 'Vermelho Crítico / SLA', hex: '#DC2626' },
  { name: 'Roxo Estratégico', hex: '#7C3AED' },
  { name: 'Grafite Escuro', hex: '#1E293B' },
]

export function EmailTemplateEditorDialog({
  open,
  onOpenChange,
  setting,
  onSaved,
  canEdit = true,
}: EmailTemplateEditorDialogProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<EmailAlertSetting | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')

  useEffect(() => {
    if (setting) {
      setDraft({ ...setting })
      setActiveTab('editor')
    } else {
      setDraft(null)
    }
  }, [setting])

  const parsedVariables = useMemo(() => {
    if (!draft) return []
    if (Array.isArray(draft.variables_hint)) {
      return draft.variables_hint
    }
    if (typeof draft.variables_hint === 'string') {
      try {
        return JSON.parse(draft.variables_hint)
      } catch {
        /* intentionally ignored */
      }
    }
    // Fallback das chaves de sample data
    const sample = EMAIL_ALERT_SAMPLE_DATA[draft.alert_key] || {}
    return Object.keys(sample).map((k) => ({
      key: k,
      desc: k.replace(/_/g, ' '),
    }))
  }, [draft])

  if (!draft) return null

  const handleFieldChange = <K extends keyof EmailAlertSetting>(
    field: K,
    value: EmailAlertSetting[K],
  ) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleInsertVariable = (varKey: string) => {
    const token = `{{${varKey}}}`
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        body_template: (prev.body_template || '') + ' ' + token,
      }
    })
    toast({
      title: 'Variável inserida',
      description: `Tag ${token} adicionada ao corpo do e-mail.`,
    })
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const updated = await updateEmailAlertSetting(draft.id, {
        template_layout: draft.template_layout,
        primary_color: draft.primary_color,
        subject_template: draft.subject_template,
        header_title: draft.header_title,
        header_subtitle: draft.header_subtitle,
        body_template: draft.body_template,
        footer_text: draft.footer_text,
        show_button: draft.show_button,
        button_label: draft.button_label,
        button_url_template: draft.button_url_template,
      })
      toast({
        title: 'Template salvo com sucesso',
        description: `Visual do alerta "${draft.name}" atualizado.`,
      })
      onSaved(updated)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar template',
        description: err?.message || 'Ocorreu uma falha ao persistir as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-amber-500" />
                  Editor de Template Visual
                </DialogTitle>
                <Badge variant="outline" className="text-xs font-mono uppercase bg-background">
                  {draft.alert_key}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {draft.name} — Personalize o design institucional com a marca Lógos AITSM e veja a
                prévia ao vivo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-auto"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="editor" className="text-xs h-7 gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    Campos & Estilo
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs h-7 gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Pré-visualização
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'preview' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Exibindo preview com dados simulados e o layout{' '}
                  <strong className="text-foreground capitalize">{draft.template_layout}</strong>.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setActiveTab('editor')}
                >
                  Voltar ao Editor
                </Button>
              </div>
              <EmailLivePreview setting={draft} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna da esquerda: Formulário de Design e Textos */}
              <div className="lg:col-span-7 space-y-5">
                {/* Seleção de Layout */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5 text-amber-500" />
                    Estilo Visual do E-mail
                  </Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      {
                        id: 'modern' as EmailTemplateLayout,
                        title: 'Moderno',
                        desc: 'Cabeçalho escuro com gradiente e badge oficial Lógos',
                      },
                      {
                        id: 'corporate' as EmailTemplateLayout,
                        title: 'Corporativo',
                        desc: 'Borda superior marcante, tipografia sóbria e rodapé executivo',
                      },
                      {
                        id: 'minimal' as EmailTemplateLayout,
                        title: 'Minimalista',
                        desc: 'Fundo claro, linhas sutis e foco na leitura rápida',
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleFieldChange('template_layout', item.id)}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          draft.template_layout === item.id
                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 shadow-xs'
                            : 'border-border/80 hover:bg-muted/50 bg-card'
                        }`}
                      >
                        <div className="text-xs font-bold text-foreground">{item.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                          {item.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor Primária */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-amber-500" />
                      Cor de Destaque / Botão
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {draft.primary_color}
                    </span>
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => handleFieldChange('primary_color', c.hex)}
                        title={c.name}
                        className={`h-7 px-2.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${
                          draft.primary_color === c.hex
                            ? 'border-foreground shadow-xs font-bold'
                            : 'border-border opacity-85 hover:opacity-100'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-inner"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-[11px]">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assunto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Linha de Assunto</Label>
                  <Input
                    value={draft.subject_template || ''}
                    onChange={(e) => handleFieldChange('subject_template', e.target.value)}
                    placeholder="Ex: Chamado #{{chamado_numero}} registrado com sucesso"
                    className="text-xs h-9"
                    disabled={!canEdit}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Suporta variáveis como {'{{chamado_numero}}'} e {'{{titulo}}'}.
                  </p>
                </div>

                {/* Cabeçalho: Título e Subtítulo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Título do Cabeçalho</Label>
                    <Input
                      value={draft.header_title || ''}
                      onChange={(e) => handleFieldChange('header_title', e.target.value)}
                      placeholder="Lógos AITSM"
                      className="text-xs h-9"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Subtítulo Institucional</Label>
                    <Input
                      value={draft.header_subtitle || ''}
                      onChange={(e) => handleFieldChange('header_subtitle', e.target.value)}
                      placeholder="Atendimento & Central de Serviços"
                      className="text-xs h-9"
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                {/* Corpo do E-mail */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Corpo da Mensagem (HTML / Texto)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Tags HTML básicas permitidas (&lt;p&gt;, &lt;strong&gt;, &lt;div&gt;)
                    </span>
                  </div>
                  <Textarea
                    value={draft.body_template || ''}
                    onChange={(e) => handleFieldChange('body_template', e.target.value)}
                    rows={6}
                    placeholder="<p>Olá <strong>{{cliente}}</strong>,</p><p>Seu chamado foi registrado...</p>"
                    className="font-mono text-xs leading-relaxed"
                    disabled={!canEdit}
                  />
                </div>

                {/* Variáveis Disponíveis */}
                {parsedVariables.length > 0 && (
                  <div className="p-3 bg-muted/40 rounded-lg border border-border/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                        Variáveis Dinâmicas Disponíveis
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Clique para inserir no corpo
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedVariables.map((v: any) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => handleInsertVariable(v.key)}
                          disabled={!canEdit}
                          className="px-2 py-1 bg-background hover:bg-amber-500/10 hover:border-amber-500 border border-border rounded text-[11px] font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
                          title={v.desc}
                        >
                          <span className="text-amber-500 font-bold">+</span>
                          <span>{`{{${v.key}}}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão de Ação (CTA) */}
                <div className="p-3.5 bg-muted/30 rounded-lg border border-border/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <LinkIcon className="h-3.5 w-3.5 text-amber-500" />
                        Incluir Botão de Ação no E-mail
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Adiciona um botão estilizado direcionando para o portal ou chamado.
                      </p>
                    </div>
                    <Switch
                      checked={draft.show_button}
                      onCheckedChange={(c) => handleFieldChange('show_button', c)}
                      disabled={!canEdit}
                    />
                  </div>

                  {draft.show_button && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Texto do Botão</Label>
                        <Input
                          value={draft.button_label || ''}
                          onChange={(e) => handleFieldChange('button_label', e.target.value)}
                          placeholder="Acompanhar no Portal"
                          className="text-xs h-8"
                          disabled={!canEdit}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Destino da URL</Label>
                        <Input
                          value={draft.button_url_template || ''}
                          onChange={(e) => handleFieldChange('button_url_template', e.target.value)}
                          placeholder="{{link}}"
                          className="text-xs h-8 font-mono"
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Texto do Rodapé</Label>
                  <Input
                    value={draft.footer_text || ''}
                    onChange={(e) => handleFieldChange('footer_text', e.target.value)}
                    placeholder="Lógos AITSM • Central de Serviços Inteligente"
                    className="text-xs h-9"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {/* Coluna da direita: Mini Preview Rápido */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="h-3.5 w-3.5 text-amber-500" />
                    Pré-visualização Instantânea
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] text-amber-500 hover:text-amber-600 px-2"
                    onClick={() => setActiveTab('preview')}
                  >
                    Ver em Tela Cheia
                  </Button>
                </div>
                <div className="max-h-[620px] overflow-y-auto rounded-lg border bg-muted/20 p-2">
                  <EmailLivePreview setting={draft} />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (setting) setDraft({ ...setting })
              }}
              disabled={saving}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Original
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !canEdit}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
