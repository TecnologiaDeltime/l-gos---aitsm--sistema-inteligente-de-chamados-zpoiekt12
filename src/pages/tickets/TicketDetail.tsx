import { useEffect, useState } from 'react'
import { useParams } from 'react'
import { Send, Clock, User, Building2, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getTicket,
  getTicketInteractions,
  createInteraction,
  updateTicket,
  createSlaPause,
  TicketRecord,
} from '@/services/tickets'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaProgressBar } from '@/components/SlaProgressBar'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const [ticket, setTicket] = useState<TicketRecord | null>(null)
  const [interactions, setInteractions] = useState<any[]>([])
  const [comment, setMessageComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const loadData = () => {
    if (!id) return
    getTicket(id)
      .then(setTicket)
      .catch(() => {})
    getTicketInteractions(id)
      .then(setInteractions)
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleSendComment = async () => {
    if (!comment.trim() || !id || !user) return
    await createInteraction({
      ticket: id,
      author: user.id,
      type: isInternal ? 'Interno' : 'Público',
      content: comment,
    })
    setMessageComment('')
    loadData()
    toast({ title: 'Interação adicionada com sucesso!' })
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return
    await updateTicket(id, { status: newStatus })
    loadData()
    toast({ title: `Status alterado para: ${newStatus}` })
  }

  const handlePauseSla = async () => {
    if (!id || !user) return
    await createSlaPause({
      ticket: id,
      reason: 'Aguardando Cliente',
      justification: 'Aguardando envio de logs pelo cliente',
      paused_by: user.id,
      paused_at: new Date().toISOString(),
    })
    await updateTicket(id, {
      sla_paused: true,
      sla_status: 'Pausado',
      status: 'Aguardando Cliente',
    })
    loadData()
    toast({ title: 'SLA Pausado com sucesso' })
  }

  const handleResumeSla = async () => {
    if (!id) return
    await updateTicket(id, {
      sla_paused: false,
      sla_status: 'Dentro do Prazo',
      status: 'Em Atendimento',
    })
    loadData()
    toast({ title: 'SLA Retomado' })
  }

  if (!ticket)
    return <div className="p-8 text-center text-slate-500">Carregando detalhes do chamado...</div>

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Coluna Principal */}
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              #{ticket.number} - {ticket.title}
            </h2>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Aberto por <span className="font-semibold text-slate-700">{ticket.requester_name}</span>{' '}
            em {new Date(ticket.created).toLocaleString('pt-BR')}
          </p>

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-800 border dark:bg-slate-800 dark:text-slate-200">
            {ticket.description}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            {ticket.status !== 'Em Atendimento' && (
              <Button size="sm" onClick={() => handleStatusChange('Em Atendimento')}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Iniciar Atendimento
              </Button>
            )}

            {ticket.sla_paused ? (
              <Button size="sm" variant="outline" onClick={handleResumeSla}>
                <PlayCircle className="mr-1.5 h-4 w-4 text-green-600" /> Retomar SLA
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handlePauseSla}>
                <PauseCircle className="mr-1.5 h-4 w-4 text-amber-600" /> Pausar SLA
              </Button>
            )}

            {ticket.status !== 'Resolvido' && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleStatusChange('Resolvido')}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Resolver Chamado
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="interactions" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none p-0 bg-transparent">
            <TabsTrigger value="interactions">Interações ({interactions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="interactions" className="pt-4 space-y-4">
            <div className="space-y-3">
              {interactions.map((i) => (
                <div
                  key={i.id}
                  className="rounded-lg border p-4 text-xs space-y-1 bg-white dark:bg-slate-900"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">
                      {i.expand?.author?.name || 'Usuário'}
                    </span>
                    <span className="text-slate-400">
                      {new Date(i.created).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-slate-700">{i.content}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-white p-4 space-y-3">
              <Textarea
                placeholder="Escreva uma resposta ou nota interna..."
                value={comment}
                onChange={(e) => setMessageComment(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-600 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                  Nota interna (visível apenas para a equipe)
                </label>
                <Button
                  onClick={handleSendComment}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar Info */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4 dark:bg-slate-900">
          <h3 className="font-semibold text-sm border-b pb-2">Controle de SLA</h3>
          <SlaProgressBar
            slaStatus={ticket.sla_status}
            paused={ticket.sla_paused}
            deadline={ticket.sla_solution_deadline}
          />

          <div className="pt-2 border-t space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400" />
              <span>Cliente: {ticket.expand?.company?.trade_name || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4 text-slate-400" />
              <span>Técnico: {ticket.expand?.assigned_to?.name || 'Não atribuído'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Horas: {ticket.work_hours || 0}h registradas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
