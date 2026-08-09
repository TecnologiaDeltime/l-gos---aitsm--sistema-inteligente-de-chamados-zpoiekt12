import pb from '@/lib/pocketbase/client'

export interface ProblemRecord {
  id: string
  number: string
  title: string
  description: string
  symptom?: string
  expected_behavior?: string
  current_behavior?: string
  impact_description?: string
  frequency?: string
  first_occurrence_date?: string
  last_occurrence_date?: string
  origin?: string
  origin_record_id?: string
  status: string
  priority: string
  impact: string
  urgency: string
  requester: string
  responsible?: string
  team?: string
  company?: string
  contract?: string
  service?: string
  category?: string
  subcategory?: string
  impact_classification?: string
  affected_services?: string
  affected_clients?: string
  affected_users_count?: number
  avg_downtime?: string
  financial_impact?: string
  security_impact?: string
  reputational_impact?: string
  regulatory_impact?: string
  investigation_responsible?: string
  investigation_start_date?: string
  investigation_evidence?: string
  investigation_logs?: string
  investigation_tests?: string
  investigation_analyses?: string
  investigation_tools?: string
  investigation_observations?: string
  root_cause_identified?: string
  root_cause_evidence?: string
  root_cause_method?: string
  root_cause_responsible?: string
  root_cause_date?: string
  root_cause_confidence?: string
  five_whys?: any
  ishikawa?: any
  is_known_error?: boolean
  effectiveness_start_date?: string
  effectiveness_end_date?: string
  effectiveness_period_days?: number
  effectiveness_result?: string
  incidents_before_count?: number
  incidents_after_count?: number
  closure_notes?: string
  reopened_count?: number
  reopen_reason?: string
  created: string
  updated: string
  expand?: any
}

const EXPAND =
  'requester,responsible,team,company,contract,category,subcategory,investigation_responsible,root_cause_responsible'

export const getProblems = (filter?: string) =>
  pb.collection('problems').getFullList<ProblemRecord>({ filter, sort: '-created', expand: EXPAND })

export const getProblem = (id: string) =>
  pb.collection('problems').getOne<ProblemRecord>(id, { expand: EXPAND })

export const createProblem = (data: Partial<ProblemRecord>) =>
  pb.collection('problems').create<ProblemRecord>(data)

export const updateProblem = (id: string, data: Partial<ProblemRecord>) =>
  pb.collection('problems').update<ProblemRecord>(id, data)

export const deleteProblem = (id: string) => pb.collection('problems').delete(id)

export const getProblemIncidents = (problemId: string) =>
  pb.collection('problem_incidents').getFullList({
    filter: `problem = "${problemId}"`,
    sort: '-created',
    expand: 'ticket,ticket.company,ticket.category,ticket.assigned_to',
  })

export const addProblemIncident = (problemId: string, ticketId: string) =>
  pb.collection('problem_incidents').create({ problem: problemId, ticket: ticketId })

export const removeProblemIncident = (id: string) => pb.collection('problem_incidents').delete(id)

export const getProblemsByTicket = (ticketId: string) =>
  pb.collection('problem_incidents').getFullList({
    filter: `ticket = "${ticketId}"`,
    expand: 'problem',
  })

export const getHypotheses = (problemId: string) =>
  pb
    .collection('problem_hypotheses')
    .getFullList({ filter: `problem = "${problemId}"`, sort: 'created' })

export const createHypothesis = (data: any) => pb.collection('problem_hypotheses').create(data)
export const updateHypothesis = (id: string, data: any) =>
  pb.collection('problem_hypotheses').update(id, data)
export const deleteHypothesis = (id: string) => pb.collection('problem_hypotheses').delete(id)

export const getWorkarounds = (problemId: string) =>
  pb
    .collection('problem_workarounds')
    .getFullList({ filter: `problem = "${problemId}"`, sort: '-created', expand: 'responsible' })

export const createWorkaround = (data: any) => pb.collection('problem_workarounds').create(data)
export const updateWorkaround = (id: string, data: any) =>
  pb.collection('problem_workarounds').update(id, data)

export const getEvaluations = (problemId: string) =>
  pb
    .collection('problem_effectiveness_evaluations')
    .getFullList({ filter: `problem = "${problemId}"`, sort: '-created', expand: 'evaluated_by' })

export const createEvaluation = (data: any) =>
  pb.collection('problem_effectiveness_evaluations').create(data)

export const getDefinitiveSolutions = (problemId: string) =>
  pb.collection('problem_definitive_solutions').getFullList({
    filter: `problem = "${problemId}"`,
    sort: '-created',
    expand: 'responsible,related_change',
  })

export const createDefinitiveSolution = (data: any) =>
  pb.collection('problem_definitive_solutions').create(data)

export const getExtensions = (problemId: string) =>
  pb
    .collection('problem_extensions')
    .getFullList({ filter: `problem = "${problemId}"`, sort: '-created', expand: 'responsible' })

export const createExtension = (data: any) => pb.collection('problem_extensions').create(data)

export const getKnownErrors = (filter?: string) =>
  pb
    .collection('known_errors')
    .getFullList({ filter, sort: '-created', expand: 'problem,responsible' })

export const createKnownError = (data: any) => pb.collection('known_errors').create(data)
export const updateKnownError = (id: string, data: any) =>
  pb.collection('known_errors').update(id, data)

export const getProblemAuditLogs = (problemId: string) =>
  pb
    .collection('problem_audit_logs')
    .getFullList({ filter: `problem = "${problemId}"`, sort: '-created', expand: 'user' })

export const getProblemTimeline = (problemId: string) =>
  pb
    .collection('problem_timeline')
    .getFullList({ filter: `problem = "${problemId}"`, sort: 'created', expand: 'responsible' })

export const aiAnalyzeIncidents = (days?: number, minIncidents?: number) =>
  pb.send('/backend/v1/problems/ai-analyze', {
    method: 'POST',
    body: JSON.stringify({ days, min_incidents: minIncidents }),
    headers: { 'Content-Type': 'application/json' },
  })

export const aiEffectivenessAnalysis = (problemId: string) =>
  pb.send('/backend/v1/problems/ai-effectiveness', {
    method: 'POST',
    body: JSON.stringify({ problem_id: problemId }),
    headers: { 'Content-Type': 'application/json' },
  })
