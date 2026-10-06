import { useEffect, useState, useMemo } from 'react'
import {
  BookOpen,
  Search,
  Plus,
  FileDown,
  Layers,
  Tag,
  Pencil,
  Trash2,
  Filter,
  X,
  FileText,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getKnowledgeArticles,
  deleteKnowledgeArticle,
  KnowledgeArticle,
  getArticleAttachmentUrl,
} from '@/services/knowledge'
import { getCategories, CategoryRecord } from '@/services/categories'
import { ArticleDialog } from '@/components/knowledge/ArticleDialog'
import { ArticleDetailDialog } from '@/components/knowledge/ArticleDetailDialog'
import { useToast } from '@/hooks/use-toast'

export default function KnowledgeBase() {
  const { toast } = useToast()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedActivity, setSelectedActivity] = useState<string>('all')
  const [selectedToken, setSelectedToken] = useState<string>('all')

  // Modais
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null)
  const [detailArticle, setDetailArticle] = useState<KnowledgeArticle | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [artData, catData] = await Promise.all([getKnowledgeArticles(), getCategories()])
      setArticles(artData)
      setCategories(catData)
    } catch {
      toast({
        title: 'Erro ao carregar artigos',
        description: 'Não foi possível carregar os dados da base de conhecimento.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Lista única de tokens presentes nos artigos para popular o filtro
  const allTokens = useMemo(() => {
    const set = new Set<string>()
    articles.forEach((art) => {
      const artTokens = Array.isArray(art.tokens)
        ? art.tokens
        : art.tags
          ? art.tags.split(',').map((t) => t.trim().toLowerCase())
          : []
      artTokens.forEach((t) => {
        if (t) set.add(t)
      })
    })
    return Array.from(set).sort()
  }, [articles])

  // Atividades do catálogo (subcategorias)
  const activities = useMemo(() => {
    return categories.filter((c) => !!c.parent)
  }, [categories])

  // Filtro composto: busca texto + atividade + token
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return articles.filter((a) => {
      // 1. Busca textual no título, resumo, tokens e conteúdo
      const artTokens = Array.isArray(a.tokens)
        ? a.tokens
        : a.tags
          ? a.tags.split(',').map((t) => t.trim().toLowerCase())
          : []

      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.summary && a.summary.toLowerCase().includes(q)) ||
        (a.content && a.content.toLowerCase().includes(q)) ||
        artTokens.some((t) => t.toLowerCase().includes(q))

      if (!matchesSearch) return false

      // 2. Filtro por atividade associada
      if (selectedActivity !== 'all') {
        if (a.activity !== selectedActivity && a.category !== selectedActivity) {
          return false
        }
      }

      // 3. Filtro por token
      if (selectedToken !== 'all') {
        if (!artTokens.includes(selectedToken.toLowerCase())) {
          return false
        }
      }

      return true
    })
  }, [articles, search, selectedActivity, selectedToken])

  const handleCreate = () => {
    setEditingArticle(null)
    setDialogOpen(true)
  }

  const handleEdit = (art: KnowledgeArticle) => {
    setEditingArticle(art)
    setDialogOpen(true)
  }

  const handleOpenDetail = (art: KnowledgeArticle) => {
    setDetailArticle(art)
    setDetailOpen(true)
  }

  const handleDelete = async (art: KnowledgeArticle) => {
    if (!confirm(`Tem certeza de que deseja excluir o artigo "${art.title}"?`)) {
      return
    }

    try {
      await deleteKnowledgeArticle(art.id)
      toast({
        title: 'Artigo excluído',
        description: 'O artigo foi removido com sucesso.',
      })
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o artigo.',
        variant: 'destructive',
      })
    }
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedActivity('all')
    setSelectedToken('all')
  }

  const hasActiveFilters = search || selectedActivity !== 'all' || selectedToken !== 'all'

  return (
    <div className="space-y-6">
      {/* Topo / Barra de Ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Base de Conhecimento
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Procedimentos operacionais padrão, manuais técnicos e guias associados ao catálogo de
            atividades.
          </p>
        </div>

        <Button
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Criar Artigo
        </Button>
      </div>

      {/* Barra de Busca e Filtros Avançados (Token + Atividade do Catálogo) */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Busca por texto */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Pesquisar por título, texto ou procedimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtro por Atividade do Catálogo */}
          <div>
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Todas as Atividades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Atividades</SelectItem>
                {activities.map((act) => (
                  <SelectItem key={act.id} value={act.id}>
                    {act.name} {act.expand?.parent ? `(${act.expand.parent.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Token */}
          <div>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Todos os Tokens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tokens</SelectItem>
                {allTokens.map((tok) => (
                  <SelectItem key={tok} value={tok}>
                    #{tok}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha de status de filtros ativos */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground border-t">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Mostrando <strong>{filtered.length}</strong> de {articles.length} artigo(s)
            </span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700"
              >
                <X className="mr-1 h-3 w-3" /> Limpar filtros
              </Button>
            )}
          </div>

          {/* Sugestão de tokens rápidos clicáveis */}
          {allTokens.length > 0 && selectedToken === 'all' && (
            <div className="hidden sm:flex items-center gap-1 overflow-hidden">
              <span className="text-[11px] text-muted-foreground shrink-0">Tokens populares:</span>
              <div className="flex gap-1 overflow-x-auto max-w-md">
                {allTokens.slice(0, 6).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedToken(t)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 transition-colors"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid de Artigos */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-border bg-card p-5 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center dark:bg-blue-950/40">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhum artigo encontrado</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Tente ajustar os termos de pesquisa ou remover os filtros de atividade e tokens.'
              : 'Nenhum artigo cadastrado na base de conhecimento. Comece criando o primeiro procedimento!'}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
              Limpar Filtros
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar Primeiro Artigo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((art) => {
            const tokens = Array.isArray(art.tokens)
              ? art.tokens
              : art.tags
                ? art.tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : []
            const attachmentUrl = getArticleAttachmentUrl(art)

            return (
              <div
                key={art.id}
                onClick={() => handleOpenDetail(art)}
                className="group relative rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* Categorias & Atividade */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {art.expand?.category && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          <Layers className="mr-1 h-2.5 w-2.5 text-blue-600" />
                          {art.expand.category.name}
                        </Badge>
                      )}
                      {art.expand?.activity && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                        >
                          <Layers className="mr-1 h-2.5 w-2.5 text-indigo-600" />
                          {art.expand.activity.name}
                        </Badge>
                      )}
                    </div>

                    {/* Botões de Ação Rápida */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Editar artigo"
                        onClick={() => handleEdit(art)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500 hover:text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        title="Excluir artigo"
                        onClick={() => handleDelete(art)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Título */}
                  <div className="flex items-start gap-2 text-blue-600">
                    <BookOpen className="h-5 w-5 shrink-0 mt-0.5" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-blue-600 transition-colors">
                      {art.title}
                    </h3>
                  </div>

                  {/* Resumo */}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {art.summary || art.content.slice(0, 160)}
                  </p>

                  {/* Documento Anexo (se existir) */}
                  {art.attachment && attachmentUrl && (
                    <div
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-[11px] text-blue-700 dark:text-blue-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileDown className="h-3.5 w-3.5 text-blue-600" />
                      <span className="font-medium truncate max-w-[200px]">
                        {art.attachment_name || 'Documento Anexo'}
                      </span>
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="underline hover:text-blue-800 ml-1"
                      >
                        Baixar
                      </a>
                    </div>
                  )}

                  {/* Badges de Tokens */}
                  {tokens.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tokens.map((token) => (
                        <Badge
                          key={token}
                          variant="secondary"
                          className="text-[10px] px-2 py-0 bg-indigo-50/70 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900"
                        >
                          #{token}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rodapé com visualizações e data */}
                <div className="flex justify-between items-center text-[11px] text-muted-foreground border-t pt-2.5 mt-2">
                  <span>{new Date(art.created).toLocaleDateString('pt-BR')}</span>
                  <span>{art.views || 0} visualizações</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <ArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        articleToEdit={editingArticle}
        onSuccess={loadData}
      />

      {/* Modal de Detalhe Completo do Artigo */}
      <ArticleDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        article={detailArticle}
        onEdit={(art) => handleEdit(art)}
        onDelete={(art) => handleDelete(art)}
      />
    </div>
  )
}
