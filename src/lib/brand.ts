// src/lib/brand.ts
// Constantes canônicas da marca oficial do sistema no frontend.
// Use estas constantes para títulos, notificações, rodapés e e-mails gerados no cliente.

export const BRAND_NAME = 'Lógos AITSM' as const
export const BRAND_SUBTITLE = 'Gestão Inteligente de TI' as const
export const BRAND_SLOGAN = 'Sistema Inteligente de Chamados e Gestão de Serviços de TI' as const
export const BRAND_DEFAULT_SENDER_EMAIL = 'noreply@logositsm.com.br' as const

/**
 * Higieniza qualquer string para garantir que a marca antiga não seja renderizada.
 */
export function sanitizeBrandName(text: string): string {
  if (!text) return text
  return text.replace(/L[oó]gos\s+AITILSM/gi, BRAND_NAME).replace(/AITILSM/gi, 'AITSM')
}
