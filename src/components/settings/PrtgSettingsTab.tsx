import { useState, useEffect } from 'react'
import {
  Activity,
  CheckCircle2,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  AlertTriangle,
  Info,
  Server,
  KeyRound,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  prtgMonitoringService,
  PrtgSettings,
  PrtgMappingRule,
  PrtgSimulationResult,
} from '@/services/prtg-monitoring'

interface SimpleItem {
  id: string
  name: string
}

interface AutoAssignSettingsTabProps {
  canConfigure?: boolean
}

export function PrtgSettingsTab({ canConfigure = true }: AutoAssignSettingsTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [settings, setSettings] = useState<PrtgSettings>({
    prtg_enabled: false,
    prtg_webhook_token: 'prtg_live_token_aitilsm',
    prtg_default_priority: 'Média',
    prtg_default_queue: '',
    prtg_default_activity: '',
    prtg_default_company: '',
    prtg_dedup_hours: 4,
    prtg_auto_resolve_on_up: true,
    prtg_mapping_rules: [],
  })

  // Listas para seleção
  const [queues, setQueues] = useState<SimpleItem[]>([])
  const [activities, setActivities] = useState<SimpleItem[]>([])
  const [companies, setCompanies] = useState<SimpleItem[]>([])

  // Estado para regra nova
  const [newRuleMatch, setNewRuleMatch] = useState('')
  const [newRuleCompany, setNewRuleCompany] = useState('')
  const [newRuleQueue, setNewRuleQueue] = useState('')
  const [newRuleActivity, setNewRuleActivity] = useState('')

  // Estado de simulação/teste
  const [testDevice, setTestDevice] = useState('SRV-DC01.corp.local')
  const [testSensor, setTestSensor] = useState('Ping / ICMP Gateway')
  const [testStatus, setTestStatus] = useState<'down' | 'up'>('down')
  const [testMessage, setTestMessage] = useState('Request timed out (100% packet loss)')
  const [testResult, setTestResult] = useState<PrtgSimulationResult | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [st, qList, aList, cList] = await Promise.all([
        prtgMonitoringService.getSettings(),
        pb.collection('queues').getFullList<SimpleItem>({ sort: 'name', requestKey: null }),
        pb.collection('tkt_categories').getFullList<SimpleItem>({ sort: 'name', requestKey: null }),
        pb.collection('companies').getFullList<any>({ sort: 'trade_name', requestKey: null }),
      ])

      const mappedCompanies: SimpleItem[] = (cList || []).map((c: any) => ({
        id: c.id,
        name: c.trade_name || c.legal_name || c.name || 'Empresa',
      }))

      setSettings(st)
      setQueues(qList)
      setActivities(aList)
      setCompanies(mappedCompanies)
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: e.message || 'Falha ao buscar dados do PRTG.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!canConfigure) return
    try {
      setSaving(true)
      const updated = await prtgMonitoringService.saveSettings(settings)
      setSettings(updated)
      toast({
        title: 'Configurações salvas com sucesso',
        description: 'Os parâmetros da integração PRTG foram atualizados no sistema.',
      })
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const generateRandomToken = () => {
    if (!canConfigure) return
    const rand =
      Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
    setSettings((prev) => ({ ...prev, prtg_webhook_token: `prtg_${rand}` }))
  }

  const backendBase = (import.meta.env.VITE_POCKETBASE_URL || window.location.origin).replace(
    /\/$/,
    '',
  )
  const webhookUrl = `${backendBase}/backend/v1/webhooks/prtg?token=${encodeURIComponent(
    settings.prtg_webhook_token || '',
  )}`

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast({
      title: 'URL copiada!',
      description: 'A URL do Webhook com o token foi copiada para a área de transferência.',
    })
  }

  const handleAddRule = () => {
    if (!newRuleMatch.trim()) {
      toast({
        title: 'Texto de correspondência obrigatório',
        description: 'Digite um termo contido no sensor/dispositivo (ex: "FILIAL-SP").',
        variant: 'destructive',
      })
      return
    }

    const newRule: PrtgMappingRule = {
      id: Math.random().toString(36).substring(2, 9),
      matchText: newRuleMatch.trim(),
      companyId: newRuleCompany,
      queueId: newRuleQueue,
      activityId: newRuleActivity,
    }

    setSettings((prev) => ({
      ...prev,
      prtg_mapping_rules: [...prev.prtg_mapping_rules, newRule],
    }))

    setNewRuleMatch('')
    setNewRuleCompany('')
    setNewRuleQueue('')
    setNewRuleActivity('')
  }

  const handleRemoveRule = (ruleId: string) => {
    if (!canConfigure) return
    setSettings((prev) => ({
      ...prev,
      prtg_mapping_rules: prev.prtg_mapping_rules.filter((r) => r.id !== ruleId),
    }))
  }

  const handleRunTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      const res = await prtgMonitoringService.simulateWebhookAlert({
        token: settings.prtg_webhook_token,
        device: testDevice,
        sensor: testSensor,
        status: testStatus,
        message: testStatus === 'up' ? 'Sensor normalizado' : testMessage,
        priority: '3',
      })
      setTestResult(res)
      if (res.ok) {
        toast({
          title: 'Simulação executada com sucesso',
          description: `Ação realizada: ${res.action} (${res.message || 'OK'})`,
        })
      } else {
        toast({
          title: 'Aviso na simulação',
          description: res.error || res.message || 'O webhook não concluiu a ação.',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({
        title: 'Erro ao disparar simulação',
        description: e.message || 'Falha de comunicação com o endpoint de webhook.',
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Carregando parâmetros de monitoramento do PRTG...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header e Status Principal */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-xl">Integração com Monitoramento PRTG</CardTitle>
              {settings.prtg_enabled ? (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary">Inativo</Badge>
              )}
            </div>
            <CardDescription>
              Abertura automática de chamados, deduplicação inteligente e auto-resolução a partir
              dos alertas disparados pelo PRTG Network Monitor.
            </CardDescription>
          </div>
          {canConfigure && (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="space-y-0.5">
              <div className="text-base font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Habilitar Abertura Automática por Alertas do PRTG
              </div>
              <p className="text-sm text-muted-foreground">
                Quando ativado, os alertas recebidos no Webhook abrem chamados automaticamente ou
                adicionam interações.
              </p>
            </div>
            <Switch
              disabled={!canConfigure}
              checked={settings.prtg_enabled}
              onCheckedChange={(val) => setSettings((prev) => ({ ...prev, prtg_enabled: val }))}
            />
          </div>

          {/* URL e Token do Webhook */}
          <div className="space-y-3 p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                URL do Webhook (Cole na Ação de Notificação HTTP do PRTG)
              </Label>
              {canConfigure && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateRandomToken}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Gerar novo token
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="font-mono text-xs bg-muted/50 cursor-pointer"
                onClick={handleCopyWebhookUrl}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyWebhookUrl}
                className="gap-1.5 shrink-0"
              >
                <Copy className="w-4 h-4" />
                Copiar URL
              </Button>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              No PRTG, crie uma notificação do tipo <strong>HTTP Action</strong> configurando método
              POST ou GET para esta URL.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Regras Padrão de Chamado e Anti-Duplicidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Destino e Parâmetros Padrão do Chamado
            </CardTitle>
            <CardDescription>
              Fila, atividade e prioridade atribuídas aos chamados automáticos gerados pelo PRTG.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Fila de Atendimento Padrão</Label>
              <Select
                disabled={!canConfigure}
                value={settings.prtg_default_queue || 'none'}
                onValueChange={(val) =>
                  setSettings((p) => ({ ...p, prtg_default_queue: val === 'none' ? '' : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fila de destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma fila (Triagem geral)</SelectItem>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Atividade / Classificação Padrão</Label>
              <Select
                disabled={!canConfigure}
                value={settings.prtg_default_activity || 'none'}
                onValueChange={(val) =>
                  setSettings((p) => ({ ...p, prtg_default_activity: val === 'none' ? '' : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a atividade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem atividade pré-definida</SelectItem>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Prioridade do Chamado Automático</Label>
              <Select
                disabled={!canConfigure}
                value={settings.prtg_default_priority}
                onValueChange={(val: any) =>
                  setSettings((p) => ({ ...p, prtg_default_priority: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média (Recomendado)</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Crítica">
                    Crítica (Dispara e-mail de alerta vermelho)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Nota: Se selecionar Alta ou Crítica, certifique-se de que a atividade selecionada
                não requer aprovação prévia obrigatória.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Cliente Padrão (Fallback)</Label>
              <Select
                disabled={!canConfigure}
                value={settings.prtg_default_company || 'none'}
                onValueChange={(val) =>
                  setSettings((p) => ({ ...p, prtg_default_company: val === 'none' ? '' : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente de fallback" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Primeira empresa do sistema</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Anti-Duplicidade & Auto-Resolução
            </CardTitle>
            <CardDescription>
              Controle de alertas repetidos e encerramento automático quando o sensor volta a ficar
              UP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">Janela de Deduplicação de Alertas (em horas)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={72}
                  disabled={!canConfigure}
                  value={settings.prtg_dedup_hours}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      prtg_dedup_hours: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-28"
                />
                <span className="text-xs text-muted-foreground">horas de janela</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alertas repetidos do mesmo sensor dentro deste período não abrem novo chamado; em
                vez disso, registram uma nova interação no chamado em aberto.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Auto-Resolver ao Recuperar (UP)</div>
                <p className="text-xs text-muted-foreground">
                  Quando o PRTG enviar notificação de sensor recuperado, marca o chamado aberto como
                  "Resolvido".
                </p>
              </div>
              <Switch
                disabled={!canConfigure}
                checked={settings.prtg_auto_resolve_on_up}
                onCheckedChange={(val) =>
                  setSettings((p) => ({ ...p, prtg_auto_resolve_on_up: val }))
                }
              />
            </div>

            <div className="p-3 border rounded-lg bg-blue-500/10 border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Atribuição Automática Integrada
              </div>
              <p>
                Os chamados gerados são automaticamente direcionados aos operadores da fila pelo{' '}
                <strong>Agente de Distribuição Automática</strong> e seus membros recebem
                notificação in-app em tempo real.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regras de Mapeamento Sensor/Dispositivo -> Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Regras de Roteamento por Cliente
          </CardTitle>
          <CardDescription>
            Associe alertas a clientes específicos com base em palavras-chave contidas no nome do
            dispositivo, sensor ou grupo do PRTG.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabela de Regras Existentes */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground border-b">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">
                    Texto Contido (Dispositivo/Sensor)
                  </th>
                  <th className="py-2 px-3 text-left font-medium">Cliente Vinculado</th>
                  <th className="py-2 px-3 text-left font-medium">Fila Específica</th>
                  <th className="py-2 px-3 text-left font-medium">Atividade</th>
                  <th className="py-2 px-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {settings.prtg_mapping_rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                      Nenhuma regra configurada. O cliente padrão (fallback) será usado para todos
                      os alertas.
                    </td>
                  </tr>
                ) : (
                  settings.prtg_mapping_rules.map((rule) => {
                    const comp = companies.find((c) => c.id === rule.companyId)
                    const q = queues.find((item) => item.id === rule.queueId)
                    const act = activities.find((item) => item.id === rule.activityId)
                    return (
                      <tr key={rule.id} className="hover:bg-muted/40">
                        <td className="py-2 px-3 font-semibold text-foreground">
                          "{rule.matchText}"
                        </td>
                        <td className="py-2 px-3">{comp ? comp.name : '(Nenhum)'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{q ? q.name : 'Padrão'}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {act ? act.name : 'Padrão'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {canConfigure && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRule(rule.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Adicionar Nova Regra */}
          {canConfigure && (
            <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
              <div className="text-xs font-semibold">Adicionar Nova Regra de Mapeamento:</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <Input
                    placeholder="Texto contido (ex: SP-DC, Matriz)"
                    value={newRuleMatch}
                    onChange={(e) => setNewRuleMatch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Select
                    value={newRuleCompany || 'none'}
                    onValueChange={(val) => setNewRuleCompany(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione o Cliente</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select
                    value={newRuleQueue || 'none'}
                    onValueChange={(val) => setNewRuleQueue(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Fila (opcional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Fila Padrão</SelectItem>
                      {queues.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={newRuleActivity || 'none'}
                    onValueChange={(val) => setNewRuleActivity(val === 'none' ? '' : val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Atividade..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Atividade Padrão</SelectItem>
                      {activities.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddRule}
                    className="h-8 px-3 shrink-0 gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulação e Teste de Alerta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-500" />
            Enviar Alerta de Teste (Simulador PRTG)
          </CardTitle>
          <CardDescription>
            Simule o envio de uma notificação HTTP do PRTG para testar a criação de chamado,
            deduplicação e encerramento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dispositivo (%device)</Label>
              <Input
                value={testDevice}
                onChange={(e) => setTestDevice(e.target.value)}
                className="h-8 text-xs"
                placeholder="Ex: FIREWALL-EDGE-01"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sensor (%sensor)</Label>
              <Input
                value={testSensor}
                onChange={(e) => setTestSensor(e.target.value)}
                className="h-8 text-xs"
                placeholder="Ex: Link Internet Fibra"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Evento</Label>
              <Select value={testStatus} onValueChange={(val: any) => setTestStatus(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="down">
                    Alerta DOWN (Cria chamado ou adiciona interação)
                  </SelectItem>
                  <SelectItem value="up">Recuperação UP (Resolve chamado aberto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mensagem do Sensor (%message)</Label>
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="h-8 text-xs"
              placeholder="Ex: Connection refused / Ping failed"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              O teste executa o webhook real com as configurações salvas atualmente.
            </div>
            <Button
              type="button"
              disabled={testing || !settings.prtg_enabled}
              onClick={handleRunTest}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {testing ? 'Disparando...' : 'Enviar Alerta de Teste'}
            </Button>
          </div>

          {/* Resultado da Simulação */}
          {testResult && (
            <div
              className={`p-4 rounded-lg border text-xs space-y-1 ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="font-semibold flex items-center gap-2">
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Resposta do Webhook: Sucesso ({testResult.action})
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Resposta do Webhook: Atenção / Erro
                  </>
                )}
              </div>
              <p className="text-muted-foreground">{testResult.message || testResult.error}</p>
              {testResult.ticket_number && (
                <div className="font-medium pt-1">
                  Número do Chamado:{' '}
                  <span className="text-foreground font-bold">#{testResult.ticket_number}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
