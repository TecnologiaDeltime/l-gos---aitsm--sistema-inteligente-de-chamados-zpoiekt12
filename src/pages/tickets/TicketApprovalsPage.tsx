import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ShieldCheck, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { getApprovals, APPROVAL_TYPES } from '@/services/approvals'
import type { ApprovalRecord } from '@/services/approvals'
import { useAuth } from '@/hooks/use-auth'

const STATUS_BADGE: Record<string, string> = {
  Aprovado:
    'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40',
  Reprovado:
    'bg-red-500/10 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',
  Pendente:
    'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
}

export default function TicketApprovalsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const loadApprovals = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const data = await getApprovals()
        setApprovals(data)
      } catch (err) {
        console.error(err)
        if (!silent) {
          toast({
            title: 'Erro ao carregar aprovações',
            description: 'Não foi possível buscar as aprovações pendentes.',
            variant: 'destructive',
          })
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  const isClientUser = user?.role === 'cliente_solicitante' || user?.role === 'cliente_gestor'

  const typesInUse = Array.from(new Set(approvals.map((a) => a.type).filter(Boolean))).sort()
  const typeOptions = Array.from(new Set([...APPROVAL_TYPES, ...typesInUse]))

  const filtered = approvals.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = `${a.expand?.ticket?.number || ''} ${a.expand?.ticket?.title || ''} ${
        a.expand?.requester?.name || ''
      } ${a.expand?.approver?.name || ''} ${a.target_email || ''} ${a.justification || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const pendingCount = approvals.filter((a) => a.status === 'Pendente').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            Aprovações
          </h1>
          <p className="text-sm text-muted-foreground">
            Pendências de aprovação geradas pelo fluxo de aprovação dos chamados.
            {!isClientUser &&
              ' A decisão acontece no portal do cliente, por e-mail ou link público.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => loadApprovals(true)} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por chamado, solicitante, aprovador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Reprovado">Reprovado</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading
              ? 'Carregando...'
              : `${filtered.length} aprovação(ões) · ${pendingCount} pendente(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma aprovação encontrada com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Chamado</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[170px]">Tipo</TableHead>
                    <TableHead className="w-[160px]">Solicitante</TableHead>
                    <TableHead className="w-[160px]">Aprovador</TableHead>
                    <TableHead className="w-[140px]">Papel</TableHead>
                    <TableHead className="w-[150px]">Criada em</TableHead>
                    <TableHead className="w-[150px]">Decisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const ticketNumber = a.expand?.ticket?.number || '—'
                    const ticketTitle =
                      a.expand?.ticket?.title || a.expand?.ticket?.description || '—'
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm font-semibold">
                          {a.expand?.ticket?.id ? (
                            <Link to={`/tickets/${a.expand.ticket.id}`} className="hover:underline">
                              {ticketNumber}
                            </Link>
                          ) : (
                            ticketNumber
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[320px] truncate text-sm font-medium">
                            {a.expand?.ticket?.id ? (
                              <Link
                                to={`/tickets/${a.expand.ticket.id}`}
                                className="hover:underline"
                              >
                                {ticketTitle}
                              </Link>
                            ) : (
                              ticketTitle
                            )}
                          </div>
                          {a.justification && (
                            <div className="mt-0.5 max-w-[320px] truncate text-xs text-muted-foreground">
                              {a.justification}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`itsm-badge ${STATUS_BADGE[a.status] || ''}`}
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.type}
                          {a.mode && (
                            <span className="ml-1 text-xs text-muted-foreground">({a.mode})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.expand?.requester?.name || a.target_email || a.requester || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.expand?.approver?.name || a.expand?.target_contact?.full_name || '—'}
                        </TableCell>
                        <TableCell>
                          {a.approval_role ? (
                            <Badge variant="outline" className="text-[10px]">
                              {a.approval_role === 'client'
                                ? 'Cliente'
                                : a.approval_role === 'internal'
                                  ? 'Interna'
                                  : 'Geral'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(a.created).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.approved_at
                            ? `Aprovada em ${new Date(a.approved_at).toLocaleString('pt-BR')}`
                            : a.rejected_at
                              ? `Reprovada em ${new Date(a.rejected_at).toLocaleString('pt-BR')}`
                              : a.deadline
                                ? `Prazo: ${new Date(a.deadline).toLocaleString('pt-BR')}`
                                : '—'}
                          {a.rejection_reason && (
                            <div className="text-red-500">Motivo: {a.rejection_reason}</div>
                          )}
                          {a.approver_comment && <div>Comentário: {a.approver_comment}</div>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
