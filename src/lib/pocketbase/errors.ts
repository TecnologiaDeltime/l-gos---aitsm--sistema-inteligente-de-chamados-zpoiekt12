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

const FIELD_LABELS_PT: Record<string, string> = {
  email: 'E-mail',
  password: 'Senha',
  passwordConfirm: 'Confirmação de senha',
  name: 'Nome completo',
  first_name: 'Nome',
  last_name: 'Sobrenome',
  role: 'Função/Papel',
  profile_id: 'Perfil de acesso',
  team: 'Equipe',
  type: 'Tipo de atendimento',
  extension: 'Ramal',
  mobile: 'Celular',
  phone: 'Telefone',
  position: 'Cargo',
  company: 'Empresa',
  unit: 'Unidade',
  active: 'Status ativo',
}

function translateFieldValidationMessage(field: string, msg: string): string {
  const label = FIELD_LABELS_PT[field] || field
  const lower = (msg || '').toLowerCase()

  if (
    lower.includes('unique') ||
    lower.includes('already exists') ||
    lower.includes('já está em uso') ||
    lower.includes('must be unique')
  ) {
    if (field === 'email') {
      return `O e-mail informado já está em uso por outro operador.`
    }
    return `O campo "${label}" já existe e deve ser exclusivo.`
  }

  if (
    lower.includes('blank') ||
    lower.includes('required') ||
    lower.includes('cannot be blank') ||
    lower.includes('obrigatório')
  ) {
    return `O campo "${label}" é obrigatório.`
  }

  if (lower.includes('invalid') || lower.includes('invalid email') || lower.includes('inválido')) {
    return `O valor informado em "${label}" é inválido.`
  }

  if (lower.includes('min') || lower.includes('length')) {
    if (field === 'password') {
      return 'A senha deve conter no mínimo 8 caracteres.'
    }
    return `O campo "${label}" não cumpre o tamanho mínimo exigido.`
  }

  if (lower.includes('match') || lower.includes('passwordconfirm') || lower.includes('confirm')) {
    return 'A confirmação de senha não confere com a senha informada.'
  }

  return `${label}: ${msg}`
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
  }

  // Se houver erros específicos por campo no response.data
  const fieldErrors = extractFieldErrors(error)
  const entries = Object.entries(fieldErrors)

  if (entries.length > 0) {
    const translated = entries.map(([field, detail]) =>
      translateFieldValidationMessage(field, detail),
    )
    return translated.join(' • ')
  }

  // Mensagens em status específicos
  if (
    error.status === 400 &&
    (error.message === 'Failed to create record.' ||
      error.message.includes('Failed to create record'))
  ) {
    return 'Não foi possível cadastrar o operador. Verifique se os dados estão completos ou se o e-mail já está em uso.'
  }

  if (error.status === 403) {
    return 'Você não possui permissão para realizar esta operação.'
  }

  if (error.status === 404) {
    return 'Registro não encontrado.'
  }

  if (error.status === 0) {
    return 'Falha de conexão com o servidor. Verifique sua rede.'
  }

  return error.message || 'Ocorreu um erro ao processar a requisição.'
}
