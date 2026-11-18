import {
  GitBranch,
  GitMerge,
  Gauge,
  Eye,
  UserCheck,
  Clock3,
  Timer,
  CalendarClock,
  Star,
  ClipboardCheck,
  MessagesSquare,
  Phone,
  Mail,
  MonitorSmartphone,
  Wrench,
  Construction,
  TicketPlus,
  ScrollText,
  BadgeCheck,
} from 'lucide-react'
import { SlideShell } from './ExecutivePresentationSlidesShell'

/* Slide: Gestão de Projetos — Waterfall, Scrum, Lean */
export function SlideProjects() {
  const formas = [
    {
      icon: GitBranch,
      titulo: 'Waterfall (Cascata)',
      descricao:
        'Fases sequenciais com portões de revisão: requisitos, planejamento, execução e encerramento — ideal para escopo fechado e prazos previsíveis.',
    },
    {
      icon: GitMerge,
      titulo: 'Scrum',
      descricao:
        'Sprints curtos, backlog priorizado e quadro de tarefas — entregas incrementais com acompanhamento visual do time.',
    },
    {
      icon: Gauge,
      titulo: 'Lean',
      descricao:
        'Fluxo contínuo, eliminação de desperdícios e foco no valor entregue — Kanban de itens em andamento com limites por etapa.',
    },
  ]
  return (
    <SlideShell eyebrow="Gestão de Projetos">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">
        Três formas de gerenciar projetos, <span className="text-primary">num só lugar</span>
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {formas.map((f) => (
          <div key={f.titulo} className="flex flex-col rounded-lg border border-border bg-card p-6">
            <f.icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-xl font-semibold text-primary">{f.titulo}</h3>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{f.descricao}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground md:text-base">
        Cada projeto adota a metodologia mais adequada — com cronograma, tarefas, horas apontadas e
        notificações de prazo integradas ao restante do sistema.
      </p>
    </SlideShell>
  )
}

/* Slide: Transparência — Painel do Operador e Dashboard Gerencial */
export function SlideTransparencia() {
  const itens = [
    {
      icon: UserCheck,
      titulo: 'Painel do Operador',
      descricao:
        'Visão em tempo real da fila do operador: chamados atribuídos, SLA correndo, pausas, retrabalho e histórico — tudo num só painel.',
    },
    {
      icon: Eye,
      titulo: 'Dashboard Gerencial',
      descricao:
        'Volume por período, SLA por prioridade, consumo de contratos, desempenho por operador, visitas e horas — com filtros e exportação.',
    },
  ]
  return (
    <SlideShell eyebrow="Transparência">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">
        O que acontece, <span className="text-primary">na mesa de todos</span>
      </h2>
      <p className="mt-3 max-w-3xl text-lg text-muted-foreground md:text-xl">
        Indicadores vivos para quem atende e para quem decide — sem relatório manual no meio do
        caminho.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {itens.map((i) => (
          <div key={i.titulo} className="rounded-lg border border-border bg-card p-6">
            <i.icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-xl font-semibold text-primary">{i.titulo}</h3>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{i.descricao}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  )
}

/* Slide: Visão do Cliente — módulos do Portal do Ponto Focal */
export function SlideVisaoCliente() {
  const itens = [
    {
      icon: TicketPlus,
      titulo: 'Abertura de chamados',
      descricao:
        'O ponto focal abre o chamado pelo portal, com o ativo da máquina pré-preenchido automaticamente (celular, impressora e scanner prioritários) e triagem por IA.',
    },
    {
      icon: ScrollText,
      titulo: 'Acompanhamento em tempo real',
      descricao:
        'Logs públicos e interações dos operadores visíveis a cada movimentação, com status do chamado atualizado em tempo real.',
    },
    {
      icon: BadgeCheck,
      titulo: 'Aprovações',
      descricao:
        'Chamados que exigem aprovação ficam travados até o cliente decidir: aprova ou reprova com motivo obrigatório na reprovação.',
    },
    {
      icon: MonitorSmartphone,
      titulo: 'Inventário de TI (CMDB)',
      descricao:
        'Consulta aos ativos da própria empresa: máquinas, número de série, localização, histórico de atendimentos e documentos.',
    },
    {
      icon: CalendarClock,
      titulo: 'Visitas técnicas',
      descricao:
        'Agenda de visitas agendadas com acompanhamento do check-in e do check-out do técnico em tempo real.',
    },
    {
      icon: Timer,
      titulo: 'Horas contratadas',
      descricao:
        'Controle do consumo da franquia de horas do contrato, com saldo disponível, histórico por interação e alertas por nível.',
    },
    {
      icon: Star,
      titulo: 'Pesquisa do chamado',
      descricao:
        'Ao encerrar o atendimento, avaliação nota 1–5 e comentário direto sobre o chamado recebido.',
    },
    {
      icon: ClipboardCheck,
      titulo: 'Pesquisa mensal do ponto focal',
      descricao:
        'Avaliação mensal do ponto focal sobre o trabalho prestado no mês, com nota e comentário.',
    },
  ]
  return (
    <SlideShell eyebrow="Visão do Cliente">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">
        O portal do cliente: <span className="text-primary">8 módulos de autonomia</span>
      </h2>
      <p className="mt-3 max-w-3xl text-lg text-muted-foreground md:text-xl">
        Tudo o que o ponto focal vê e faz no Portal do Cliente — sem depender de e-mail ou telefone.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {itens.map((i) => (
          <div key={i.titulo} className="rounded-lg border border-border bg-card p-4">
            <i.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-2 font-semibold text-primary md:text-lg">{i.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{i.descricao}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground md:text-base">
        Portal dedicado ao ponto focal em{' '}
        <span className="font-semibold text-primary">/cliente</span>, com acesso independente e
        visual próprio — e portal do colaborador para quem só abre chamados.
      </p>
    </SlideShell>
  )
}

/* Slide: Em Construção */
export function SlideEmConstrucao() {
  const itens = [
    {
      icon: MessagesSquare,
      titulo: 'Atendimento Omnichannel',
      descricao:
        'Atendimento unificado por múltiplos canais — e-mail, portal, chat e telefone — convergindo num único fluxo de chamado: o histórico de todos os canais num só ticket, sem perder contexto.',
    },
    {
      icon: Wrench,
      titulo: 'Monitoramento de Máquina',
      descricao:
        'Acompanhamento proativo da saúde dos ativos: o sistema enxerga o problema antes do usuário relatar.',
    },
  ]
  return (
    <SlideShell eyebrow="Em Construção">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">
        O que vem por aí <Construction className="ml-3 inline h-8 w-8 text-primary" />
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {itens.map((i) => (
          <div
            key={i.titulo}
            className="flex flex-col rounded-lg border border-dashed border-primary/50 bg-card p-6"
          >
            <div className="flex items-center gap-3">
              <i.icon className="h-7 w-7 text-primary" />
              <span className="rounded-full border border-primary/40 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Em breve
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-primary">{i.titulo}</h3>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">{i.descricao}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  )
}

/* re-exportado para conveniência de tipos no arquivo principal */
export const _icons = { Clock3, Mail, Phone }
