import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  EmailAlertSetting,
  EmailSentLog,
  fetchEmailAlertSettings,
  updateEmailAlertToggle,
  fetchEmailSentLogs,
} from '@/services/email-alert-settings'
import { EmailTemplateEditorDialog } from '@/components/settings/EmailTemplateEditorDialog'
import {
  Mail,
  Palette,
  Power,
  ShieldCheck,
  History,
  RotateCw,
  Search,
  CheckCircle2,
  XCircle,
  Filter,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react'

interface EmailAlertsSettingsTabProps {
  canEdit?: boolean
}

const CATEGORY_LABELS: Record<string, { label: string; badgeClass: string }> = {
  tickets: {
    label: 'Chamados',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  sla: {
    label: 'SLA & Prazos',
    badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  changes: {
    label: 'Mudanças (GMUD)',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  projects: {
    label: 'Projetos',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  portal: {
    label: 'Portal do Cliente',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
}

export function EmailAlertsSettingsTab({ canEdit = true }: EmailAlertsSettingsTabProps) {
  const { toast } = useToast()
  const [settings, setSettings] = useState<EmailAlertSetting[]>([])
  const [logs, setLogs] = useState<EmailSentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [editingSetting, setEditingSetting] = useState<EmailAlertSetting | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [data, sentLogs] = await Promise.all([
        fetchEmailAlertSettings(),
        fetchEmailSentLogs(30),
      ])
      setSettings(data)
      setLogs(sentLogs)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar alertas',
        description: err?.message || 'Não foi possível carregar os parâmetros de alerta.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const reloadLogs = async () => {
    setLogsLoading(true)
    try {
      const sentLogs = await fetchEmailSentLogs(50)
      setLogs(sentLogs)
      toast({
        title: 'Histórico atualizado',
        description: `${sentLogs.length} disparos recentes carregados.`,
      })
    } catch {
      /* ignore */
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggle = async (item: EmailAlertSetting) => {
    if (!canEdit) return
    const nextState = !item.enabled
    setTogglingId(item.id)

    // Atualização otimista
    setSettings((prev) => prev.map((s) => (s.id === item.id ? { ...s, enabled: nextState } : s)))

    try {
      await updateEmailAlertToggle(item.id, nextState)
      toast({
        title: nextState ? 'Alerta ativado' : 'Alerta desativado',
        description: nextState
          ? `O alerta "${item.name}" passará a ser despachado conforme as regras do sistema.`
          : `O alerta "${item.name}" foi pausado e não enviará e-mails.`,
      })
    } catch (err: any) {
      // Reverte em caso de erro
      setSettings((prev) => prev.map((s) => (s.id === item.id ? { ...s, enabled: !nextState } : s)))
      toast({
        title: 'Erro ao alterar status',
        description: err?.message || 'Falha ao salvar no servidor.',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleOpenEditor = (item: EmailAlertSetting) => {
    setEditingSetting(item)
    setEditorOpen(true)
  }

  const handleSettingSaved = (updated: EmailAlertSetting) => {
    setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  const filteredSettings = useMemo(() => {
    return settings.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.alert_key.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      const matchCat = selectedCategory === 'all' || s.category === selectedCategory
      return matchSearch && matchCat
    })
  }, [settings, search, selectedCategory])

  const totalEnabled = useMemo(() => settings.filter((s) => s.enabled).length, [settings])

  return (
    <div className="space-y-6">
      {/* Header com resumo institucional */}
      <Card className="itsm-card overflow-hidden border-amber-500/20 shadow-xs">
        <CardHeader className="bg-gradient-to-r from-amber-500/10 via-background to-background border-b border-border/60 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
                  <Mail className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold text-foreground">
                  Central de Alertas por E-mail
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-background/80 font-semibold">
                  Skip Cloud Mailer
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Controle individualmente o despacho de cada notificação por e-mail do Lógos AITSM.
                Por segurança e controle do gestor,{' '}
                <strong>todos os alertas iniciam desligados por padrão</strong> e devem ser
                habilitados um a um.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 rounded-lg bg-muted/60 border text-center">
                <div className="text-xs font-semibold text-muted-foreground">Alertas Ativos</div>
                <div className="text-base font-bold text-foreground">
                  {loading ? '—' : `${totalEnabled} de ${settings.length}`}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="h-9 text-xs gap-1.5"
              >
                <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Barra de Filtros */}
        <CardContent className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, chave ou descrição..."
              className="text-xs h-8 pl-8"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Categoria:
            </span>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'tickets', label: 'Chamados' },
              { id: 'sla', label: 'SLA' },
              { id: 'changes', label: 'Mudanças' },
              { id: 'projects', label: 'Projetos' },
              { id: 'portal', label: 'Portal' },
            ].map((cat) => (
              <Button
                key={cat.id}
                type="button"
                size="sm"
                variant={selectedCategory === cat.id ? 'default' : 'ghost'}
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-7 text-xs px-2.5 rounded-md ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 hover:bg-amber-700 text-white font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Grid de Alertas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Power className="h-4 w-4 text-amber-500" />
            Catálogo de Alertas & Interruptores
          </h3>
          <span className="text-xs text-muted-foreground">
            {filteredSettings.length} alerta(s) encontrado(s)
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="itsm-card p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-1/2" />
              </Card>
            ))}
          </div>
        ) : filteredSettings.length === 0 ? (
          <Card className="itsm-card p-8 text-center space-y-2">
            <Mail className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-medium text-foreground">
              Nenhum alerta localizado com os filtros aplicados.
            </p>
            <p className="text-xs text-muted-foreground">
              Tente redefinir o termo de busca ou selecionar outra categoria.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSettings.map((item) => {
              const catInfo = CATEGORY_LABELS[item.category] || {
                label: item.category,
                badgeClass: 'bg-muted text-muted-foreground',
              }
              const isToggling = togglingId === item.id

              return (
                <Card
                  key={item.id}
                  className={`itsm-card transition-all flex flex-col justify-between ${
                    item.enabled
                      ? 'border-amber-500/40 bg-card shadow-xs'
                      : 'border-border/70 bg-card/60 opacity-90'
                  }`}
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-[10px] ${catInfo.badgeClass}`}>
                        {catInfo.label}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {item.enabled ? 'Ativo' : 'Desligado'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <CardTitle className="text-sm font-bold text-foreground leading-snug">
                        {item.name}
                      </CardTitle>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.alert_key}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Template:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground capitalize">
                            {item.template_layout}
                          </span>
                          {item.is_customized ? (
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] px-1 py-0 h-4 uppercase">
                              Dinâmico
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">(Padrão)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Destinatários:</span>
                        <span className="font-medium text-foreground truncate max-w-[150px]">
                          {item.recipient_types}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Destaque:</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shadow-inner"
                            style={{ backgroundColor: item.primary_color }}
                          />
                          <span className="font-mono text-[10px]">{item.primary_color}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.enabled}
                          onCheckedChange={() => handleToggle(item)}
                          disabled={!canEdit || isToggling}
                          aria-label={`Ativar ou desativar alerta ${item.name}`}
                        />
                        <span className="text-xs font-medium text-foreground">
                          {item.enabled ? 'Disparar e-mail' : 'Silenciado'}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditor(item)}
                        className="h-7 text-xs gap-1.5 hover:border-amber-500 hover:text-amber-600"
                      >
                        <Palette className="h-3 w-3 text-amber-500" />
                        Editar Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Histórico Anti-duplicidade e Auditoria de Disparos */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-border/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Auditoria de Disparos & Proteção Anti-duplicidade
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Registros da coleção <code className="text-[11px] font-mono">
                email_sent_logs
              </code>{' '}
              com índice único{' '}
              <code className="text-[11px] font-mono">(alert_key, reference_id, recipient)</code>{' '}
              para blindar reenvios indevidos.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={reloadLogs}
            disabled={logsLoading}
            className="h-8 text-xs gap-1.5 self-start sm:self-auto"
          >
            <RotateCw className={`h-3 w-3 ${logsLoading ? 'animate-spin' : ''}`} />
            Recarregar Logs
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Carregando histórico de auditoria...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <History className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
              <p className="text-xs font-medium text-foreground">
                Nenhum e-mail registrado nesta central até o momento.
              </p>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                Quando os alertas ativos forem acionados, o Skip Cloud registrará cada entrega
                assegurando que nenhuma mensagem seja repetida indevidamente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3 pl-4">Tipo de Alerta</th>
                    <th className="p-3">Destinatário</th>
                    <th className="p-3">Assunto</th>
                    <th className="p-3">Referência</th>
                    <th className="p-3 pr-4 text-right">Data / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 pl-4 font-mono font-semibold text-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {log.alert_key}
                        </Badge>
                      </td>
                      <td className="p-3 text-foreground font-medium">{log.recipient}</td>
                      <td
                        className="p-3 text-muted-foreground max-w-xs truncate"
                        title={log.subject}
                      >
                        {log.subject}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {log.reference_id || '—'}
                      </td>
                      <td className="p-3 pr-4 text-right text-muted-foreground whitespace-nowrap">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Edição Visual */}
      <EmailTemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        setting={editingSetting}
        onSaved={handleSettingSaved}
        canEdit={canEdit}
      />
    </div>
  )
}
