export type ProjectMethodology = 'waterfall' | 'scrum' | 'lean'

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'suspended' | 'cancelled'

export type ProjectMemberRole = 'manager' | 'assignee' | 'collaborator'

export interface ProjectTeamMember {
  user_id: string
  role: ProjectMemberRole
  name?: string
  email?: string
}

export interface LeanStageDefinition {
  id: string
  label: string
  wip_limit?: number
  order: number
}

export type LeanStageConfig = LeanStageDefinition

export interface ProjectMethodologySettings {
  lean_stages?: LeanStageDefinition[]
  stale_threshold_days?: number // Desperdício lean: dias sem movimento
  scrum_default_sprint_weeks?: number
}

export interface ProjectRecord {
  id: string
  name: string
  description?: string
  company?: string
  manager?: string
  methodology: ProjectMethodology
  status: ProjectStatus
  start_date?: string
  target_date?: string
  completed_at?: string
  team_members?: ProjectTeamMember[]
  methodology_settings?: ProjectMethodologySettings
  total_worked_seconds?: number
  created: string
  updated: string
  expand?: {
    company?: {
      id: string
      name: string
      cnpj?: string
    }
    manager?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
  }
}

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled' | 'closed'

export interface ProjectSprintRecord {
  id: string
  project: string
  name: string
  goal?: string
  status: SprintStatus
  start_date?: string
  end_date?: string
  daily_notes?: string
  review_notes?: string
  retrospective_notes?: string
  created: string
  updated: string
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type WaterfallPhase = 'initiation' | 'planning' | 'execution' | 'monitoring' | 'closure'

export interface ProjectTaskRecord {
  id: string
  project: string
  title: string
  description?: string
  assigned_to?: string
  status: TaskStatus
  priority?: TaskPriority
  waterfall_phase?: WaterfallPhase
  is_milestone?: boolean
  sprint?: string
  story_points?: number
  lean_stage?: string
  due_date?: string
  completed_at?: string
  ticket?: string
  worked_seconds?: number
  order?: number
  created: string
  updated: string
  expand?: {
    assigned_to?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
    sprint?: ProjectSprintRecord
    ticket?: {
      id: string
      ticket_number?: number
      subject?: string
      title?: string
      status?: string
    }
  }
}

export interface ProjectWorkLogRecord {
  id: string
  project: string
  task?: string
  user: string
  description: string
  duration_seconds: number
  logged_at?: string
  ticket?: string
  created: string
  updated: string
  expand?: {
    user?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
    task?: {
      id: string
      title?: string
    }
    ticket?: {
      id: string
      ticket_number?: number
      subject?: string
      title?: string
    }
  }
}
