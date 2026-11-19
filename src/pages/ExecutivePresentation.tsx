import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
  Bot,
  Zap,
  Layers,
  Globe,
  BarChart3,
} from 'lucide-react'
import { LogosLogoFull as LogosLogo } from '@/components/brand/LogosLogo'
import { Button } from '@/components/ui/button'
import { SlideShell } from './ExecutivePresentationSlidesShell'
import './ExecutivePresentationPrint.css'
import {
  SlideProjects,
  SlideTransparencia,
  SlideVisaoCliente,
  SlideEmConstrucao,
} from './ExecutivePresentationExtraSlides'

const TOTAL_SLIDES = 12

interface AutomationArea {
  area: string
  description: string
  cadence: string
}

const MODULOS: Array<{ titulo: string; descricao: string }> = [
  {
    titulo: 'Chamados',
    descricao:
      'Criação, atribuição, delegação, Kanban, histórico, anexos e interações com cronômetro.',
  },
  {
    titulo: 'SLA inteligente',
    descricao:
      'Conta só no expediente da empresa — janelas por cliente, pausa fora do horário, alertas de resposta e estouro.',
  },
  {
    titulo: 'CMDB / Ativos',
    descricao: 'Inventário completo com auditoria de mudanças de dono.',
  },
  {
    titulo: 'Mudanças',
    descricao: 'Submissão, aprovação com votação e controle de prazo.',
  },
  {
    titulo: 'Problemas',
    descricao: 'Análise de causa raiz com apoio de IA.',
  },
  {
    titulo: 'Contratos & Consumo',
    descricao:
      'Franquia de horas, débito automático por interação, alertas por nível e por filial.',
  },
  {
    titulo: 'Visitas',
    descricao: 'Check-in/out validados, ordem de serviço e reembolso.',
  },
  {
    titulo: 'Base de Conhecimento',
    descricao: 'Geração e curadoria de artigos por IA.',
  },
  {
    titulo: 'Relatórios',
    descricao: 'Agregação noturna, relatório mensal por cliente e envio agendado.',
  },
]

const AUTOMACOES: AutomationArea[] = [
  {
    area: 'Triagem',
    description: 'Atribuição automática de operador por regras de fila e nível.',
    cadence: 'A cada minuto',
  },
  {
    area: 'SLA',
    description: 'Recálculo de SLA, alertas de resposta e escalonamento automático.',
    cadence: 'Recálculo a cada 30 min · alertas por minuto',
  },
  {
    area: 'Chamados parados',
    description: 'Detecção de chamados retidos e sem movimentação.',
    cadence: 'A cada 5–15 min',
  },
  {
    area: 'Aprovações',
    description: 'Escalonamento de aprovações e prazo de votação de mudanças.',
    cadence: 'Por minuto',
  },
  {
    area: 'E-mail',
    description:
      'Caixa de entrada verificada: converte e-mail em chamado, resposta automática, retenção e limpeza.',
    cadence: 'A cada 2 min',
  },
  {
    area: 'Contratos',
    description: 'Renovação, consumo por filial e agente de consumo.',
    cadence: 'Diário · consumo hora em hora',
  },
  {
    area: 'Gestão',
    description: 'Relatórios mensais e agendados, notificações de projetos e consolidação noturna.',
    cadence: 'Noturno / agendado',
  },
  {
    area: 'Motor de Workflows',
    description: 'Automações configuráveis por eventos e agendamento.',
    cadence: 'Por evento',
  },
]

const IA_SERVICOS: Array<{ titulo: string; descricao: string }> = [
  {
    titulo: 'Triagem no Portal',
    descricao:
      'O colaborador descreve o problema; a IA sugere categoria, prioridade e encaminhamento.',
  },
  {
    titulo: 'Rascunho de resposta',
    descricao: 'Sugere a resposta ao operador e etiqueta o chamado.',
  },
  {
    titulo: 'Assistente Técnico',
    descricao: 'Chat que responde com base na base de conhecimento.',
  },
  {
    titulo: 'Curadoria de Knowledge Base',
    descricao: 'Gera e cura artigos da base de conhecimento.',
  },
  {
    titulo: 'Análise de Problemas',
    descricao: 'Padrões de chamados para causa raiz e efetividade das soluções.',
  },
  {
    titulo: 'Agente de Consumo',
    descricao: 'Avalia diariamente o consumo dos contratos e age preventivamente.',
  },
]

const SEGURANCA: string[] = [
  '3 portais independentes — Operadores (/login), Ponto Focal (/cliente) e Colaborador (/portal/colaborador) — com endereços e visuais próprios',
  'Catálogo de permissões por perfil: 9 perfis, cada função liberável ou retirável individualmente',
  'Autenticação em dois fatores (2FA)',
  'Política de sessão com heartbeat e invalidação automática',
  'Cofre de credenciais com auditoria completa',
]

const NUMEROS: Array<{ valor: string; legenda: string }> = [
  { valor: '100+', legenda: 'Rotas de serviço no backend' },
  { valor: '21', legenda: 'Automações ativas 24×7' },
  { valor: '7', legenda: 'Agentes de IA' },
  { valor: '4', legenda: 'Áreas de acesso' },
  { valor: 'SLA', legenda: 'Por expediente e por cliente' },
]

function renderSlide(index: number): React.ReactNode {
  switch (index) {
    case 0:
      return (
        <SlideShell eyebrow="Abertura">
          <div className="flex flex-col items-start gap-6">
            <LogosLogo monogramClassName="h-14 w-14" textClassName="h-10 w-auto" />
            <h1 className="text-5xl font-bold leading-tight text-foreground md:text-6xl">
              LÓGOS AITSM
              <span className="mt-2 block text-3xl font-semibold text-primary md:text-4xl">
                Apresentação Executiva
              </span>
            </h1>
            <p className="max-w-3xl text-xl text-muted-foreground md:text-2xl">
              Sistema Inteligente de Chamados: gestão, atendimento e controle de SLA.
            </p>
          </div>
        </SlideShell>
      )
    case 1:
      return (
        <SlideShell eyebrow="O que é">
          <h2 className="text-4xl font-bold text-foreground md:text-5xl">
            Uma plataforma completa de gestão de chamados de TI (ITSM)
          </h2>
          <ul className="mt-10 space-y-5 text-xl text-foreground/90 md:text-2xl">
            <li className="flex gap-4">
              <Zap className="mt-1 h-7 w-7 shrink-0 text-primary" />
              Controle de SLA por expediente, com pausa fora do horário
            </li>
            <li className="flex gap-4">
              <Globe className="mt-1 h-7 w-7 shrink-0 text-primary" />
              Portais de autoatendimento para cliente e colaborador
            </li>
            <li className="flex gap-4">
              <Bot className="mt-1 h-7 w-7 shrink-0 text-primary" />
              Inteligência artificial aplicada ao ciclo de vida do chamado
            </li>
            <li className="flex gap-4">
              <Layers className="mt-1 h-7 w-7 shrink-0 text-primary" />
              Projetos, conhecimento, visitas e contratos no mesmo sistema
            </li>
          </ul>
        </SlideShell>
      )
    case 2:
      return (
        <SlideShell eyebrow="Módulos do sistema">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            Nove módulos que cobrem todo o ciclo de atendimento
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODULOS.map((m) => (
              <div key={m.titulo} className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-semibold text-primary md:text-xl">{m.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground md:text-base">{m.descricao}</p>
              </div>
            ))}
          </div>
        </SlideShell>
      )
    case 3:
      return <SlideProjects />
    case 4:
      return (
        <SlideShell eyebrow="Automações rodando 24×7">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            <span className="text-primary">21 processos ativos</span> trabalhando 24×7
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {AUTOMACOES.map((a) => (
              <div
                key={a.area}
                className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
              >
                <Zap className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">
                    {a.area}
                    <span className="ml-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                      {a.cadence}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SlideShell>
      )
    case 5:
      return (
        <SlideShell eyebrow="Inteligência Artificial">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              7 agentes/serviços de IA
            </h2>
            <span className="rounded-full bg-primary px-4 py-1 text-sm font-bold text-primary-foreground">
              IA no dia a dia
            </span>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {IA_SERVICOS.map((s) => (
              <div key={s.titulo} className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-lg font-semibold text-primary">{s.titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground md:text-base">{s.descricao}</p>
              </div>
            ))}
          </div>
        </SlideShell>
      )
    case 6:
      return <SlideTransparencia />
    case 7:
      return <SlideVisaoCliente />
    case 8:
      return (
        <SlideShell eyebrow="Acessos e segurança">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            Acesso controlado, por perfil, de ponta a ponta
          </h2>
          <ul className="mt-8 space-y-5 text-lg text-foreground/90 md:text-xl">
            {SEGURANCA.map((s) => (
              <li key={s} className="flex gap-4">
                <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />
                {s}
              </li>
            ))}
          </ul>
        </SlideShell>
      )
    case 9:
      return (
        <SlideShell eyebrow="Números para destacar">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {NUMEROS.map((n) => (
              <div key={n.legenda} className="text-center">
                <p className="text-5xl font-extrabold text-primary md:text-6xl">{n.valor}</p>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">{n.legenda}</p>
              </div>
            ))}
          </div>
        </SlideShell>
      )
    case 10:
      return <SlideEmConstrucao />
    default:
      return (
        <SlideShell>
          <div className="flex flex-col items-start gap-6">
            <LogosLogo monogramClassName="h-14 w-14" textClassName="h-10 w-auto" />
            <h2 className="text-4xl font-bold leading-tight text-foreground md:text-5xl">
              LÓGOS AITSM
              <span className="mt-3 block text-2xl font-semibold text-primary md:text-3xl">
                Atendimento de TI com inteligência, controle e autonomia.
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">Obrigado.</p>
          </div>
        </SlideShell>
      )
  }
}

export default function ExecutivePresentation() {
  const [current, setCurrent] = useState(0)

  // Exporta como PDF via impressão do navegador ("Salvar como PDF").
  // A folha @media print mostra todos os slides, um por página, em paisagem.
  const exportPdf = useCallback(() => {
    const previousTitle = document.title
    document.title = 'Apresentação Executiva - LÓGOS AITSM'
    const restore = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }, [])

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, TOTAL_SLIDES - 1)), [])
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Área do slide */}
      <main className="relative flex-1" onClick={next}>
        {/* Clique no corpo avança 1 slide; o rodapé faz stopPropagation
            para que os botões Anterior/Próximo não disparem next de novo. */}
        <div key={current} className="h-full w-full">
          {renderSlide(current)}
        </div>

        {/* Rodapé fixo do slide: progresso + navegação.
            stopPropagation: os botões Anterior/Próximo não podem borbulhar
            para o onClick={next} do main — sem isso, "Próximo" avançava 2
            (botão + bolha) e "Anterior" voltava 1 e avançava 1 (net 0). */}
        <div
          className="pointer-events-auto absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-border bg-background/80 px-6 py-4 backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            Slide {current + 1} de {TOTAL_SLIDES}
          </p>

          {/* Barra de progresso */}
          <div className="mx-6 hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted md:block">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              aria-label="Exportar apresentação em PDF"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={prev}
              disabled={current === 0}
              aria-label="Slide anterior"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              size="sm"
              onClick={next}
              disabled={current === TOTAL_SLIDES - 1}
              aria-label="Próximo slide"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>

      {/* Versão de impressão: todos os slides em sequência (oculta na tela;
          visível apenas no PDF via ExecutivePresentationPrint.css). */}
      <div id="apresentacao-print" aria-hidden="true">
        {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
          <div key={i} className="apresentacao-print-slide bg-background text-foreground">
            {renderSlide(i)}
          </div>
        ))}
      </div>
    </div>
  )
}
