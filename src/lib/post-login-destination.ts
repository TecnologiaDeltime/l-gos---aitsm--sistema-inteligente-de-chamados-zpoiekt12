import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/hooks/use-auth'
import type { ProfileRecord } from '@/types/profiles'
import { PROFILE_LANDING_OPTIONS } from '@/types/profiles'

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
 * Carrega o registro completo do perfil do usuário.
 */
async function fetchUserProfile(user?: Partial<UserRecord> | null): Promise<ProfileRecord | null> {
  if (!user) return null

  if (user.expand?.profile_id) {
    return user.expand.profile_id as ProfileRecord
  }

  const profileId = user.profile_id
  if (!profileId) return null

  try {
    return await pb.collection('profiles').getOne<ProfileRecord>(profileId)
  } catch {
    return null
  }
}

/**
 * Verifica se o usuário tem permissão para acessar uma rota de destino configurada.
 * Regras:
 * 1. Admin tem sempre acesso total.
 * 2. Se a rota apontar para um item conhecido no PROFILE_LANDING_OPTIONS,
 *    verifica se o módulo ou item não foi revogado na matriz de permissões.
 * 3. Se a rota foi revogada, retorna false para acionar fallback seguro.
 */
export async function canAccessRoute(
  route: string,
  user?: Partial<UserRecord> | null,
  profile?: ProfileRecord | null,
): Promise<boolean> {
  if (!user) return false
  if (user.role === 'admin') return true

  const prof = profile || (await fetchUserProfile(user))
  if (!prof) return true

  // Administrador tem sempre acesso
  if (prof.name?.trim().toLowerCase() === 'administrador') {
    return true
  }

  const option = PROFILE_LANDING_OPTIONS.find((o) => o.route === route)
  if (!option) {
    return true
  }

  // 1. Verificar se o módulo pai está oculto nas permissões legadas
  if (prof.permissions?.[option.moduleKey]?.hidden) {
    return false
  }

  // 2. Se houver itemKey específico, checar em profile_permissions
  if (option.itemKey && prof.id) {
    try {
      const perm = await pb
        .collection('profile_permissions')
        .getFirstListItem(
          `profile = "${prof.id}" && module_key = "${option.moduleKey}" && item_key = "${option.itemKey}"`,
        )
        .catch(() => null)

      if (perm) {
        return !!perm.granted
      }
    } catch {
      // Se der erro de busca, segue fallback permissivo
    }
  }

  return true
}

/**
 * Verifica se o usuário tem permissão para acessar o Painel do Operador ('meu_painel').
 */
export async function canAccessOperatorPanel(user?: Partial<UserRecord> | null): Promise<boolean> {
  return await canAccessRoute('/operator-dashboard', user)
}

/**
 * Resolve o destino pós-login para o usuário informado:
 * 1. Clientes -> /portal
 * 2. Perfil configurado com `landing_route`:
 *    - Se configurado, valida se o usuário tem acesso a essa rota na matriz de permissões.
 *    - Se tiver permissão, redireciona para a rota configurada.
 *    - Se a permissão tiver sido retirada, faz fallback seguro para /dashboard.
 * 3. Se o perfil não tiver landing_route:
 *    - Administrador -> /dashboard
 *    - Perfis de operação -> /operator-dashboard (se tiver 'meu_painel', senão /dashboard)
 */
export async function resolvePostLoginDestination(
  user?: Partial<UserRecord> | null,
): Promise<string> {
  if (!user) return '/dashboard'

  // 1. Clientes
  if (user.role === 'cliente_solicitante' || user.role === 'cliente_gestor') {
    return '/portal'
  }

  // Carregar perfil associado
  const profile = await fetchUserProfile(user)

  // 2. Destino configurado explicitamente no perfil
  const configuredRoute = profile?.landing_route?.trim()
  if (configuredRoute) {
    const hasAccess = await canAccessRoute(configuredRoute, user, profile)
    if (hasAccess) {
      return configuredRoute
    }
    // Fallback seguro caso a tela configurada tenha sido desmarcada
    return '/dashboard'
  }

  // 3. Fallback preservando v0.0.279
  if (!isOperationalUser(user, profile?.name)) {
    return '/dashboard'
  }

  const hasPanelAccess = await canAccessRoute('/operator-dashboard', user, profile)
  return hasPanelAccess ? '/operator-dashboard' : '/dashboard'
}
