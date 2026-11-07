import { useEffect, useState } from 'react'
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
import {
  getProjectDeadlineSettings,
  saveProjectDeadlineSettings,
  type ProjectDeadlineSettings,
} from '@/services/project-deadline-settings'
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'

interface ProjectDeadlinesTabProps {
  canConfigure: boolean
  canEdit: boolean
}

export function ProjectDeadlinesSettingsTab({ canConfigure, canEdit }: ProjectDeadlinesTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<ProjectDeadlineSettings>({
    id: '',
    enabled: true,
    check_interval_minutes: 60,
    advance_days: 3,
    notify_manager: true,
    notify_gestors: true,
    notify_task_assignee: true,
    created: '',
    updated: '',
  })

  const isReadOnly = !canConfigure && !canEdit

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const s = await getProjectDeadlineSettings()
      setSettings(s)
    } catch (err: any) {
      console.error('Erro ao carregar configurações de prazo de projetos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (isReadOnly) return
    setSaving(true)
    try {
      const saved = await saveProjectDeadlineSettings({
        enabled: settings.enabled,
        check_interval_minutes: Math.max(
          5,
          Math.min(1440, Number(settings.check_interval_minutes) || 60),
        ),
        advance_days: Math.max(0, Math.min(365, Number(settings.advance_days) || 0)),
        notify_manager: settings.notify_manager,
        notify_gestors: settings.notify_gestors,
        notify_task_assignee: settings.notify_task_assignee,
      })
      setSettings(saved)
      toast({
        title: 'Configurações salvas',
        description: 'Parâmetros das notificações de prazo de projetos atualizados com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar configurações de prazo de projetos.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const update = (patch: Partial<ProjectDeadlineSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }))

  if (loading) {
    return (
      <Card className="itsm-card">
        <CardContent className="p-8 text-center text-slate-500">
          Carregando parâmetros das notificações de prazo...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Notificações de Prazo de Projetos
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Agente que monitora prazos de projetos e atividades e envia avisos no sino (próximo
                do prazo, vencendo hoje e vencido).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Ativar Notificações de Prazo
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quando desativado, nenhum aviso de prazo de projeto ou atividade é enviado.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => update({ enabled: v })}
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="pd-interval" className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Intervalo de Verificação (minutos)
              </Label>
              <Select
                value={String(settings.check_interval_minutes)}
                onValueChange={(v) => update({ check_interval_minutes: Number(v) })}
                disabled={isReadOnly || !settings.enabled}
              >
                <SelectTrigger id="pd-interval" className="itsm-input">
                  <SelectValue placeholder="Selecione o intervalo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">A cada 15 minutos</SelectItem>
                  <SelectItem value="30">A cada 30 minutos</SelectItem>
                  <SelectItem value="60">A cada 1 hora</SelectItem>
                  <SelectItem value="120">A cada 2 horas</SelectItem>
                  <SelectItem value="240">A cada 4 horas</SelectItem>
                  <SelectItem value="360">A cada 6 horas</SelectItem>
                  <SelectItem value="720">A cada 12 horas</SelectItem>
                  <SelectItem value="1440">1 vez por dia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Frequência com que o agente verifica prazos no backend.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pd-advance" className="text-sm font-medium flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-500" />
                Aviso de antecedência (dias)
              </Label>
              <Input
                id="pd-advance"
                type="number"
                min={0}
                max={365}
                value={settings.advance_days}
                onChange={(e) => update({ advance_days: Number(e.target.value) })}
                disabled={isReadOnly || !settings.enabled}
                className="itsm-input"
              />
              <p className="text-xs text-slate-500">
                Quantos dias antes do prazo o aviso "próximo do prazo" começa a ser enviado. O aviso
                do dia e o de vencido são sempre enviados.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Destinatários
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Responsável pelo projeto (manager)
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Avisos de prazo do projeto e das suas atividades
                  </p>
                </div>
                <Switch
                  checked={settings.notify_manager}
                  onCheckedChange={(v) => update({ notify_manager: v })}
                  disabled={isReadOnly || !settings.enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Gestores e administradores
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Todos os usuários com papel gestor/admin e permissão de ver Projetos
                  </p>
                </div>
                <Switch
                  checked={settings.notify_gestors}
                  onCheckedChange={(v) => update({ notify_gestors: v })}
                  disabled={isReadOnly || !settings.enabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Responsável pela atividade
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Avisos de prazo das atividades delegadas a cada responsável
                  </p>
                </div>
                <Switch
                  checked={settings.notify_task_assignee}
                  onCheckedChange={(v) => update({ notify_task_assignee: v })}
                  disabled={isReadOnly || !settings.enabled}
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Regras do agente
            </h4>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-5">
              <li>
                Cada tipo de aviso (próximo / hoje / vencido) é enviado apenas uma vez por prazo.
              </li>
              <li>Se o prazo do projeto ou da atividade mudar, os avisos voltam a ser emitidos.</li>
              <li>
                Projetos concluídos, suspensos ou cancelados e atividades concluídas não geram
                avisos.
              </li>
              <li>
                Só recebe notificação quem pertence a um perfil com a permissão
                <strong> Projetos → Notificações de Prazo de Projetos</strong> concedida.
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
