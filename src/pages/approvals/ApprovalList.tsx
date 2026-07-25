import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  getApprovals,
  ApprovalRecord,
  APPROVAL_TYPES,
  APPROVAL_STATUSES,
} from '@/services/approvals'
import { useRealtime } from '@/hooks/use-realtime'

export default function ApprovalList() {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const loadData = () => {
    getApprovals()
      .then(setApprovals)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('approvals', () => loadData())

  const filtered = approvals.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    return true
  })

  const statusCls: Record<string, string> = {
    Pendente: 'bg-amber-100 text-amber-800',
    Aprovado: 'bg-green-100 text-green-800',
    Reprovado: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Aprovações</h2>
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {APPROVAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {APPROVAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhuma aprovação encontrada.
            </CardContent>
          </Card>
        ) : (
          filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={statusCls[a.status] || 'bg-slate-100'}>{a.status}</Badge>
                  <span className="text-xs font-medium text-slate-500">{a.type}</span>
                </div>
                <p className="text-sm font-medium">
                  {a.expand?.ticket ? (
                    <Link
                      to={`/tickets/${a.expand.ticket.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      #{a.expand.ticket.number}
                    </Link>
                  ) : (
                    'N/A'
                  )}{' '}
                  - {a.justification}
                </p>
                <p className="text-xs text-slate-500">
                  Solicitado por {a.expand?.requester?.name || 'N/A'} em{' '}
                  {new Date(a.created).toLocaleDateString('pt-BR')}
                  {a.estimated_cost ? ` · R$ ${a.estimated_cost}` : ''}
                  {a.deadline
                    ? ` · Prazo: ${new Date(a.deadline).toLocaleDateString('pt-BR')}`
                    : ''}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
