import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { getMyPendingApprovals, decideChangeApproval } from '@/services/changes'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export default function PendingApprovals() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const loadData = () => {
    if (!user) return
    getMyPendingApprovals(user.id)
      .then(setApprovals)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('change_approvals', () => loadData())

  const handleDecide = async (changeId: string, decision: string) => {
    setProcessing(changeId + decision)
    try {
      await decideChangeApproval(changeId, decision, comments[changeId] || '')
      const label =
        decision === 'Aprovado'
          ? 'aprovada'
          : decision === 'Recusado'
            ? 'recusada'
            : 'marcada para revisão'
      toast({ title: `Mudança ${label}!` })
      loadData()
    } catch {
      toast({ title: 'Erro ao processar', variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return <div className="text-center py-8 text-sm text-slate-500">Carregando...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Clock className="h-5 w-5" /> Mudanças Pendentes de Aprovação
      </h2>
      {approvals.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Nenhuma aprovação pendente.</p>
      ) : (
        approvals.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/changes/${a.change}`}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    {a.expand?.change?.number || 'N/A'}
                  </Link>
                  <Badge variant="outline" className="text-[10px]">
                    Pendente
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(a.created).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="text-sm font-medium">{a.expand?.change?.title || 'N/A'}</p>
              <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                <span>Tipo: {a.expand?.change?.expand?.change_type?.name || '-'}</span>
                <span>Risco: {a.expand?.change?.risk_level || '-'}</span>
                <span>Solicitante: {a.expand?.change?.expand?.requester?.name || '-'}</span>
              </div>
              <p className="text-xs text-slate-600">{a.expand?.change?.description}</p>
              <Textarea
                placeholder="Comentário (opcional)..."
                value={comments[a.change] || ''}
                onChange={(e) => setComments({ ...comments, [a.change]: e.target.value })}
                rows={2}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleDecide(a.change, 'Aprovado')}
                  disabled={processing === a.change + 'Aprovado'}
                >
                  {processing === a.change + 'Aprovado' ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  )}{' '}
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDecide(a.change, 'Recusado')}
                  disabled={processing === a.change + 'Recusado'}
                >
                  {processing === a.change + 'Recusado' ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                  )}{' '}
                  Recusar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecide(a.change, 'Solicitar Revisão')}
                  disabled={processing === a.change + 'Solicitar Revisão'}
                >
                  {processing === a.change + 'Solicitar Revisão' ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  )}{' '}
                  Revisão
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
