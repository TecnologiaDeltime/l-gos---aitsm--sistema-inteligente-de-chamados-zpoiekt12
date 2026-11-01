import React, { useState } from 'react'
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  Eye,
  Download,
  AlertCircle,
  Building2,
  Lock,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/date-format'
import { ClientMonthlyReportRecord, evaluateMonthlyReport } from '@/services/client-monthly-reports'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Star, ThumbsUp } from 'lucide-react'

interface PortalReportsTabProps {
  reports: ClientMonthlyReportRecord[]
  loading: boolean
  companyName: string
  onRefresh?: () => void
}

export default function PortalReportsTab({
  reports,
  loading,
  companyName,
  onRefresh,
}: PortalReportsTabProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [viewingReport, setViewingReport] = useState<ClientMonthlyReportRecord | null>(null)

  // Estados da avaliação no modal do relatório
  const [reportScore, setReportScore] = useState<number>(0)
  const [hoverScore, setHoverScore] = useState<number>(0)
  const [reportComment, setReportComment] = useState<string>('')
  const [savingEvaluation, setSavingEvaluation] = useState(false)

  // Quando abre um relatório, carrega a avaliação existente
  const handleOpenReport = (report: ClientMonthlyReportRecord) => {
    setViewingReport(report)
    setReportScore(report.satisfaction_score || 0)
    setReportComment(report.satisfaction_comment || '')
    setHoverScore(0)
  }

  const starLabels: Record<number, string> = {
    1: '1 - Muito Ruim',
    2: '2 - Ruim',
    3: '3 - Regular',
    4: '4 - Bom',
    5: '5 - Excelente',
  }

  const handleSaveEvaluation = async () => {
    if (!viewingReport) return
    if (reportScore < 1 || reportScore > 5) {
      toast({
        title: 'Selecione uma nota',
        description: 'Clique nas estrelas de 1 a 5 para avaliar o serviço prestado no período.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSavingEvaluation(true)
      const updated = await evaluateMonthlyReport({
        reportId: viewingReport.id,
        score: reportScore,
        comment: reportComment,
      })

      setViewingReport(updated)
      toast({
        title: 'Avaliação registrada com sucesso!',
        description: 'Sua avaliação referente aos serviços prestados no período foi gravada.',
      })

      if (onRefresh) {
        onRefresh()
      }
    } catch (err: any) {
      console.error('Erro ao salvar avaliação do relatório mensal:', err)
      toast({
        title: 'Erro ao salvar avaliação',
        description: err.message || 'Não foi possível gravar sua avaliação.',
        variant: 'destructive',
      })
    } finally {
      setSavingEvaluation(false)
    }
  }

  const filteredReports = reports.filter((r) => {
    const term = searchTerm.toLowerCase()
    return (
      r.period_label.toLowerCase().includes(term) ||
      r.month_key.toLowerCase().includes(term) ||
      (r.summary_notes || '').toLowerCase().includes(term) ||
      (r.expand?.released_by?.name || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-4">
      {/* Topo Informativo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-xl p-4 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" />
            Relatórios Mensais de Atendimento
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Demonstrativos consolidados emitidos pela equipe de Qualidade e liberados para{' '}
            <strong>{companyName}</strong>.
          </p>
        </div>

        {/* Busca */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar por mês ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Lista de Relatórios */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground bg-card border rounded-xl">
          Carregando relatórios mensais liberados...
        </div>
      ) : filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full w-fit mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {searchTerm
                ? 'Nenhum relatório encontrado para o filtro aplicado.'
                : 'Nenhum relatório mensal liberado até o momento.'}
            </p>
            <p className="max-w-md mx-auto leading-relaxed">
              Quando o mês é fechado, a equipe responsável (Qualidade e Governança) gera e analisa o
              relatório mensal. Assim que a liberação for realizada, o documento ficará disponível
              aqui para consulta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const data = report.report_data || {}
            const totalHours =
              data.totalUsedHours || data.totalContractedHours
                ? `${Number(data.totalUsedHours || 0).toFixed(1)}h`
                : null
            const balanceHours =
              data.totalBalanceHours !== undefined
                ? `${Number(data.totalBalanceHours).toFixed(1)}h`
                : null

            return (
              <Card
                key={report.id}
                className="bg-card border hover:border-amber-500/50 transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[11px] font-semibold gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Liberado ao Cliente
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {report.month_key}
                    </span>
                  </div>

                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-amber-500" />
                    {report.period_label}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                    {report.summary_notes ||
                      'Demonstrativo mensal consolidado de consumo de franquia, chamados e acordos.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3">
                  {/* Resumo de Indicadores se existirem no snapshot */}
                  {(totalHours || balanceHours) && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/40 border text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Horas Consumidas
                        </span>
                        <span className="font-mono font-bold text-foreground">{totalHours}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Saldo de Horas
                        </span>
                        <span className="font-mono font-bold text-foreground">{balanceHours}</span>
                      </div>
                    </div>
                  )}

                  {/* Metadados de Liberação */}
                  <div className="space-y-1 text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Liberado em:
                      </span>
                      <strong className="text-foreground">
                        {report.released_at ? formatDateTime(report.released_at) : '—'}
                      </strong>
                    </div>

                    {report.expand?.released_by?.name && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          Liberado por:
                        </span>
                        <strong className="text-foreground truncate max-w-[140px]">
                          {report.expand.released_by.name}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Indicador de Avaliação no Card */}
                  {report.satisfaction_score ? (
                    <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-muted-foreground flex items-center gap-1 font-medium">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        Avaliado:
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {report.satisfaction_score} estrela(s)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-amber-500/5 border border-dashed border-amber-500/30 text-amber-700 dark:text-amber-300">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        Avaliação pendente
                      </span>
                      <span
                        className="text-[10px] font-semibold underline cursor-pointer"
                        onClick={() => handleOpenReport(report)}
                      >
                        Avaliar agora
                      </span>
                    </div>
                  )}

                  {/* Ação de Visualização */}
                  <Button
                    size="sm"
                    onClick={() => handleOpenReport(report)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 mt-2"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Visualizar Relatório
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Leitura do Relatório Mensal Liberado */}
      {viewingReport && (
        <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap pr-6">
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-500" />
                    Relatório Mensal &mdash; {viewingReport.period_label}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    {companyName} &bull; Mês de Referência: {viewingReport.month_key}
                  </DialogDescription>
                </div>
                <Badge className="bg-emerald-600 text-white text-xs">
                  Liberado em{' '}
                  {viewingReport.released_at ? formatDateTime(viewingReport.released_at) : '—'}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-6 pt-2 text-xs">
              {/* =========================================================================
                  SEÇÃO DE AVALIAÇÃO DE SATISFAÇÃO DO RELATÓRIO MENSAL (1-5 Estrelas)
                  ========================================================================= */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-card space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Avaliação dos Serviços Prestados no Período ({viewingReport.period_label})
                    </h4>
                  </div>
                  {viewingReport.satisfaction_score ? (
                    <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Avaliação Gravada
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] gap-1">
                      <AlertCircle className="h-3 w-3" /> Aguardando Avaliação
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Como você avalia os serviços prestados pela equipe de atendimento neste mês de{' '}
                  <strong>{viewingReport.period_label}</strong>? (1 = muito ruim, 5 = excelente)
                </p>

                {/* Se já foi avaliado anteriormente, exibe as estrelas e o comentário */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= (hoverScore || reportScore)
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReportScore(star)}
                        onMouseEnter={() => setHoverScore(star)}
                        onMouseLeave={() => setHoverScore(0)}
                        className="p-1 rounded-md transition-transform hover:scale-110 focus:outline-hidden"
                        title={starLabels[star]}
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            filled
                              ? 'text-amber-500 fill-amber-500 drop-shadow-xs'
                              : 'text-zinc-400 dark:text-zinc-600 hover:text-amber-400'
                          }`}
                        />
                      </button>
                    )
                  })}
                  {(hoverScore || reportScore) > 0 && (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-2">
                      {starLabels[hoverScore || reportScore]}
                    </span>
                  )}
                </div>

                {/* Campo de comentário */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>O que achou dos serviços prestados naquele período?</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Comentário opcional
                    </span>
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="Deixe seu parecer ou comentários sobre as entregas, prazos e atendimento do mês..."
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    className="text-xs resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <div className="text-[11px] text-muted-foreground">
                    {viewingReport.satisfaction_score ? (
                      <span>
                        Avaliado em{' '}
                        {viewingReport.satisfaction_responded_at
                          ? formatDateTime(viewingReport.satisfaction_responded_at)
                          : 'recente'}
                        {viewingReport.expand?.satisfaction_responded_by?.name && (
                          <span> por {viewingReport.expand.satisfaction_responded_by.name}</span>
                        )}
                        . Você pode atualizar a nota e comentário se desejar.
                      </span>
                    ) : (
                      <span>
                        Sua avaliação é fundamental para a governança e melhoria contínua do
                        contrato.
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveEvaluation}
                    disabled={savingEvaluation || reportScore === 0}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 h-8 shrink-0"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {savingEvaluation
                      ? 'Salvando...'
                      : viewingReport.satisfaction_score
                        ? 'Atualizar Avaliação'
                        : 'Gravar Avaliação'}
                  </Button>
                </div>
              </div>

              {/* Box de Observações / Parecer da Qualidade */}
              {viewingReport.summary_notes && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
                  <span className="font-bold text-amber-600 dark:text-amber-400 block text-xs">
                    Parecer da Equipe de Qualidade e Governança:
                  </span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap text-xs">
                    {viewingReport.summary_notes}
                  </p>
                </div>
              )}

              {/* Snapshot Analítico do Relatório se disponível */}
              {viewingReport.report_data ? (
                <div className="space-y-6">
                  {/* Cards de KPIs do Relatório */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground block">
                        Horas Contratadas
                      </span>
                      <span className="text-lg font-bold font-mono text-foreground">
                        {Number(viewingReport.report_data.totalContractedHours || 0).toFixed(1)}h
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground block">
                        Horas Consumidas
                      </span>
                      <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                        {Number(viewingReport.report_data.totalUsedHours || 0).toFixed(1)}h
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground block">
                        Saldo Contratual
                      </span>
                      <span className="text-lg font-bold font-mono text-foreground">
                        {Number(viewingReport.report_data.totalBalanceHours || 0).toFixed(1)}h
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground block">Utilização</span>
                      <span className="text-lg font-bold font-mono text-foreground">
                        {Number(viewingReport.report_data.totalUtilizationPercent || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Consumo por Setor */}
                  {Array.isArray(viewingReport.report_data.sectors) &&
                    viewingReport.report_data.sectors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-foreground text-sm border-b pb-1">
                          Consumo de Horas por Setor
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted text-muted-foreground font-semibold">
                              <tr>
                                <th className="p-2 text-left">Setor / Departamento</th>
                                <th className="p-2 text-right">Chamados</th>
                                <th className="p-2 text-right">Horas</th>
                                <th className="p-2 text-right">% do Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {viewingReport.report_data.sectors.map((sec: any, idx: number) => (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="p-2 font-medium text-foreground">{sec.name}</td>
                                  <td className="p-2 text-right font-mono">{sec.ticketCount}</td>
                                  <td className="p-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                    {Number(sec.usedHours || 0).toFixed(1)}h
                                  </td>
                                  <td className="p-2 text-right font-mono">{sec.percentTotal}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  {/* Atividades mais requisitadas */}
                  {Array.isArray(viewingReport.report_data.activities) &&
                    viewingReport.report_data.activities.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-foreground text-sm border-b pb-1">
                          Atividades mais Requisitadas
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted text-muted-foreground font-semibold">
                              <tr>
                                <th className="p-2 text-left">Atividade / Serviço</th>
                                <th className="p-2 text-left">Categoria</th>
                                <th className="p-2 text-right">Chamados</th>
                                <th className="p-2 text-right">Horas</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {viewingReport.report_data.activities
                                .slice(0, 10)
                                .map((act: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-muted/20">
                                    <td className="p-2 font-medium text-foreground">{act.name}</td>
                                    <td className="p-2 text-muted-foreground">
                                      {act.categoryName || '—'}
                                    </td>
                                    <td className="p-2 text-right font-mono">{act.ticketCount}</td>
                                    <td className="p-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                      {Number(act.usedHours || 0).toFixed(1)}h
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  {/* Estudo Técnico / Recomendações */}
                  {viewingReport.report_data.study?.recommendations && (
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                      <span className="font-bold text-foreground block text-xs">
                        Recomendações e Conclusões Técnicas:
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                        {viewingReport.report_data.study.recommendations.map(
                          (rec: string, rIdx: number) => (
                            <li key={rIdx}>{rec}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/10">
                  <p>
                    O relatório mensal de {viewingReport.period_label} foi liberado pela equipe
                    técnica.
                  </p>
                </div>
              )}

              {/* Botão de Fechar */}
              <div className="flex justify-end pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingReport(null)}
                  className="text-xs"
                >
                  Fechar Visualização
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
