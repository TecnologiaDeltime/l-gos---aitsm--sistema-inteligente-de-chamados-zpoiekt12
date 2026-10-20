import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { securityService, SecuritySettings, LoginAttemptLog } from '@/services/security'
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Lock,
  Smartphone,
  Save,
  RotateCcw,
  History,
} from 'lucide-react'

interface SecuritySettingsTabProps {
  isAdmin: boolean
}

export const SecuritySettingsTab: React.FC<SecuritySettingsTabProps> = ({ isAdmin }) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SecuritySettings>({
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    require_2fa_admin: true,
    require_2fa_gestor: false,
  })

  // Logs de tentativas
  const [logs, setLogs] = useState<LoginAttemptLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const policy = await securityService.getPolicy()
      setSettings(policy)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar parâmetros de segurança',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      const data = await securityService.getLoginLogs(25)
      setLogs(data)
    } catch (_) {
      // Ignorar caso não tenha permissão de leitura de auditoria
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadData()
    if (isAdmin) {
      loadLogs()
    }
  }, [isAdmin])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    setSaving(true)
    try {
      const updated = await securityService.updatePolicy({
        session_timeout_minutes: Number(settings.session_timeout_minutes),
        max_login_attempts: Number(settings.max_login_attempts),
        lockout_duration_minutes: Number(settings.lockout_duration_minutes),
        require_2fa_admin: settings.require_2fa_admin,
        require_2fa_gestor: settings.require_2fa_gestor,
      })
      setSettings(updated)
      toast({
        title: 'Políticas de segurança atualizadas',
        description: 'Os parâmetros de sessão, bloqueio e 2FA foram salvos com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Falha ao salvar',
        description: err.message || 'Erro ao persistir políticas de segurança.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Sucesso</Badge>
      case 'failed_password':
        return <Badge variant="destructive">Senha Incorreta</Badge>
      case 'account_locked':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">Conta Bloqueada</Badge>
      case 'unlocked_by_admin':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Desbloqueio Admin</Badge>
      case 'totp_success':
        return <Badge className="bg-teal-600 hover:bg-teal-700 text-white">2FA Sucesso</Badge>
      case 'totp_failed':
        return <Badge variant="destructive">2FA Falhou</Badge>
      default:
        return <Badge variant="outline">{outcome}</Badge>
    }
  }

  const formatDate = (iso: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Políticas de Sessão e Endurecimento de Segurança
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Controles de expiração de sessão, proteção contra força bruta e autenticação de
                  dois fatores
                </CardDescription>
              </div>
            </div>
            {!isAdmin && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Somente Leitura (Requer Administrador)
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <p className="text-xs text-slate-500">Carregando parâmetros de segurança...</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* PARTE 1: EXPIRAÇÃO DE SESSÃO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>1. Expiração Automática de Sessão</span>
                </div>
                <p className="text-xs text-slate-500">
                  Desconecta automaticamente o usuário após o período de inatividade especificado.
                  Um aviso é exibido nos últimos 2 minutos com opção de renovação de sessão.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="session_timeout">Tempo de Inatividade (minutos)</Label>
                    <Input
                      id="session_timeout"
                      type="number"
                      min={5}
                      max={1440}
                      value={settings.session_timeout_minutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          session_timeout_minutes: parseInt(e.target.value, 10) || 60,
                        })
                      }
                      disabled={!isAdmin}
                      className="w-full sm:w-48"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Padrão recomendado: 60 minutos. Mínimo 5 min.
                    </p>
                  </div>
                </div>
              </div>

              {/* PARTE 2: PROTEÇÃO CONTRA FORÇA BRUTA (BLOQUEIO DE TENTATIVAS) */}
              <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>2. Limite de Tentativas de Login e Bloqueio Automático</span>
                </div>
                <p className="text-xs text-slate-500">
                  Protege contra ataques de força bruta. Se o usuário errar a senha sucessivamente,
                  a conta é bloqueada temporariamente e a tentativa registrada em auditoria.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="max_attempts">Máximo de Tentativas Incorretas</Label>
                    <Input
                      id="max_attempts"
                      type="number"
                      min={3}
                      max={20}
                      value={settings.max_login_attempts}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          max_login_attempts: parseInt(e.target.value, 10) || 5,
                        })
                      }
                      disabled={!isAdmin}
                      className="w-full sm:w-48"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Padrão recomendado: 5 tentativas.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lockout_duration">Duração do Bloqueio (minutos)</Label>
                    <Input
                      id="lockout_duration"
                      type="number"
                      min={5}
                      max={1440}
                      value={settings.lockout_duration_minutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          lockout_duration_minutes: parseInt(e.target.value, 10) || 15,
                        })
                      }
                      disabled={!isAdmin}
                      className="w-full sm:w-48"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Padrão recomendado: 15 minutos.
                    </p>
                  </div>
                </div>
              </div>

              {/* PARTE 3: 2FA TOTP PARA PERFIS DE ACESSO */}
              <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>3. Autenticação em Duas Etapas (2FA TOTP)</span>
                </div>
                <p className="text-xs text-slate-500">
                  Exige aplicativo autenticador (Google Authenticator, Microsoft Authenticator) e
                  fornece códigos de recuperação únicos. O segredo é cifrado em repouso no backend.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Exigir 2FA para Administradores</Label>
                      <p className="text-xs text-muted-foreground">
                        Obrigatório no primeiro acesso de qualquer conta com perfil "admin".
                      </p>
                    </div>
                    <Switch
                      checked={settings.require_2fa_admin}
                      onCheckedChange={(val) =>
                        setSettings({ ...settings, require_2fa_admin: val })
                      }
                      disabled={!isAdmin}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Exigir 2FA para Gestores</Label>
                      <p className="text-xs text-muted-foreground">
                        Habilitar autenticação em duas etapas para contas de gestores.
                      </p>
                    </div>
                    <Switch
                      checked={settings.require_2fa_gestor}
                      onCheckedChange={(val) =>
                        setSettings({ ...settings, require_2fa_gestor: val })
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              {isAdmin && (
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    disabled={saving}
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Restaurar
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    <Save className="w-4 h-4 mr-1.5" />
                    {saving ? 'Salvando...' : 'Salvar Políticas'}
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {/* HISTÓRICO DE LOGS DE LOGIN E BLOQUEIO (AUDITORIA) */}
      {isAdmin && (
        <Card className="itsm-card">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Auditoria de Tentativas de Acesso
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Registro em tempo real de sucessos, falhas de senha, bloqueios e validações 2FA
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="h-8 text-xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                Atualizar Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data/Hora</TableHead>
                    <TableHead className="text-xs">E-mail</TableHead>
                    <TableHead className="text-xs">Resultado</TableHead>
                    <TableHead className="text-xs">Detalhes</TableHead>
                    <TableHead className="text-xs">Endereço IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-xs text-muted-foreground"
                      >
                        {loadingLogs
                          ? 'Carregando logs de acesso...'
                          : 'Nenhum registro encontrado.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell className="font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {formatDate(log.created)}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          {log.email}
                        </TableCell>
                        <TableCell>{getOutcomeBadge(log.outcome)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {log.details || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.ip_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
