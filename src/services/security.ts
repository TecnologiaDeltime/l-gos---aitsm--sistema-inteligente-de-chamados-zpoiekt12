import pb from '@/lib/pocketbase/client'

export interface SecuritySettings {
  id?: string
  session_timeout_minutes: number
  max_login_attempts: number
  lockout_duration_minutes: number
  require_2fa_admin: boolean
  require_2fa_gestor: boolean
}

export interface LoginAttemptLog {
  id: string
  email: string
  ip_address?: string
  user_agent?: string
  outcome:
    | 'success'
    | 'failed_password'
    | 'account_locked'
    | 'unlocked_by_admin'
    | 'totp_failed'
    | 'totp_success'
  details?: string
  created: string
  updated: string
}

export interface TwoFactorCheckResponse {
  required: boolean
  configured: boolean
  needs_setup: boolean
  user_id?: string
  role?: string
}

export interface TwoFactorSetupResponse {
  success: boolean
  secret: string
  otpauth_url: string
  recovery_codes: string[]
}

export const securityService = {
  // Obter política de segurança
  async getPolicy(): Promise<SecuritySettings> {
    try {
      const res = await pb.send<SecuritySettings>('/backend/v1/auth/security-policy', {
        method: 'GET',
      })
      return res
    } catch (_) {
      // Fallback para leitura da coleção caso a rota direta demore
      const recs = await pb.collection('security_settings').getList<SecuritySettings>(1, 1, {
        sort: '-created',
      })
      if (recs.items.length > 0) {
        return recs.items[0]
      }
      return {
        session_timeout_minutes: 60,
        max_login_attempts: 5,
        lockout_duration_minutes: 15,
        require_2fa_admin: true,
        require_2fa_gestor: false,
      }
    }
  },

  // Atualizar política de segurança (Admin)
  async updatePolicy(data: Partial<SecuritySettings>): Promise<SecuritySettings> {
    const res = await pb.send<{ success: boolean; settings: SecuritySettings }>(
      '/backend/v1/auth/security-policy',
      {
        method: 'POST',
        body: data,
      },
    )
    return res.settings
  },

  // Heartbeat de sessão
  async sendHeartbeat(): Promise<void> {
    await pb.send('/backend/v1/auth/session/heartbeat', {
      method: 'POST',
    })
  },

  // Desbloquear usuário manualmente (Admin)
  async unlockUser(userId: string): Promise<void> {
    await pb.send('/backend/v1/auth/unlock-user', {
      method: 'POST',
      body: { user_id: userId },
    })
  },

  // Resetar 2FA de outro usuário (Admin)
  async resetUser2Fa(userId: string): Promise<void> {
    await pb.send('/backend/v1/auth/2fa/reset-user', {
      method: 'POST',
      body: { user_id: userId },
    })
  },

  // Checar exigência de 2FA
  async check2Fa(email: string): Promise<TwoFactorCheckResponse> {
    return await pb.send<TwoFactorCheckResponse>('/backend/v1/auth/2fa/check', {
      method: 'POST',
      body: { email },
    })
  },

  // Iniciar setup do 2FA
  async setup2Fa(): Promise<TwoFactorSetupResponse> {
    return await pb.send<TwoFactorSetupResponse>('/backend/v1/auth/2fa/setup', {
      method: 'POST',
    })
  },

  // Confirmar código do setup
  async confirm2Fa(code: string): Promise<{ success: boolean; message: string }> {
    return await pb.send<{ success: boolean; message: string }>('/backend/v1/auth/2fa/confirm', {
      method: 'POST',
      body: { code },
    })
  },

  // Validar código no login (TOTP normal ou recovery)
  async verify2FaLogin(
    email: string,
    code: string,
    isRecovery = false,
  ): Promise<{ success: boolean; message: string }> {
    return await pb.send<{ success: boolean; message: string }>('/backend/v1/auth/2fa/verify', {
      method: 'POST',
      body: { email, code, is_recovery: isRecovery },
    })
  },

  // Buscar logs recentes de tentativas de login
  async getLoginLogs(limit = 50): Promise<LoginAttemptLog[]> {
    try {
      const res = await pb.collection('login_attempt_logs').getList<LoginAttemptLog>(1, limit, {
        sort: '-created',
      })
      return res.items
    } catch (_) {
      return []
    }
  },
}
