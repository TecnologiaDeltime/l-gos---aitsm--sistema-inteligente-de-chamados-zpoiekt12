/**
 * Bolha de mensagem do chat interno com suporte a:
 * - destaque de busca (splitTextWithHighlight);
 * - menções `@` (cartão clicável que navega para o item citado);
 * - anexos (imagem inline, player de áudio, player de vídeo).
 */
import { memo } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { splitTextWithHighlight, extractSearchTokens, normalizeSearchText } from '@/lib/search-text'
import { splitMentionSegments } from '@/lib/chat-mentions'
import { ChatMentionCard } from '@/components/chat/ChatMentionCard'
import { formatChatTime } from '@/lib/chat-format'
import {
  getChatMessageFileUrl,
  getChatAttachmentKind,
  OperatorChatMessage,
} from '@/services/operator-chat'

interface ChatMessageBubbleProps {
  message: OperatorChatMessage
  isMe: boolean
  senderName: string
  senderAvatar?: string
  searchQuery: string
}

/** Conta quantos trechos de busca uma mensagem contém (para a contagem global). */
export function countMessageMatches(content: string, query: string): number {
  if (!query.trim()) return 0
  const tokens = extractSearchTokens(query)
  if (tokens.length === 0) return 0
  const norm = normalizeSearchText(content)
  if (!norm) return 0
  let count = 0
  for (const token of tokens) {
    let idx = 0
    while (idx <= norm.length) {
      const found = norm.indexOf(token, idx)
      if (found === -1) break
      count += 1
      idx = found + token.length
    }
  }
  return count
}

/** Imagem inline, player de áudio e player de vídeo do anexo da mensagem. */
function MessageAttachment({ message }: { message: OperatorChatMessage }) {
  const kind = getChatAttachmentKind(message)
  if (!kind) {
    return message.file ? (
      <a
        href={getChatMessageFileUrl(message)}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block text-[11px] underline underline-offset-2"
      >
        📎 {message.file}
      </a>
    ) : null
  }
  const url = getChatMessageFileUrl(message)
  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <img
          src={url}
          alt={message.file || 'Imagem anexada'}
          className="max-h-64 w-auto max-w-full rounded-lg border border-black/10 object-contain"
        />
      </a>
    )
  }
  if (kind === 'audio') {
    return <audio controls src={url} className="mt-1 h-9 w-56 max-w-full" preload="metadata" />
  }
  return (
    <video
      controls
      src={url}
      preload="metadata"
      className="mt-1 max-h-64 w-full max-w-[260px] rounded-lg border border-black/10"
    />
  )
}

/** Texto da mensagem com destaque da busca e menções renderizadas como cartões. */
function MessageBody({
  message,
  isMe,
  searchQuery,
}: {
  message: OperatorChatMessage
  isMe: boolean
  searchQuery: string
}) {
  const mentionSegments = splitMentionSegments(message.content)
  const hasSearch = !!searchQuery.trim()

  return (
    <>
      {mentionSegments.map((seg, idx) => {
        if (seg.type === 'mention' && seg.mention) {
          return (
            <ChatMentionCard
              key={`mention-${idx}`}
              entityType={seg.mention.entityType}
              entityId={seg.mention.entityId}
              mine={isMe}
            />
          )
        }
        if (!seg.value.trim()) return seg.value ? <span key={`t-${idx}`}>{seg.value}</span> : null
        // Dentro do trecho comum: aplica highlight se houver busca ativa
        if (hasSearch) {
          return (
            <span key={`t-${idx}`} className="whitespace-pre-wrap">
              {splitTextWithHighlight(seg.value, searchQuery).map((h, hIdx) =>
                h.isMatch ? (
                  <mark
                    key={hIdx}
                    className="rounded bg-amber-300 px-0.5 font-bold text-amber-950 dark:bg-amber-400/90 dark:text-zinc-950"
                  >
                    {h.text}
                  </mark>
                ) : (
                  <span key={hIdx}>{h.text}</span>
                ),
              )}
            </span>
          )
        }
        return (
          <span key={`t-${idx}`} className="whitespace-pre-wrap">
            {seg.value}
          </span>
        )
      })}
    </>
  )
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  isMe,
  senderName,
  senderAvatar,
  searchQuery,
}: ChatMessageBubbleProps) {
  const timeStr = formatChatTime(message)
  const showSenderName = !isMe

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <Avatar className="h-6 w-6 mb-1 shrink-0">
          {senderAvatar && <AvatarImage src={senderAvatar} />}
          <AvatarFallback className="bg-amber-500/20 text-amber-500 text-[10px] font-bold">
            {senderName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        {showSenderName && (
          <span className="px-1 text-[10px] font-semibold text-muted-foreground">{senderName}</span>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 text-xs shadow-sm break-words whitespace-pre-wrap ${
            isMe
              ? 'bg-amber-500 text-slate-950 font-medium rounded-br-sm'
              : 'bg-muted text-foreground border border-border rounded-bl-sm'
          }`}
        >
          <MessageBody message={message} isMe={isMe} searchQuery={searchQuery} />
          <MessageAttachment message={message} />
          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
              isMe ? 'text-slate-900/80' : 'text-muted-foreground'
            }`}
          >
            <span>{timeStr}</span>
            {isMe &&
              (message.read ? (
                <CheckCheck className="h-3 w-3 text-emerald-800 dark:text-emerald-950" />
              ) : (
                <Check className="h-3 w-3 text-slate-800/60" />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
})
