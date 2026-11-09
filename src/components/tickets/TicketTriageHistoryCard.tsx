import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Loader2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  getPortalTriageHistory,
  triggerPortalTriage,
  type PortalTriageHistoryItem,
} from '@/services/portal-triage'
import { useToast } from '@/hooks/use-toast'

interface TicketTriageHistoryCardProps {
  ticketId: string
  canReclassify?: boolean
  onReclassified?: () => void
}

export const TicketTriageHistoryCard: React.FC<TicketTriageHistoryCardProps> = ({
  ticketId,
  canReclassify = false,
  onReclassified,
}) => {
  const { toast } = useToast()
  const [history, setHistory] = useState<PortalTriageHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const loadHistory = async () => {
    if (!ticketId) return
    setLoading(true)
    try {
      const items = await getPortalTriageHistory(ticketId, 10)
      setHistory(items)
    } catch (err) {
      console.warn('Erro ao buscar histórico de triagem:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [ticketId])

  const handleRunTriage = async () => {
    if (!ticketId || running) return
    setRunning(true)
    try {
      const res = await triggerPortalTriage(ticketId)
      if (res?.applied) {
        toast({
          title: 'Triagem IA executada',
          description: `Chamado classificado com confiança de ${Math.round(
            (res.confidence || 0) * 100,
          )}%.`,
        })
      } else {
        toast({
          title: 'Triagem executada',
          description: res?.reason || 'Chamado mantido ou encaminhado à fila padrão pela IA.',
        })
      }
      await loadHistory()
      onReclassified?.()
    } catch (err: any) {
      toast({
        title: 'Falha na triagem IA',
        description: err?.message || 'Não foi possível reclassificar o chamado.',
        variant: 'destructive',
      })
    } finally {
      setRunning(false)
    }
  }

  const latest = history[0]

  return (
    <div className="itsm-card p-4 space-y-3.5 border border-purple-500/20 bg-purple-500/[0.02] shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          Triagem por IA
        </h3>
        <div className="flex items-center gap-1">
          {canReclassify && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRunTriage}
              disabled={running}
              className="h-7 text-xs px-2 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
              title="Solicitar nova análise de categorização para a IA"
            >
              {running ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RotateCw className="h-3 w-3 mr-1" />
              )}
              Reclassificar IA
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-2" />
          Consultando histórico da IA...
        </div>
      ) : history.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground space-y-1">
          <p>Nenhuma triagem de IA registrada para este chamado.</p>
          {canReclassify && (
            <p className="text-[11px] text-purple-600 dark:text-purple-400">
              Clique em &ldquo;Reclassificar IA&rdquo; para analisar com o catálogo.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 text-xs">
          {/* Card do último registro */}
          {latest && (
            <div className="p-3 rounded-lg border border-purple-500/20 bg-background/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Última Análise do Agente
                  </span>
                  <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                    {latest.suggested_category_name ? (
                      <span>{latest.suggested_category_name}</span>
                    ) : (
                      <span className="italic text-muted-foreground">
                        Sem atividade identificada
                      </span>
                    )}
                    {latest.suggested_subcategory_name && (
                      <span className="text-muted-foreground">
                        › {latest.suggested_subcategory_name}
                      </span>
                    )}
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    latest.applied
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  }`}
                >
                  {latest.applied ? (
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1 inline" />
                  )}
                  {latest.applied ? 'Aplicado' : 'Fila padrão'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground">Confiança IA: </span>
                  <strong className="text-foreground font-mono">
                    {typeof latest.confidence === 'number'
                      ? `${Math.round(latest.confidence * 100)}%`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Fila: </span>
                  <strong className="text-foreground">{latest.queue_name || 'Padrão'}</strong>
                </div>
              </div>

              {latest.reason && (
                <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2 rounded">
                  &ldquo;{latest.reason}&rdquo;
                </p>
              )}

              <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1">
                <span>
                  Método: {latest.match_method || 'ai_agent'} ({latest.source || 'portal'})
                </span>
                <span>{new Date(latest.created).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          )}

          {/* Histórico completo colapsável se houver mais de 1 */}
          {history.length > 1 && (
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full h-6 text-[11px] text-purple-700 dark:text-purple-300 p-0 hover:bg-transparent"
              >
                {expanded ? (
                  <span className="flex items-center gap-1">
                    <ChevronUp className="h-3 w-3" /> Ocultar histórico anterior (
                    {history.length - 1})
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ChevronDown className="h-3 w-3" /> Ver análises anteriores (
                    {history.length - 1})
                  </span>
                )}
              </Button>

              {expanded && (
                <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto pr-1">
                  {history.slice(1).map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded border border-border/60 bg-muted/20 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {item.suggested_category_name || 'Sem atividade'}
                          {item.suggested_subcategory_name &&
                            ` › ${item.suggested_subcategory_name}`}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round((item.confidence || 0) * 100)}%
                        </span>
                      </div>
                      {item.reason && (
                        <p className="text-muted-foreground text-[10px] line-clamp-2">
                          {item.reason}
                        </p>
                      )}
                      <div className="text-[10px] text-muted-foreground flex justify-between">
                        <span>{item.applied ? 'Aplicado' : 'Fila padrão'}</span>
                        <span>{new Date(item.created).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
