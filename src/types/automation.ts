export interface AutomationRecord {
  id: string
  name: string
  code: string
  description?: string
  client?: string
  catalog?: string
  service?: string
  ticket_type?: string
  current_version?: number
  status: string
  execution_priority?: number
  validity_start?: string
  validity_end?: string
  responsible?: string
  is_template?: boolean
  template_category?: string
  schedule_cron?: string
  created: string
  updated: string
  expand?: any
}

export interface WorkflowVersionRecord {
  id: string
  automation: string
  version_number: number
  status: string
  published_by?: string
  published_at?: string
  changes?: string
  reason?: string
  definition?: string
  created: string
  updated: string
}

export interface WorkflowBlock {
  id: string
  type: string
  label: string
  x: number
  y: number
  config: Record<string, any>
}

export interface WorkflowConnection {
  id: string
  source: string
  target: string
  sourcePort?: string
}

export interface WorkflowDefinition {
  blocks: WorkflowBlock[]
  connections: WorkflowConnection[]
}

export interface WorkflowExecutionRecord {
  id: string
  automation: string
  version?: string
  ticket?: string
  status: string
  started_at?: string
  completed_at?: string
  error?: string
  current_block?: string
  created: string
  updated: string
  expand?: any
}

export interface WorkflowExecutionLogRecord {
  id: string
  execution: string
  block_id?: string
  block_type?: string
  block_label?: string
  timestamp?: string
  result?: string
  input?: string
  output?: string
  error?: string
  retries?: number
  next_action?: string
  created: string
}

export interface WorkflowTaskRecord {
  id: string
  ticket?: string
  automation?: string
  execution?: string
  title: string
  description?: string
  responsible?: string
  queue?: string
  deadline?: string
  priority?: string
  status: string
  checklist?: any
  estimated_time?: number
  hour_type?: string
  required_evidence?: boolean
  required_approval?: boolean
  parent_task?: string
  task_type?: string
  completed_at?: string
  completed_by?: string
  created: string
  updated: string
  expand?: any
}
