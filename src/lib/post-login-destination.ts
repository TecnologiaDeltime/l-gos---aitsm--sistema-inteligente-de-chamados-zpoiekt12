import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/hooks/use-auth'
import type { ProfileRecord } from '@/types/profiles'

/**
 * Verifica se um papel ou perfil de usuário pertence à operação (operador / atendimento).
 * A regra do produto: "todos os perfis EXCETO Administrador" são perfis de operação.
 * Clientes têm seu próprio portal (/portal).
 */
export function isOperationalUser(
  user?: Partial<UserRecord> | null,
  profileName?: string | null,
): boolean {
  if (!user) return false

  // Clientes usam o Portal do Cliente
  if (user.role === 'cliente_solicitante' || user.role === 'cliente_gestor') {
    return false
  }

  // Se o role for 'admin', é Administrador
  if (user.role === 'admin') {
    return false
  }

  // Se o nome do perfil for explicitamente Administrador
  const resolvedProfileName = profileName || user.expand?.profile_id?.name || ''

  if (resolvedProfileName.trim().toLowerCase() === 'administrador') {
    return false
  }

  // Qualquer outro perfil de usuário interno/sistema (operador, técnico, gestor, auditor, etc.)
  // é considerado perfil de operação/atendimento.
  return true
}

/**
 * Verifica se o usuário tem permissão para acessar o Painel do Operador ('meu_painel').
 * Leva em conta:
 * 1. Admin sempre tem acesso.
 * 2. Perfil associado: se o módulo 'dashboard' estiver oculto no JSON legado ou
 *    se na tabela `profile_permissions` a chave 'dashboard.meu_painel' tiver granted === false.
 */
export async function canAccessOperatorPanel(user?: Partial<UserRecord> | null): Promise<boolean> {
  if (!user) return false
  if (user.role === 'admin') return true

  const profileId = user.profile_id || user.expand?.profile_id?.id

  // Se não tem perfil associado, fallback por role:
  // perfis de operação têm acesso padrão a dashboard e meu_painel
  if (!profileId) {
    return true
  }

  try {
    // 1. Checar se o perfil tem o módulo 'dashboard' oculto nas permissões base
    let profileRecord: ProfileRecord | undefined = user.expand?.profile_id
    if (!profileRecord || !profileRecord.permissions) {
      try {
        profileRecord = await pb.collection('profiles').getOne<ProfileRecord>(profileId)
      } catch {
        /* ignora falha de busca */
      }
    }

    if (profileRecord?.permissions?.dashboard?.hidden) {
      return false
    }

    // 2. Checar permissão granular na collection profile_permissions
    const perm = await pb
      .collection('profile_permissions')
      .getFirstListItem(
        `profile = "${profileId}" && module_key = "dashboard" && item_key = "meu_painel"`,
      )
      .catch(() => null)

    if (perm) {
      return !!perm.granted
    }

    // Se ainda não tem registro granular na collection, o padrão do catálogo para meu_painel é concedido
    return true
  } catch (err) {
    console.warn('Erro ao checar permissão meu_painel:', err)
    return true
  }
}

/**
 * Resolve o destino pós-login para o usuário informado:
 * - Clientes -> /portal
 * - Administrador -> /dashboard (ou destino padrão)
 * - Perfis de operação -> /operator-dashboard (caso tenha permissão 'meu_painel')
 * - Se a permissão 'meu_painel' tiver sido retirada -> /dashboard (destino padrão)
 */
export async function resolvePostLoginDestination(
  user?: Partial<UserRecord> | null,
): Promise<string> {
  if (!user) return '/dashboard'

  // 1. Clientes
  if (user.role === 'cliente_solicitante' || user.role === 'cliente_gestor') {
    return '/portal'
  }

  // 2. Administrador
  if (!isOperationalUser(user)) {
    return '/dashboard'
  }

  // 3. Perfis de operação: checar permissão 'meu_painel'
  const hasPanelAccess = await canAccessOperatorPanel(user)
  if (hasPanelAccess) {
    return '/operator-dashboard'
  }

  // Se retirado o item meu_painel, fallback seguro para o dashboard padrão
  return '/dashboard'
}
