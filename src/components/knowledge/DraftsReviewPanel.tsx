import { useState, useEffect } from 'react'
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  User,
  Ticket,
  Eye,
  Trash2,
  AlertCircle,
  UploadCloud,
  Loader2,
  RefreshCw,
  Edit3,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  KnowledgeDraft,
  getKnowledgeDrafts,
  generateDraftWithAi,
  updateKnowledgeDraft,
  deleteKnowledgeDraft,
  publishDraftToKnowledgeBase,
} from '@/services/knowledge'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

interface ClosedTicketOption {
  id: string
  number: string
  title: string
  solution: string
  assigned_to?: string
}

interface DraftsReviewPanelProps {
  onPublished?: () => void
  canEdit?: boolean
}

export function DraftsReviewPanel({ onPublished, canEdit = true }: DraftsReviewPanelProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [drafts, setDrafts] = useState<KnowledgeDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Chamados encerrados disponíveis para seleção direta
  const [closedTickets, setClosedTickets] = useState<ClosedTicketOption[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<string>('auto')

  // Modal de Revisão / Edição do Rascunho
  const [reviewOpen, setReviewOpen] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<KnowledgeDraft | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editProblem, setEditProblem] = useState('')
  const [editSteps, setEditSteps] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [savingAction, setSavingAction] = useState(false)

  const loadDrafts = async () => {
    try {
      setLoading(true)
      const data = await getKnowledgeDrafts()
      setDrafts(data)
    } catch {
      toast({
        title: 'Erro ao carregar rascunhos',
        description: 'Não foi possível buscar a fila de rascunhos de IA.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadClosedTickets = async () => {
    try {
      const records = await pb.collection('tickets').getList(1, 20, {
        filter: '(status = "Resolvido" || status = "Encerrado") && solution != ""',
        sort: '-resolution_date,-updated',
      })
      const mapped: ClosedTicketOption[] = records.items.map((r: any) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        solution: r.solution,
        assigned_to: r.assigned_to,
      }))
      setClosedTickets(mapped)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadDrafts()
    loadClosedTickets()
  }, [])

  const handleGenerate = async () => {
    if (!canEdit) {
      toast({
        title: 'Permissão necessária',
        description: 'Seu perfil possui apenas permissão de visualização para este recurso.',
        variant: 'destructive',
      })
      return
    }

    try {
      setGenerating(true)
      const targetTicketId = selectedTicketId === 'auto' ? undefined : selectedTicketId
      const res = await generateDraftWithAi(targetTicketId)

      toast({
        title: 'Rascunho criado com IA!',
        description:
          'O rascunho foi gerado a partir do chamado encerrado e adicionado à fila para revisão.',
      })

      await loadDrafts()

      // Abrir imediatamente o rascunho gerado para conferência
      if (res?.draft) {
        openReviewModal(res.draft)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar rascunho',
        description: err.message || 'Falha na comunicação com o assistente de IA.',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const openReviewModal = (draft: KnowledgeDraft) => {
    setCurrentDraft(draft)
    setEditTitle(draft.title || '')
    setEditSummary(draft.summary || '')
    setEditProblem(draft.problem_description || '')
    setEditSteps(draft.resolution_steps || '')
    setEditContent(draft.content || '')
    setEditTags(draft.tags || '')
    setReviewNotes(draft.review_notes || '')
    setReviewOpen(true)
  }

  const handleSaveDraftChanges = async () => {
    if (!currentDraft) return
    try {
      setSavingAction(true)
      await updateKnowledgeDraft(currentDraft.id, {
        title: editTitle,
        summary: editSummary,
        problem_description: editProblem,
        resolution_steps: editSteps,
        content: editContent,
        tags: editTags,
        review_notes: reviewNotes,
      })
      toast({
        title: 'Rascunho salvo',
        description: 'As alterações do rascunho foram atualizadas com sucesso.',
      })
      await loadDrafts()
      setReviewOpen(false)
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar o rascunho.',
        variant: 'destructive',
      })
    } finally {
      setSavingAction(false)
    }
  }

  const handlePublish = async () => {
    if (!currentDraft) return
    if (!canEdit) {
      toast({
        title: 'Permissão insuficiente',
        description: 'Apenas operadores com nível Editar ou Configurar podem aprovar/publicar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSavingAction(true)

      // Atualiza os dados editados primeiro
      const updatedDraft = {
        ...currentDraft,
        title: editTitle,
        summary: editSummary,
        problem_description: editProblem,
        resolution_steps: editSteps,
        content: editContent,
        tags: editTags,
        review_notes: reviewNotes,
      }

      await updateKnowledgeDraft(currentDraft.id, {
        title: editTitle,
        summary: editSummary,
        problem_description: editProblem,
        resolution_steps: editSteps,
        content: editContent,
        tags: editTags,
        review_notes: reviewNotes,
        status: 'Aprovado',
      })

      // Publica oficialmente na base de conhecimento
      await publishDraftToKnowledgeBase(updatedDraft, user?.id)

      toast({
        title: 'Artigo publicado na Base de Conhecimento!',
        description:
          'O rascunho foi revisado, aprovado e agora está disponível no catálogo de artigos da KB.',
      })

      setReviewOpen(false)
      await loadDrafts()
      if (onPublished) onPublished()
    } catch (err: any) {
      toast({
        title: 'Erro ao publicar',
        description: err.message || 'Falha ao transformar rascunho em artigo.',
        variant: 'destructive',
      })
    } finally {
      setSavingAction(false)
    }
  }

  const handleDiscard = async () => {
    if (!currentDraft) return
    if (!canEdit) return

    if (!confirm('Deseja realmente marcar este rascunho como Descartado?')) return

    try {
      setSavingAction(true)
      await updateKnowledgeDraft(currentDraft.id, {
        status: 'Descartado',
        review_notes: reviewNotes || 'Descartado pela equipe técnica durante a revisão.',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      toast({
        title: 'Rascunho descartado',
        description: 'O rascunho foi arquivado como Descartado.',
      })
      setReviewOpen(false)
      await loadDrafts()
    } catch {
      toast({
        title: 'Erro ao descartar',
        description: 'Não foi possível alterar o status do rascunho.',
        variant: 'destructive',
      })
    } finally {
      setSavingAction(false)
    }
  }

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canEdit) return
    if (!confirm('Deseja excluir permanentemente este rascunho?')) return

    try {
      await deleteKnowledgeDraft(id)
      toast({ title: 'Rascunho excluído' })
      loadDrafts()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const filteredDrafts = drafts.filter((d) => {
    if (statusFilter === 'all') return true
    return d.status === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* Box de Ação de Geração com IA */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-foreground">
                Geração Automática de Artigos por IA
              </h2>
              <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px]">
                ITIL 4 / Técnicos Seniores
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              A inteligência artificial analisa os chamados concluídos com sucesso, extrai a
              causa-raiz e os passos da solução deixados pelos técnicos seniores e cria um rascunho
              estruturado.
              <strong className="text-foreground ml-1">
                O rascunho nunca é publicado automaticamente:
              </strong>{' '}
              permanece nesta fila para que a equipe revise, edite e valide antes de publicar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="min-w-[220px]">
              <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Origem do chamado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Priorizar Técnicos Seniores (Automático)</SelectItem>
                  {closedTickets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      #{t.number} - {t.title.slice(0, 32)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || !canEdit}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm shrink-0 h-9 text-xs"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Gerando Rascunho...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Gerar Novo Rascunho
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Filtrar status:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'Pendente de Revisão', label: 'Pendente de Revisão' },
              { id: 'Aprovado', label: 'Aprovado' },
              { id: 'Publicado', label: 'Publicado' },
              { id: 'Descartado', label: 'Descartado' },
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
            onClick={loadDrafts}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar Fila
          </Button>
          <span className="text-xs text-muted-foreground">
            Total: <strong>{filteredDrafts.length}</strong> rascunho(s)
          </span>
        </div>
      </div>

      {/* Grid de Rascunhos */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-border bg-card p-5 animate-pulse"
            />
          ))}
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhum rascunho na fila</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {statusFilter !== 'all'
              ? 'Nenhum rascunho com o status selecionado.'
              : 'Clique em "Gerar Novo Rascunho" para que a IA analise chamados resolvidos e sugira artigos técnicos para aprovação da equipe.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDrafts.map((d) => {
            const isPending = d.status === 'Pendente de Revisão'
            const isPublished = d.status === 'Publicado'
            const isDiscarded = d.status === 'Descartado'

            return (
              <div
                key={d.id}
                onClick={() => openReviewModal(d)}
                className={`group relative rounded-xl border bg-card p-5 shadow-sm space-y-3 cursor-pointer transition-all flex flex-col justify-between hover:shadow-md ${
                  isPending
                    ? 'border-amber-500/40 hover:border-amber-500'
                    : isPublished
                      ? 'border-emerald-500/40'
                      : 'border-border opacity-75'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={
                        isPending
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : isPublished
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : isDiscarded
                              ? 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                      }
                    >
                      {d.status}
                    </Badge>

                    {d.source_ticket_number && (
                      <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                        <Ticket className="h-3 w-3 text-amber-500" />
                        Chamado: {d.source_ticket_number}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-amber-500 transition-colors">
                    {d.title}
                  </h3>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {d.summary || d.problem_description || d.content.slice(0, 120)}
                  </p>

                  {/* Informações da Fonte Senior */}
                  <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {d.source_technician_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        Técnico:{' '}
                        <strong className="text-foreground">{d.source_technician_name}</strong>
                      </span>
                    )}
                    {d.source_technician_seniority && (
                      <Badge variant="secondary" className="text-[10px] py-0">
                        {d.source_technician_seniority}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/80 pt-2.5 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(d.created).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(d.created).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openReviewModal(d)}
                      className="h-7 px-2 text-[11px] text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Eye className="mr-1 h-3 w-3" /> Revisar
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteDraft(d.id, e)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Revisão do Rascunho */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Revisão de Artigo Gerado por IA
            </DialogTitle>
            <DialogDescription className="text-xs">
              Valide o título, os passos da resolução e o conteúdo antes de aprovar ou publicar.
              {currentDraft?.source_ticket_number && (
                <span className="ml-1 text-foreground font-mono">
                  (Origem: Chamado #{currentDraft.source_ticket_number})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Aviso sobre técnico senior */}
            {currentDraft?.source_technician_name && (
              <div className="rounded-lg bg-secondary/50 p-3 border border-border text-xs flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Solução extraída de: </span>
                  <strong className="text-foreground">{currentDraft.source_technician_name}</strong>
                  {currentDraft.source_technician_seniority && (
                    <span className="ml-1 text-amber-500">
                      ({currentDraft.source_technician_seniority})
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Status: {currentDraft.status}
                </Badge>
              </div>
            )}

            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título do Artigo</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex: Como redefinir o perfil VPN corporativo"
                className="text-xs"
                disabled={!canEdit}
              />
            </div>

            {/* Resumo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resumo / Objetivo</Label>
              <Input
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="Resumo objetivo em uma ou duas frases"
                className="text-xs"
                disabled={!canEdit}
              />
            </div>

            {/* Problema e Sintoma */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descrição do Problema / Sintoma</Label>
              <Textarea
                rows={3}
                value={editProblem}
                onChange={(e) => setEditProblem(e.target.value)}
                placeholder="Descreva o sintoma ou erro enfrentado pelo usuário"
                className="text-xs"
                disabled={!canEdit}
              />
            </div>

            {/* Passos de Resolução */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Passos de Resolução (Passo a Passo)</Label>
              <Textarea
                rows={4}
                value={editSteps}
                onChange={(e) => setEditSteps(e.target.value)}
                placeholder="1. Passo um... 2. Passo dois..."
                className="text-xs font-mono"
                disabled={!canEdit}
              />
            </div>

            {/* Conteúdo Completo (Markdown) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Conteúdo Formatado Completo (Markdown)
              </Label>
              <Textarea
                rows={5}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="text-xs font-mono"
                disabled={!canEdit}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Palavras-chave e Tags (separadas por vírgula)
              </Label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="vpn, rede, autenticacao, suporte"
                className="text-xs"
                disabled={!canEdit}
              />
            </div>

            {/* Notas do Revisor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Parecer do Revisor (Opcional)</Label>
              <Input
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Observações da equipe técnica sobre este rascunho..."
                className="text-xs"
                disabled={!canEdit}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
            <div>
              {canEdit && currentDraft?.status !== 'Descartado' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={savingAction}
                  className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Descartar Rascunho
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewOpen(false)}
                className="text-xs"
              >
                Fechar
              </Button>

              {canEdit && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveDraftChanges}
                    disabled={savingAction}
                    className="text-xs"
                  >
                    Salvar Alterações
                  </Button>

                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={savingAction}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm"
                  >
                    {savingAction ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Aprovar e Publicar na KB
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
