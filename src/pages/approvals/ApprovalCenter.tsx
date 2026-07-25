import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, CheckCircle, XCircle, FileCheck, AlertTriangle } from 'lucide-react'
import { getApprovals, decideApproval, ApprovalRecord } from '@/services/approvals'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

const STATUS_CLS: Record<string, string> = {
  Pendente: 'bg-amber-100 text-amber-800',
  Aprovado: 'bg-green-100 text-green-800',
  Reprovado: 'bg-red-100 text-red-800',
}

export default function ApprovalCenter() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [sortBy, setSortBy] = useState('created')

  const loadData = () => {
    if (!user) return
    getApprovals(`approver = "${user.id}"`)
      .then(setApprovals)
      .catch(() => {
        getApprovals()
          .then(setApprovals)
          .catch(() => {})
      })
  }
  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('approvals', () => loadData())

  const sorted = [...approvals].sort((a, b) => {
    if (sortBy === 'deadline') {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
      return da - db
    }
    return new Date(b.created).getTime() - new Date(a.created).getTime()
  })

  const pending = sorted.filter((a) => a.status === 'Pendente')
  const approved = sorted.filter((a) => a.status === 'Aprovado')
  const rejected = sorted.filter((a) => a.status === 'Reprovado')
  const overdue = pending.filter((a) => a.deadline && new Date(a.deadline) < new Date())

  const handleDecide = async (token: string, decision: string) => {
    try {
      await decideApproval(token, decision, '')
      toast({ title: `Aprovação ${decision === 'approved' ? 'concedida' : 'recusada'}!` })
      loadData()
    } catch {
      toast({ title: 'Erro ao processar', variant: 'destructive' })
    }
  }

  const renderCard = (a: ApprovalRecord) => (
    <Card key={a.id}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge className={STATUS_CLS[a.status] || 'bg-slate-100'}>{a.status}</Badge>
          <span className="text-[10px] text-slate-500">{a.type}</span>
          {a.deadline && new Date(a.deadline) < new Date() && a.status === 'Pendente' && (
            <Badge className="bg-red-100 text-red-700">
              <AlertTriangle className="mr-0.5 h-3 w-3" />
              Vencida
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium">
          {a.expand?.ticket ? (
            <Link to={`/tickets/${a.expand.ticket.id}`} className="text-blue-600 hover:underline">
              #{a.expand.ticket.number}
            </Link>
          ) : (
            'N/A'
          )}{' '}
          - {a.justification}
        </p>
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span>Solicitante: {a.expand?.requester?.name || 'N/A'}</span>
          {a.estimated_cost ? <span>Valor: R$ {a.estimated_cost}</span> : null}
          {a.deadline ? (
            <span>Prazo: {new Date(a.deadline).toLocaleDateString('pt-BR')}</span>
          ) : null}
          <span>Data: {new Date(a.created).toLocaleDateString('pt-BR')}</span>
        </div>
        {a.status === 'Pendente' && a.token && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleDecide(a.token!, 'approved')}
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDecide(a.token!, 'rejected')}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Recusar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileCheck className="h-5 w-5" /> Central de Aprovações
        </h2>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Mais Recentes</SelectItem>
            <SelectItem value="deadline">Prazo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="text-xs">
            Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="overdue" className="text-xs">
            Vencidas ({overdue.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">
            Aprovadas ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">
            Recusadas ({rejected.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-2 mt-2">
          {pending.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-4">Nenhuma aprovação pendente.</p>
          ) : (
            pending.map(renderCard)
          )}
        </TabsContent>
        <TabsContent value="overdue" className="space-y-2 mt-2">
          {overdue.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-4">Nenhuma aprovação vencida.</p>
          ) : (
            overdue.map(renderCard)
          )}
        </TabsContent>
        <TabsContent value="approved" className="space-y-2 mt-2">
          {approved.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-4">Nenhuma aprovação concedida.</p>
          ) : (
            approved.map(renderCard)
          )}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-2 mt-2">
          {rejected.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-4">Nenhuma aprovação recusada.</p>
          ) : (
            rejected.map(renderCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
