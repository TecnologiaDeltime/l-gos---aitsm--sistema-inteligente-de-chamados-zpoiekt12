import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star } from 'lucide-react'
import { getSurveyByToken, submitSurvey } from '@/services/satisfaction-surveys'
import { useToast } from '@/hooks/use-toast'

export default function SurveyPublic() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token)
      getSurveyByToken(token)
        .then(setData)
        .catch(() => {})
  }, [token])

  const fields = [
    { key: 'quality_score', label: 'Qualidade do Atendimento' },
    { key: 'time_score', label: 'Tempo de Resposta' },
    { key: 'communication_score', label: 'Comunicação' },
    { key: 'technical_score', label: 'Conhecimento Técnico' },
    { key: 'solution_score', label: 'Solução Apresentada' },
    { key: 'overall_score', label: 'Avaliação Geral' },
  ]

  const handleSubmit = async () => {
    if (!token) return
    setSubmitting(true)
    try {
      await submitSurvey(token, { ...scores, comment })
      toast({ title: 'Pesquisa enviada! Obrigado.' })
      navigate('/')
    } catch {
      toast({ title: 'Erro ao enviar', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!data)
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">Carregando...</div>
    )
  if (data.responded)
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold">Pesquisa já respondida</p>
            <p className="text-sm text-slate-500 mt-2">Obrigado pelo seu feedback!</p>
          </CardContent>
        </Card>
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Pesquisa de Satisfação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Chamado #{data.ticket_number} - {data.ticket_title}
          </p>
          {fields.map((f) => (
            <div key={f.key}>
              <p className="text-sm font-medium mb-1">{f.label}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScores((p) => ({ ...p, [f.key]: n }))}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${(scores[f.key] || 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="text-sm font-medium mb-1">Comentário (opcional)</p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          <Button
            className="w-full"
            disabled={submitting || fields.some((f) => !scores[f.key])}
            onClick={handleSubmit}
          >
            {submitting ? 'Enviando...' : 'Enviar Pesquisa'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
