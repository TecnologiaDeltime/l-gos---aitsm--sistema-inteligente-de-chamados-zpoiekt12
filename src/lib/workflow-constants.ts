import {
  Play,
  GitBranch,
  Split,
  Zap,
  CheckCircle,
  Clock,
  Bell,
  ListTodo,
  Webhook,
  Square,
} from 'lucide-react'

export const BLOCK_TYPES = [
  {
    type: 'start',
    label: 'Início',
    icon: Play,
    color: 'bg-green-500',
    desc: 'Quando um chamado é aberto',
  },
  {
    type: 'condition',
    label: 'Condição',
    icon: GitBranch,
    color: 'bg-blue-500',
    desc: 'Se o campo do chamado é',
  },
  {
    type: 'decision',
    label: 'Decisão',
    icon: Split,
    color: 'bg-purple-500',
    desc: 'Criar caminhos alternativos',
  },
  {
    type: 'action',
    label: 'Ação',
    icon: Zap,
    color: 'bg-orange-500',
    desc: 'Alterar campos do chamado',
  },
  {
    type: 'approval',
    label: 'Aprovação',
    icon: CheckCircle,
    color: 'bg-amber-500',
    desc: 'Enviar para aprovação',
  },
  { type: 'wait', label: 'Aguardar', icon: Clock, color: 'bg-gray-500', desc: 'Aguardar condição' },
  {
    type: 'notification',
    label: 'Notificação',
    icon: Bell,
    color: 'bg-cyan-500',
    desc: 'Enviar notificação',
  },
  { type: 'task', label: 'Tarefa', icon: ListTodo, color: 'bg-indigo-500', desc: 'Criar tarefa' },
  {
    type: 'integration',
    label: 'Integração',
    icon: Webhook,
    color: 'bg-teal-500',
    desc: 'Executar HTTP/webhook',
  },
  { type: 'end', label: 'Fim', icon: Square, color: 'bg-red-500', desc: 'Concluir fluxo' },
] as const

export const TRIGGER_TYPES = [
  'Chamado Aberto',
  'Chamado Atualizado',
  'Chamado Atribuído',
  'Status Alterado',
  'Cliente Respondeu',
  'SLA Próximo do Vencimento',
  'Data Agendada',
  'Aprovação Recebida',
  'Limite de Horas Atingido',
  'Ativo Vinculado',
  'Formulário Enviado',
  'E-mail Recebido',
  'Integração Disparada',
]

export const CONDITION_OPERATORS = [
  '=',
  '!=',
  'contains',
  '>',
  '<',
  '>=',
  '<=',
  'empty',
  'not empty',
  'between',
  'in',
  'not in',
]

export const CONDITION_FIELDS = [
  'company',
  'category',
  'subcategory',
  'priority',
  'impact',
  'urgency',
  'department',
  'source',
  'type',
  'status',
  'assigned_to',
  'queue',
  'title',
  'description',
]

export const ACTION_TYPES = [
  'Alterar Categoria',
  'Alterar Subcategoria',
  'Alterar Prioridade',
  'Alterar Impacto',
  'Alterar Urgência',
  'Alterar Tipo',
  'Alterar Status',
  'Alterar Fila',
  'Atribuir Responsável',
  'Adicionar Participante',
  'Aplicar SLA',
  'Vincular Contrato',
  'Vincular Ativo',
  'Inserir Comentário',
  'Criar Tarefa',
  'Criar Chamado Filho',
  'Enviar Notificação',
  'Solicitar Aprovação',
  'Gerar Documento',
  'Pausar SLA',
  'Resumir SLA',
  'Fechar Chamado',
]

export const APPROVAL_TYPES = [
  'Aprovador Único',
  'Múltiplos Aprovadores',
  'Sequencial',
  'Paralelo',
  'Maioria',
  'Unânime',
  'Primeiro a Responder',
  'Por Grupo',
  'Por Função',
  'Por Área',
  'Gestor do Solicitante',
  'Gestor do Cliente',
  'Responsável Fixo',
]

export const WAIT_TYPES = [
  'Aguardar Aprovação',
  'Aguardar Resposta do Cliente',
  'Aguardar Resposta do Fornecedor',
  'Aguardar Data Específica',
  'Aguardar Horas',
  'Aguardar Dias Úteis',
  'Aguardar Mudança de Status',
  'Aguardar Envio de Formulário',
  'Aguardar Resultado de Integração',
  'Aguardar Conclusão de Tarefa',
]

export const NOTIFICATION_RECIPIENTS = [
  'Solicitante',
  'Gestor do Solicitante',
  'Gestor do Cliente',
  'Operador',
  'Gestor da Fila',
  'Aprovador',
  'Grupo',
  'E-mail Fixo',
  'Usuário Dinâmico',
]

export const END_OUTCOMES = [
  'Autorizado',
  'Recusado',
  'Cancelado',
  'Concluído',
  'Encaminhado',
  'Aguardando Execução',
  'Bloqueado',
  'Finalizado com Erro',
]

export const TASK_TYPES = [
  'Sequencial',
  'Paralela',
  'Independente',
  'Dependente',
  'Obrigatória',
  'Opcional',
]

export const AUTOMATION_TEMPLATES = [
  'Admissão de Funcionário',
  'Desligamento de Funcionário',
  'Criação de Usuário',
  'Solicitação de Acesso',
  'Instalação de Software',
  'Visita Técnica',
  'Compra de Equipamento',
  'Mudança de Infraestrutura',
  'Mudança de Emergência',
  'Chamado Crítico',
  'Aprovação de Horas Extras',
  'Manutenção Preventiva',
  'Liberação de Equipamento',
  'Incidente Recorrente',
  'Atendimento Fora do Horário',
]

export function getBlockMeta(type: string) {
  return BLOCK_TYPES.find((b) => b.type === type) || BLOCK_TYPES[0]
}
