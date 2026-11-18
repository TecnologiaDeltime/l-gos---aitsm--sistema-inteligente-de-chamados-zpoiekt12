import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'

const BASE_URL = '/backend/v1/collaborator'
const IMPERSONATION_KEY = 'logos_collaborator_impersonation'

export interface CollaboratorImpersonation {
  companyId: string
  collaboratorId: string
  collaboratorName: string
  collaboratorEmail: string
  token: string
}

export function saveImpersonation(data: CollaboratorImpersonation) {
  sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(data))
}

export function readImpersonation(): CollaboratorImpersonation | null {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY)
    return raw ? (JSON.parse(raw) as CollaboratorImpersonation) : null
  } catch {
    return null
  }
}

export function clearImpersonation() {
  try {
    sessionStorage.removeItem(IMPERSONATION_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Autentica o admin no PocketBase e solicita ao hook A2_collaborator_portal
 * um ticket de sessão curto para o colaborador (impersonação).
 * O token recebido é uma sessão de portal do colaborador real — o painel
 * usa exatamente o mesmo fluxo do login normal do colaborador.
 */
export async function startImpersonation(
  companyId: string,
  collaboratorId: string,
  collaboratorName: string,
  collaboratorEmail: string,
): Promise<CollaboratorImpersonation> {
  const session = await pb.send<{ token: string }>(`${BASE_URL}/impersonate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collaborator_id: collaboratorId }),
  })
  const imp: CollaboratorImpersonation = {
    companyId,
    collaboratorId,
    collaboratorName,
    collaboratorEmail,
    token: session.token,
  }
  saveImpersonation(imp)
  return imp
}
