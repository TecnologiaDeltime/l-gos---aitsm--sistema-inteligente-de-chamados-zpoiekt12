import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Bot, Sparkles, Save, CheckCircle2, ShieldCheck, HelpCircle, Tag } from 'lucide-react'
import { aiTicketReplyService, AiTicketSettings, AiTicketMode } from '@/services/ai-ticket-reply'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface AiTicketSettingsTabProps {
  isAdminOrGestor: boolean
}

export function AiTicketSettingsTab({ isAdminOrGestor }: AiTicketSettingsTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<AiTicketSettings>({
    scope: 'global',
    enabled: true,
    mode: 'both',
    auto_reply_internal: true,
    auto_reply_portal: true,
    include_kb: true,
    include_history: true,
    include_asset: true,
    system_instructions: 'Seja cordial, profissional e forneça passos técnicos objetivos e claros.',
    tag_suggestions_enabled: true,
  })

  useEffect(() => {
    aiTicketReplyService
      .getSettings()
      .then((res) => {
        setSettings(res)
      })
      .catch((err) => {
        toast({
          title: 'Erro ao carregar configurações de IA',
          description: getErrorMessage(err),
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!isAdminOrGestor) return
    setSaving(true)
    try {
      const saved = await aiTicketReplyService.saveSettings(settings)
      setSettings(saved)
      toast({
        title: 'Configurações de IA salvas com sucesso!',
        description: 'Os parâmetros foram aplicados ao Agente Nativo de Chamados.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar configurações de IA',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="itsm-card">
        <CardContent className="p-8 text-center text-xs text-muted-foreground">
          Carregando configurações da Inteligência Artificial...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="itsm-card border-border/80">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  Agente Nativo de IA para Chamados
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-primary border-amber-500/30 text-[10px] font-mono"
                  >
                    ticket-responder-agent
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure o modo de atuação da IA para sugerir respostas ao operador e responder
                  chamados automaticamente.
                </CardDescription>
              </div>
            </div>

            <Badge
              variant={settings.enabled ? 'default' : 'secondary'}
              className={
                settings.enabled
                  ? 'bg-amber-500/20 text-primary border-amber-500/40 font-mono text-[11px]'
                  : 'text-muted-foreground font-mono text-[11px]'
              }
            >
              {settings.enabled ? 'IA Ativa' : 'IA Desativada'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Chave Geral On/Off */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/60">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Habilitar IA para Atendimento de Chamados
              </Label>
              <p className="text-xs text-muted-foreground max-w-xl">
                Controla o funcionamento global do agente de IA nos chamados internos e no Portal do
                Cliente.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(c) => setSettings({ ...settings, enabled: c })}
              disabled={!isAdminOrGestor || saving}
            />
          </div>

          {/* Modo de Atuação */}
          <div className="space-y-2.5 pt-2">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Modo de Atuação da IA
            </Label>
            <p className="text-xs text-muted-foreground">
              Escolha se a IA deve apenas sugerir rascunhos para o operador revisar, responder
              automaticamente os novos chamados, ou atuar em ambos os modos.
            </p>

            <Select
              value={settings.mode}
              onValueChange={(val: AiTicketMode) => setSettings({ ...settings, mode: val })}
              disabled={!isAdminOrGestor || saving || !settings.enabled}
            >
              <SelectTrigger className="w-full sm:w-80 text-xs h-9 bg-card">
                <SelectValue placeholder="Selecione o modo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggestion" className="text-xs">
                  Modo Sugestão (apenas rascunho para revisão do operador)
                </SelectItem>
                <SelectItem value="automatic" className="text-xs">
                  Modo Automático (IA responde sozinha aos novos chamados)
                </SelectItem>
                <SelectItem value="both" className="text-xs">
                  Ambos os Modos (Sugestão ao operador + Resposta automática)
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-1">
              {settings.mode === 'suggestion' && (
                <p>
                  ✍️ <strong>Sugestão ao Operador:</strong> O operador visualiza o botão "Gerar
                  Resposta com IA" no chamado interno, revisa, edita e envia como interação oficial.
                </p>
              )}
              {settings.mode === 'automatic' && (
                <p>
                  ⚡ <strong>Resposta Automática:</strong> Novos chamados recebem uma interação
                  pública gerada pelo agente de IA. Nenhuma franquia de horas é debitada do cliente
                  (origem Automático).
                </p>
              )}
              {settings.mode === 'both' && (
                <p>
                  🚀 <strong>Ambos os Modos Ativos:</strong> Novos chamados recebem acolhimento
                  inicial automático da IA, e o operador pode solicitar rascunhos inteligentes a
                  qualquer momento nas interações seguintes.
                </p>
              )}
            </div>
          </div>

          {/* Canais de Resposta Automática */}
          {(settings.mode === 'automatic' || settings.mode === 'both') && (
            <div className="space-y-3 pt-3 border-t border-border/60">
              <Label className="text-sm font-semibold text-foreground">
                Canais com Resposta Automática Ativa
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground block">
                      Sistema Interno
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Chamados manuais ou de e-mail interno
                    </span>
                  </div>
                  <Switch
                    checked={settings.auto_reply_internal}
                    onCheckedChange={(c) => setSettings({ ...settings, auto_reply_internal: c })}
                    disabled={!isAdminOrGestor || saving || !settings.enabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground block">
                      Portal do Cliente
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Chamados abertos diretamente pelo cliente
                    </span>
                  </div>
                  <Switch
                    checked={settings.auto_reply_portal}
                    onCheckedChange={(c) => setSettings({ ...settings, auto_reply_portal: c })}
                    disabled={!isAdminOrGestor || saving || !settings.enabled}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fontes de Contexto para a IA */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <Label className="text-sm font-semibold text-foreground">
              Fontes de Contexto Utilizadas pelo Agente
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <span className="text-xs text-foreground font-medium">Base de Conhecimento</span>
                <Switch
                  checked={settings.include_kb}
                  onCheckedChange={(c) => setSettings({ ...settings, include_kb: c })}
                  disabled={!isAdminOrGestor || saving || !settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <span className="text-xs text-foreground font-medium">Histórico de Interações</span>
                <Switch
                  checked={settings.include_history}
                  onCheckedChange={(c) => setSettings({ ...settings, include_history: c })}
                  disabled={!isAdminOrGestor || saving || !settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <span className="text-xs text-foreground font-medium">Ativo / CI Vinculado</span>
                <Switch
                  checked={settings.include_asset}
                  onCheckedChange={(c) => setSettings({ ...settings, include_asset: c })}
                  disabled={!isAdminOrGestor || saving || !settings.enabled}
                />
              </div>
            </div>
          </div>

          {/* Instruções do Sistema */}
          <div className="space-y-2 pt-3 border-t border-border/60">
            <Label className="text-sm font-semibold text-foreground">
              Diretrizes de Tom e Regras Adicionais da Organização
            </Label>
            <p className="text-xs text-muted-foreground">
              Instruções que guiam o agente ao redigir as respostas (saudação, cordialidade, formato
              dos passos).
            </p>
            <Textarea
              rows={4}
              value={settings.system_instructions || ''}
              onChange={(e) => setSettings({ ...settings, system_instructions: e.target.value })}
              disabled={!isAdminOrGestor || saving || !settings.enabled}
              className="text-xs bg-card border-border font-sans"
              placeholder="Ex: Seja cordial, chame o solicitante pelo primeiro nome, forneça passos numerados objetivos..."
            />
          </div>

          {/* Sugestão de Tags por IA */}
          <div className="space-y-3 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card/60">
              <div className="space-y-1 pr-4">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2 cursor-pointer">
                  <Tag className="h-4 w-4 text-primary" />
                  Sugestão de Tags por IA para Chamados
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-primary border-amber-500/30 text-[10px] font-mono"
                  >
                    Operador Interno
                  </Badge>
                </Label>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Permite que a IA analise título, descrição e contexto do chamado para sugerir tags
                  relevantes ao operador na tela do chamado interno.
                </p>
              </div>
              <Switch
                checked={settings.tag_suggestions_enabled ?? true}
                onCheckedChange={(c) => setSettings({ ...settings, tag_suggestions_enabled: c })}
                disabled={!isAdminOrGestor || saving || !settings.enabled}
              />
            </div>
          </div>

          {/* Regra de Horas e Franquia */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-primary font-mono uppercase text-[11px]">
              <ShieldCheck className="h-4 w-4" />
              Regra de Horas e Franquia (0108 / 0109)
            </div>
            <p className="text-muted-foreground leading-relaxed">
              As interações criadas automaticamente pela IA são registradas com origem{' '}
              <strong>Automático</strong>, tempo zero e status <strong>Não Faturável</strong>. Elas{' '}
              <strong>NÃO debitam a franquia de horas do cliente</strong>, permanecendo plenamente
              coerentes com a política vigente.
            </p>
          </div>

          {isAdminOrGestor && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9"
              >
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Configurações de IA'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
