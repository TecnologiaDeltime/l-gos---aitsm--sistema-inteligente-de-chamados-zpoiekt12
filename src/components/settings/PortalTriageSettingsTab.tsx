import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { getQueues, QueueRecord } from '@/services/queues'
import {
  getPortalTriageSettings,
  savePortalTriageSettings,
  triggerPortalTriage,
  PortalTriageSettings,
} from '@/services/portal-triage'
import {
  Sparkles,
  Bot,
  RefreshCw,
  Save,
  CheckCircle2,
  ShieldCheck,
  Inbox,
  Gauge,
  Sliders,
  HelpCircle,
} from 'lucide-react'

interface PortalTriageSettingsTabProps {
  canConfigure?: boolean
  canEdit?: boolean
}

export function PortalTriageSettingsTab({
  canConfigure = true,
  canEdit = true,
}: PortalTriageSettingsTabProps) {
  const { toast } = useToast()
  const isReadOnly = !canConfigure && !canEdit

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testTicketId, setTestTicketId] = useState('')
  const [testResult, setTestResult] = useState<any>(null)

  const [queues, setQueues] = useState<QueueRecord[]>([])
  const [enabled, setEnabled] = useState(true)
  const [defaultQueue, setDefaultQueue] = useState<string>('none')
  const [minConfidence, setMinConfidence] = useState<number>(0.5)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [settings, qs] = await Promise.all([
        getPortalTriageSettings().catch((err) => {
          console.warn('[PortalTriageSettingsTab] falha ao ler settings:', err)
          return {
            portal_auto_triage_enabled: true,
            portal_triage_default_queue: '',
            portal_triage_min_confidence: 0.5,
          } as PortalTriageSettings
        }),
        getQueues().catch(() => []),
      ])

      setEnabled(Boolean(settings.portal_auto_triage_enabled))
      setDefaultQueue(settings.portal_triage_default_queue || 'none')
      setMinConfidence(
        typeof settings.portal_triage_min_confidence === 'number'
          ? settings.portal_triage_min_confidence
          : 0.5,
      )
      setQueues((qs as QueueRecord[]).filter((q) => q.active !== false))
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: err?.message || 'Falha ao buscar dados de triagem do portal.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isReadOnly) return
    setSaving(true)
    try {
      await savePortalTriageSettings({
        portal_auto_triage_enabled: enabled,
        portal_triage_default_queue: defaultQueue === 'none' ? '' : defaultQueue,
        portal_triage_min_confidence: minConfidence,
      })
      toast({
        title: 'Configurações salvas!',
        description: 'Parâmetros de triagem por IA do Portal do Cliente atualizados com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao gravar configurações de triagem.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRunManualTest = async () => {
    const tid = testTicketId.trim()
    if (!tid) {
      toast({
        title: 'Informe o ID do chamado',
        description: 'Digite o ID do chamado do portal para testar a triagem.',
        variant: 'destructive',
      })
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await triggerPortalTriage(tid)
      setTestResult(res)
      if (res.applied) {
        toast({
          title: 'Triagem executada com sucesso!',
          description: `Chamado classificado como "${res.activity || 'Atividade'}" e encaminhado para "${res.queue || 'Fila'}".`,
        })
      } else {
        toast({
          title: 'Triagem não aplicada',
          description: res.reason || 'O chamado não pôde ser classificado pelo agente.',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao testar triagem',
        description: err?.message || 'Falha ao invocar agente de triagem.',
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Card className="itsm-card">
        <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
          <span className="text-xs">Carregando configurações de triagem do portal...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <Card className="itsm-card border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-card to-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Sparkles className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  Triagem Automática por IA (Portal do Cliente)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground max-w-2xl">
                O cliente abre chamados apenas com título, descrição, prioridade e anexos. O agente
                nativo de IA lê o texto, localiza a atividade correspondente no Catálogo de Serviços
                e distribui automaticamente para a equipe configurada naquela atividade.
              </CardDescription>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || isReadOnly}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 h-8 font-semibold shadow-xs"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Painel Principal de Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ativação & Modo de Operação */}
        <Card className="itsm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Bot className="h-4 w-4 text-amber-500" />
              Ativação do Agente
            </CardTitle>
            <CardDescription className="text-xs">
              Liga ou desliga a triagem automática de novos chamados abertos pelo Portal do Cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5 pr-4">
                <Label className="text-xs font-semibold text-foreground">
                  Triagem Automática Ativa
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Quando desativada, chamados do portal nascem sem atividade/fila (ou vão direto
                  para a fila padrão).
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isReadOnly} />
            </div>

            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Agente Nativo Vinculado
              </div>
              <p className="text-[11px] leading-relaxed">
                Utiliza o agente nativo{' '}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground">
                  portal-ticket-triage-agent
                </code>{' '}
                (Fast Tier, JSON estrito), com ferramentas de leitura direta no Catálogo de
                Atividades e Filas do Lógos AITSM.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Destino e Confiança Mínima */}
        <Card className="itsm-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sliders className="h-4 w-4 text-amber-500" />
              Fila Padrão e Confiança
            </CardTitle>
            <CardDescription className="text-xs">
              Fallback e limiar estatístico para classificar o chamado com segurança.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fila Padrão */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Inbox className="h-3.5 w-3.5 text-amber-500" />
                Fila de Atendimento Padrão (Fallback)
              </Label>
              <Select value={defaultQueue} onValueChange={setDefaultQueue} disabled={isReadOnly}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione a fila padrão..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Nenhuma (permanecer sem fila se a IA não classificar)
                  </SelectItem>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name} {q.level ? `(${q.level})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Usada quando a atividade identificada não tem equipe vinculada no catálogo ou quando
                a confiança da IA fica abaixo do mínimo.
              </p>
            </div>

            {/* Confiança Mínima */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-amber-500" />
                  Confiança Mínima da IA
                </Label>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono">
                  {Math.round(minConfidence * 100)}%
                </span>
              </div>
              <Slider
                value={[minConfidence * 100]}
                min={10}
                max={95}
                step={5}
                onValueChange={(vals) => setMinConfidence((vals[0] || 50) / 100)}
                disabled={isReadOnly}
                className="py-1"
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Padrão recomendado: <strong>50%</strong>. Abaixo deste limiar, a IA não força uma
                atividade incorreta e aciona a Fila Padrão.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teste Manual de Triagem */}
      <Card className="itsm-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-500" />
            Simulação / Teste Manual de Triagem
          </CardTitle>
          <CardDescription className="text-xs">
            Teste a triagem em um chamado existente do portal informando seu ID do PocketBase. A
            resposta mostra a atividade sugerida, a fila de destino e o nível de confiança.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="ID do chamado (ex: 8z9q12k4la3b...)"
              value={testTicketId}
              onChange={(e) => setTestTicketId(e.target.value)}
              className="flex-1 h-9 px-3 rounded-md border text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRunManualTest}
              disabled={testing || !testTicketId.trim()}
              className="text-xs h-9 gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Triando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Executar Triagem
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div className="p-3 rounded-lg border bg-muted/40 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2
                  className={`h-4 w-4 ${testResult.applied ? 'text-emerald-500' : 'text-amber-500'}`}
                />
                <span>
                  {testResult.applied ? 'Triagem aplicada ao chamado!' : 'Resultado da análise:'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-muted-foreground block">Atividade:</span>
                  <span className="font-semibold text-foreground">
                    {testResult.activity || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Fila / Equipe:</span>
                  <span className="font-semibold text-foreground">{testResult.queue || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Confiança:</span>
                  <span className="font-semibold text-foreground">
                    {typeof testResult.confidence === 'number'
                      ? `${Math.round(testResult.confidence * 100)}%`
                      : '—'}
                  </span>
                </div>
              </div>
              {testResult.reason && (
                <p className="text-[11px] text-muted-foreground pt-1 border-t">
                  <strong>Justificativa da IA:</strong> {testResult.reason}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
