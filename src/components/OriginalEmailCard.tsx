import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Mail,
  User,
  Calendar,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react'
import { sanitizeEmailHtml } from '@/lib/sanitize-email-html'
import type { TicketAttachmentRecord } from '@/services/attachments'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface OriginalEmailCardProps {
  fromName?: string
  fromEmail?: string
  toEmail?: string
  date?: string
  subject: string
  htmlContent?: string | null
  textContent?: string
  attachments?: TicketAttachmentRecord[]
  className?: string
  defaultExpanded?: boolean
}

export const OriginalEmailCard: React.FC<OriginalEmailCardProps> = ({
  fromName,
  fromEmail,
  toEmail,
  date,
  subject,
  htmlContent,
  textContent,
  attachments = [],
  className = '',
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isFullHeight, setIsFullHeight] = useState(false)

  // Sanitizar o HTML com injeção segura e resolução de cid:
  const sanitizedHtml = useMemo(() => {
    if (!htmlContent) return ''
    return sanitizeEmailHtml(htmlContent, attachments)
  }, [htmlContent, attachments])

  const formattedDate = useMemo(() => {
    if (!date) return ''
    try {
      return format(new Date(date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    } catch {
      return date
    }
  }, [date])

  const nonInlineAttachments = useMemo(() => {
    return attachments.filter((att) => !att.content_id)
  }, [attachments])

  return (
    <Card className={`border-border/70 shadow-sm overflow-hidden bg-card ${className}`}>
      {/* Cabeçalho do Card estilo Cliente de E-mail Moderno */}
      <CardHeader className="bg-muted/40 p-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base text-foreground truncate">
                  {fromName || fromEmail || 'Remetente Desconhecido'}
                </span>
                {fromEmail && fromName && (
                  <span className="text-xs text-muted-foreground truncate">
                    &lt;{fromEmail}&gt;
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="text-[11px] font-normal bg-background/80 ml-auto sm:ml-0"
                >
                  E-mail Original
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                {toEmail && (
                  <span className="truncate">
                    <span className="font-medium text-foreground/80">Para:</span> {toEmail}
                  </span>
                )}
                {formattedDate && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formattedDate}
                  </span>
                )}
              </div>

              <div className="text-xs sm:text-sm font-medium text-foreground mt-1.5 flex items-center gap-1.5">
                <span className="text-muted-foreground font-normal">Assunto:</span>
                <span className="truncate">{subject}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {sanitizedHtml && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsFullHeight(!isFullHeight)}
                title={isFullHeight ? 'Modo normal de rolagem' : 'Expandir altura total'}
              >
                {isFullHeight ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Recolher e-mail' : 'Expandir e-mail'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Anexos diretos do e-mail */}
        {nonInlineAttachments.length > 0 && isExpanded && (
          <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              {nonInlineAttachments.length} {nonInlineAttachments.length === 1 ? 'anexo' : 'anexos'}
              :
            </span>
            {nonInlineAttachments.map((att) => {
              const fileUrl = att.file ? `/api/files/ticket_attachments/${att.id}/${att.file}` : '#'
              return (
                <a
                  key={att.id}
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs bg-background/80 hover:bg-background border border-border/70 hover:border-primary/50 text-foreground px-2.5 py-1 rounded-md transition-colors"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[150px] truncate">{att.file_name || 'anexo'}</span>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </a>
              )
            })}
          </div>
        )}
      </CardHeader>

      {/* Corpo do E-mail */}
      {isExpanded && (
        <CardContent className="p-0">
          <div
            className={`w-full overflow-x-auto p-4 sm:p-6 transition-all duration-200 ${
              isFullHeight ? 'max-h-none' : 'max-h-[550px] overflow-y-auto'
            }`}
          >
            {sanitizedHtml ? (
              <div
                className="email-html-body prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed font-sans"
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : textContent ? (
              <div className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">
                {textContent}
              </div>
            ) : (
              <div className="text-sm italic text-muted-foreground">
                (E-mail sem conteúdo textual no corpo)
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
