import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Bot, RefreshCw, CheckCircle2, ShieldAlert, Users, Clock, Zap } from 'lucide-react'

interface AutoAssignTabProps {
  canConfigure: boolean
  canEdit: boolean
}

export function AutoAssignSettingsTab({ canConfigure, canEdit }: AutoAssignTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [runningManual, setRunningManual] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)

  const [enabled, setEnabled] = useState(true)
  const [intervalMinutes, setIntervalMinutes] = useState(5)
  const [rule, setRule] = useState('Cascata Inteligente')

  const isReadOnly = !canConfigure && !canEdit

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const records = await pb.collection('system_settings').getList<any>(1, 1, {
        filter: 'key = "global"',
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        setRecordId(item.id)
        setEnabled(item.auto_assign_enabled ?? true)
        setIntervalMinutes(item.auto_assign_interval_minutes || 5)
        setRule(item.auto_assign_rule || 'Cascata Inteligente')
      }
    } catch (err: any) {
      console.error('Erro ao carregar configurações de auto assign:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isReadOnly) return
    setSaving(true)
    try {
      const payload = {
        key: 'global',
        auto_assign_enabled: enabled,
        auto_assign_interval_minutes: Math.max(1, Math.min(1440, Number(intervalMinutes) || 5)),
        auto_assign_rule: rule,
      }

      if (recordId) {
        await pb.collection('system_settings').update(recordId, payload)
      } else {
        const created = await pb.collection('system_settings').create(payload)
        setRecordId(created.id)
      }

      toast({
        title: 'Configurações salvas',
        description: 'Parâmetros do Agente de Distribuição Automática atualizados com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar configurações do agente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRunImmediate = async () => {
    setRunningManual(true)
    try {
      const res = await pb.send<{ assigned_count?: number; total_evaluated?: number }>(
        '/backend/v1/tickets/auto-assign/run',
        {
          method: 'POST',
        },
      )
      toast({
        title: 'Distribuição executada!',
        description: `${res?.assigned_count ?? 0} chamado(s) atribuído(s) de ${res?.total_evaluated ?? 0} avaliado(s).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao executar distribuição',
        description: err.message || 'Falha na rotina manual de distribuição.',
        variant: 'destructive',
      })
    } finally {
      setRunningManual(false)
    }
  }

  if (loading) {
    return (
      <Card className="itsm-card">
        <CardContent className="p-8 text-center text-slate-500">
          Carregando parâmetros do agente de distribuição...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Agente de Distribuição Automática de Chamados
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Atribui chamados sem operador considerando disponibilidade em tempo real, menor
                  volume ativo, ociosidade e líder da equipe.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRunImmediate}
              disabled={runningManual}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${runningManual ? 'animate-spin' : ''}`} />
              Executar Agora
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Ativar Distribuição Automática
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aplica a distribuição em novos chamados e na rotina agendada (cron)
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isReadOnly} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="interval" className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Intervalo de Reavaliação Periódica (minutos)
              </Label>
              <Input
                id="interval"
                type="number"
                min={1}
                max={1440}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                disabled={isReadOnly || !enabled}
                className="itsm-input"
              />
              <p className="text-xs text-slate-500">
                Frequência em minutos para varredura e atribuição de chamados sem operador.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule" className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Regra Primária de Distribuição
              </Label>
              <Select value={rule} onValueChange={setRule} disabled={isReadOnly || !enabled}>
                <SelectTrigger id="rule" className="itsm-input">
                  <SelectValue placeholder="Selecione a regra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cascata Inteligente">
                    Cascata Inteligente (Disponível → Menor Volume → Ociosidade → Líder)
                  </SelectItem>
                  <SelectItem value="Disponibilidade">Apenas Operadores Disponíveis</SelectItem>
                  <SelectItem value="Menor Carga">Menor Carga de Chamados Ativos</SelectItem>
                  <SelectItem value="Líder da Equipe">Fallback Direto no Líder da Fila</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Prioriza quem tem status "Disponível" e menor quantidade de chamados em aberto.
              </p>
            </div>
          </div>

          {/* Card explicativo das prioridades */}
          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Critérios de Desempate e Cascata
            </h4>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-5">
              <li>
                <strong>1º Nível — Fila & Disponibilidade:</strong> Somente operadores pertencentes
                à equipe/fila do chamado que estejam com status <em>"Disponível"</em>.
              </li>
              <li>
                <strong>2º Nível — Menor Carga Ativa:</strong> Dentre os disponíveis, seleciona o
                operador com a menor quantidade de chamados ativos (diferente de Encerrado,
                Cancelado ou Resolvido).
              </li>
              <li>
                <strong>3º Nível — Ociosidade:</strong> Em caso de empate de chamados ativos,
                escolhe o operador ocioso há mais tempo.
              </li>
              <li>
                <strong>4º Nível — Fallback no Líder:</strong> Caso não haja membros disponíveis ou
                a fila não tenha operadores ativos, o chamado é encaminhado para o Líder/Responsável
                da Fila.
              </li>
            </ul>
          </div>

          {!isReadOnly && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Salvar Configurações
              </Button>
            </div>
          )}

          {isReadOnly && (
            <div className="flex items-center gap-2 p-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              Seu perfil possui permissão apenas de visualização para esta configuração.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
