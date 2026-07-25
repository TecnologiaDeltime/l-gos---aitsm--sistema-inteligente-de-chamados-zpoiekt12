import pb from '@/lib/pocketbase/client'

export interface ContinuityDecisionRecord {
  id: string
  contract?: string
  client?: string
  decision?: string
  hours_authorized?: number
  value_authorized?: number
  respondent_email?: string
  ip_address?: string
  notes?: string
  responded_at?: string
  created: string
  expand?: any
}

export const DECISION_OPTIONS = [
  'Autorizar Continuidade com Excedente',
  'Solicitar Contratação Horas Adicionais',
  'Solicitar Novo Orçamento',
  'Suspender Atendimentos',
  'Solicitar Contato Comercial',
  'Continuar Apenas Críticos',
]

export const getContinuityDecisions = () =>
  pb.collection('continuity_decisions').getFullList<ContinuityDecisionRecord>({
    sort: '-created',
    expand: 'contract,client',
  })

export const createContinuityDecision = (data: Partial<ContinuityDecisionRecord>) =>
  pb.collection('continuity_decisions').create<ContinuityDecisionRecord>(data)
