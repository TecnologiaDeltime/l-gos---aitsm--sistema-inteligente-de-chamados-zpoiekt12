import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  getClientNotificationSettings,
  saveClientNotificationSettings,
  ClientNotificationSettings,
} from '@/services/client-notification-settings'
import { getCompanies, CompanyRecord } from '@/services/companies'
import {
  Mail,
  CheckCircle2,
  FileText,
  Users,
  Building2,
  Save,
  Globe,
  Loader2,
  Info,
} from 'lucide-react'

interface ClientNotificationSettingsTabProps {
  isAdminOrGestor: boolean
}

export function ClientNotificationSettingsTab({
  isAdminOrGestor,
}: ClientNotificationSettingsTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<ClientNotificationSettings | null>(null)
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('global')

  useEffect(() => {
    loadData('global')
    getCompanies()
      .then((comps) => setCompanies(comps.filter((c) => c.status === 'Ativo')))
      .catch(() => setCompanies([]))
  }, [])

  const loadData = async (compScope: string) => {
    setLoading(true)
    try {
      const targetId = compScope === 'global' ? undefined : compScope
      const res = await getClientNotificationSettings(targetId)
      setSettings(res)
    } catch {
      toast({
        title: 'Erro ao carregar configurações de notificações',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value)
    loadData(value)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const companyId = selectedCompanyId === 'global' ? undefined : selectedCompanyId
      const saved = await saveClientNotificationSettings(
        {
          notify_ticket_created: settings.notify_ticket_created,
          notify_ticket_resolved: settings.notify_ticket_resolved,
          notify_focal_points: settings.notify_focal_points,
        },
        companyId,
      )
      setSettings(saved)
      toast({
        title: 'Configurações de notificações salvas!',
        description:
          selectedCompanyId === 'global'
            ? 'Regras globais aplicadas para todos os clientes.'
            : 'Regras personalizadas salvas para o cliente selecionado.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar configurações',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* CARD PRINCIPAL */}
      <Card className="itsm-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Central de Notificações do Cliente
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Defina quais e-mails e alertas automáticos os solicitantes e contatos do cliente
                recebem durante o ciclo de vida dos chamados.
              </CardDescription>
            </div>

            <Badge
              variant="secondary"
              className="self-start sm:self-auto bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              Comunicação Externa
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* SELETOR DE ESCOPO: GLOBAL OU POR CLIENTE */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-slate-500" />
                  Escopo da Configuração
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alterne entre a regra padrão do sistema (global) ou regras específicas por
                  cliente.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger className="itsm-input h-9 text-xs">
                    <SelectValue placeholder="Selecione o escopo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global" className="text-xs font-semibold">
                      🌐 Padrão Global (Todos os Clientes)
                    </SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        🏢 {c.trade_name || c.legal_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCompanyId !== 'global' && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>
                  Você está editando a regra personalizada para este cliente. Se desativado, o envio
                  é interrompido para solicitações desta empresa.
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-xs">Carregando preferências de notificação...</p>
            </div>
          ) : settings ? (
            <div className="space-y-6">
              {/* TOGGLES PRINCIPAIS */}
              <div className="space-y-4">
                {/* 1. E-MAIL DE ABERTURA DE CHAMADO */}
                <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-sky-600" />
                      <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer">
                        E-mail de Abertura de Chamado
                      </Label>
                      <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 text-[10px] h-5">
                        abertura_chamado
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                      Envia mensagem institucional de confirmação ao solicitante assim que o chamado
                      é registrado no sistema (via portal, manual ou e-mail), com número do chamado,
                      problema informado, data/hora e aviso de fila de atendimento.
                    </p>
                  </div>
                  <Switch
                    checked={settings.notify_ticket_created}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notify_ticket_created: checked })
                    }
                    disabled={!isAdminOrGestor}
                    className="data-[state=checked]:bg-sky-600"
                  />
                </div>

                {/* 2. E-MAIL DE RESOLUÇÃO DO CHAMADO */}
                <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer">
                        E-mail de Resolução do Chamado
                      </Label>
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] h-5">
                        resolucao_chamado
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                      Envia notificação formal ao cliente quando o chamado for marcado como{' '}
                      <strong>Resolvido</strong> (ou Encerrado direto), no mesmo template
                      institucional, apresentando a solução aplicada pelo operador, data de
                      conclusão e orientações finais.
                    </p>
                  </div>
                  <Switch
                    checked={settings.notify_ticket_resolved}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notify_ticket_resolved: checked })
                    }
                    disabled={!isAdminOrGestor}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                {/* 3. CÓPIA PARA PONTOS FOCAIS */}
                <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100 cursor-pointer">
                        Cópia para Pontos Focais do Cliente
                      </Label>
                      <Badge variant="outline" className="text-[10px] h-5">
                        client_contacts
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                      Quando ativado, além do solicitante direto, os contatos cadastrados como
                      pontos focais da empresa do chamado também recebem as notificações de
                      resolução.
                    </p>
                  </div>
                  <Switch
                    checked={settings.notify_focal_points}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notify_focal_points: checked })
                    }
                    disabled={!isAdminOrGestor}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                </div>
              </div>

              {/* CARD DE INFORMAÇÕES DE INTEGRAÇÃO */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Info className="h-4 w-4 text-blue-500" />
                  Como funcionam as regras de envio
                </div>
                <ul className="text-xs text-slate-500 space-y-1 list-disc pl-5">
                  <li>
                    Os e-mails utilizam o transporte SMTP autenticado configurado na aba Conexão
                    IMAP & Caixa de E-mail (ou fallback do servidor).
                  </li>
                  <li>
                    Todos os envios geram registro em tempo real na auditoria em{' '}
                    <strong>Conexão IMAP & Caixa de E-mail → Histórico de Auditoria</strong>.
                  </li>
                  <li>
                    Alertas internos do sistema (como SLA de Resposta e chamados sem atualização)
                    são direcionados exclusivamente a operadores e não são afetados por esta
                    central.
                  </li>
                </ul>
              </div>

              {/* BOTÃO DE SALVAMENTO */}
              {isAdminOrGestor && (
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saving ? 'Salvando...' : 'Salvar Preferências'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-red-500">
              Não foi possível carregar as configurações de notificações.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
