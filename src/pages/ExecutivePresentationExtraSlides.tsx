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

/* Slide: Visão do Cliente */
export function SlideVisaoCliente() {
  const itens = [
    {
      icon: Timer,
      titulo: 'Consumo da franquia de horas',
      descricao:
        'O cliente acompanha saldo e consumo das horas contratadas em tempo real, com alertas por nível.',
    },
    {
      icon: MonitorSmartphone,
      titulo: 'Inventário de TI (ativos/CMDB)',
      descricao: 'Acesso aos ativos da própria empresa: máquinas, serial, localização e histórico.',
    },
    {
      icon: CalendarClock,
      titulo: 'Visitas agendadas',
      descricao: 'Agenda de visitas técnicas com check-in e check-out visíveis ao cliente.',
    },
    {
      icon: Star,
      titulo: 'Pesquisa de satisfação do chamado',
      descricao: 'Avaliação nota 1–5 e comentário direto sobre o atendimento recebido.',
    },
    {
      icon: ClipboardCheck,
      titulo: 'Pesquisa do ponto focal',
      descricao: 'Avaliação mensal do ponto focal sobre o trabalho prestado no mês.',
    },
  ]
  return (
    <SlideShell eyebrow="Visão do Cliente">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">
        O cliente enxerga <span className="text-primary">tudo o que importa</span>
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {itens.map((i) => (
          <div key={i.titulo} className="rounded-lg border border-border bg-card p-5">
            <i.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold text-primary">{i.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{i.descricao}</p>
          </div>
        ))}
      </div>
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
