import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { ChatOperatorUser } from '@/services/operator-chat'
import {
  ChatHistoryMessage,
  getChatHistory,
  getChatHistoryOperators,
  summarizeChatHistory,
} from '@/services/chat-history'
import { formatDateTime } from '@/lib/date-format'
import { splitTextWithHighlight } from '@/lib/search-text'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  History,
  Search,
  MessageSquare,
  Users,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface ConversationGroup {
  key: string
  participantIds: string[]
  participants: Array<ChatOperatorUser | undefined>
  messages: ChatHistoryMessage[]
  lastAt: string
  matchingCount: number
}

export default function ChatHistoryPage() {
  const { user } = useAuth()
  const permissions = usePermissions()
  const [operators, setOperators] = useState<ChatOperatorUser[]>([])
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const canOpenChat = permissions.canAccessItem('chat', 'chat_operadores')

  // Carrega operadores para o filtro
  useEffect(() => {
    let cancelled = false
    getChatHistoryOperators()
      .then((list) => {
        if (!cancelled) setOperators(list)
      })
      .catch((err) => console.error('Erro ao carregar operadores:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Consulta o histórico sempre que os filtros mudam (somente leitura)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const list = await getChatHistory({
          operatorId: operatorFilter === 'all' ? undefined : operatorFilter,
          from: from || undefined,
          to: to || undefined,
          search: search || undefined,
        })
        if (!cancelled) setMessages(list)
      } catch (err) {
        console.error('Erro ao carregar histórico de chat:', err)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadedOnce(true)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [operatorFilter, from, to, search])

  const summary = useMemo(() => summarizeChatHistory(messages), [messages])

  // Agrupa as mensagens por conversa (par de participantes), ordenada da mais recente
  const conversations = useMemo<ConversationGroup[]>(() => {
    const userById = new Map<string, ChatOperatorUser>()
    for (const m of messages) {
      for (const p of [m.expand?.sender, m.expand?.recipient]) {
        if (p?.id) userById.set(p.id, p as ChatOperatorUser)
      }
    }

    const map = new Map<
      string,
      { participantIds: string[]; messages: ChatHistoryMessage[]; lastAt: string }
    >()
    for (const m of messages) {
      const senderId = String(m.sender)
      const recipientId = String(m.recipient)
      if (!senderId || !recipientId) continue
      const key = [senderId, recipientId].sort().join('__')
      let entry = map.get(key)
      if (!entry) {
        entry = { participantIds: [senderId, recipientId], messages: [], lastAt: m.created }
        map.set(key, entry)
      }
      entry.messages.push(m)
      if (m.created > entry.lastAt) entry.lastAt = m.created
    }

    const list: ConversationGroup[] = Array.from(map.entries()).map(([key, entry]) => ({
      key,
      participantIds: entry.participantIds,
      participants: entry.participantIds.map((id) => userById.get(id)),
      messages: [...entry.messages].sort((a, b) => (a.created < b.created ? -1 : 1)),
      lastAt: entry.lastAt,
      matchingCount: entry.messages.length,
    }))

    list.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
    return list
  }, [messages])

  const operatorLabel = (id: string): string => {
    const byFilter = operators.find((o) => o.id === id)
    if (byFilter?.name) return byFilter.name
    for (const m of messages) {
      if (m.expand?.sender?.id === id && m.expand.sender.name) return m.expand.sender.name
      if (m.expand?.recipient?.id === id && m.expand.recipient.name) return m.expand.recipient.name
    }
    return 'Operador'
  }

  const hasFilters = operatorFilter !== 'all' || !!from || !!to || !!search

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-500">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Histórico de Chat por Operador
            </h1>
            <p className="text-xs text-muted-foreground">
              Consulta de todas as conversas e mensagens trocadas no chat interno entre operadores
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canOpenChat && (
            <Button asChild variant="outline" size="sm" className="h-9 text-xs">
              <Link to="/chat">
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Abrir Chat em Tempo Real
              </Link>
            </Button>
          )}
          <Badge variant="outline" className="flex items-center gap-1.5 py-1 text-xs">
            Consulta somente leitura
          </Badge>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-border bg-card p-3">
        <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-12">
          <div className="space-y-1 md:col-span-4">
            <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Users className="h-3 w-3" /> Operador (remetente ou destinatário)
            </label>
            <Select value={operatorFilter} onValueChange={(v) => setOperatorFilter(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos os operadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os operadores</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                    {op.email ? ` (${op.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" /> De
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" /> Até
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1 md:col-span-4">
            <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Search className="h-3 w-3" /> Buscar no conteúdo
            </label>
            <div className="relative">
              <Input
                placeholder="Busca por termos, palavras múltiplas, sem acentos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pr-7 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  title="Limpar busca de texto"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {search.trim() ? (
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
            >
              <Search className="mr-1 h-3 w-3" />
              {summary.total} mensagem(ens) encontrada(s) com o termo &ldquo;{search.trim()}&rdquo;
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {summary.total} mensagem(ens)
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {summary.conversations} conversa(s)
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {summary.participants} participante(s)
          </Badge>
          {summary.firstMessageAt && summary.lastMessageAt && (
            <span>
              Período efetivo: {formatDateTime(summary.firstMessageAt)} →{' '}
              {formatDateTime(summary.lastMessageAt)}
            </span>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setOperatorFilter('all')
                setFrom('')
                setTo('')
                setSearch('')
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Listagem agrupada por conversa, em ordem cronológica */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card">
        <ScrollArea className="flex-1">
          {loading && !loadedOnce ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Consultando histórico...
            </div>
          ) : loadedOnce && conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhuma mensagem encontrada para os filtros aplicados.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {conversations.map((conv) => {
                const isExpanded = expandedKey === conv.key
                const otherName = conv.participantIds.map((id) => operatorLabel(id)).join(' ⇄ ')
                return (
                  <div key={conv.key} className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(isExpanded ? null : conv.key)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2.5">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex -space-x-2">
                          {conv.participants.map((p, idx) => (
                            <Avatar key={idx} className="h-7 w-7 border border-border">
                              {p?.avatar ? (
                                <AvatarImage src={p.avatar} alt={p.name || 'Operador'} />
                              ) : null}
                              <AvatarFallback className="text-[10px]">
                                {(p?.name || operatorLabel(conv.participantIds[idx]))
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {otherName}
                            </span>
                            {search.trim() && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                              >
                                {conv.matchingCount} ocorrência(s)
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {conv.messages.length} mensagem(ens) · última em{' '}
                            {formatDateTime(conv.lastAt)}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-1 space-y-1.5 rounded-lg bg-muted/20 p-2.5">
                        {conv.messages.map((m) => {
                          const senderId = String(m.sender)
                          const recipientId = String(m.recipient)
                          const mine = senderId === user?.id
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                                  mine ? 'bg-amber-500/90 text-white' : 'bg-muted text-foreground'
                                }`}
                              >
                                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-medium opacity-80">
                                  <span>
                                    {operatorLabel(senderId)} → {operatorLabel(recipientId)}
                                  </span>
                                  <span>·</span>
                                  <span>{formatDateTime(m.created)}</span>
                                </div>
                                <div className="whitespace-pre-wrap break-words">
                                  {search.trim()
                                    ? splitTextWithHighlight(m.content, search).map((seg, idx) =>
                                        seg.isMatch ? (
                                          <mark
                                            key={idx}
                                            className="rounded bg-amber-300 px-0.5 font-bold text-amber-950 dark:bg-amber-400/90 dark:text-zinc-950"
                                          >
                                            {seg.text}
                                          </mark>
                                        ) : (
                                          <span key={idx}>{seg.text}</span>
                                        ),
                                      )
                                    : m.content}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  )
}
