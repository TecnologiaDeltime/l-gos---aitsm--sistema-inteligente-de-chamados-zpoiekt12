import { cn } from '@/lib/utils'

interface ArticleRendererProps {
  contentHtml?: string
  fallbackContent?: string
  className?: string
}

export function ArticleRenderer({ contentHtml, fallbackContent, className }: ArticleRendererProps) {
  // Se tem HTML rico, renderiza diretamente
  if (contentHtml && contentHtml.trim().length > 0) {
    return (
      <div
        className={cn('kb-article-body leading-relaxed text-sm', className)}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    )
  }

  // Fallback se for conteúdo legado (texto simples com possíveis quebras de linha ou títulos simples)
  if (!fallbackContent) {
    return <p className="text-muted-foreground italic text-sm">Sem conteúdo cadastrado.</p>
  }

  return (
    <div className={cn('kb-article-body space-y-3 leading-relaxed text-sm', className)}>
      {fallbackContent.split('\n\n').map((paragraph, idx) => {
        // Se parecer cabeçalho markdown simples
        if (paragraph.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base font-semibold text-foreground mt-4 mb-2">
              {paragraph.replace('### ', '')}
            </h3>
          )
        }
        if (paragraph.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-lg font-bold text-foreground mt-4 mb-2">
              {paragraph.replace('## ', '')}
            </h2>
          )
        }
        if (paragraph.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-xl font-bold text-foreground mt-4 mb-2">
              {paragraph.replace('# ', '')}
            </h1>
          )
        }

        return (
          <p key={idx} className="text-foreground whitespace-pre-line">
            {paragraph}
          </p>
        )
      })}
    </div>
  )
}
