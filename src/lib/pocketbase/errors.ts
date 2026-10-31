import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

// Tradução e mapeamento de mensagens comuns de erro do PocketBase / HTTP / SMTP
function translateCommonErrorMessage(msg: string): string {
  if (!msg) return 'Ocorreu um erro inesperado ao processar a solicitação.'
  const lower = msg.toLowerCase()

  if (
    lower.includes('something went wrong while processing your request') ||
    lower.includes('something went wrong')
  ) {
    return 'Falha na comunicação com o servidor ou serviço temporariamente indisponível. Verifique os parâmetros informados e tente novamente.'
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('connection refused')
  ) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão de rede.'
  }

  if (lower.includes('failed to authenticate') || lower.includes('invalid credentials')) {
    return 'Credenciais inválidas ou sessão expirada. Faça login novamente.'
  }

  if (lower.includes('the request was autocancelled')) {
    return 'A requisição anterior foi cancelada por uma nova ação.'
  }

  if (lower.includes('the requested resource was not found') || lower.includes("wasn't found")) {
    return 'O recurso solicitado não foi encontrado no servidor.'
  }

  if (lower.includes('only superusers can access this action')) {
    return 'Ação restrita a administradores do sistema.'
  }

  return msg
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      return translateCommonErrorMessage(error.message)
    }
    return 'Ocorreu um erro inesperado ao processar a solicitação.'
  }

  // Verificar se há erro específico encapsulado no body retornado pelo PocketBase (response.data ou response.error)
  const resData = error.response?.data
  if (resData && typeof resData === 'object') {
    if ('error' in resData && typeof (resData as { error: unknown }).error === 'string') {
      const customErr = (resData as { error: string }).error
      if (customErr) return translateCommonErrorMessage(customErr)
    }
    if ('message' in resData && typeof (resData as { message: unknown }).message === 'string') {
      const customMsg = (resData as { message: string }).message
      if (
        customMsg &&
        !customMsg.toLowerCase().includes('something went wrong while processing your request')
      ) {
        return translateCommonErrorMessage(customMsg)
      }
    }
  }

  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) {
    return msgs.join(' ')
  }

  const rawMsg = error.message || 'Ocorreu um erro inesperado ao processar a solicitação.'
  return translateCommonErrorMessage(rawMsg)
}
