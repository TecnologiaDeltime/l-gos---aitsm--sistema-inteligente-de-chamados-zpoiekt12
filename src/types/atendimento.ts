export type CanalAtendimento = 'whatsapp' | 'webchat' | 'email'

export type EstadoAtendimento =
  | 'NOVA'
  | 'TRIAGEM_BOT'
  | 'BOT_RESOLVENDO'
  | 'HANDOFF_PENDENTE'
  | 'HUMANO_ATIVO'
  | 'RESOLVIDA'

export type PrioridadeAtendimento = 'P1' | 'P2' | 'P3' | 'P4'

export type PraticaItil = 'incident' | 'service_request' | 'change' | 'question'

export type ImpactoItil = 'menor' | 'moderado' | 'significativo' | 'extenso'

export type UrgenciaItil = 'baixa' | 'média' | 'alta' | 'crítica'

export interface ClassificacaoItil {
  pratica: PraticaItil
  categoria: string
  impacto: ImpactoItil
  urgencia: UrgenciaItil
  confianca: number
  sentimento: number
  intencao: string
  prioridade: PrioridadeAtendimento
}

export interface AtendimentoConversa {
  id: string
  canal: CanalAtendimento
  estado: EstadoAtendimento
  prioridade: PrioridadeAtendimento
  pratica?: PraticaItil
  categoria?: string
  impacto?: ImpactoItil
  urgencia?: UrgenciaItil
  contato_nome: string
  contato_handle?: string
  contato_vip?: boolean
  contato_locale?: string
  sentimento?: number
  confianca_bot?: number
  motivo_handoff?: string
  operador_atribuido?: string
  chamado_vinculado?: string
  sla_resposta_deadline?: string
  sla_resolucao_deadline?: string
  sla_resposta_at?: string
  sla_resolucao_at?: string
  ultima_mensagem_texto?: string
  ultima_atividade_at?: string
  metadata?: Record<string, any>
  created: string
  updated: string
  expand?: {
    operador_atribuido?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
    chamado_vinculado?: {
      id: string
      number: string
      title: string
      status: string
      priority: string
    }
  }
}

export interface AtendimentoMensagem {
  id: string
  conversa: string
  direcao: 'entrada' | 'saida'
  autor_tipo: 'usuario' | 'bot' | 'operador' | 'sistema'
  autor_nome: string
  operador?: string
  texto: string
  artigos_consultados?: string[]
  classificacao?: Partial<ClassificacaoItil>
  id_externo?: string
  created: string
  updated: string
  expand?: {
    operador?: {
      id: string
      name?: string
      email?: string
    }
  }
}

export interface ArtigoTentado {
  titulo: string
  resultado: 'falhou' | 'parcial' | 'sucesso'
  motivoFalha: string
}

export interface EventoHandoff {
  timestamp: string
  etapa: string
  descricao: string
}

export interface AtendimentoDossie {
  id: string
  conversa: string
  headline: string
  narrativa: string
  objetivo_cliente: string
  passos_tomados: string[]
  artigos_tentados: ArtigoTentado[]
  perguntas_abertas: string[]
  riscos: string[]
  proxima_acao_recomendada: string
  roteamento_score?: string
  roteamento_justificativa?: string
  skills_avaliadas?: string[]
  agente_sugerido?: string
  eventos_handoff?: EventoHandoff[]
  aceito_por?: string
  aceito_at?: string
  created: string
  updated: string
  expand?: {
    agente_sugerido?: {
      id: string
      name: string
      email: string
    }
    aceito_por?: {
      id: string
      name: string
      email: string
    }
  }
}

export interface AgenteCandidato {
  id: string
  nome: string
  email: string
  skills: string[]
  idiomas: string[]
  cargaAtual: number
  capacidadeMax: number
  turnoTerminaEm: string
  online: boolean
}
