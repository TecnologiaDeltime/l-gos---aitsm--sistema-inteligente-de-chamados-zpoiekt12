import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle, XCircle } from 'lucide-react'
import { getApprovals, decideApproval, ApprovalRecord } from '@/services/approvals'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/hooks/use-toast'
import { ApprovalRulesTab } from '@/components/approvals/ApprovalRulesTab'
import { ApprovalDecisionDialog } from '@/components/approvals/ApprovalDecisionDialog'

const STATUS_CLS: Record<string, string> = {
  Pendente: 'bg-amber-100 text-amber-800',
  Aprovado: 'bg-green-100 text-green-800',
  Reprovado: 'bg-red-100 text-red-800',
}

export default function ApprovalList() {
  const { canManageClients } = usePermissions()
  const { toast } = useToast()
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)

  const loadData = () =>
    getApprovals()
      .then(setApprovals)
      .catch(() => {})
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('approvals', () => loadData())

  const pending = approvals.filter((a) => a.status === 'Pendente')
  const history = approvals.filter((a) => a.status !== 'Pendente')

  const openDialog = (token: string, dec: 'approved' | 'rejected') => {
    setSelectedToken(token)
    setDecision(dec)
    setDialogOpen(true)
  }

  const handleConfirm = async (comment: string) => {
    if (!selectedToken || !decision) return
    try {
      await decideApproval(selectedToken, decision, comment)
      toast({
        title: decision === 'approved' ? 'Aprovação concedida!' : 'Aprovação recusada!',
      })
      setDialogOpen(false)
      loadData()
    } catch {
      toast({ title: 'Erro ao processar', variant: 'destructive' })
    }
  }

  const ticketNum = (a: ApprovalRecord) => a.expand?.ticket?.number || 'N/A'
  const clientName = (a: ApprovalRecord) => {
    const co = a.expand?.ticket?.expand?.company
    return co?.trade_name || co?.legal_name || 'N/A'
  }
  const activityName = (a: ApprovalRecord) => {
    const t = a.expand?.ticket
    return t?.expand?.subcategory?.name || t?.expand?.category?.name || 'N/A'
  }

  const renderRow = (a: ApprovalRecord) => (
    <TableRow key={a.id}>
      <TableCell className="text-sm">
        {a.expand?.ticket ? (
          <Link to={`/tickets/${a.expand.ticket.id}`} className="text-blue-600 hover:underline">
            #{ticketNum(a)}
          </Link>
        ) : (
          'N/A'
        )}
      </TableCell>
      <TableCell className="text-sm">{clientName(a)}</TableCell>
      <TableCell className="text-sm">{activityName(a)}</TableCell>
      <TableCell className="text-sm text-slate-500">
        {new Date(a.created).toLocaleDateString('pt-BR')}
      </TableCell>
      <TableCell className="text-sm max-w-xs truncate" title={a.justification}>
        {a.justification}
      </TableCell>
      <TableCell>
        <Badge className={STATUS_CLS[a.status] || 'bg-slate-100'}>{a.status}</Badge>
      </TableCell>
      {canManageClients && (
        <TableCell>
          {a.status === 'Pendente' && a.token && (
            <div className="flex gap-1">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                onClick={() => openDialog(a.token!, 'approved')}
              >
                <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => openDialog(a.token!, 'rejected')}
              >
                <XCircle className="mr-1 h-3 w-3" /> Rejeitar
              </Button>
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  )

  const cols = canManageClients ? 7 : 6
  const headers = (
    <TableRow>
      <TableHead>Chamado</TableHead>
      <TableHead>Cliente</TableHead>
      <TableHead>Atividade</TableHead>
      <TableHead>Data</TableHead>
      <TableHead>Justificativa</TableHead>
      <TableHead>Status</TableHead>
      {canManageClients && <TableHead>Ações</TableHead>}
    </TableRow>
  )

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Aprovações</h2>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico ({history.length})</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>{headers}</TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={cols} className="text-center text-sm text-slate-500 py-8">
                        Nenhuma aprovação pendente.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pending.map(renderRow)
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>{headers}</TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={cols} className="text-center text-sm text-slate-500 py-8">
                        Nenhum histórico.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map(renderRow)
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <ApprovalRulesTab />
        </TabsContent>
      </Tabs>
      <ApprovalDecisionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        decision={decision}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
