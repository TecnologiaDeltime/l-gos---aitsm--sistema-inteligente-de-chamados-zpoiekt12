import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Ticket,
  Timer,
  PenLine,
  Gauge,
  Columns3,
  Camera,
  Lightbulb,
  UserRound,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface HelpTopic {
  id: string
  title: string
  icon: React.ElementType
  /** Resumo exibido no cabeçalho do acordeão. */
  summary: string
  /** Palavras extras para a busca, além do título/resumo/conteúdo. */
  keywords?: string
  /** Links "Abrir" para as telas do sistema. */
  links?: { label: string; to: string }[]
  /** Parágrafos do manual. */
  paragraphs: string[]
  /** Tópicos em lista, quando o manual pede. */
  bullets?: { strong: string; text: string }[]
  /** Parágrafos exibidos após a lista de tópicos. */
  afterBullets?: string[]
}

/**
 * Normaliza texto para a busca: minúsculas e sem acentos — permite achar
 * "configuracao" digitando "configuração", e palavras parciais.
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'chamados',
    title: 'Chamados: abrir e atender',
    icon: Ticket,
    summary: 'Fila de tickets, criticidade, criar chamado e fluxo de atendimento',
    keywords: 'fila de tickets criticidade kanban novo chamado atender ficha resolver urgente',
    links: [{ label: 'Abrir Chamados', to: '/tickets' }],
    paragraphs: [
      'A Fila de Tickets é a sua mesa de trabalho: os cartões de criticidade no topo mostram quantos chamados estão críticos, altos, médios e baixos — clique em um cartão para filtrar a fila. Use "Novo Chamado" para abrir um chamado em nome de um cliente.',
      'Para atender, abra a ficha do chamado: leia a descrição e o solicitante, inicie o Ciclo de Trabalho (Play) e registre cada contato como Interação. Ao concluir, use os botões de resolução/encerramento da ficha.',
    ],
  },
  {
    id: 'ciclo',
    title: 'Ciclo de Trabalho (Play / Pause / Encerrar)',
    icon: Timer,
    summary: 'O cronômetro de horas trabalhadas e a diferença entre pausar o ciclo e pausar o SLA',
    keywords: 'play pause encerrar cronometro horas trabalhadas pausar ciclo pausar sla prazo',
    paragraphs: [
      'Os botões Play, Pause e Encerrar controlam o seu cronômetro pessoal no chamado — o Ciclo de Trabalho:',
    ],
    bullets: [
      {
        strong: 'Play',
        text: 'inicia o ciclo — o tempo passa a contar como horas trabalhadas suas naquele chamado.',
      },
      {
        strong: 'Pause',
        text: 'interrompe apenas o cronômetro do ciclo. O SLA do cliente continua correndo — use quando precisar esperar algo, mas o prazo segue.',
      },
      {
        strong: 'Encerrar',
        text: 'finaliza o ciclo e congela o total de horas trabalhadas.',
      },
    ],
    afterBullets: [
      'Pausar o SLA é outra coisa: feito no cartão de SLA, congela o prazo do cliente (ex.: esperando retorno do solicitante) e o tempo pausado não conta para a meta. Resumo: Pause do ciclo para o SEU cronômetro; pausa do SLA para o PRAZO do cliente.',
    ],
  },
  {
    id: 'interacoes',
    title: 'Interações e tempo (HH:MM)',
    icon: PenLine,
    summary: 'Registrar contatos com tempo; o tempo lançado soma nas horas de log',
    keywords: 'interacao apontamento tempo horas de log hhmm dois pontos digitar campo',
    paragraphs: [
      'Cada contato, ação ou investigação deve virar uma Interação na ficha. Escreva o que foi feito e informe o tempo no campo HH:MM.',
      'Como digitar: o campo aceita somente números e completa os dois-pontos sozinho — digite 90 e ele vira 01:30; digite 1030 e vira 10:30. Deixe vazio para interação sem tempo.',
      'O tempo lançado soma nas Horas de Log do chamado (veja a seção Apuração de Horas) e aparece como destaque de trabalho em cada interação.',
    ],
  },
  {
    id: 'horas',
    title: 'Apuração de Horas',
    icon: Gauge,
    summary: 'Horas Trabalhadas vs. Horas de Log, Acompanhamento e correção exclusiva',
    keywords:
      'apuracao horas trabalhadas horas de log acompanhamento competencia auditoria corrigir editar',
    paragraphs: [
      'O cartão Apuração de Horas mostra dois números: Horas Trabalhadas (âmbar) — o que o Ciclo de Trabalho (Play/Pause) contabilizou, o seu cronômetro — e Horas de Log (neutro) — a soma dos tempos lançados em interações e acompanhamentos. A linha de diferença mostra se os dois conferem.',
      'O botão + Acompanhamento registra um apontamento formal (data, descrição e tempo); admin/qualidade pode informar data de competência retroativa. A correção de horas (lápis sobre Horas de Log) é exclusiva de admin/qualidade e fica registrada em auditoria.',
    ],
  },
  {
    id: 'sla',
    title: 'Evolução do SLA (Resposta e Solução)',
    icon: Gauge,
    summary: 'Barra decorrido vs. meta, prazos de resposta e solução, pausas',
    keywords: 'sla evolucao resposta solucao meta prazo barra expediente pausas estourado',
    paragraphs: [
      'O card Evolução do SLA mostra dois prazos: Resposta (primeira resposta ao cliente) e Solução (resolução do chamado). A barra compara o tempo decorrido com a meta acordada: dentro do prazo fica verde; perto ou estourado, âmbar/vermelho.',
      'Quando o SLA está pausado, o prazo congela e o tempo pausado não conta para a meta — o total de pausas aparece no bloco. O SLA só corre no expediente da empresa (fora da janela, o prazo aguarda).',
    ],
  },
  {
    id: 'tela-dividida',
    title: 'Tela Dividida da Fila de Tickets',
    icon: Columns3,
    summary: 'Lista compacta e ficha completa do chamado lado a lado',
    keywords: 'tela dividida lista ficha resumo kanban colunas status fila',
    links: [{ label: 'Abrir Fila de Tickets', to: '/tickets' }],
    paragraphs: [
      'No seletor da Fila de Tickets, escolha Tela Dividida: à esquerda fica uma lista compacta de chamados (nº, título, status, criticidade e SLA) e à direita a FICHA COMPLETA do chamado selecionado, com as mesmas abas de interações, histórico, horas e ciclo de trabalho da ficha aberta pela página.',
      'A lista tem busca, filtro de status e ordenação próprios, e pode seguir os filtros da Fila (modo Filtrada) ou mostrar todos os chamados (modo Todos). Aplicar um filtro que esconde o chamado selecionado não fecha a ficha — ela persiste até você escolher outro chamado.',
      'No celular a tela dividida empilha: lista em cima, ficha embaixo — ao tocar num chamado, a tela rola até a ficha.',
    ],
  },
  {
    id: 'laudos',
    title: 'Laudos Fotográficos de Visitas',
    icon: Camera,
    summary: 'Criar e executar laudos, fotos antes/depois e assinatura por toque',
    keywords:
      'laudo fotografico visita preventiva ambientes checklist fotos antes depois assinatura',
    links: [{ label: 'Abrir Laudos', to: '/laudos' }],
    paragraphs: [
      'Em Laudos Fotográficos, crie um laudo escolhendo o cliente, o template de ambientes e o checklist. O laudo tem um registro por ambiente, cada um com seus itens de checklist.',
      'Ao executar, tire fotos antes e depois de cada item (direto da câmera no celular), marque os itens e, ao final, colete a assinatura de quem acompanhou (assinatura por toque, vira imagem anexada). Concluído o laudo, o status vira "concluído" e a edição trava — o laudo fica como registro oficial da visita preventiva.',
    ],
  },
  {
    id: 'sugestoes',
    title: 'Sugestões',
    icon: Lightbulb,
    summary: 'Enviar ideias, votar e acompanhar status e janela de implantação',
    keywords: 'sugestao ideia voto votos apoiar implantacao status melhoria',
    links: [{ label: 'Abrir Sugestões', to: '/suggestions' }],
    paragraphs: [
      'Na Área de Sugestões, qualquer operador envia uma ideia de melhoria. As sugestões viram cartões com votos (apoios) dos colegas — clique em votar para dar peso à ideia.',
      'Acompanhe o status (recebida, em avaliação, aprovada, implantada) e a janela de implantação prevista. Quem gerencia sugestões move os cartões e responde os autores; novos envios avisam admin/gestor por e-mail.',
    ],
  },
  {
    id: 'solicitante',
    title: 'Perfil do solicitante e histórico',
    icon: UserRound,
    summary: 'Quem pediu o chamado, histórico de tickets e contexto do cliente',
    keywords: 'solicitante perfil historico chamados anteriores recorrente email cliente',
    paragraphs: [
      'No card Solicitante da ficha, o botão Perfil abre o histórico completo da pessoa: chamados anteriores, padrões de abertura e contexto do cliente — útil antes de responder ou escalar.',
      'O solicitante é localizado pelo e-mail; se o mesmo e-mail aparece em vários chamados, todos aparecem no perfil. Use isso para identificar chamados recorrentes do mesmo usuário.',
    ],
  },
]

export default function HelpCenter() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim())
    if (!q) return HELP_TOPICS
    // Busca por palavra parcial, ignorando maiúsculas e acentos, no título,
    // resumo, palavras-chave e no conteúdo dos tópicos.
    return HELP_TOPICS.filter((t) => {
      const haystack = normalizeText(
        [
          t.title,
          t.summary,
          t.keywords ?? '',
          ...t.paragraphs,
          ...(t.afterBullets ?? []),
          ...(t.bullets ?? []).map((b) => `${b.strong} ${b.text}`),
        ].join(' '),
      )
      return haystack.includes(q)
    })
  }, [query])

  const hasQuery = query.trim().length > 0

  return (
    <div className="min-h-dvh space-y-4 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HelpCircle className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Central de Ajuda</h1>
          <p className="text-xs text-muted-foreground">
            Manual de utilização do LÓGOS AITSM para operadores
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no manual (ex.: pausar o ciclo, horas de log, laudo...)"
          aria-label="Buscar no manual"
          className="h-11 pl-9 lg:h-9"
        />
      </div>

      {hasQuery && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {filtered.length === 0
            ? 'Nenhum resultado para esta busca.'
            : `${filtered.length} ${filtered.length === 1 ? 'seção encontrada' : 'seções encontradas'}.`}
        </p>
      )}

      {/* Lista de seções expansíveis */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="font-medium">Nenhum resultado</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Não encontramos nada sobre "{query}". Tente outra palavra — por exemplo "ciclo",
              "SLA", "horas", "laudo" ou "sugestões".
            </p>
            <Button size="sm" variant="outline" onClick={() => setQuery('')}>
              Limpar busca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={filtered.length === 1 ? [filtered[0].id] : []}
          className="space-y-2"
        >
          {filtered.map((topic) => {
            const Icon = topic.icon
            return (
              <AccordionItem
                key={topic.id}
                value={topic.id}
                className="rounded-xl border bg-card px-4 shadow-sm"
              >
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{topic.title}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {topic.summary}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-2 text-sm leading-relaxed">
                    {topic.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {topic.bullets && (
                      <ul className="list-disc space-y-1 pl-5">
                        {topic.bullets.map((b, i) => (
                          <li key={i}>
                            <strong>{b.strong}</strong>: {b.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    {topic.afterBullets?.map((p, i) => (
                      <p key={`ab-${i}`}>{p}</p>
                    ))}
                    {topic.links && topic.links.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {topic.links.map((link) => (
                          <Button key={link.to} size="sm" variant="outline" asChild>
                            <Link to={link.to}>
                              {link.label}
                              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}

      {/* Rodapé de contexto */}
      <p className="pt-2 text-center text-xs text-muted-foreground">
        Dúvidas que não estão aqui? Fale com o seu gestor ou abra uma sugestão de melhoria na{' '}
        <Link to="/suggestions" className="underline underline-offset-2">
          Área de Sugestões
        </Link>
        .
      </p>
    </div>
  )
}
