import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  FileText,
  Clock,
  Sparkles,
  Shield,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { AtendimentoDossie, AtendimentoConversa } from '@/types/atendimento'
import { Link } from 'react-router-dom'

interface DossieModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossie: AtendimentoDossie | null
  conversa: AtendimentoConversa | null
  onAceitar?: () => void
  isAceitando?: boolean
}

export function DossieHandoffModal({
  open,
  onOpenChange,
  dossie,
  conversa,
  onAceitar,
  isAceitando = false,
}: DossieModalProps) {
  if (!dossie || !conversa) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <DialogTitle className="text-base font-bold">
                Dossiê de Handoff Contextualizado
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                Canal: {conversa.canal}
              </Badge>
              <Badge
                className={`text-xs font-semibold ${
                  conversa.prioridade === 'P1'
                    ? 'bg-red-600 text-white'
                    : conversa.prioridade === 'P2'
                      ? 'bg-orange-500 text-black'
                      : conversa.prioridade === 'P3'
                        ? 'bg-amber-400 text-black'
                        : 'bg-muted text-muted-foreground'
                }`}
              >
                {conversa.prioridade}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Sintetizado factual da conversa para transferência invisível sem repetição de dados pelo
            cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Headline em destaque */}
        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold text-sm">
          {dossie.headline}
        </div>

        {/* Linha do tempo de eventos do handoff */}
        {dossie.eventos_handoff && dossie.eventos_handoff.length > 0 && (
          <div className="p-2.5 rounded bg-muted/40 border border-border text-xs">
            <h4 className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Ordem de Eventos do Handoff (Log Factual)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {dossie.eventos_handoff.map((ev, i) => (
                <div key={i} className="p-2 rounded bg-card border border-border/80">
                  <div className="font-semibold text-[11px] text-foreground">{ev.etapa}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{ev.descricao}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Coluna Principal: Fatos, Narrativa e Passos */}
          <div className="md:col-span-2 space-y-4">
            {/* Narrativa factual */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Narrativa Factual da Interação
              </h4>
              <p className="text-xs leading-relaxed text-foreground bg-muted/20 p-2.5 rounded border border-border">
                {dossie.narrativa}
              </p>
            </div>

            {/* Objetivo do cliente */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Objetivo do Cliente
              </h4>
              <div className="text-xs font-medium bg-muted/30 p-2.5 rounded border border-border flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{dossie.objetivo_cliente}</span>
              </div>
            </div>

            {/* Passos tomados */}
            {dossie.passos_tomados && dossie.passos_tomados.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Passos Tomados Antes do Handoff
                </h4>
                <ul className="space-y-1 text-xs">
                  {dossie.passos_tomados.map((p, idx) => (
                    <li
                      key={idx}
                      className="p-1.5 rounded bg-muted/30 border border-border/60 flex items-start gap-2"
                    >
                      <span className="font-mono text-amber-500 text-[10px] mt-0.5">
                        {idx + 1}.
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Artigos tentados da base */}
            {dossie.artigos_tentados && dossie.artigos_tentados.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  Artigos Consultados na Base de Conhecimento
                </h4>
                <div className="space-y-1.5">
                  {dossie.artigos_tentados.map((art, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded border bg-card text-xs flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{art.titulo}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            art.resultado === 'sucesso'
                              ? 'text-emerald-500 border-emerald-500/30'
                              : art.resultado === 'parcial'
                                ? 'text-amber-500 border-amber-500/30'
                                : 'text-red-500 border-red-500/30'
                          }`}
                        >
                          {art.resultado}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{art.motivoFalha}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna Lateral: Roteamento por Aptidão, Riscos e Próxima Ação */}
          <div className="space-y-4">
            {/* Bloco de Roteamento por Aptidão */}
            <div className="p-3 rounded-md bg-muted/30 border border-border space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                Roteamento por Aptidão
              </h4>
              <div className="text-xs space-y-1">
                {dossie.roteamento_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Score calculado:</span>
                    <span className="font-mono font-bold text-amber-500">
                      {dossie.roteamento_score} pts
                    </span>
                  </div>
                )}
                {dossie.expand?.agente_sugerido && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Agente indicado:</span>
                    <span className="font-medium">{dossie.expand.agente_sugerido.name}</span>
                  </div>
                )}
              </div>
              {dossie.roteamento_justificativa && (
                <p className="text-[11px] text-muted-foreground border-t border-border pt-2 leading-relaxed">
                  {dossie.roteamento_justificativa}
                </p>
              )}
            </div>

            {/* Riscos identificados */}
            {dossie.riscos && dossie.riscos.length > 0 && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Riscos Críticos Mapeados
                </h4>
                <ul className="space-y-1 text-[11px] text-red-600 dark:text-red-300">
                  {dossie.riscos.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span>•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Perguntas abertas */}
            {dossie.perguntas_abertas && dossie.perguntas_abertas.length > 0 && (
              <div className="p-3 rounded-md bg-muted/30 border border-border space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  Perguntas Abertas Sugeridas
                </h4>
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {dossie.perguntas_abertas.map((pq, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">?</span>
                      <span>{pq}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Próxima ação recomendada */}
            <div className="p-3 rounded-md bg-amber-500/15 border border-amber-500/40 space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Próxima Ação Recomendada
              </h4>
              <p className="text-xs text-foreground leading-relaxed font-medium">
                {dossie.proxima_acao_recomendada}
              </p>
            </div>

            {/* Link para o chamado se já vinculado */}
            {conversa.chamado_vinculado && (
              <div className="p-2.5 rounded bg-muted/40 border border-border text-xs flex items-center justify-between">
                <span>Chamado vinculado:</span>
                <Link
                  to={`/tickets/${conversa.chamado_vinculado}`}
                  className="font-mono text-amber-500 hover:underline flex items-center gap-1"
                >
                  Ver chamado
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {dossie.aceito_at ? (
              <span>Aceito em {new Date(dossie.aceito_at).toLocaleTimeString('pt-BR')}</span>
            ) : (
              <span>Aguardando confirmação do operador</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {onAceitar && conversa.estado !== 'HUMANO_ATIVO' && conversa.estado !== 'RESOLVIDA' && (
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={onAceitar}
                disabled={isAceitando}
              >
                {isAceitando ? 'Assumindo...' : 'Aceitar Atendimento (Humano Ativo)'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
