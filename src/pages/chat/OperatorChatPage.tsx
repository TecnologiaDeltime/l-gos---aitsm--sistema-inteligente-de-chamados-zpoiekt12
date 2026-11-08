import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  ChatOperatorUser,
  CHAT_MESSAGES_PAGE_SIZE,
  ChatConversationSummary,
  getChatConversations,
  getChatOperators,
  getConversationMessages,
  getConversationMessagesPage,
  getUnreadCountBySender,
  isChatOperatorOnline,
  markConversationAsRead,
  OperatorChatMessage,
  sendOperatorMessage,
} from '@/services/operator-chat'
import { useRealtime } from '@/hooks/use-realtime'
import { setActiveConversationPartner } from '@/services/operator-chat'
import { formatChatTime } from '@/lib/chat-format'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConversationHistoryList } from '@/components/chat/ConversationHistoryList'
import {
  MessageSquare,
  Search,
  Send,
  Wifi,
  WifiOff,
  CheckCheck,
  Check,
  User,
  Sparkles,
  ChevronUp,
  Loader2,
  History as HistoryIcon,
} from 'lucide-react'

export default function OperatorChatPage() {
  const { user } = useAuth()
  const [operators, setOperators] = useState<ChatOperatorUser[]>([])
  const [selectedOperator, setSelectedOperator] = useState<ChatOperatorUser | null>(null)
  const [messages, setMessages] = useState<OperatorChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingOperators, setLoadingOperators] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [currentTime, setCurrentTime] = useState(Date.now())
  // Histórico de conversas (agrupamento por parceiro das próprias mensagens)
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false)
  // Paginação do histórico da conversa aberta ("Carregar mais")
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Carrega lista de operadores
  const loadOperators = async () => {
    try {
      const list = await getChatOperators()
      // Filtra para não listar a si mesmo
      const others = list.filter((o) => o.id !== user?.id)
      setOperators(others)
    } catch (err) {
      console.error('Erro ao carregar operadores para chat:', err)
    } finally {
      setLoadingOperators(false)
    }
  }

  // Carrega contadores de não lidos
  const loadUnreadCounts = async () => {
    if (!user) return
    try {
      const map = await getUnreadCountBySender(user.id)
      setUnreadMap(map)
    } catch (err) {
      console.error('Erro ao carregar contagem de mensagens não lidas:', err)
    }
  }

  // Carrega o histórico de conversas do operador logado (agrupado por parceiro)
  const loadConversations = async () => {
    if (!user) return
    try {
      const list = await getChatConversations(user.id, { operators, unreadCounts: unreadMap })
      setConversations(list)
    } catch (err) {
      console.error('Erro ao carregar histórico de conversas:', err)
    } finally {
      setLoadingConversations(false)
      setHasLoadedConversations(true)
    }
  }

  useEffect(() => {
    loadOperators()
    loadUnreadCounts()
    // Atualiza status online a cada 30 segundos
    const interval = setInterval(() => {
      loadOperators()
      loadUnreadCounts()
    }, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Recarrega o histórico de conversas quando a lista de operadores chega
  // (nome/avatar resolvidos) ou os contadores de não lidas mudam.
  useEffect(() => {
    loadConversations()
  }, [user?.id, operators, unreadMap])

  // Relógio de presença: re-renderiza a cada 30s para o indicador online/offline
  // recalcular o limite de 15 min mesmo sem nova resposta da API.
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // Seleciona o primeiro operador automaticamente caso nenhum selecionado e exista algum
  useEffect(() => {
    if (!selectedOperator && operators.length > 0) {
      setSelectedOperator(operators[0])
    }
  }, [operators, selectedOperator])

  // Carrega conversa do operador selecionado
  const loadConversation = async (operatorId: string) => {
    if (!user) return
    setLoadingMessages(true)
    try {
      const list = await getConversationMessages(user.id, operatorId)
      setMessages(list)
      setHasMoreOlder(list.length >= CHAT_MESSAGES_PAGE_SIZE)
      setHistoryLoadedFor(operatorId)
      // Marca como lidas as mensagens recebidas deste operador
      await markConversationAsRead(operatorId, user.id)
      setUnreadMap((prev) => ({ ...prev, [operatorId]: 0 }))
    } catch (err) {
      console.error('Erro ao carregar mensagens da conversa:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Carrega página anterior (mais antigas) de mensagens da conversa aberta
  const loadOlderMessages = async () => {
    if (!user || !selectedOperator || loadingOlder || !hasMoreOlder) return
    const oldest = messages[0]
    if (!oldest) return
    setLoadingOlder(true)
    try {
      const older = await getConversationMessagesPage(user.id, selectedOperator.id, {
        before: oldest.created,
        limit: CHAT_MESSAGES_PAGE_SIZE,
      })
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const fresh = older.filter((m) => !known.has(m.id))
        return [...fresh, ...prev]
      })
      setHasMoreOlder(older.length >= CHAT_MESSAGES_PAGE_SIZE)
      if (older.length === 0) setHasMoreOlder(false)
      // Busca o nome do parceiro em conversas antigas cujo remetente não existe mais
      // nos operadores atuais para exibição correta no cabeçalho do chat
      if (older.length > 0) {
        const unknownSender = older.find(
          (m) => m.sender !== user.id && !operators.some((o) => o.id === m.sender),
        )
        if (unknownSender && unknownSender.expand?.sender) {
          setOperators((prev) => {
            if (prev.some((o) => o.id === unknownSender.expand!.sender!.id)) return prev
            const s = unknownSender.expand.sender
            return [
              ...prev,
              {
                id: s.id,
                name: s.name,
                email: s.email,
                avatar: s.avatar,
              } as ChatOperatorUser,
            ]
          })
        }
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens antigas da conversa:', err)
    } finally {
      setLoadingOlder(false)
    }
  }

  useEffect(() => {
    if (selectedOperator) {
      // Registra a conversa aberta: o ícone da barra superior usa isso para
      // NÃO tocar o alerta sonoro de mensagens desta conversa (já está na tela).
      setActiveConversationPartner(selectedOperator.id)
      loadConversation(selectedOperator.id)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setActiveConversationPartner(null)
      setMessages([])
    }
    return () => setActiveConversationPartner(null)
  }, [selectedOperator?.id, user?.id])

  // Rola para a mensagem mais recente
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    scrollToBottom(false)
  }, [messages.length])

  // Realtime para novas mensagens do chat de operadores
  useRealtime('operator_chat_messages', (e) => {
    if (!user) return

    const record = e.record as any
    const isRelated =
      (record.sender === user.id && record.recipient === selectedOperator?.id) ||
      (record.sender === selectedOperator?.id && record.recipient === user.id)

    if (e.action === 'create') {
      if (isRelated) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === record.id)) return prev
          return [...prev, record as OperatorChatMessage]
        })
        if (record.sender === selectedOperator?.id) {
          markConversationAsRead(selectedOperator.id, user.id).catch(() => {})
        }
        // A conversa com este parceiro vira a mais recente do histórico
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.partnerId === record.sender)
          if (idx === -1) return prev
          const conv = prev[idx]
          const updated: ChatConversationSummary = {
            ...conv,
            lastMessagePreview: String(record.content || '')
              .replace(/\s+/g, ' ')
              .slice(0, 70),
            lastMessageAt: record.created,
            lastFromMe: record.sender === user.id,
            unread: record.sender === user.id ? 0 : (unreadMap[record.sender] || 0) + 1,
          }
          return [updated, ...prev.filter((_, i) => i !== idx)]
        })
      } else if (record.recipient === user.id) {
        // Mensagem de outro operador (conversa não aberta): incrementa não lido.
        // O som toca UMA única vez, centralizado no ChatTopBarIcon (barra superior) —
        // aqui só atualizamos o contador para não duplicar o alerta sonoro.
        setUnreadMap((prev) => ({
          ...prev,
          [record.sender]: (prev[record.sender] || 0) + 1,
        }))
      }
    } else if (e.action === 'update' && isRelated) {
      setMessages((prev) =>
        prev.map((m) => (m.id === record.id ? (record as OperatorChatMessage) : m)),
      )
    }
  })

  // Enviar mensagem
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user || !selectedOperator || !inputText.trim() || sending) return

    const content = inputText.trim()
    setInputText('')
    setSending(true)

    try {
      const created = await sendOperatorMessage({
        sender: user.id,
        recipient: selectedOperator.id,
        content,
      })
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev
        return [...prev, created]
      })
      setTimeout(() => scrollToBottom(), 50)
    } catch (err) {
      console.error('Erro ao enviar mensagem no chat:', err)
      setInputText(content)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // Filtra operadores pela busca e recalcula a presença online a cada tick do relógio
  // (o indicador vira "Ausente" sozinho após 15 min sem atividade, sem esperar a próxima busca)
  const filteredOperators = useMemo(() => {
    void currentTime
    const list = searchTerm.trim()
      ? (() => {
          const q = searchTerm.toLowerCase()
          return operators.filter(
            (op) => op.name.toLowerCase().includes(q) || op.email.toLowerCase().includes(q),
          )
        })()
      : operators
    return list.map((op) => ({ ...op, online: isChatOperatorOnline(op) }))
  }, [operators, searchTerm, currentTime])

  const totalUnread = useMemo(() => {
    return Object.values(unreadMap).reduce((acc, count) => acc + count, 0)
  }, [unreadMap])

  return (
    <div className="flex h-[calc(100vh-4.25rem)] flex-col gap-3 p-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Chat Interno entre Operadores
              </h1>
              {totalUnread > 0 && (
                <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400">
                  {totalUnread} não lida{totalUnread > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Comunicação direta em tempo real entre operadores, equipe técnica e área de inovação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1.5 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Realtime ativo</span>
          </Badge>
        </div>
      </div>

      {/* Grid Principal: Lista à esquerda + Conversa à direita */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Painel Esquerdo: Lista de Operadores (4 colunas) */}
        <Card className="md:col-span-4 lg:col-span-3.5 flex flex-col min-h-0 bg-card border-border overflow-hidden">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar operador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>{filteredOperators.length} operador(es)</span>
              <span>{filteredOperators.filter((o) => o.online).length} online</span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loadingOperators ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Carregando operadores...
              </div>
            ) : filteredOperators.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhum operador encontrado.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredOperators.map((op) => {
                  const isSelected = selectedOperator?.id === op.id
                  const unread = unreadMap[op.id] || 0
                  return (
                    <button
                      key={op.id}
                      onClick={() => setSelectedOperator(op)}
                      className={`w-full p-3 flex items-center justify-between gap-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-500 dark:bg-amber-950/40'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9 border border-border">
                            {op.avatar && (
                              <AvatarImage
                                src={`${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${op.id}/${op.avatar}`}
                              />
                            )}
                            <AvatarFallback className="bg-amber-500/20 text-amber-500 text-xs font-bold">
                              {op.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                              op.online ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            title={op.online ? 'Online' : 'Ausente'}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {op.name}
                            </p>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{op.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-slate-950">
                            {unread}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Painel Central: Histórico de Conversas (3 colunas) */}
        <Card className="md:col-span-3 lg:col-span-3 flex flex-col min-h-0 bg-card border-border overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold text-foreground">Conversas</h2>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {conversations.length} anterior(es)
            </span>
          </div>
          <ScrollArea className="flex-1">
            <ConversationHistoryList
              conversations={conversations}
              loading={loadingConversations}
              hasLoadedOnce={hasLoadedConversations}
              activePartnerId={selectedOperator?.id || null}
              onSelect={async (partnerId) => {
                const op =
                  operators.find((o) => o.id === partnerId) ||
                  (() => {
                    const conv = conversations.find((c) => c.partnerId === partnerId)
                    return conv
                      ? {
                          id: conv.partnerId,
                          name: conv.partnerName,
                          email: conv.partnerEmail || '',
                          avatar: conv.partnerAvatar,
                        }
                      : null
                  })()
                if (op) {
                  setSelectedOperator(op as ChatOperatorUser)
                }
              }}
              operators={operators}
            />
          </ScrollArea>
        </Card>

        {/* Painel Direito: Janela da Conversa (5 colunas) */}
        <Card className="md:col-span-5 lg:col-span-5.5 flex flex-col min-h-0 bg-card border-border overflow-hidden">
          {selectedOperator ? (
            <>
              {/* Topo da Conversa com Informações do Operador */}
              <div className="p-3 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10 border border-border">
                      {selectedOperator.avatar && (
                        <AvatarImage
                          src={`${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${selectedOperator.id}/${selectedOperator.avatar}`}
                        />
                      )}
                      <AvatarFallback className="bg-amber-500/20 text-amber-500 font-bold">
                        {selectedOperator.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                        selectedOperator.online ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground truncate">
                        {selectedOperator.name}
                      </h2>
                      <Badge
                        variant="outline"
                        className={
                          selectedOperator.online
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]'
                            : 'bg-muted text-muted-foreground border-border text-[10px]'
                        }
                      >
                        {selectedOperator.online ? 'Online' : 'Ausente'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {selectedOperator.email}
                      {selectedOperator.role ? ` • ${selectedOperator.role}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Área de Mensagens */}
              <ScrollArea className="flex-1 p-4">
                {/* Botão Carregar mais (histórico paginado) */}
                {hasMoreOlder && messages.length > 0 && !loadingMessages && (
                  <div className="flex justify-center pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-500"
                      onClick={loadOlderMessages}
                      disabled={loadingOlder}
                    >
                      {loadingOlder ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Carregar mensagens mais antigas
                        </>
                      )}
                    </Button>
                    <div ref={messagesTopRef} />
                  </div>
                )}
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center p-8 text-xs text-muted-foreground">
                    Carregando conversa...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                    <Sparkles className="h-8 w-8 text-amber-500/60" />
                    <p className="text-sm font-semibold text-foreground">
                      Inicie uma conversa com {selectedOperator.name}
                    </p>
                    <p className="text-xs max-w-sm">
                      As mensagens enviadas aparecem instantaneamente para o operador no chat
                      interno.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => {
                      const isMe = m.sender === user?.id
                      const timeStr = formatChatTime(m)
                      const showSenderName = !isMe

                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isMe && (
                            <Avatar className="h-6 w-6 mb-1 shrink-0">
                              {selectedOperator.avatar && (
                                <AvatarImage
                                  src={`${import.meta.env.VITE_POCKETBASE_URL}/api/files/users/${selectedOperator.id}/${selectedOperator.avatar}`}
                                />
                              )}
                              <AvatarFallback className="bg-amber-500/20 text-amber-500 text-[10px] font-bold">
                                {selectedOperator.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div
                            className={`flex flex-col gap-0.5 max-w-[75%] ${
                              isMe ? 'items-end' : 'items-start'
                            }`}
                          >
                            {/* Nome do remetente acima da bolha (só para mensagens recebidas) */}
                            {showSenderName && (
                              <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                                {selectedOperator.name}
                              </span>
                            )}

                            {/* Bolha da mensagem: minhas (âmbar, à direita) × recebidas (card, à esquerda) */}
                            <div
                              className={`rounded-2xl px-3.5 py-2 text-xs shadow-sm break-words whitespace-pre-wrap ${
                                isMe
                                  ? 'bg-amber-500 text-slate-950 font-medium rounded-br-sm'
                                  : 'bg-muted text-foreground border border-border rounded-bl-sm'
                              }`}
                            >
                              <p className="leading-relaxed">{m.content}</p>
                              <div
                                className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                  isMe ? 'text-slate-900/80' : 'text-muted-foreground'
                                }`}
                              >
                                <span>{timeStr}</span>
                                {isMe &&
                                  (m.read ? (
                                    <CheckCheck className="h-3 w-3 text-emerald-800 dark:text-emerald-950" />
                                  ) : (
                                    <Check className="h-3 w-3 text-slate-800/60" />
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Caixa de Entrada de Mensagem */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-border bg-muted/20 flex gap-2"
              >
                <Input
                  ref={inputRef}
                  placeholder={`Mensagem para ${selectedOperator.name}... (Pressione Enter para enviar)`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sending}
                  className="flex-1 h-10 text-xs"
                />
                <Button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold px-4"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Enviar
                </Button>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
              <User className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">
                Selecione um operador na lista ao lado
              </p>
              <p className="text-xs max-w-sm">
                Escolha um operador para iniciar uma conversa direta ou ver mensagens anteriores.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
