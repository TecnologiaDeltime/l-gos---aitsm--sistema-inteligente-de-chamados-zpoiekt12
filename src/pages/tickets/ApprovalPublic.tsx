import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Ticket,
  Building2,
  User,
  ArrowLeft,
} from 'lucide-react'
import { getApprovalByToken, decideApproval } from '@/services/approvals'
import { useToast } from '@/hooks/use-toast'

export default function ApprovalPublic() {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [decisionResult, setDecisionResult] = useState<'Aprovado' | 'Reprovado' | null>(null)

  const loadApproval = async () => {
    if (!token) {
      setError('Token de aprovação não fornecido.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getApprovalByToken(token)
      setData(res)
      if (res.status !== 'Pendente') {
        setDecisionResult(res.status)
      }
    } catch (err: any) {
      setError(err?.message || 'Aprovação não encontrada ou token expirado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApproval()
  }, [token])

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!token) return
    setSubmitting(true)
    try {
      await decideApproval(token, decision, comment)
      const resStatus = decision === 'approved' ? 'Aprovado' : 'Reprovado'
      setDecisionResult(resStatus)
      toast({
        title: decision === 'approved' ? 'Chamado aprovado com sucesso!' : 'Chamado reprovado',
        description:
          decision === 'approved'
            ? 'O chamado foi liberado para atendimento.'
            : 'O chamado foi cancelado.',
      })
      await loadApproval()
    } catch (err: any) {
      toast({
        title: 'Falha ao registrar decisão',
        description:
          err?.message || 'Tente novamente ou verifique se a aprovação já foi concluída.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center space-y-2">
          <Clock className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm font-medium text-slate-600">
            Carregando solicitação de aprovação...
          </p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full shadow-lg border-slate-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-lg">Solicitação Não Encontrada</CardTitle>
            <CardDescription>
              {error || 'O link pode ser inválido ou já ter expirado.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-4">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Ir para a Página de Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isCompleted = decisionResult || data.status !== 'Pendente'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-8 px-4 flex items-center justify-center">
      <Card className="max-w-2xl w-full shadow-xl border-slate-200 bg-white">
        <CardHeader className="border-b bg-slate-50/70 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-slate-900 tracking-tight">Lógos AITSM</span>
            </div>
            <Badge
              variant={
                data.status === 'Aprovado'
                  ? 'default'
                  : data.status === 'Reprovado'
                    ? 'destructive'
                    : 'secondary'
              }
              className={data.status === 'Aprovado' ? 'bg-green-600 text-white' : ''}
            >
              {data.status === 'Pendente' ? 'Aprovação Pendente' : data.status}
            </Badge>
          </div>
          <CardTitle className="text-xl mt-3 text-slate-900">
            Aprovação de Chamado #{data.ticket_number}
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">{data.ticket_title}</CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Informações Resumidas do Chamado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 block">Número do Chamado</span>
                <span className="font-semibold text-slate-800">#{data.ticket_number}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 block">Empresa / Cliente</span>
                <span className="font-semibold text-slate-800">
                  {data.company_name || 'Não informada'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 block">Solicitante</span>
                <span className="font-semibold text-slate-800">{data.requester_name || '-'}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 block">Modo de Aprovação</span>
              <span className="font-semibold text-slate-800">
                {data.mode || 'Individual'} {data.stage ? `(Nível ${data.stage})` : ''}
              </span>
            </div>
          </div>

          {/* Atividade e Categoria */}
          {(data.category_name || data.subcategory_name) && (
            <div className="text-xs flex items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-700">Atividade:</span>
              <span>{data.category_name}</span>
              {data.subcategory_name && <span>→ {data.subcategory_name}</span>}
            </div>
          )}

          {/* Assunto e Descrição Literal do Problema */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Descrição do Problema / Atividade Apontada
            </label>
            <div className="p-4 rounded-lg border bg-white text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {data.ticket_description || data.ticket_title || 'Sem descrição detalhada'}
            </div>
          </div>

          {/* Justificativa da Aprovação */}
          {data.justification && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Justificativa da Solicitação
              </label>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                {data.justification}
              </div>
            </div>
          )}

          {/* Status já finalizado */}
          {isCompleted ? (
            <div className="p-5 rounded-lg border text-center space-y-2 bg-slate-50">
              {data.status === 'Aprovado' || decisionResult === 'Aprovado' ? (
                <>
                  <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
                  <h3 className="font-bold text-lg text-green-900">Chamado Aprovado</h3>
                  <p className="text-sm text-slate-600">
                    Esta solicitação já foi aprovada e o chamado segue o fluxo normal de
                    atendimento.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-10 w-10 text-red-600 mx-auto" />
                  <h3 className="font-bold text-lg text-red-900">Chamado Reprovado</h3>
                  <p className="text-sm text-slate-600">
                    Esta solicitação foi reprovada e o chamado foi cancelado.
                  </p>
                </>
              )}
              {data.approver_comment && (
                <div className="text-xs text-slate-500 mt-2 bg-white p-3 rounded border">
                  <strong>Observação registrada:</strong> {data.approver_comment}
                </div>
              )}
            </div>
          ) : (
            /* Formulário de Decisão Interativo */
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Observação / Parecer da Decisão (opcional)
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Insira detalhes ou orientações sobre a aprovação/reprovação..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => handleDecision('approved')}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base shadow-sm"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {submitting ? 'Processando...' : 'Aprovar Chamado'}
                </Button>

                <Button
                  onClick={() => handleDecision('rejected')}
                  disabled={submitting}
                  variant="destructive"
                  className="font-bold h-12 text-base shadow-sm bg-red-600 hover:bg-red-700"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  {submitting ? 'Processando...' : 'Reprovar Chamado'}
                </Button>
              </div>

              <p className="text-center text-xs text-slate-400">
                Você pode decidir sem efetuar login. A ação é registrada com auditoria no histórico
                do chamado.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
