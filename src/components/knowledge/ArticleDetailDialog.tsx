import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Calendar,
  Eye,
  FileDown,
  Layers,
  Tag,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import {
  KnowledgeArticle,
  getArticleAttachmentUrl,
  incrementArticleViews,
} from '@/services/knowledge'
import { ArticleRenderer } from '@/components/knowledge/ArticleRenderer'

interface ArticleDetailDialogProps {
  article: KnowledgeArticle | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (article: KnowledgeArticle) => void
  onDelete?: (article: KnowledgeArticle) => void
}

export function ArticleDetailDialog({
  article,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ArticleDetailDialogProps) {
  const [views, setViews] = useState(article?.views || 0)

  useEffect(() => {
    if (article && open) {
      setViews(article.views || 0)
      // Incrementa visualização
      incrementArticleViews(article.id, article.views).then((res) => {
        if (res?.views) setViews(res.views)
      })
    }
  }, [article?.id, open])

  if (!article) return null

  const tokens = Array.isArray(article.tokens)
    ? article.tokens
    : article.tags
      ? article.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []

  const attachmentUrl = getArticleAttachmentUrl(article)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Cabeçalho do Artigo */}
        <DialogHeader className="p-6 pb-4 border-b bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {article.expand?.category && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Layers className="mr-1 h-3 w-3 text-blue-600" />
                  {article.expand.category.name}
                </Badge>
              )}
              {article.expand?.activity && (
                <Badge
                  variant="outline"
                  className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                >
                  <Layers className="mr-1 h-3 w-3 text-indigo-600" />
                  Atividade: {article.expand.activity.name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onEdit(article)
                  }}
                  className="h-8 text-xs gap-1"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                  <span>Editar</span>
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onDelete(article)
                  }}
                  className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
            {article.title}
          </DialogTitle>

          {article.summary && (
            <p className="text-xs sm:text-sm text-muted-foreground pt-1 leading-relaxed">
              {article.summary}
            </p>
          )}

          {/* Metadados: data, visualizações, autor */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-3 border-t mt-3">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(article.created).toLocaleDateString('pt-BR')}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {views} visualizações
            </span>
            {article.expand?.author && <span>Autor: {article.expand.author.name}</span>}
          </div>
        </DialogHeader>

        {/* Corpo do Artigo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Anexo de Documento (se houver) */}
          {article.attachment && attachmentUrl && (
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <FileDown className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                    Documento Anexo (Manual / Guia)
                  </span>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {article.attachment_name || article.attachment}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Baixar / Abrir</span>
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </div>
            </div>
          )}

          {/* Conteúdo Renderizado (HTML Rico ou fallback texto simples) */}
          <ArticleRenderer contentHtml={article.content_html} fallbackContent={article.content} />

          {/* Tokens / Tags associados */}
          {tokens.length > 0 && (
            <div className="pt-6 border-t space-y-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                Tokens e Palavras-Chave de Associação:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tokens.map((token) => (
                  <Badge
                    key={token}
                    variant="secondary"
                    className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                  >
                    #{token}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
