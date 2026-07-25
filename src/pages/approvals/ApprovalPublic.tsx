import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle } from 'lucide-react'
import { getApprovalByToken, decideApproval } from '@/services/approvals'
import { useToast } from '@/hooks/use-toast'

export default function ApprovalPublic() {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token)
      getApprovalByToken(token)
        .then(setData)
        .catch(() => {})
  }, [token])

  const handleDecide = async (decision: 'approved' | 'rejected') => {
    if (!token) return
    setSubmitting(true)
    try {
      await decideApproval(token, decision, comment)
      const updated = await getApprovalByToken(token)
      setData(updated)
      toast({ title: `Aprovação ${decision === 'approved' ? 'aprovada' : 'reprovada'}!` })
    } catch {
      toast({ title: 'Erro ao processar', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!data)
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">Carregando...</div>
    )

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl">Solicitação de Aprovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Chamado</p>
              <p className="font-semibold">#{data.ticket_number}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Solicitante</p>
              <p className="font-semibold">{data.requester_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tipo</p>
              <p className="font-semibold">{data.type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Prazo</p>
              <p className="font-semibold">
                {data.deadline ? new Date(data.deadline).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Horas Est.</p>
              <p className="font-semibold">{data.estimated_hours || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Custo Est.</p>
              <p className="font-semibold">
                {data.estimated_cost ? `R$ ${data.estimated_cost}` : '-'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Justificativa</p>
            <p className="text-sm rounded-lg bg-slate-50 p-3 border">{data.justification}</p>
          </div>
          {data.status !== 'Pendente' && (
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm font-semibold">
                {data.status === 'Aprovado' ? 'Aprovado' : 'Reprovado'}
              </p>
              {data.approver_comment && (
                <p className="text-xs text-slate-500 mt-1">{data.approver_comment}</p>
              )}
            </div>
          )}
          {data.status === 'Pendente' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Comentário (opcional)</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                  onClick={() => handleDecide('approved')}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={submitting}
                  onClick={() => handleDecide('rejected')}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reprovar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
