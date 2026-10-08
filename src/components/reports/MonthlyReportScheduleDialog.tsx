import { useEffect, useState } from 'react'
import {
  Mail,
  Calendar,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { getClientContacts, type ClientContactRecord } from '@/services/client-contacts'
import {
  getMonthlyReportScheduleForCompany,
  saveMonthlyReportSchedule,
  getMonthlyReportLogsForCompany,
  sendMonthlyReportNow,
  type MonthlyReportScheduleRecord,
  type MonthlyReportSendLogRecord,
} from '@/services/monthly-report-schedule'

interface MonthlyReportScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  companyName: string
  currentMonthKey: string
}

export function MonthlyReportScheduleDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  currentMonthKey,
}: MonthlyReportScheduleDialogProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'config' | 'history' | 'send_now'>('config')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingNow, setSendingNow] = useState(false)

  // Configuração
  const [enabled, setEnabled] = useState(false)
  const [sendDay, setSendDay] = useState<number>(5)
  const [useFocalPoints, setUseFocalPoints] = useState(true)
  const [manualRecipients, setManualRecipients] = useState('')
  const [scheduleData, setScheduleData] = useState<MonthlyReportScheduleRecord | null>(null)

  // Pontos focais do cliente
  const [focalPoints, setFocalPoints] = useState<ClientContactRecord[]>([])
  // Logs de envio
  const [logs, setLogs] = useState<MonthlyReportSendLogRecord[]>([])

  // Envio imediato
  const [sendNowMonth, setSendNowMonth] = useState(currentMonthKey)
  const [extraEmailsInput, setExtraEmailsInput] = useState('')

  const loadAll = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [sched, contacts, logList] = await Promise.all([
        getMonthlyReportScheduleForCompany(companyId),
        getClientContacts(companyId),
        getMonthlyReportLogsForCompany(companyId, 30),
      ])

      const focals = contacts.filter((c) => c.is_focal_point && c.email)
      setFocalPoints(focals)
      setLogs(logList)
      setScheduleData(sched)

      if (sched) {
        setEnabled(sched.enabled)
        setSendDay(sched.send_day || 5)
        setUseFocalPoints(sched.use_focal_points ?? true)
        setManualRecipients(sched.manual_recipients || '')
      } else {
        // Padrão novo
        setEnabled(false)
        setSendDay(5)
        setUseFocalPoints(true)
        setManualRecipients('')
      }
    } catch (err) {
      toast({
        title: 'Erro ao carregar configurações de envio',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && companyId) {
      loadAll()
    }
  }, [open, companyId])

  const handleSaveConfig = async () => {
    if (sendDay < 1 || sendDay > 28) {
      toast({
        title: 'Dia inválido',
        description: 'Escolha um dia de envio entre 1 e 28 do mês.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const saved = await saveMonthlyReportSchedule(companyId, {
        enabled,
        send_day: Number(sendDay),
        use_focal_points: useFocalPoints,
        manual_recipients: manualRecipients.trim(),
      })
      setScheduleData(saved)
      toast({
        title: 'Agendamento salvo com sucesso',
        description: enabled
          ? `Envio automático configurado para todo dia ${sendDay} às 06:00.`
          : 'Envio automático desativado para este cliente.',
      })
      await loadAll()
    } catch (err) {
      toast({
        title: 'Erro ao salvar agendamento',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSendNow = async () => {
    if (!sendNowMonth) {
      toast({
        title: 'Mês obrigatório',
        description: 'Selecione o mês de referência para o relatório.',
        variant: 'destructive',
      })
      return
    }

    const extras = extraEmailsInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3 && s.includes('@'))

    setSendingNow(true)
    try {
      const result = await sendMonthlyReportNow(companyId, sendNowMonth, extras)
      toast({
        title: 'Relatório enviado com sucesso!',
        description: `Disparado para ${result.recipients.length} destinatário(s) no padrão ABNT.`,
      })
      // Recarrega logs
      const updatedLogs = await getMonthlyReportLogsForCompany(companyId, 30)
      setLogs(updatedLogs)
      setActiveTab('history')
    } catch (err) {
      toast({
        title: 'Falha no envio do relatório',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSendingNow(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-blue-600" />
            Envio Automático do Relatório Mensal &mdash; {companyName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure o disparo recorrente por e-mail no padrão ABNT aos pontos focais e
            destinatários cadastrados.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="config" className="text-xs gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Configuração
            </TabsTrigger>
            <TabsTrigger value="send_now" className="text-xs gap-1.5">
              <Send className="h-3.5 w-3.5" /> Disparar Agora
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5">
              <History className="h-3.5 w-3.5" /> Auditoria / Logs
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: CONFIGURAÇÃO DO AGENDAMENTO */}
          <TabsContent value="config" className="space-y-4">
            {/* Status Ativo/Inativo */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border bg-slate-50 dark:bg-slate-900/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Envio Automático Todo Mês
                </Label>
                <p className="text-xs text-slate-500">
                  Quando ativo, o servidor gera e dispara o relatório no dia agendado (06:00).
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Dia do envio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" /> Dia do Disparo no Mês
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={sendDay}
                    onChange={(e) => setSendDay(Number(e.target.value))}
                    className="w-24 text-center font-bold text-sm"
                  />
                  <span className="text-xs text-slate-500">
                    de cada mês (ex: dia 5 para enviar o mês anterior)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Último Envio Automático</Label>
                <div className="h-9 px-3 rounded-md border flex items-center text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                  {scheduleData?.last_sent_at ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {new Date(scheduleData.last_sent_at).toLocaleDateString('pt-BR')} (Mês{' '}
                      {scheduleData.last_sent_month || '—'})
                    </span>
                  ) : (
                    <span className="text-slate-400">Nenhum envio registrado</span>
                  )}
                </div>
              </div>
            </div>

            {/* Opção Pontos Focais */}
            <div className="p-3.5 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-600" /> Incluir Pontos Focais do Cliente
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Dispara automaticamente para os contatos marcados como &quot;Ponto Focal&quot;
                    no cadastro do cliente.
                  </p>
                </div>
                <Switch checked={useFocalPoints} onCheckedChange={setUseFocalPoints} />
              </div>

              {useFocalPoints && (
                <div className="pt-2 border-t text-xs">
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Pontos focais cadastrados ({focalPoints.length}):
                  </p>
                  {focalPoints.length === 0 ? (
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 flex items-center gap-2 text-[11px]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Nenhum contato marcado como Ponto Focal com e-mail encontrado. Cadastre
                      contatos na tela de edição do cliente ou adicione e-mails manuais abaixo.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {focalPoints.map((f) => (
                        <Badge key={f.id} variant="secondary" className="text-[11px] py-0.5">
                          {f.full_name} ({f.email})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Destinatários Manuais */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Destinatários Adicionais (E-mails manuais)
              </Label>
              <Textarea
                placeholder="Insira e-mails separados por vírgula ou uma linha por e-mail&#10;exemplo: diretoria@cliente.com.br, ti@cliente.com.br"
                value={manualRecipients}
                onChange={(e) => setManualRecipients(e.target.value)}
                rows={3}
                className="text-xs"
              />
              <p className="text-[10px] text-slate-500">
                Estes e-mails sempre receberão o relatório além dos pontos focais.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveConfig}
                disabled={saving || loading}
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ABA 2: DISPARAR AGORA */}
          <TabsContent value="send_now" className="space-y-4">
            <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-1 text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" /> Envio Imediato de Teste / Produção
              </p>
              <p>
                Permite disparar imediatamente o relatório compilado em HTML (normas ABNT) para os
                destinatários configurados e/ou e-mails pontuais de teste.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mês de Referência do Relatório</Label>
              <Input
                type="month"
                value={sendNowMonth}
                onChange={(e) => setSendNowMonth(e.target.value)}
                className="text-xs w-48"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                E-mails Adicionais Apenas para este Disparo (Opcional)
              </Label>
              <Textarea
                placeholder="ex.: seu-email@empresa.com.br"
                value={extraEmailsInput}
                onChange={(e) => setExtraEmailsInput(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <p className="text-[10px] text-slate-500">
                Se quiser testar em seu próprio e-mail antes de enviar aos pontos focais.
              </p>
            </div>

            <div className="p-3 rounded-md border text-xs bg-slate-50 dark:bg-slate-900/40">
              <p className="font-semibold mb-1">Destinatários que serão acionados:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                {useFocalPoints && focalPoints.length > 0 && (
                  <li>Pontos focais: {focalPoints.map((f) => f.email).join(', ')}</li>
                )}
                {manualRecipients.trim() && (
                  <li>Configurados manuais: {manualRecipients.trim()}</li>
                )}
                {extraEmailsInput.trim() && <li>Extras pontuais: {extraEmailsInput.trim()}</li>}
                {!useFocalPoints && !manualRecipients.trim() && !extraEmailsInput.trim() && (
                  <li className="text-red-500 font-semibold">Nenhum destinatário informado.</li>
                )}
              </ul>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSendNow}
                disabled={sendingNow}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendingNow ? (
                  'Enviando...'
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Enviar Agora por E-mail
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ABA 3: AUDITORIA / LOGS */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Histórico de Disparos Realizados ({logs.length})
              </p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadAll}>
                Atualizar
              </Button>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center border rounded-lg text-xs text-slate-500">
                Nenhum log de envio registrado para este cliente.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b text-[11px] text-slate-500">
                    <tr>
                      <th className="p-2.5">Data / Hora</th>
                      <th className="p-2.5">Mês Ref.</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Origem</th>
                      <th className="p-2.5">Destinatários / Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 whitespace-nowrap font-mono text-[11px]">
                          {new Date(log.sent_at || log.created).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-2.5 font-semibold text-[11px]">{log.report_month}</td>
                        <td className="p-2.5">
                          {log.status === 'sucesso' ? (
                            <Badge className="bg-emerald-600 text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Sucesso
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <XCircle className="h-3 w-3" /> Falha
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 capitalize text-[11px] text-slate-600">
                          {log.triggered_by || 'cron'}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                          {log.status === 'sucesso'
                            ? log.recipients
                            : log.error_message || log.recipients}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
