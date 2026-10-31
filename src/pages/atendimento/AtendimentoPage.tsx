import { useState, useEffect, useRef } from 'react'
import {
  AtendimentoConversa,
  AtendimentoMensagem,
  AtendimentoDossie,
  CanalAtendimento,
} from '@/types/atendimento'
import {
  getConversasAtendimento,
  getMensagensAtendimento,
  getDossieAtendimento,
  enviarMensagemOperador,
  criarMensagemEntrada,
  aceitarAtendimento,
  resolverConversa,
} from '@/services/atendimento'
import { SlaLiveCountdown } from '@/components/atendimento/SlaLiveCountdown'
import { DossieHandoffModal } from '@/components/atendimento/DossieHandoffModal'
import { VincularChamadoDialog } from '@/components/atendimento/VincularChamadoDialog'
import { NovaConversaModal } from '@/components/atendimento/NovaConversaModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Send,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  Search,
  Sparkles,
  RefreshCw,
  PhoneCall,
  Globe,
  Mail,
  Shield,
  Layers,
  Activity,
  User,
  Bot,
  Laptop,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'

export function AtendimentoPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Estados principais
  const [conversas, setConversas] = useState<AtendimentoConversa[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<AtendimentoMensagem[]>([])
  const [currentDossie, setCurrentDossie] = useState<AtendimentoDossie | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Filtros da fila
  const [filtroCanal, setFiltroCanal] = useState<string>('todos')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todos')
  const [busca, setBusca] = useState<string>('')

  // Composer
  const [respostaTexto, setRespostaTexto] = useState<string>('')
  const [isSending, setIsSending] = useState(false)
  const [isSimulatingUser, setIsSimulatingUser] = useState(false)
  const [simularTexto, setSimularTexto] = useState<string>('')

  // Modais
  const [dossieOpen, setDossieOpen] = useState(false)
  const [vincularOpen, setVincularOpen] = useState(false)
  const [novaConversaOpen, setNovaConversaOpen] = useState(false)
  const [isAceitando, setIsAceitando] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Conversa ativa selecionada
  const activeConversa = conversas.find((c) => c.id === selectedId) || null

  // Carrega lista de conversas
  const carregarConversas = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const list = await getConversasAtendimento({
        canal: filtroCanal,
        estado: filtroEstado,
        prioridade: filtroPrioridade,
        search: busca,
      })
      setConversas(list)

      // Seleciona a primeira se nenhuma selecionada ou se a selecionada sumiu
      if (list.length > 0) {
        if (!selectedId || !list.some((c) => c.id === selectedId)) {
          setSelectedId(list[0].id)
        }
      } else {
        setSelectedId(null)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar atendimentos',
        description: err.message || 'Falha ao buscar fila do banco',
        variant: 'destructive',
      })
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  // Carrega mensagens e dossiê da conversa selecionada
  const carregarThread = async (convId: string) => {
    setLoadingMessages(true)
    try {
      const [msgs, dossie] = await Promise.all([
        getMensagensAtendimento(convId),
        getDossieAtendimento(convId),
      ])
      setMensagens(msgs)
      setCurrentDossie(dossie)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar mensagens',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    carregarConversas()
  }, [filtroCanal, filtroEstado, filtroPrioridade])

  useEffect(() => {
    if (selectedId) {
      carregarThread(selectedId)
    } else {
      setMensagens([])
      setCurrentDossie(null)
    }
  }, [selectedId])

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Enviar resposta do operador
  const handleEnviarResposta = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedId || !respostaTexto.trim()) return

    setIsSending(true)
    try {
      const novaMsg = await enviarMensagemOperador(
        selectedId,
        respostaTexto.trim(),
        user?.id,
        user?.name || user?.email || 'Operador',
      )
      setMensagens((prev) => [...prev, novaMsg])
      setRespostaTexto('')

      // Atualiza a conversa na lista local
      setConversas((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                estado:
                  c.estado === 'HANDOFF_PENDENTE' || c.estado === 'NOVA'
                    ? 'HUMANO_ATIVO'
                    : c.estado,
                ultima_mensagem_texto: novaMsg.texto,
                ultima_atividade_at: novaMsg.created,
                sla_resposta_at: c.sla_resposta_at || novaMsg.created,
              }
            : c,
        ),
      )
      toast({ title: 'Resposta enviada e gravada no banco!' })
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar resposta',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  // Simular mensagem de entrada do cliente (WhatsApp / Webchat operáveis na tela)
  const handleSimularEntrada = async () => {
    if (!selectedId || !simularTexto.trim()) return

    setIsSimulatingUser(true)
    try {
      const novaMsg = await criarMensagemEntrada(
        selectedId,
        simularTexto.trim(),
        activeConversa?.contato_nome || 'Cliente',
      )
      setMensagens((prev) => [...prev, novaMsg])
      setSimularTexto('')

      // Recarrega conversa para obter nova classificação e SLA recalculado
      const atualizada = await getConversasAtendimento({
        canal: filtroCanal,
        estado: filtroEstado,
        prioridade: filtroPrioridade,
      })
      setConversas(atualizada)

      toast({
        title: 'Mensagem do cliente recebida!',
        description: 'Classificação ITIL atualizada e SLA recalculado com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao simular cliente',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSimulatingUser(false)
    }
  }

  // Aceitar atendimento na fila: gera dossiê de handoff e exibe modal
  const handleAceitarAtendimento = async () => {
    if (!selectedId) return
    setIsAceitando(true)
    try {
      const res = await aceitarAtendimento(
        selectedId,
        user?.id,
        user?.name || user?.email || 'Operador',
      )
      setCurrentDossie(res.dossie)
      setConversas((prev) => prev.map((c) => (c.id === selectedId ? res.conversa : c)))
      setMensagens(await getMensagensAtendimento(selectedId))
      setDossieOpen(true)
      toast({
        title: 'Atendimento assumido!',
        description: 'Dossiê contextualizado de handoff gerado com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao aceitar atendimento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsAceitando(false)
    }
  }

  // Resolver atendimento
  const handleResolver = async () => {
    if (!selectedId) return
    try {
      const res = await resolverConversa(selectedId)
      setConversas((prev) => prev.map((c) => (c.id === selectedId ? res : c)))
      toast({ title: 'Conversa marcada como Resolvida!' })
    } catch (err: any) {
      toast({
        title: 'Erro ao resolver',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Helper de ícone de canal
  const renderCanalIcon = (canal: CanalAtendimento) => {
    switch (canal) {
      case 'whatsapp':
        return <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
      case 'webchat':
        return <Globe className="w-3.5 h-3.5 text-blue-500" />
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-amber-500" />
      default:
        return <Layers className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  // Helper de badge de prioridade com cor semântica estrita
  const renderPriorityBadge = (prio: string) => {
    let classes = 'bg-muted text-muted-foreground'
    if (prio === 'P1') classes = 'bg-red-600 text-white font-bold'
    else if (prio === 'P2') classes = 'bg-orange-500 text-black font-semibold'
    else if (prio === 'P3') classes = 'bg-amber-400 text-black font-semibold'

    return <Badge className={`text-[10px] px-1.5 py-0.2 rounded ${classes}`}>{prio}</Badge>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] min-h-[640px] bg-background text-foreground overflow-hidden">
      {/* Topbar Operacional Omnichannel */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/60 shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h1 className="text-sm font-bold tracking-tight">Console de Atendimento Omnichannel</h1>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
            AITSM · Opção C
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => carregarConversas(false)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-xs"
            onClick={() => setNovaConversaOpen(true)}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Nova Conversa
          </Button>
        </div>
      </div>

      {/* Grid de Três Colunas (Fila Omnichannel | Thread de Mensagens | Painel de Contexto ITIL/SLA) */}
      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
        {/* COLUNA 1: FILA DE CONVERSAS (md:col-span-3) */}
        <div className="md:col-span-3 flex flex-col h-full bg-card/30 overflow-hidden">
          {/* Barra de Filtros */}
          <div className="p-2.5 border-b border-border bg-card/60 space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, texto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && carregarConversas()}
                className="h-8 text-xs pl-8 pr-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {/* Filtro por Canal */}
              <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                <SelectTrigger className="h-7 text-[11px] px-2">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por Estado */}
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="h-7 text-[11px] px-2">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos estados</SelectItem>
                  <SelectItem value="NOVA">Nova</SelectItem>
                  <SelectItem value="HANDOFF_PENDENTE">Handoff</SelectItem>
                  <SelectItem value="HUMANO_ATIVO">Em Atendimento</SelectItem>
                  <SelectItem value="RESOLVIDA">Resolvida</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por Prioridade */}
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger className="h-7 text-[11px] px-2">
                  <SelectValue placeholder="Prio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="P1">P1 - Crítica</SelectItem>
                  <SelectItem value="P2">P2 - Alta</SelectItem>
                  <SelectItem value="P3">P3 - Média</SelectItem>
                  <SelectItem value="P4">P4 - Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de Conversas com rolagem */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                <span>Carregando atendimentos...</span>
              </div>
            ) : conversas.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhuma conversa encontrada para os filtros selecionados.
              </div>
            ) : (
              conversas.map((c) => {
                const isSelected = c.id === selectedId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 transition-colors flex flex-col gap-1.5 border-l-2 ${
                      isSelected
                        ? 'bg-amber-500/10 border-l-amber-500 text-foreground'
                        : 'border-l-transparent hover:bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-foreground truncate">
                        {renderCanalIcon(c.canal)}
                        <span className="truncate">{c.contato_nome}</span>
                        {c.contato_vip && (
                          <Badge className="bg-amber-500 text-black text-[9px] px-1 py-0 h-4">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {renderPriorityBadge(c.prioridade)}
                      </div>
                    </div>

                    {/* Prévia da última mensagem */}
                    <div className="text-[11px] line-clamp-2 leading-relaxed text-muted-foreground">
                      {c.ultima_mensagem_texto || 'Sem mensagens'}
                    </div>

                    {/* Linha de status, canal e SLA regressivo compacto */}
                    <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${
                            c.estado === 'HANDOFF_PENDENTE'
                              ? 'text-orange-500 border-orange-500/40 bg-orange-500/10 font-bold'
                              : c.estado === 'HUMANO_ATIVO'
                                ? 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10 font-semibold'
                                : c.estado === 'RESOLVIDA'
                                  ? 'text-muted-foreground border-border'
                                  : 'text-blue-500 border-blue-500/40'
                          }`}
                        >
                          {c.estado.replace('_', ' ')}
                        </Badge>
                        <span className="text-muted-foreground font-mono">
                          {c.categoria || 'Geral'}
                        </span>
                      </div>

                      {/* SLA regressivo compacto ao vivo na fila */}
                      <SlaLiveCountdown
                        label="SLA"
                        deadline={c.sla_resposta_deadline}
                        completedAt={c.sla_resposta_at}
                        compact
                      />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* COLUNA 2: THREAD DE MENSAGENS (md:col-span-6) */}
        <div className="md:col-span-6 flex flex-col h-full bg-background overflow-hidden">
          {activeConversa ? (
            <>
              {/* Cabeçalho da Thread */}
              <div className="px-4 py-2.5 border-b border-border bg-card/40 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-foreground shrink-0 border border-border">
                    {activeConversa.contato_nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs truncate">
                        {activeConversa.contato_nome}
                      </span>
                      {activeConversa.contato_vip && (
                        <Badge className="bg-amber-500 text-black text-[9px] px-1 h-3.5 font-bold">
                          VIP
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ({activeConversa.contato_handle || activeConversa.canal})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>
                        Canal: <b className="capitalize text-foreground">{activeConversa.canal}</b>
                      </span>
                      <span>·</span>
                      <span>
                        Estado: <b className="text-amber-500">{activeConversa.estado}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações Rápidas no Cabeçalho */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Botão de Dossiê Handoff */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                    onClick={() => {
                      if (!currentDossie && activeConversa.estado !== 'HUMANO_ATIVO') {
                        handleAceitarAtendimento()
                      } else {
                        setDossieOpen(true)
                      }
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dossiê Handoff</span>
                  </Button>

                  {/* Aceitar Atendimento se pendente */}
                  {activeConversa.estado !== 'HUMANO_ATIVO' &&
                    activeConversa.estado !== 'RESOLVIDA' && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        onClick={handleAceitarAtendimento}
                        disabled={isAceitando}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isAceitando ? 'Assumindo...' : 'Aceitar'}</span>
                      </Button>
                    )}

                  {/* Marcar como Resolvido */}
                  {activeConversa.estado !== 'RESOLVIDA' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={handleResolver}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolver</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Corpo da Thread com Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Carregando histórico da conversa...</span>
                  </div>
                ) : mensagens.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Nenhuma mensagem registrada nesta conversa.
                  </div>
                ) : (
                  mensagens.map((msg) => {
                    const isUsuario = msg.autor_tipo === 'usuario'
                    const isOperador = msg.autor_tipo === 'operador'
                    const isBot = msg.autor_tipo === 'bot'
                    const isSistema = msg.autor_tipo === 'sistema'

                    if (isSistema) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border">
                            {msg.texto} ·{' '}
                            {new Date(msg.created).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[82%] ${
                          isUsuario ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1 px-1">
                          {isUsuario && <User className="w-3 h-3 text-muted-foreground" />}
                          {isOperador && <Laptop className="w-3 h-3 text-amber-500" />}
                          {isBot && <Bot className="w-3 h-3 text-blue-500" />}
                          <span className="font-semibold text-foreground">{msg.autor_nome}</span>
                          <span>•</span>
                          <span className="font-mono">
                            {new Date(msg.created).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Bolha de Mensagem */}
                        <div
                          className={`p-3 rounded-lg text-xs leading-relaxed break-words shadow-2xs border ${
                            isUsuario
                              ? 'bg-amber-500/15 border-amber-500/40 text-foreground rounded-tr-none'
                              : isOperador
                                ? 'bg-card border-border text-foreground rounded-tl-none ring-1 ring-border/50'
                                : 'bg-muted/80 border-border text-foreground rounded-tl-none'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.texto}</div>

                          {/* Se bot consultou artigos */}
                          {msg.artigos_consultados && msg.artigos_consultados.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                Base consultada:
                              </span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {msg.artigos_consultados.map((art, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[9px] font-mono text-muted-foreground bg-background/50"
                                  >
                                    {art}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Se mensagem tem classificação ITIL gravada */}
                          {msg.classificacao && msg.classificacao.prioridade && (
                            <div className="mt-1.5 pt-1 border-t border-border/40 text-[9px] font-mono text-muted-foreground flex items-center gap-2">
                              <span>
                                Prática: <b>{msg.classificacao.pratica}</b>
                              </span>
                              <span>·</span>
                              <span>
                                Prio:{' '}
                                <b className="text-amber-500">{msg.classificacao.prioridade}</b>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra do Simulador de Entrada de Cliente (Operabilidade na Tela) */}
              <div className="p-2 border-t border-border/60 bg-muted/30 flex items-center gap-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-amber-500" />
                  Simular cliente ({activeConversa.canal}):
                </span>
                <Input
                  placeholder="Escreva como o cliente para testar classificação ITIL e SLA ao vivo..."
                  value={simularTexto}
                  onChange={(e) => setSimularTexto(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSimularEntrada()}
                  className="h-7 text-xs"
                  disabled={isSimulatingUser}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={handleSimularEntrada}
                  disabled={isSimulatingUser || !simularTexto.trim()}
                >
                  {isSimulatingUser ? 'Enviando...' : 'Receber na tela'}
                </Button>
              </div>

              {/* Composer: Resposta do Operador gravando no banco */}
              <div className="p-3 border-t border-border bg-card/60 shrink-0">
                <form onSubmit={handleEnviarResposta} className="space-y-2">
                  <div className="relative">
                    <Textarea
                      placeholder="Escreva a resposta do operador (gravada no histórico e atualiza SLA)..."
                      value={respostaTexto}
                      onChange={(e) => setRespostaTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          handleEnviarResposta()
                        }
                      }}
                      className="min-h-[70px] text-xs resize-none pr-16 bg-background"
                      disabled={isSending}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="absolute right-2.5 bottom-2.5 h-7 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1"
                      disabled={isSending || !respostaTexto.trim()}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Gravando...' : 'Enviar'}</span>
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Dica: Pressione Ctrl + Enter para enviar rapidamente.</span>
                    <span>
                      Operador: <b>{user?.name || user?.email || 'Você'}</b>
                    </span>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Layers className="w-10 h-10 mb-2 opacity-40 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Nenhuma conversa selecionada
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Selecione uma conversa na fila ao lado para acompanhar a thread, classificar ITIL e
                visualizar os SLAs.
              </p>
            </div>
          )}
        </div>

        {/* COLUNA 3: PAINEL DE CONTEXTO ITIL, SLA E VÍNCULO A CHAMADO (md:col-span-3) */}
        <div className="md:col-span-3 flex flex-col h-full bg-card/20 overflow-y-auto divide-y divide-border/60">
          {activeConversa ? (
            <>
              {/* Bloco 1: SLAs ao vivo com contagem regressiva */}
              <div className="p-3.5 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>SLA Operacional ao Vivo</span>
                  <Badge variant="outline" className="text-[10px] font-mono text-amber-500">
                    {activeConversa.prioridade}
                  </Badge>
                </h4>

                <div className="space-y-2">
                  <SlaLiveCountdown
                    label="Primeira Resposta"
                    deadline={activeConversa.sla_resposta_deadline}
                    completedAt={activeConversa.sla_resposta_at}
                  />

                  <SlaLiveCountdown
                    label="Resolução Total"
                    deadline={activeConversa.sla_resolucao_deadline}
                    completedAt={activeConversa.sla_resolucao_at}
                  />
                </div>
              </div>

              {/* Bloco 2: Classificação ITIL por Mensagem */}
              <div className="p-3.5 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Classificação ITIL 4</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Heurística pt-BR
                  </span>
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/40 border border-border/80">
                    <span className="text-[9.5px] uppercase font-semibold text-muted-foreground block">
                      Prática
                    </span>
                    <span className="font-semibold text-foreground capitalize">
                      {activeConversa.pratica || 'Incidente'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-muted/40 border border-border/80">
                    <span className="text-[9.5px] uppercase font-semibold text-muted-foreground block">
                      Categoria
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {activeConversa.categoria || 'Geral'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-muted/40 border border-border/80">
                    <span className="text-[9.5px] uppercase font-semibold text-muted-foreground block">
                      Impacto
                    </span>
                    <span className="font-semibold text-foreground capitalize">
                      {activeConversa.impacto || 'Moderado'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-muted/40 border border-border/80">
                    <span className="text-[9.5px] uppercase font-semibold text-muted-foreground block">
                      Urgência
                    </span>
                    <span className="font-semibold text-foreground capitalize">
                      {activeConversa.urgencia || 'Média'}
                    </span>
                  </div>
                </div>

                {/* Sentimento & Confiança */}
                <div className="p-2.5 rounded bg-muted/30 border border-border/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Sentimento do Cliente
                    </span>
                    <span
                      className={`font-mono font-bold text-xs ${
                        (activeConversa.sentimento || 0) <= -0.6
                          ? 'text-red-500'
                          : (activeConversa.sentimento || 0) >= 0.2
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                      }`}
                    >
                      {(activeConversa.sentimento || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        (activeConversa.sentimento || 0) <= -0.6
                          ? 'bg-red-500'
                          : (activeConversa.sentimento || 0) >= 0.2
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(10, ((activeConversa.sentimento || 0) + 1) * 50))}%`,
                      }}
                    />
                  </div>

                  {activeConversa.confianca_bot !== undefined && (
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                      <span className="text-muted-foreground">Confiança do Bot:</span>
                      <span className="font-mono font-semibold">
                        {(activeConversa.confianca_bot * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bloco 3: Vínculo com Chamado ITSM */}
              <div className="p-3.5 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Chamado do Sistema</span>
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                </h4>

                {activeConversa.chamado_vinculado ? (
                  <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Vinculado</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        #
                        {activeConversa.expand?.chamado_vinculado?.number ||
                          activeConversa.chamado_vinculado.slice(0, 8)}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {activeConversa.expand?.chamado_vinculado?.title ||
                        'Chamado registrado no ITSM'}
                    </p>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                      <Link
                        to={`/tickets/${activeConversa.chamado_vinculado}`}
                        className="text-xs font-semibold text-amber-500 hover:underline flex items-center gap-1"
                      >
                        Abrir Chamado
                        <ExternalLink className="w-3 h-3" />
                      </Link>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => setVincularOpen(true)}
                      >
                        Alterar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-muted/40 border border-border text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Esta conversa ainda não está vinculada a um chamado ITSM.
                    </p>
                    <Button
                      size="sm"
                      className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                      onClick={() => setVincularOpen(true)}
                    >
                      Criar ou Associar Chamado
                    </Button>
                  </div>
                )}
              </div>

              {/* Bloco 4: Dossiê de Handoff Sintetizado */}
              <div className="p-3.5 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Dossiê AITSM</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </h4>

                {currentDossie ? (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded bg-muted/30 border border-border space-y-1">
                      <div className="font-semibold text-foreground line-clamp-1">
                        {currentDossie.headline}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-3">
                        {currentDossie.narrativa}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                      onClick={() => setDossieOpen(true)}
                    >
                      Ver Dossiê Completo
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-muted/30 border border-border text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Nenhum dossiê gerado ainda para esta conversa.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs border-amber-500/40 text-amber-500"
                      onClick={handleAceitarAtendimento}
                      disabled={isAceitando}
                    >
                      {isAceitando ? 'Gerando...' : 'Gerar Dossiê de Handoff'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Selecione uma conversa para visualizar os SLAs e o painel de contexto ITIL.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Dossiê de Handoff Contextualizado */}
      <DossieHandoffModal
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        dossie={currentDossie}
        conversa={activeConversa}
        onAceitar={handleAceitarAtendimento}
        isAceitando={isAceitando}
      />

      {/* Modal de Vínculo com Chamado (Criar ou Associar) */}
      {activeConversa && (
        <VincularChamadoDialog
          open={vincularOpen}
          onOpenChange={setVincularOpen}
          conversa={activeConversa}
          onSuccess={(atualizada) => {
            setConversas((prev) => prev.map((c) => (c.id === atualizada.id ? atualizada : c)))
          }}
        />
      )}

      {/* Modal para Nova Conversa Operacional */}
      <NovaConversaModal
        open={novaConversaOpen}
        onOpenChange={setNovaConversaOpen}
        onSuccess={(nova) => {
          setConversas((prev) => [nova, ...prev])
          setSelectedId(nova.id)
        }}
      />
    </div>
  )
}
