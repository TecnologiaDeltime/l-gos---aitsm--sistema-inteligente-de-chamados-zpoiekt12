import { useCallback, useEffect, useState } from 'react'

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data as { error?: string })?.error || 'Erro inesperado.')
    throw err
  }
  return data as T
}

export function useCollaboratorAuth() {
  const [collaborator, setCollaborator] = useState<CollaboratorRecord | null>(null)
  const [surveyRequired, setSurveyRequired] = useState(false)
  const [pendingSurvey, setPendingSurvey] = useState<CollaboratorPendingSurvey | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = readToken()
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const me = await api<MeResponse>(`/me?token=${encodeURIComponent(token)}`)
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
      const data = await api<{ token: string; collaborator: CollaboratorRecord }>('/auth', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
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
        await api('/logout', { method: 'POST', body: JSON.stringify({ token }) })
      } catch {
        /* ignore */
      }
    }
    writeToken(null)
    setCollaborator(null)
    setPendingSurvey(null)
  }, [])

  return {
    collaborator,
    surveyRequired,
    pendingSurvey,
    loading,
    login,
    logout,
    refresh,
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
      const data = await api<{ tickets: CollaboratorTicket[] }>(
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
