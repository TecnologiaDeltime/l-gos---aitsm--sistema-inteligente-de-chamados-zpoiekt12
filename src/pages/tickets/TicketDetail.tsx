import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Send,
  Clock,
  User,
  Building2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Server,
  FileCheck,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  getTicket,
  getTicketInteractions,
  createInteraction,
  updateTicket,
  createSlaPause,
  TicketRecord,
} from '@/services/tickets'
import { getTicketVisits } from '@/services/technical-visits'
import { PriorityBadge } from '@/components/PriorityBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { SlaProgressBar } from '@/components/SlaProgressBar'
import { ApprovalDialog } from '@/components/ApprovalDialog'
import { VisitDialog } from '@/components/VisitDialog'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const perms = usePermissions()
  const { toast } = useToast()
  const [ticket, setTicket] = useState<TicketRecord | null>(null)
  const [interactions, setInteractions] = useState<any[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showApproval, setShowApproval] = useState(false)
  const [showVisit, setShowVisit] = useState(false)

  const loadData = () => {
    if (!id) return
    getTicket(id)
      .then(setTicket)
      .catch(() => {})
    getTicketInteractions(id)
      .then(setInteractions)
      .catch(() => {})
    getTicketVisits(id)
      .then(setVisits)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('tickets', () => loadData())
  useRealtime('ticket_interactions', () => loadData())
  useRealtime('technical_visits', () => loadData())

  const handleSendComment = async () => {
    if (!comment.trim() || !id || !user) return
    await createInteraction({
      ticket: id,
      author: user.id,
      type: isInternal ? 'Interno' : 'Público',
      content: comment,
    })
    setComment('')
    loadData()
    toast({ title: 'Interação adicionada!' })
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
      justification: 'Aguardando envio de logs',
      paused_by: user.id,
      paused_at: new Date().toISOString(),
    })
    await updateTicket(id, {
      sla_paused: true,
      sla_status: 'Pausado',
      status: 'Aguardando Cliente',
    })
    loadData()
    toast({ title: 'SLA Pausado' })
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
          {ticket.equipment && ticket.expand?.equipment && (
            <div className="flex items-center gap-2 text-xs">
              <Server className="h-4 w-4 text-slate-400" />
              <span>Ativo: </span>
              <Link
                to={`/cmdb/assets/${ticket.equipment}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {ticket.expand.equipment.name} ({ticket.expand.equipment.hostname || 'sem hostname'}
                )
              </Link>
            </div>
          )}
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
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Resolver
              </Button>
            )}
            {(perms.isAdmin || perms.isGestor || perms.isClienteGestor) && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowApproval(true)}>
                  <FileCheck className="mr-1.5 h-4 w-4" /> Solicitar Aprovação
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowVisit(true)}>
                  <MapPin className="mr-1.5 h-4 w-4" /> Agendar Visita
                </Button>
              </>
            )}
          </div>
        </div>
        <Tabs defaultValue="interactions" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none p-0 bg-transparent">
            <TabsTrigger value="interactions">Interações ({interactions.length})</TabsTrigger>
            <TabsTrigger value="visits">Visitas ({visits.length})</TabsTrigger>
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
                    {i.type === 'Interno' && (
                      <Badge variant="outline" className="text-[10px]">
                        Interno
                      </Badge>
                    )}
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
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-600 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />{' '}
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
          <TabsContent value="visits" className="pt-4 space-y-3">
            {visits.length === 0 ? (
              <p className="text-center text-sm text-slate-500 p-4">
                Nenhuma visita técnica agendada.
              </p>
            ) : (
              visits.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border p-4 text-xs space-y-1 bg-white dark:bg-slate-900"
                >
                  <div className="flex justify-between items-center">
                    <Badge variant="outline">{v.status}</Badge>
                    <span className="text-slate-400">
                      {v.scheduled_date
                        ? new Date(v.scheduled_date).toLocaleDateString('pt-BR')
                        : ''}{' '}
                      {v.scheduled_time || ''}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <MapPin className="inline h-3 w-3" /> {v.client_address || '-'}
                  </p>
                  <p className="text-slate-600">Técnico: {v.expand?.technician?.name || '-'}</p>
                  {v.materials && <p className="text-slate-600">Materiais: {v.materials}</p>}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
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
              <Building2 className="h-4 w-4 text-slate-400" /> Cliente:{' '}
              {ticket.expand?.company?.trade_name || 'N/A'}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4 text-slate-400" /> Técnico:{' '}
              {ticket.expand?.assigned_to?.name || 'Não atribuído'}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" /> Horas: {ticket.work_hours || 0}h
            </div>
            {ticket.equipment && ticket.expand?.equipment && (
              <div className="flex items-center gap-2 text-slate-600">
                <Server className="h-4 w-4 text-slate-400" /> Ativo:{' '}
                <Link
                  to={`/cmdb/assets/${ticket.equipment}`}
                  className="text-blue-600 hover:underline"
                >
                  {ticket.expand.equipment.name}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <ApprovalDialog ticketId={id!} open={showApproval} onOpenChange={setShowApproval} />
      <VisitDialog
        ticketId={id!}
        companyId={ticket.company}
        open={showVisit}
        onOpenChange={setShowVisit}
        onSaved={loadData}
      />
    </div>
  )
}
