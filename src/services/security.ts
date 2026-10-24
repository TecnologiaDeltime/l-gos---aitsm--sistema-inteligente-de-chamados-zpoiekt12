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
    // Se o cliente nem sequer tiver token válido no authStore, evita chamada inútil
    if (!pb.authStore.isValid || !pb.authStore.token) {
      return
    }

    try {
      await pb.send('/backend/v1/auth/session/heartbeat', {
        method: 'POST',
        headers: {
          Authorization: pb.authStore.token,
        },
      })
    } catch (err: any) {
      const status = err?.status || err?.response?.status || err?.statusCode
      if (status === 401) {
        // Disparar evento global e/ou limpar sessão expirada para que a aplicação realize o logout
        console.warn('Sessão expirada ou token revogado no heartbeat (401).')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('itsm:session-expired', {
              detail: {
                reason: 'Sua sessão expirou por inatividade. Faça login novamente.',
              },
            }),
          )
        }
      } else {
        // Outros erros de rede/conexão são ignorados silenciosamente para não quebrar a UI
        console.log('Heartbeat de sessão ignorado por falha temporária:', err?.message || err)
      }
    }
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

  // Solicitar recuperação de senha
  async requestPasswordReset(
    email: string,
  ): Promise<{ success: boolean; message: string; email_sent?: boolean }> {
    try {
      return await pb.send<{ success: boolean; message: string; email_sent?: boolean }>(
        '/backend/v1/auth/request-password-reset',
        {
          method: 'POST',
          body: { email },
        },
      )
    } catch (err: any) {
      // Fallback para chamada padrão de requestPasswordReset do SDK caso a rota personalizada falhe
      try {
        await pb.collection('users').requestPasswordReset(email)
        return {
          success: true,
          email_sent: true,
          message:
            'Se o e-mail estiver cadastrado, as orientações de recuperação foram encaminhadas.',
        }
      } catch (fallbackErr: any) {
        return {
          success: true,
          email_sent: false,
          message:
            'Solicitação registrada. Se não receber o link em alguns minutos, contate o administrador para obter uma nova senha provisória.',
        }
      }
    }
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
