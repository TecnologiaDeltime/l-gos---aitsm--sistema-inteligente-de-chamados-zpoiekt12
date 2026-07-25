import pb from '@/lib/pocketbase/client'

export interface SatisfactionSurveyRecord {
  id: string
  ticket: string
  company: string
  respondent: string
  quality_score?: number
  time_score?: number
  communication_score?: number
  technical_score?: number
  solution_score?: number
  overall_score?: number
  comment?: string
  responded_at?: string
  token?: string
  created: string
  updated: string
  expand?: any
}

export const getSurveys = (filter?: string) =>
  pb.collection('satisfaction_surveys').getFullList<SatisfactionSurveyRecord>({
    filter,
    sort: '-created',
    expand: 'ticket,company,respondent',
  })

export const getSurvey = (id: string) =>
  pb.collection('satisfaction_surveys').getOne<SatisfactionSurveyRecord>(id, {
    expand: 'ticket,company,respondent',
  })

export const getSurveyByToken = (token: string) =>
  pb.send(`/backend/v1/surveys/${token}`, { method: 'GET' })

export const submitSurvey = (token: string, data: Record<string, any>) =>
  pb.send(`/backend/v1/surveys/${token}/respond`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
