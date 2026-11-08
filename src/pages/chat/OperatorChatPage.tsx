import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  ChatOperatorUser,
  getChatOperators,
  getConversationMessages,
  getUnreadCountBySender,
  isChatOperatorOnline,
  markConversationAsRead,
  OperatorChatMessage,
  sendOperatorMessage,
} from '@/services/operator-chat'
import { useRealtime } from '@/hooks/use-realtime'
import { playTicketChime } from '@/lib/ticket-alerts'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
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
      // Marca como lidas as mensagens recebidas deste operador
      await markConversationAsRead(operatorId, user.id)
      setUnreadMap((prev) => ({ ...prev, [operatorId]: 0 }))
    } catch (err) {
      console.error('Erro ao carregar mensagens da conversa:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    if (selectedOperator) {
      loadConversation(selectedOperator.id)
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setMessages([])
    }
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
      } else if (record.recipient === user.id) {
        // Mensagem de outro operador: incrementa não lido e toca aviso
        setUnreadMap((prev) => ({
          ...prev,
          [record.sender]: (prev[record.sender] || 0) + 1,
        }))
        playTicketChime('Baixa')
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

        {/* Painel Direito: Janela da Conversa (8 colunas) */}
        <Card className="md:col-span-8 lg:col-span-8.5 flex flex-col min-h-0 bg-card border-border overflow-hidden">
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
                      const timeStr = m.created
                        ? new Date(m.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''

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
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow-sm break-words whitespace-pre-wrap ${
                              isMe
                                ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                                : 'bg-muted text-foreground border border-border rounded-bl-xs'
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
