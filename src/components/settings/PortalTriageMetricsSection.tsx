import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  TrendingUp,
  RefreshCw,
  Sparkles,
  HelpCircle,
  ThumbsUp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { getPortalTriageMetrics, type PortalTriageMetricsSummary } from '@/services/portal-triage'

interface PortalTriageMetricsSectionProps {
  canView?: boolean
}

export const PortalTriageMetricsSection: React.FC<PortalTriageMetricsSectionProps> = ({
  canView = true,
}) => {
  const [periodDays, setPeriodDays] = useState<number>(30)
  const [loading, setLoading] = useState<boolean>(true)
  const [metrics, setMetrics] = useState<PortalTriageMetricsSummary | null>(null)

  const loadMetrics = async (days = periodDays) => {
    setLoading(true)
    try {
      const data = await getPortalTriageMetrics(days)
      setMetrics(data)
    } catch (err) {
      console.warn('Erro ao carregar métricas de triagem IA:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) {
      loadMetrics(periodDays)
    }
  }, [periodDays, canView])

  if (!canView) return null

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Painel com Filtro de Período */}
      <Card className="border border-purple-500/20 bg-gradient-to-r from-purple-500/[0.04] via-card to-card shadow-sm">
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-4 w-4" />
                </span>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  Métricas de Satisfação e Desempenho da IA
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                  >
                    Acurácia & Triagem
                  </Badge>
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Acompanhamento em tempo real da qualidade das classificações feitas pelo agente de
                IA, taxas de aceitação automática e correções manuais efetuadas pelos operadores.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <Select
                value={String(periodDays)}
                onValueChange={(val) => setPeriodDays(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-36 text-xs bg-background">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="0">Todo o período</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => loadMetrics()}
                disabled={loading}
                className="h-8 text-xs px-2.5 gap-1.5"
                title="Recarregar métricas"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid de 5 Cards Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total de Triagens */}
        <Card className="border shadow-sm p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Total de Triagens</span>
            <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {metrics ? metrics.totalTriages : '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {periodDays > 0 ? `Nos últimos ${periodDays} dias` : 'Histórico completo'}
          </p>
        </Card>

        {/* % Aplicadas Automaticamente */}
        <Card className="border shadow-sm p-3.5 space-y-1 border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Aplicadas Direto</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            {metrics ? `${metrics.appliedPct}%` : '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics ? `${metrics.appliedCount} chamados classificados` : '—'}
          </p>
        </Card>

        {/* % Satisfação / Acurácia da IA */}
        <Card className="border shadow-sm p-3.5 space-y-1 border-blue-500/20 bg-blue-500/[0.02]">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Acurácia Percebida</span>
            <ThumbsUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400">
            {metrics ? `${metrics.accuracyPct}%` : '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics ? `${metrics.totalTriages - metrics.correctedCount} sem correção` : '—'}
          </p>
        </Card>

        {/* % Corrigidas pelo Operador */}
        <Card className="border shadow-sm p-3.5 space-y-1 border-amber-500/20 bg-amber-500/[0.02]">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Corrigidas pelo Operador</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
            {metrics ? `${metrics.correctedPct}%` : '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics ? `${metrics.correctedCount} reclassificadas` : '—'}
          </p>
        </Card>

        {/* Confiança Média da IA */}
        <Card className="border shadow-sm p-3.5 space-y-1 border-purple-500/20 bg-purple-500/[0.02]">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Confiança Média</span>
            <Gauge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-purple-600 dark:text-purple-400">
            {metrics ? `${Math.round(metrics.avgConfidence * 100)}%` : '—'}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics && metrics.avgCorrectionMinutes > 0
              ? `Tempo médio p/ ajuste: ${metrics.avgCorrectionMinutes} min`
              : 'Indicador global'}
          </p>
        </Card>
      </div>

      {/* Seção 2: Distribuição de Confiança + Taxa de Acerto por Atividade */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Distribuição de Confiança */}
        <Card className="lg:col-span-5 border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Distribuição de Confiança
            </CardTitle>
            <CardDescription className="text-xs">
              Como se dividem as previsões de confiança calculadas pelo agente de IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            {metrics && metrics.totalTriages > 0 ? (
              <div className="space-y-3 pt-1">
                {/* Alta Confiança >= 80% */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Alta
                      Confiança (≥ 80%)
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {metrics.confidenceBuckets.high} (
                      {Math.round((metrics.confidenceBuckets.high / metrics.totalTriages) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${Math.round((metrics.confidenceBuckets.high / metrics.totalTriages) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Média Confiança 60% - 79% */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Média
                      Confiança (60% - 79%)
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {metrics.confidenceBuckets.medium} (
                      {Math.round((metrics.confidenceBuckets.medium / metrics.totalTriages) * 100)}
                      %)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{
                        width: `${Math.round((metrics.confidenceBuckets.medium / metrics.totalTriages) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Baixa Confiança < 60% / Fila padrão */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Baixa
                      Confiança (&lt; 60% - Fila Padrão)
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {metrics.confidenceBuckets.low} (
                      {Math.round((metrics.confidenceBuckets.low / metrics.totalTriages) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all"
                      style={{
                        width: `${Math.round((metrics.confidenceBuckets.low / metrics.totalTriages) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Resumo da Fila Padrão */}
                <div className="p-2.5 rounded-lg border border-border/80 bg-muted/30 text-xs space-y-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Encaminhados à Fila Padrão:</span>
                    <strong className="font-mono text-foreground">
                      {metrics.defaultQueueCount} ({metrics.defaultQueuePct}%)
                    </strong>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Chamados com confiança abaixo da nota de corte ou sem palavras-chave
                    identificadas caem automaticamente na fila geral de triagem humana.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Sem registros suficientes no período selecionado.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking de Atividades: Onde a IA mais acerta e mais erra */}
        <Card className="lg:col-span-7 border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Taxa de Acerto e Correções por Atividade
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Sugestão IA vs. Categoria Final
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Atividades do catálogo onde o operador mais reclassifica (indica necessidade de
              melhorar palavras-chave ou artigos da base de conhecimento).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            {metrics && metrics.topCorrectedActivities.length > 0 ? (
              <div className="space-y-2">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b text-muted-foreground font-medium text-[11px]">
                      <tr>
                        <th className="p-2">Atividade Sugerida</th>
                        <th className="p-2 text-center">Total Sugerido</th>
                        <th className="p-2 text-center">Corrigidas</th>
                        <th className="p-2 text-center">Taxa de Erro</th>
                        <th className="p-2">Destino Frequente da Correção</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {metrics.topCorrectedActivities.map((act) => {
                        const topDestinations = Object.entries(act.finalCategoriesSummary)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 2)
                          .map(([name, count]) => `${name} (${count})`)
                          .join(', ')

                        return (
                          <tr key={act.categoryId} className="hover:bg-muted/30">
                            <td className="p-2 font-medium text-foreground">{act.categoryName}</td>
                            <td className="p-2 text-center font-mono">{act.totalSuggested}</td>
                            <td className="p-2 text-center font-mono text-amber-600 dark:text-amber-400 font-semibold">
                              {act.correctedCount}
                            </td>
                            <td className="p-2 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  act.errorRatePct >= 50
                                    ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {act.errorRatePct}%
                              </Badge>
                            </td>
                            <td className="p-2 text-[11px] text-muted-foreground">
                              {topDestinations || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-muted-foreground italic">
                  Dica: Para reduzir a taxa de erro nas atividades acima, adicione termos sinônimos
                  na descrição da atividade (Catálogo de Serviços) ou crie artigos direcionados na
                  Base de Conhecimento.
                </p>
              </div>
            ) : metrics && metrics.totalTriages > 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                <p className="font-medium text-foreground">
                  Nenhuma correção de operador registrada no período.
                </p>
                <p className="text-[11px]">
                  Todas as triagens da IA foram mantidas sem alteração de categoria pelos operadores
                  (100% de acurácia).
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Sem registros de triagem no período selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
