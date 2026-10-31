import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Link2, PlusCircle, Search, Ticket } from 'lucide-react'
import { AtendimentoConversa } from '@/types/atendimento'
import { createTicket, getTickets } from '@/services/tickets'
import { vincularChamado } from '@/services/atendimento'
import { useToast } from '@/hooks/use-toast'

interface VincularChamadoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversa: AtendimentoConversa
  onSuccess: (updated: AtendimentoConversa) => void
}

export function VincularChamadoDialog({
  open,
  onOpenChange,
  conversa,
  onSuccess,
}: VincularChamadoDialogProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<'associar' | 'criar'>('criar')
  const [loading, setLoading] = useState(false)

  // Estado para busca de ticket existente
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string>('')

  // Estado para criação de novo ticket
  const [ticketTitle, setTicketTitle] = useState(
    `[${(conversa.canal || 'OMNI').toUpperCase()}] ${conversa.categoria || 'Atendimento'} - ${conversa.contato_nome}`,
  )
  const [ticketType, setTicketType] = useState(
    conversa.pratica === 'incident'
      ? 'Incidente'
      : conversa.pratica === 'change'
        ? 'Mudança'
        : 'Requisição de Serviço',
  )
  const [ticketImpact, setTicketImpact] = useState<'Alto' | 'Médio' | 'Baixo'>(
    conversa.impacto === 'extenso' || conversa.impacto === 'significativo'
      ? 'Alto'
      : conversa.impacto === 'moderado'
        ? 'Médio'
        : 'Baixo',
  )
  const [ticketUrgency, setTicketUrgency] = useState<'Alta' | 'Média' | 'Baixa'>(
    conversa.urgencia === 'crítica' || conversa.urgencia === 'alta'
      ? 'Alta'
      : conversa.urgencia === 'média'
        ? 'Média'
        : 'Baixa',
  )

  const handleSearchTickets = async () => {
    if (!searchTerm.trim()) return
    setSearching(true)
    try {
      const q = searchTerm.trim().replace(/"/g, '\\"')
      const tickets = await getTickets(
        `title ~ "${q}" || number ~ "${q}" || requester_name ~ "${q}"`,
        '-created',
      )
      setSearchResults(tickets.slice(0, 8))
    } catch (err: any) {
      toast({
        title: 'Erro na busca',
        description: err.message || 'Falha ao buscar chamados',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  const handleAssociarExistente = async () => {
    if (!selectedTicketId) {
      toast({ title: 'Selecione um chamado', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const updated = await vincularChamado(conversa.id, selectedTicketId)
      toast({ title: 'Chamado vinculado com sucesso!' })
      onSuccess(updated)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao vincular',
        description: err.message || 'Não foi possível vincular o chamado',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCriarChamado = async () => {
    if (!ticketTitle.trim()) {
      toast({ title: 'Título é obrigatório', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      // Cria chamado real na coleção tickets
      const newTicket = await createTicket({
        title: ticketTitle.trim(),
        description: `Chamado gerado a partir de conversa omnichannel (${conversa.canal.toUpperCase()}):\nContato: ${conversa.contato_nome} (${conversa.contato_handle || 'sem fone/email'})\nÚltima mensagem: ${conversa.ultima_mensagem_texto || 'Sem texto'}`,
        requester_name: conversa.contato_nome,
        requester_email: conversa.contato_handle?.includes('@')
          ? conversa.contato_handle
          : undefined,
        requester_phone: !conversa.contato_handle?.includes('@')
          ? conversa.contato_handle
          : undefined,
        type: ticketType,
        impact: ticketImpact,
        urgency: ticketUrgency,
        priority:
          conversa.prioridade === 'P1'
            ? 'Crítica'
            : conversa.prioridade === 'P2'
              ? 'Alta'
              : conversa.prioridade === 'P3'
                ? 'Média'
                : 'Baixa',
        status: 'Novo',
        source: conversa.canal === 'email' ? 'E-mail' : 'Manual',
      })

      // Vincula o chamado recém criado à conversa
      const updated = await vincularChamado(conversa.id, newTicket.id)
      toast({
        title: 'Chamado criado e vinculado com sucesso!',
        description: `Chamado #${newTicket.number || newTicket.id} gerado no sistema.`,
      })
      onSuccess(updated)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao criar chamado',
        description: err.message || 'Falha ao gravar chamado no banco de dados',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-500" />
            <DialogTitle className="text-base font-bold">Vínculo com Chamado ITSM</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Associe esta conversa a um ticket existente do sistema ou crie um chamado novo
            diretamente.
          </DialogDescription>
        </DialogHeader>

        {/* Alternador de abas: Criar ou Associar */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-md">
          <Button
            type="button"
            variant={mode === 'criar' ? 'default' : 'ghost'}
            size="sm"
            className={
              mode === 'criar'
                ? 'bg-amber-500 text-black hover:bg-amber-600 font-semibold'
                : 'text-muted-foreground'
            }
            onClick={() => setMode('criar')}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            Criar Chamado
          </Button>
          <Button
            type="button"
            variant={mode === 'associar' ? 'default' : 'ghost'}
            size="sm"
            className={
              mode === 'associar'
                ? 'bg-amber-500 text-black hover:bg-amber-600 font-semibold'
                : 'text-muted-foreground'
            }
            onClick={() => setMode('associar')}
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            Associar Existente
          </Button>
        </div>

        {mode === 'criar' ? (
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Título do Chamado</Label>
              <Input
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={ticketType} onValueChange={setTicketType}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Requisição de Serviço">Requisição de Serviço</SelectItem>
                  <SelectItem value="Problema">Problema</SelectItem>
                  <SelectItem value="Mudança">Mudança</SelectItem>
                  <SelectItem value="Dúvida">Dúvida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Impacto</Label>
                <Select value={ticketImpact} onValueChange={(val: any) => setTicketImpact(val)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Urgência</Label>
                <Select value={ticketUrgency} onValueChange={(val: any) => setTicketUrgency(val)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 border border-border text-[11px] text-muted-foreground">
              Prioridade calculada: <b className="text-amber-500">{conversa.prioridade}</b>. O
              chamado herdará solicitante, histórico e métricas desta conversa.
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Buscar chamado existente por número ou título</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Ex: 2026-0001 ou VPN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchTickets()}
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={handleSearchTickets}
                  disabled={searching}
                >
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded p-1">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  {searching ? 'Buscando chamados...' : 'Nenhum chamado encontrado'}
                </div>
              ) : (
                searchResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`w-full text-left p-2 rounded text-xs border transition-colors flex items-center justify-between ${
                      selectedTicketId === t.id
                        ? 'bg-amber-500/15 border-amber-500 text-foreground font-medium'
                        : 'border-transparent hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div>
                      <div className="font-mono font-semibold text-foreground">
                        #{t.number || t.id.slice(0, 8)} - {t.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Solicitante: {t.requester_name} · Status: {t.status}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {mode === 'criar' ? (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={handleCriarChamado}
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Criar e Vincular Chamado'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={handleAssociarExistente}
              disabled={loading || !selectedTicketId}
            >
              {loading ? 'Vinculando...' : 'Vincular Selecionado'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
