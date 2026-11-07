import pb from '@/lib/pocketbase/client'

export interface ProjectDeadlineSettings {
  id: string
  enabled: boolean
  check_interval_minutes: number
  advance_days: number
  notify_manager: boolean
  notify_gestors: boolean
  notify_task_assignee: boolean
  created: string
  updated: string
}

const DEFAULTS: Omit<ProjectDeadlineSettings, 'id' | 'created' | 'updated'> = {
  enabled: true,
  check_interval_minutes: 60,
  advance_days: 3,
  notify_manager: true,
  notify_gestors: true,
  notify_task_assignee: true,
}

/** Busca a configuração global de notificações de prazo de projetos (registro único). */
export async function getProjectDeadlineSettings(): Promise<ProjectDeadlineSettings> {
  try {
    const list = await pb
      .collection('project_deadline_settings')
      .getList<ProjectDeadlineSettings>(1, 1, {
        sort: '-created',
      })
    if (list.items.length > 0) return list.items[0]
  } catch (_) {
    // coleção pode não existir ainda (antes da migração) — retorna defaults.
  }
  return { ...DEFAULTS, id: '', created: '', updated: '' } as ProjectDeadlineSettings
}

/** Atualiza (ou cria) a configuração global de notificações de prazo de projetos. */
export async function saveProjectDeadlineSettings(
  data: Partial<ProjectDeadlineSettings>,
): Promise<ProjectDeadlineSettings> {
  const existing = await getProjectDeadlineSettings()
  if (existing.id) {
    return pb
      .collection('project_deadline_settings')
      .update<ProjectDeadlineSettings>(existing.id, data)
  }
  return pb
    .collection('project_deadline_settings')
    .create<ProjectDeadlineSettings>({ ...DEFAULTS, ...data })
}
