import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { readImpersonation } from '@/services/collaborator-impersonation'

const BASE_URL = '/backend/v1/collaborator'

const STORAGE_KEY = 'logos_collaborator_session'

export interface CollaboratorRecord {
  id: string
  name: string
  email: string
  company: string
  company_name?: string
}

export interface CollaboratorTicket {
  id: string
  number: string
  title: string
  status: string
  priority?: string
  created: string
  updated?: string
}

export interface CollaboratorInteraction {
  id: string
  content: string
  type: string
  origin?: string
  author_name: string
  created: string
}

export interface CollaboratorSurvey {
  rating: number
  comment: string
  responded_at?: string
}

export interface CollaboratorPendingSurvey {
  ticket_id: string
  ticket_number: string
  ticket_title?: string
}

interface MeResponse {
  collaborator: CollaboratorRecord
  survey_required: boolean
  pending_survey: CollaboratorPendingSurvey | null
}

function readToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Chamada às rotas do hook A2_collaborator_portal via pb.send
 * (mesmo padrão dos demais hooks: base URL do PocketBase).
 */
export async function collaboratorApi<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  return pb.send<T>(BASE_URL + path, {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
}

export function useCollaboratorAuth() {
  const [collaborator, setCollaborator] = useState<CollaboratorRecord | null>(null)
  const [surveyRequired, setSurveyRequired] = useState(false)
  const [pendingSurvey, setPendingSurvey] = useState<CollaboratorPendingSurvey | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // Impersonação de admin: sessão em sessionStorage tem prioridade sobre o
    // token normal (localStorage) — o painel mostra exatamente o que o
    // colaborador vê, via o mesmo token do portal.
    const imp = readImpersonation()
    const token = imp ? imp.token : readToken()
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const me = await collaboratorApi<MeResponse>(`/me?token=${encodeURIComponent(token)}`)
      setCollaborator(me.collaborator)
      setSurveyRequired(me.survey_required)
      setPendingSurvey(me.pending_survey)
    } catch {
      writeToken(null)
      setCollaborator(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await collaboratorApi<{ token: string; collaborator: CollaboratorRecord }>(
        '/auth',
        { method: 'POST', body: { email, password } },
      )
      writeToken(data.token)
      setCollaborator(data.collaborator)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    const token = readToken()
    if (token) {
      try {
        await collaboratorApi('/logout', { method: 'POST', body: { token } })
      } catch {
        /* ignore */
      }
    }
    writeToken(null)
    setCollaborator(null)
    setPendingSurvey(null)
  }, [])

  const impersonation = readImpersonation()

  return {
    collaborator,
    surveyRequired,
    pendingSurvey,
    loading,
    login,
    logout,
    refresh,
    impersonation,
  }
}

export function useCollaboratorTickets(token: string | null) {
  const [tickets, setTickets] = useState<CollaboratorTicket[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setTickets([])
      return
    }
    setLoading(true)
    try {
      const data = await collaboratorApi<{ tickets: CollaboratorTicket[] }>(
        `/tickets?token=${encodeURIComponent(token)}`,
      )
      setTickets(data.tickets)
    } catch {
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  return { tickets, loading, reload: load }
}
