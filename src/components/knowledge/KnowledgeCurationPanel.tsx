import { useState, useEffect } from 'react'
import {
  RefreshCw,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  Clock,
  Layers,
  ChevronRight,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  KnowledgeCuration,
  getKnowledgeCurations,
  runKnowledgeCurationAnalysis,
  applyCurationSuggestion,
  rejectCurationSuggestion,
} from '@/services/knowledge'
import { useToast } from '@/hooks/use-toast'

interface KnowledgeCurationPanelProps {
  onApplied?: () => void
  canEdit?: boolean
}

export function KnowledgeCurationPanel({ onApplied, canEdit = true }: KnowledgeCurationPanelProps) {
  const { toast } = useToast()

  const [curations, setCurations] = useState<KnowledgeCuration[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modal de Detalhe e Ação
  const [modalOpen, setModalOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<KnowledgeCuration | null>(null)
  const [editableContent, setEditableContent] = useState('')
  const [editableSummary, setEditableSummary] = useState('')
  const [editableTags, setEditableTags] = useState('')
  const [actionNotes, setActionNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  const loadCurations = async () => {
    try {
      setLoading(true)
      const data = await getKnowledgeCurations()
      setCurations(data)
    } catch {
      toast({
        title: 'Erro ao carregar dados de cura',
        description: 'Não foi possível carregar os registros de monitoramento.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCurations()
  }, [])

  const handleRunAnalysis = async () => {
    if (!canEdit) {
      toast({
        title: 'Permissão necessária',
        description: 'Seu perfil tem apenas permissão de visualização para este recurso.',
        variant: 'destructive',
      })
      return
    }

    try {
      setAnalyzing(true)
      const res = await runKnowledgeCurationAnalysis()
      toast({
        title: 'Análise de integridade concluída!',
        description: `${res.flagged_count || 0} artigo(s) analisado(s) e atualizados com sugestões da IA.`,
      })
      await loadCurations()
    } catch (err: any) {
      toast({
        title: 'Erro na análise de curadoria',
        description: err.message || 'Falha ao executar o monitoramento algorítmico.',
        variant: 'destructive',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleOpenDetail = (cur: KnowledgeCuration) => {
    setActiveItem(cur)
    setEditableContent(cur.suggested_content || '')
    setEditableSummary(cur.suggested_summary || '')
    setEditableTags(cur.suggested_tags || '')
    setActionNotes(cur.action_notes || '')
    setModalOpen(true)
  }

  const handleApply = async () => {
    if (!activeItem) return
    if (!canEdit) {
      toast({
        title: 'Permissão insuficiente',
        description: 'Apenas operadores com nível Editar ou Configurar podem aplicar sugestões.',
        variant: 'destructive',
      })
      return
    }

    try {
      setProcessing(true)
      await applyCurationSuggestion(activeItem.id, {
        content: editableContent,
        summary: editableSummary,
        tags: editableTags,
        notes: actionNotes || 'Melhoria sugerida pela IA aceita e aplicada.',
      })

      toast({
        title: 'Melhorias aplicadas ao artigo!',
        description: 'O artigo da base de conhecimento foi atualizado com sucesso.',
      })

      setModalOpen(false)
      await loadCurations()
      if (onApplied) onApplied()
    } catch (err: any) {
      toast({
        title: 'Erro ao aplicar melhoria',
        description: err.message || 'Falha na atualização do artigo.',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!activeItem) return
    if (!canEdit) return

    if (!confirm('Deseja realmente recusar esta sugestão de melhoria?')) return

    try {
      setProcessing(true)
      await rejectCurationSuggestion(activeItem.id, actionNotes || 'Recusada pela equipe.')

      toast({
        title: 'Sugestão recusada',
        description: 'O status do diagnóstico foi atualizado para Recusada.',
      })

      setModalOpen(false)
      await loadCurations()
    } catch (err: any) {
      toast({
        title: 'Erro ao recusar',
        description: err.message || 'Falha ao recusar sugestão.',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const filteredCurations = curations.filter((c) => {
    if (statusFilter === 'all') return true
    return c.status === statusFilter
  })

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'Desatualizado':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1 text-[10px]"
          >
            <Clock className="h-3 w-3" /> Desatualizado
          </Badge>
        )
      case 'Incompleto':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-500 border-blue-500/30 gap-1 text-[10px]"
          >
            <FileQuestion className="h-3 w-3" /> Incompleto
          </Badge>
        )
      case 'Falhando em Resolver':
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-500 border-rose-500/30 gap-1 text-[10px]"
          >
            <AlertTriangle className="h-3 w-3" /> Falhando em Resolver
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-500 border-purple-500/30 gap-1 text-[10px]"
          >
            <ShieldAlert className="h-3 w-3" /> Múltiplos Fatores
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Box de Monitoramento & Cura de Dados */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500">
                <RefreshCw className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-foreground">
                Cura e Atualização Contínua de Artigos
              </h2>
              <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px]">
                Monitoramento Algorítmico + IA
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Algoritmos varrem constantemente a base de conhecimento para sinalizar artigos
              <strong> desatualizados</strong> (&gt; 60 dias sem revisão),
              <strong> incompletos</strong> (sem resumo, passos rasos ou sem tags) ou
              <strong> com baixa efetividade</strong>. Para cada caso, o agente nativo de IA gera
              uma proposta de melhoria detalhada para aprovação técnica.
            </p>
          </div>

          <Button
            onClick={handleRunAnalysis}
            disabled={analyzing || !canEdit}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm shrink-0 h-9 text-xs"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Diagnosticando Artigos...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Executar Varredura e Curadoria
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filtros de Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Filtrar status:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'Pendente', label: 'Pendentes de Ação' },
              { id: 'Aplicada', label: 'Melhorias Aplicadas' },
              { id: 'Recusada', label: 'Recusadas' },
            ].map((f) => (
              <Button
                key={f.id}
                variant={statusFilter === f.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(f.id)}
                className={`h-7 text-xs px-2.5 ${
                  statusFilter === f.id
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'text-muted-foreground'
                }`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadCurations}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar Lista
          </Button>
          <span className="text-xs text-muted-foreground">
            Total: <strong>{filteredCurations.length}</strong> diagnóstico(s)
          </span>
        </div>
      </div>

      {/* Grid de Artigos Sinalizados e Sugestões */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-border bg-card p-5 animate-pulse"
            />
          ))}
        </div>
      ) : filteredCurations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Base em ótimo estado!</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {statusFilter !== 'all'
              ? 'Nenhuma recomendação com o status selecionado.'
              : 'Nenhum artigo com alertas pendentes de curadoria. Clique em "Executar Varredura e Curadoria" para uma nova checagem com o agente de IA.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCurations.map((cur) => {
            const isPending = cur.status === 'Pendente'
            const isApplied = cur.status === 'Aplicada'
            const isRejected = cur.status === 'Recusada'

            return (
              <div
                key={cur.id}
                onClick={() => handleOpenDetail(cur)}
                className={`group relative rounded-xl border bg-card p-5 shadow-sm space-y-3 cursor-pointer transition-all flex flex-col justify-between hover:shadow-md ${
                  isPending
                    ? 'border-amber-500/40 hover:border-amber-500'
                    : isApplied
                      ? 'border-emerald-500/40'
                      : 'border-border opacity-75'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {getReasonBadge(cur.flag_reason)}

                    <Badge
                      variant="outline"
                      className={
                        isPending
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]'
                          : isApplied
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30 text-[10px]'
                      }
                    >
                      {cur.status}
                    </Badge>
                  </div>

                  {/* Título do Artigo */}
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-amber-500 transition-colors">
                      {cur.article_title}
                    </h3>
                  </div>

                  {/* Diagnóstico */}
                  {cur.diagnostic_details && (
                    <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5 border border-border">
                      <strong className="text-foreground">Diagnóstico: </strong>
                      {cur.diagnostic_details}
                    </p>
                  )}

                  {/* Sugestão da IA */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                      <Sparkles className="h-3.5 w-3.5" />
                      Sugestão de Melhoria (IA):
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {cur.suggested_improvements}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/80 pt-2.5 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(cur.created).toLocaleDateString('pt-BR')}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDetail(cur)}
                    className="h-7 px-2 text-[11px] text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 gap-1"
                  >
                    Ver Proposta e Ações <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Detalhe e Aplicação/Recusa da Sugestão */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Proposta de Melhoria de Artigo (IA)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Artigo: <strong className="text-foreground">{activeItem?.article_title}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Informações do Diagnóstico */}
            <div className="rounded-lg bg-secondary/50 p-3 border border-border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Motivo do Alerta:</span>
                {activeItem && getReasonBadge(activeItem.flag_reason)}
              </div>
              <p className="text-muted-foreground">{activeItem?.diagnostic_details}</p>
            </div>

            {/* Parecer das Melhorias */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Diagnóstico e Recomendações do Especialista (IA)
              </Label>
              <div className="p-3 rounded-lg border border-border bg-card text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {activeItem?.suggested_improvements}
              </div>
            </div>

            {/* Novo Resumo Proposto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resumo Sugerido</Label>
              <Textarea
                rows={2}
                value={editableSummary}
                onChange={(e) => setEditableSummary(e.target.value)}
                className="text-xs"
                disabled={!canEdit || activeItem?.status !== 'Pendente'}
              />
            </div>

            {/* Novo Conteúdo Proposto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Conteúdo Expandido / Corrigido (Markdown)
              </Label>
              <Textarea
                rows={6}
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                className="text-xs font-mono"
                disabled={!canEdit || activeItem?.status !== 'Pendente'}
              />
            </div>

            {/* Novas Tags Propostas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tags e Palavras-chave Sugeridas</Label>
              <Textarea
                rows={1}
                value={editableTags}
                onChange={(e) => setEditableTags(e.target.value)}
                className="text-xs"
                disabled={!canEdit || activeItem?.status !== 'Pendente'}
              />
            </div>

            {/* Observações da Equipe */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Justificativa / Parecer da Equipe</Label>
              <Textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Insira detalhes sobre a aplicação ou motivo de recusa..."
                className="text-xs"
                disabled={!canEdit || activeItem?.status !== 'Pendente'}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
            <div>
              {canEdit && activeItem?.status === 'Pendente' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReject}
                  disabled={processing}
                  className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Recusar Sugestão
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="text-xs"
              >
                Fechar
              </Button>

              {canEdit && activeItem?.status === 'Pendente' && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={processing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm"
                >
                  {processing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Aceitar e Atualizar Artigo Oficial
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
