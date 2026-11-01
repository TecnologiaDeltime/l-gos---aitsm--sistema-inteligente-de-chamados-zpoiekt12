import React, { useState, useMemo } from 'react'
import {
  Ticket,
  Server,
  Clock,
  Bell,
  BarChart3,
  Shield,
  Wrench,
  Download,
  Printer,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  Layers,
  FileSpreadsheet,
  FileText,
  Calendar,
  Building,
  Check,
  Globe,
  Star,
  LayoutDashboard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { exportToCsv } from '@/lib/export-utils'
import { useTheme } from '@/hooks/use-theme'

interface FeatureItem {
  id: string
  title: string
  description?: string
  tag?: string
}

interface FeatureCategory {
  id: string
  title: string
  icon: React.ElementType
  color: string
  bgLight: string
  borderColor: string
  items: FeatureItem[]
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'tickets',
    title: 'Tickets e Atendimento',
    icon: Ticket,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50/70 dark:bg-amber-950/20',
    borderColor: 'border-amber-200 dark:border-amber-900',
    items: [
      {
        id: 'tk-reopen',
        title: 'Reabertura de chamados com prazo configurável e motivo obrigatório',
        description:
          'Mecanismo de reabertura para chamados resolvidos com prazo limite parametrizável em Configurações (padrão de 2 dias), histórico de reaberturas e justificativa/motivo obrigatório.',
        tag: 'Ciclo de Vida / SLA',
      },
      {
        id: 'tk-1',
        title: 'Abertura de chamados estruturada',
        description:
          'Seleção em cascata de empresa, contrato, contato, fila e Item de Configuração (CI).',
        tag: 'Workflow',
      },
      {
        id: 'tk-2',
        title: 'Preenchimento automático do contrato',
        description: 'Auto-preenchimento ao selecionar a empresa vinculada.',
        tag: 'Automação',
      },
      {
        id: 'tk-3',
        title: 'Bloqueio de abertura para empresas sem contrato ativo',
        description:
          'Validação preventiva no formulário impedindo chamados sem cobertura contratual.',
        tag: 'Regra de Negócio',
      },
      {
        id: 'tk-4',
        title: 'Resumo do chamado antes de enviar (Step 2)',
        description:
          'Etapa de revisão completa dos dados inseridos antes da confirmação de criação.',
        tag: 'UX / Validação',
      },
      {
        id: 'tk-5',
        title: 'Ticket Filho (Hierarquia)',
        description:
          'Abertura a partir de chamado pai, banner "Ticket Filho de #XXXX" no detalhe e ícone GitBranch na listagem.',
        tag: 'Hierarquia',
      },
      {
        id: 'tk-6',
        title: 'Bloqueio de resolução de pai com filhos pendentes',
        description:
          'Garante que nenhuma demanda principal seja encerrada com pendências técnicas filhas.',
        tag: 'Controle de Qualidade',
      },
      {
        id: 'tk-7',
        title: 'Associação entre chamados com fechamento em massa',
        description: 'Vinculação de chamados correlatos para aplicação de mesma solução conjunta.',
        tag: 'Produtividade',
      },
      {
        id: 'tk-8',
        title: 'Bloqueio de resolução com SLA pausado',
        description: 'Exige reativação explícita do SLA antes do encerramento do chamado.',
        tag: 'SLA / Governança',
      },
      {
        id: 'tk-9',
        title: 'Bloqueio de resolução sem iniciar atendimento',
        description:
          'Obriga mudança de status para "Em Atendimento" antes de permitir a conclusão.',
        tag: 'Processo ITIL',
      },
      {
        id: 'tk-10',
        title: 'Alerta ao resolver chamado sem horas ou comentários',
        description:
          'Notificação e aviso ao operador quando tenta concluir sem apontamento de tempo ou parecer.',
        tag: 'Auditoria',
      },
      {
        id: 'tk-11',
        title: 'Revisão de horas antes de resolver',
        description:
          'Tabela consolidada exibindo todas as horas apontadas + somatório total antes da finalização.',
        tag: 'Financeiro / Apuração',
      },
      {
        id: 'tk-13',
        title: 'Coluna "Tempo sem Atualização" com código de cores',
        description:
          'Identificação visual de chamados parados (verde/amarelo/laranja/vermelho) com ordenação dinâmica.',
        tag: 'Monitoramento',
      },
      {
        id: 'tk-14',
        title: 'Proteção de horas do cronômetro',
        description:
          'Impedimento de edição manual indevida, remoção de botão editar e campos desabilitados em apontamentos de timer.',
        tag: 'Segurança / Fraude',
      },
      {
        id: 'tk-hours-rule',
        title: 'Regra de apuração e débito de horas (Franquia vs Operador)',
        description:
          'Horas de acompanhamento manual (logs) debitam da franquia contratual do cliente; tempo de play/pause do cronômetro acumula na produtividade/horas de trabalho do operador, com registro automático do cumprimento do SLA de Resposta no primeiro play.',
        tag: 'Regra de Horas / SLA',
      },
    ],
  },
  {
    id: 'portal',
    title: 'Portal do Cliente e Autoatendimento',
    icon: Globe,
    color: 'text-amber-500 dark:text-amber-400',
    bgLight: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-500/30 dark:border-amber-500/30',
    items: [
      {
        id: 'portal-1',
        title: 'Portal do Cliente completo (/portal)',
        description:
          'Ambiente dedicado e intuitivo para solicitantes e gestores das empresas clientes, com login exclusivo em /portal/login.',
        tag: 'Autoatendimento',
      },
      {
        id: 'portal-2',
        title: 'Dashboard do Portal com gráficos e filtro de mês',
        description:
          'Métricas visuais de chamados abertos, em andamento, resolvidos, taxa de SLA e filtros interativos por competência mensal.',
        tag: 'Indicadores / Portal',
      },
      {
        id: 'portal-3',
        title: 'Chamados da organização e pesquisa de satisfação por estrelas',
        description:
          'Visualização completa dos chamados da organização com timeline de interações públicas e avaliação de satisfação (1 a 5 estrelas com comentários) diretamente no chamado.',
        tag: 'Chamados & CSAT',
      },
      {
        id: 'portal-4',
        title: 'Abertura rápida de chamados no Portal',
        description:
          'Formulário simplificado com seleção em cascata de setor, contato por setor, categoria, assunto, descrição e upload de anexos.',
        tag: 'Self-Service',
      },
      {
        id: 'portal-5',
        title: 'Central de Aprovações no Portal',
        description:
          'Aprovação ou reprovação ágil de solicitações de mudanças, orçamentos e serviços adicionais com registro de parecer.',
        tag: 'Workflow / Aprovações',
      },
      {
        id: 'portal-6',
        title: 'Inventário de TI (CMDB do Cliente)',
        description:
          'Consulta detalhada aos ativos e itens de configuração cadastrados para a empresa, com busca textual instantânea, filtros múltiplos por tipo, status e localização, totalizadores de resumo no topo, alternância entre visualização em cards e tabela, modal com ficha técnica completa, atalho para abertura de chamado vinculado e seção de Histórico de Manutenção com atendimentos, datas, status e resumos de cada intervenção.',
        tag: 'Ativos / CMDB',
      },
      {
        id: 'portal-6-manutencao',
        title: 'Histórico de Manutenção no Inventário de TI',
        description:
          'Linha do tempo de atendimentos técnicos e chamados vinculados ao equipamento na ficha do ativo, exibindo número, data, status atual, última interação/solução aplicada e técnico responsável, ordenados do mais recente ao mais antigo com sincronização dinâmica por empresa.',
        tag: 'Histórico & Manutenção',
      },
      {
        id: 'portal-7',
        title: 'Visitas Técnicas no Portal',
        description:
          'Acompanhamento do agendamento, check-in, check-out e relatórios de atendimentos presenciais efetuados pelos técnicos de campo.',
        tag: 'Field Service',
      },
      {
        id: 'portal-8',
        title: 'Extrato de Horas e Saldo de Franquia',
        description:
          'Transparência total no consumo de horas contratadas, franquia disponível, horas excedentes e histórico consolidado.',
        tag: 'Gestão de Franquia',
      },
      {
        id: 'portal-9',
        title: 'Relatórios Mensais liberados com avaliação',
        description:
          'Acesso a relatórios executivos mensais disponibilizados pela equipe técnica, com download em PDF e avaliação obrigatória por popup de pendência.',
        tag: 'Transparência & ABNT',
      },
      {
        id: 'portal-10',
        title: 'Modo Suporte do Administrador (Masquerade)',
        description:
          'Acesso administrativo ao Portal do Cliente sem necessidade de senha, permitindo alternar e simular a experiência de qualquer empresa cliente em tempo real.',
        tag: 'Administração / Suporte',
      },
    ],
  },
  {
    id: 'satisfaction',
    title: 'Satisfação do Cliente (CSAT)',
    icon: Star,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-100/60 dark:bg-amber-950/25',
    borderColor: 'border-amber-300 dark:border-amber-800',
    items: [
      {
        id: 'sat-1',
        title: 'Pesquisa de satisfação por chamado (1 a 5 estrelas)',
        description:
          'Avaliação imediata da qualidade do atendimento ao resolver o chamado, com classificação em estrelas (1 a 5) e feedback textual do cliente.',
        tag: 'CSAT / Qualidade',
      },
      {
        id: 'sat-2',
        title: 'Avaliação de relatório mensal liberado',
        description:
          'Módulo de avaliação de relatórios mensais homologados, coletando notas e sugestões dos gestores de TI dos clientes.',
        tag: 'Auditoria Mensal',
      },
      {
        id: 'sat-3',
        title: 'Popups proativos de pendência de avaliação',
        description:
          'Alertas automáticos no Portal notificando o cliente sobre chamados concluídos ou relatórios pendentes de validação e nota.',
        tag: 'Engajamento',
      },
      {
        id: 'sat-4',
        title: 'Dashboard executivo de satisfação (/satisfaction)',
        description:
          'Métricas consolidadas de NPS/CSAT, distribuição de estrelas, índice de aprovação por operador e listagem de comentários.',
        tag: 'BI & Gestão',
      },
    ],
  },
  {
    id: 'cmdb',
    title: 'CMDB (Gerenciamento de Configuração)',
    icon: Server,
    color: 'text-orange-600 dark:text-orange-400',
    bgLight: 'bg-orange-50/70 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-900',
    items: [
      {
        id: 'cmdb-1',
        title: 'Menu principal CMDB unificado',
        description:
          'Navegação dedicada com subitens estruturados para Ativos e Itens de Configuração.',
        tag: 'Navegação',
      },
      {
        id: 'cmdb-2',
        title: 'CRUD completo de Itens de Configuração por cliente',
        description:
          'Suporte a múltiplos tipos (Impressora, Roteador, Access Point, Switch, Servidor, Desktop, Notebook, Tablet, Telefone IP, Storage/NAS, Firewall, No-Break, Outros).',
        tag: 'Gestão de Ativos',
      },
      {
        id: 'cmdb-3',
        title: 'Seleção de IC na abertura de chamados',
        description:
          'Vínculo direto do equipamento ou serviço afetado no momento do registro do incidente.',
        tag: 'Integração',
      },
      {
        id: 'cmdb-4',
        title: 'Exibição detalhada do IC no chamado',
        description:
          'Apresentação de metadados, número de série, localização e especificações técnicas na visualização do ticket.',
        tag: 'Diagnóstico',
      },
    ],
  },
  {
    id: 'sla',
    title: 'SLA e Alertas Proativos',
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50/70 dark:bg-amber-950/20',
    borderColor: 'border-amber-200 dark:border-amber-900',
    items: [
      {
        id: 'sla-1',
        title: 'Agente de alertas de SLA de Resposta',
        description:
          'Notificações multicanal com popup de contagem regressiva em tempo real, e-mail e síntese de voz.',
        tag: 'Tempo Real',
      },
      {
        id: 'sla-2',
        title: 'Agente de alertas de SLA de Solução',
        description:
          'Monitoramento contínuo de prazo de encerramento via popup modal, e-mail e síntese por voz.',
        tag: 'Tempo Real',
      },
      {
        id: 'sla-3',
        title: 'Agente de chamados sem atualização (8h)',
        description:
          'Identificação proativa de tickets estagnados com alertas pop-up e comando por voz.',
        tag: 'Follow-up',
      },
      {
        id: 'sla-4',
        title: 'Agente de consumo de horas (80%, 90%, 100%)',
        description:
          'Gatilhos de consumo de franquia contratual com envio de notificações para múltiplos destinatários e gestores.',
        tag: 'Gestão Contratual',
      },
      {
        id: 'sla-5',
        title: 'Configuração flexível de alertas em /settings',
        description:
          'Painel administrativo para habilitar/desabilitar canais (voz, som, popup, e-mail) e ajustar limites.',
        tag: 'Parametrização',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notificações Globais',
    icon: Bell,
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50/70 dark:bg-rose-950/20',
    borderColor: 'border-rose-200 dark:border-rose-900',
    items: [
      {
        id: 'notif-1',
        title: 'Popup global unificado (AlertNotificationPopup)',
        description:
          'Componente onipresente ativo em todas as rotas do sistema para avisos críticos instantâneos.',
        tag: 'Global UI',
      },
      {
        id: 'notif-2',
        title: 'Notificações de voz sintetizada (Web Speech API)',
        description:
          'Alertas sonoros audíveis em português alertando sobre estouros iminentes de prazo.',
        tag: 'Acessibilidade / Áudio',
      },
      {
        id: 'notif-3',
        title: 'Notificações transacionais por e-mail',
        description:
          'Disparo de e-mails para responsáveis e clientes em eventos-chave do ciclo de vida.',
        tag: 'Comunicação',
      },
      {
        id: 'notif-4',
        title: 'Central de Notificações dedicada (/notifications)',
        description:
          'Página com filtros por status, listagem completa, contadores de não lidas e marcação de leitura.',
        tag: 'Central de Mensagens',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Relatórios e BI',
    icon: BarChart3,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50/70 dark:bg-emerald-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-900',
    items: [
      {
        id: 'rep-1',
        title: 'Relatório de Horas por Cronômetro',
        description:
          'Filtros por período e empresa com exportação direta para CSV e totalizadores de horas.',
        tag: 'Apuração',
      },
      {
        id: 'rep-2',
        title: 'Relatório de Auditoria de Alertas (/reports/alert-audit)',
        description:
          'Auditoria de engajamento dos operadores com alertas disparados, com filtros por período, tipo, ação e operador.',
        tag: 'Auditoria & Compliance',
      },
      {
        id: 'rep-3',
        title: 'Cards de resumo executivo',
        description:
          'Métricas de Total de Interações, Taxa de Engajamento, Alertas de SLA, Sem Atualização & Consumo.',
        tag: 'KPIs',
      },
      {
        id: 'rep-4',
        title: 'Saldo de Horas por Nível de Atendimento',
        description:
          'Distribuição e apuração de franquias em /horas-clientes segmentadas por equipe e complexidade.',
        tag: 'Gestão de Contratos',
      },
      {
        id: 'rep-5',
        title: 'Relatório de Horas por Operador (/reports/operator-hours)',
        description:
          'Acompanhamento detalhado de produtividade individual e coletiva com horas de cronômetro (trabalho) e horas de acompanhamento (logs), totalizadores, filtros por período e operador.',
        tag: 'Produtividade / Equipe',
      },
      {
        id: 'rep-6',
        title: 'Relatório de Chamados (/reports/tickets)',
        description:
          'Listagem detalhada linha a linha com Ticket, Cliente, Filial, Setor Solicitante, Data de abertura, Atividade, título, status, Total de Horas de Acompanhamento (debitam franquia), Data de Resolução, Ativo, Operador e descrição da Solução, com 7 filtros completos (Cliente, Período, Operador, Filial, Setor, Status e Atividade) e exportação completa em CSV, planilha XLSX e PDF com cabeçalho oficial e totalizadores.',
        tag: 'Auditoria / Atendimento',
      },
      {
        id: 'rep-7',
        title: 'Relatório de Interações nos Chamados (/reports/ticket-interactions)',
        description:
          'Inspeção linha a linha de todas as interações e logs de acompanhamento lançados para controlar cada tempo registrado, com os mesmos campos cadastrais, dados da interação e os 7 filtros completos, com exportação para CSV, XLSX e PDF com cabeçalho oficial da empresa e total de horas.',
        tag: 'Controle de Logs / Franquia',
      },
      {
        id: 'rep-8',
        title: 'Relatório de Interações Horas Trabalhadas (/reports/worked-hours)',
        description:
          'Apuração linha a linha do tempo efetivo de trabalho utilizando o play e pause do chamado (origem Cronômetro, não debita franquia do cliente e acumula nas horas do operador), totalizadores de horas trabalhadas e os 7 filtros completos, com exportação em CSV, XLSX e PDF.',
        tag: 'Produtividade / Cronômetro',
      },
    ],
  },
  {
    id: 'operator-panel',
    title: 'Painel do Operador',
    icon: LayoutDashboard,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-500/30 dark:border-amber-500/30',
    items: [
      {
        id: 'op-1',
        title: 'Painel do Operador centralizado (/operator-dashboard)',
        description:
          'Visão operacional ágil com fila de chamados atribuídos, alertas em contagem regressiva, chamados aguardando primeira resposta e controle de status em tempo real.',
        tag: 'Mesa de Operação',
      },
      {
        id: 'op-2',
        title: 'Cronômetro e ações rápidas integradas',
        description:
          'Acionamento de cronômetro direto pelo painel com registro de pausas, justificativas, troca rápida de chamados e atalhos de resolução.',
        tag: 'Produtividade',
      },
    ],
  },
  {
    id: 'knowledge-ai',
    title: 'Base de Conhecimento com Inteligência Artificial',
    icon: Sparkles,
    color: 'text-amber-500 dark:text-amber-400',
    bgLight: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-500/30 dark:border-amber-500/30',
    items: [
      {
        id: 'kb-ai-1',
        title: 'Geração Automática de Artigos a partir de Soluções Seniores',
        description:
          'O agente nativo Skip Cloud analisa chamados encerrados com sucesso, priorizando notas e soluções de técnicos seniores, e gera rascunhos completos com título, descrição do problema, passos de resolução e tags. Os rascunhos nunca são publicados de forma automática: são direcionados para uma fila de revisão onde a equipe técnica aprova, ajusta e publica oficialmente.',
        tag: 'IA Nativa / ITIL',
      },
      {
        id: 'kb-ai-2',
        title: 'Cura e Atualização Contínua de Artigos com IA',
        description:
          'Monitoramento algorítmico da integridade da base de conhecimento que detecta artigos desatualizados (> 60 dias sem alteração), incompletos (sem resumo, passos rasos ou sem tags) ou ineficazes. Para cada caso sinalizado, a IA propõe diagnósticos e melhorias concretas que a equipe pode aprovar ou recusar com um clique, refletindo a ação no histórico do artigo.',
        tag: 'Curadoria de Dados',
      },
      {
        id: 'kb-ai-3',
        title: 'Fila de Revisão e Governança de Conhecimento',
        description:
          'Painel de controle com abas unificadas para Artigos Oficiais, Fila de Rascunhos de IA e Diagnósticos de Cura, garantindo governança ITIL de qualidade antes da publicação e rastreabilidade total do chamado de origem.',
        tag: 'Governança & Qualidade',
      },
    ],
  },
  {
    id: 'profiles',
    title: 'Perfis, Permissões e Operadores',
    icon: Shield,
    color: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-50/70 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-900',
    items: [
      {
        id: 'prf-levels',
        title: 'Perfis de Acesso com níveis Visualizar / Editar / Configurar',
        description:
          'Matriz refinada de autorização com níveis explícitos (Nenhum, Visualizar, Editar, Configurar) por item, catálogo auto-registrável dinâmico e campo "Tela inicial" personalizada por perfil (versão 0.0.280).',
        tag: 'RBAC Avançado',
      },
      {
        id: 'prf-1',
        title: 'Matriz de permissões granular',
        description:
          'Controle por módulo e submódulo com bloqueio de menu, ações e proteção de rotas via guard centralizado.',
        tag: 'Segurança RBAC',
      },
      {
        id: 'prf-2',
        title: 'Perfis de acesso pré-configurados',
        description:
          'Administrador, Supervisor, Técnico N1, Técnico N2, Qualidade, Help Desk, Campo e Gestor de Contrato.',
        tag: 'Padrões ITIL',
      },
      {
        id: 'prf-3',
        title: 'CRUD completo de Operadores',
        description:
          'Formulário completo: Nome, Sobrenome, E-mail, Perfil, Equipe, Status, Tipo, Ramal e Celular.',
        tag: 'Gestão de Equipe',
      },
      {
        id: 'prf-4',
        title: 'Reset seguro de senha',
        description:
          'Geração e redefinição de credenciais com modal facilitado de cópia para envio ao colaborador.',
        tag: 'Administração',
      },
      {
        id: 'prf-5',
        title: 'Menu lateral dinâmico por perfil e rotas protegidas (403)',
        description:
          'Exibição estritamente autorizada de itens de menu e bloqueio de rotas não permitidas.',
        tag: 'Proteção de Acesso',
      },
      {
        id: 'prf-6',
        title: 'Renderização condicional de botões de ação',
        description:
          'Ocultação de botões Criar / Editar / Excluir quando o operador possui permissão somente de leitura.',
        tag: 'Interface Adaptativa',
      },
    ],
  },
  {
    id: 'infra',
    title: 'Infraestrutura e Backend',
    icon: Wrench,
    color: 'text-slate-700 dark:text-slate-300',
    bgLight: 'bg-slate-100/70 dark:bg-slate-900/40',
    borderColor: 'border-slate-300 dark:border-slate-800',
    items: [
      {
        id: 'inf-1',
        title: 'Logs automáticos de cronômetro',
        description:
          'Registro de iniciar/pausar com marcação de badge "Interno" e rastreabilidade de origem "Cronômetro".',
        tag: 'Rastreabilidade',
      },
      {
        id: 'inf-2',
        title: 'Migrações de banco de dados robustas (PocketBase)',
        description:
          'Versionamento estruturado de esquemas, índices, chaves estrangeiras e regras de acesso.',
        tag: 'Database',
      },
      {
        id: 'inf-3',
        title: 'Coleção alert_audit_logs para auditoria',
        description:
          'Armazenamento seguro de todas as interações e aceites de notificações emitidas aos operadores.',
        tag: 'Auditoria de Logs',
      },
      {
        id: 'inf-4',
        title: 'Integração de filas com distribuição de horas',
        description:
          'Balanceamento e apropriação de apontamentos conforme nível de suporte atribuído.',
        tag: 'Distribuição N1/N2',
      },
    ],
  },
]

export default function ImplementedFeaturesReport() {
  const { designSettings } = useTheme()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const totalFeatures = useMemo(() => {
    return FEATURE_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0)
  }, [])

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase()

    return FEATURE_CATEGORIES.map((cat) => {
      const matchCategory = selectedCategory === 'all' || selectedCategory === cat.id
      if (!matchCategory) {
        return { ...cat, items: [] }
      }

      const matchingItems = cat.items.filter((item) => {
        if (!term) return true
        return (
          item.title.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.tag?.toLowerCase().includes(term) ||
          cat.title.toLowerCase().includes(term)
        )
      })

      return {
        ...cat,
        items: matchingItems,
      }
    }).filter((cat) => cat.items.length > 0)
  }, [search, selectedCategory])

  const filteredTotal = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0)
  }, [filteredCategories])

  const handlePrint = () => {
    window.print()
  }

  const handleExportCsv = () => {
    const rows = FEATURE_CATEGORIES.flatMap((cat) =>
      cat.items.map((item) => ({
        Categoria: cat.title,
        Funcionalidade: item.title,
        Detalhes: item.description || '',
        Tipo: item.tag || 'Implantado',
        Status: 'Implantado / Ativo',
      })),
    )

    exportToCsv(
      `relatorio_funcionalidades_implantadas_${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      ['Categoria', 'Funcionalidade', 'Detalhes', 'Tipo', 'Status'],
    )
  }

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const currentDateTime = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="report-container max-w-7xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-none">
      {/* CABEÇALHO DO RELATÓRIO */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm print:border-b-2 print:border-primary print:shadow-none print:rounded-none print:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {designSettings?.report_logo_url || designSettings?.logo_url ? (
              <div className="max-h-16 max-w-[200px] flex items-center shrink-0 p-1 bg-white rounded-md border border-slate-200">
                <img
                  src={designSettings.report_logo_url || designSettings.logo_url}
                  alt="Logotipo de Documentos"
                  className="max-h-14 w-auto object-contain"
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Relatório Oficial de Entregas
                </span>
                <span className="text-xs text-muted-foreground hidden print:inline-block">
                  • Emitido em {currentDate}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                Sistema ITSM de Chamados
              </h1>
              <p className="text-sm md:text-base text-muted-foreground font-medium">
                Relatório Geral de Funcionalidades Implantadas e Módulos Ativos
              </p>
            </div>
          </div>

          {/* Ações (escondidas na impressão) */}
          <div className="flex items-center gap-2.5 flex-wrap print:hidden">
            <Button
              onClick={handleExportCsv}
              variant="outline"
              size="sm"
              className="gap-2 shadow-sm font-medium"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Exportar CSV
            </Button>
            <Button
              onClick={handlePrint}
              variant="default"
              size="sm"
              className="gap-2 shadow-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Printer className="w-4 h-4" />
              Exportar PDF / Imprimir
            </Button>
          </div>
        </div>

        {/* Informações da emissão visíveis em tela e impressão */}
        <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <strong>Data de Geração:</strong> {currentDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-primary" />
              <strong>Sistema:</strong> ServiceOne ITSM Enterprise v1.0
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <strong>Categorias:</strong> {FEATURE_CATEGORIES.length}
            </span>
          </div>
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
          >
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
            100% dos Requisitos Operacionais
          </Badge>
        </div>
      </div>

      {/* CARDS DE RESUMO / INDICADORES */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-muted-foreground uppercase">
              Total de Funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {totalFeatures}
            </span>
            <Badge variant="secondary" className="text-[11px] font-medium">
              Todas implantadas
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-muted-foreground uppercase">
              Módulos Principais
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {FEATURE_CATEGORIES.length}
            </span>
            <span className="text-xs text-muted-foreground">Áreas funcionais</span>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-muted-foreground uppercase">
              Conformidade ITIL / SLA
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              100%
            </span>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px]">
              Homologado
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold text-muted-foreground uppercase">
              Status Geral
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-foreground">Produção</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </CardContent>
        </Card>
      </div>

      {/* BARRA DE FILTRO E BUSCA (oculta na impressão) */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionalidade por nome, descrição ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="h-8 text-xs shrink-0"
          >
            Todas ({totalFeatures})
          </Button>
          {FEATURE_CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="h-8 text-xs shrink-0 gap-1.5"
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.title.split(' ')[0]} ({cat.items.length})
            </Button>
          ))}
        </div>
      </div>

      {/* AVISO SE FILTRADO */}
      {search && (
        <div className="text-xs text-muted-foreground px-1 print:hidden flex items-center justify-between">
          <span>
            Exibindo <strong>{filteredTotal}</strong> de <strong>{totalFeatures}</strong>{' '}
            funcionalidades encontradas para &ldquo;{search}&rdquo;.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setSelectedCategory('all')
            }}
            className="h-6 text-xs text-primary"
          >
            Limpar filtros
          </Button>
        </div>
      )}

      {/* SEÇÕES DE FUNCIONALIDADES POR CATEGORIA */}
      <div className="space-y-6 print:space-y-4">
        {filteredCategories.map((category) => {
          const Icon = category.icon

          return (
            <Card
              key={category.id}
              className={`border overflow-hidden transition-all duration-200 shadow-sm print:shadow-none print:border-border print:break-inside-avoid ${category.borderColor}`}
            >
              <CardHeader
                className={`p-4 md:p-5 border-b ${category.bgLight} print:bg-slate-50 print:p-3`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg bg-card shadow-xs ${category.color} print:bg-white print:border`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base md:text-lg font-bold text-foreground">
                        {category.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {category.items.length}{' '}
                        {category.items.length === 1
                          ? 'funcionalidade implantada'
                          : 'funcionalidades implantadas'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold bg-background/80 print:bg-white"
                  >
                    {category.items.length} itens ativos
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-border/70">
                  {category.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 md:p-4 hover:bg-muted/30 transition-colors flex items-start gap-3.5 print:p-2.5 print:hover:bg-transparent"
                    >
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold print:bg-slate-100 print:text-slate-800">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground leading-snug">
                            {item.title}
                          </h4>
                          {item.tag && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-medium px-2 py-0 h-5 shrink-0 print:border print:bg-white"
                            >
                              {item.tag}
                            </Badge>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-xs md:text-[13px] text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredCategories.length === 0 && (
          <div className="bg-card border border-dashed rounded-xl p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-semibold">Nenhuma funcionalidade encontrada</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Nenhum item corresponde aos critérios de busca especificados. Tente outros termos ou
              limpe o filtro.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('')
                setSelectedCategory('all')
              }}
            >
              Resetar busca
            </Button>
          </div>
        )}
      </div>

      {/* RODAPÉ DO RELATÓRIO */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground print:border-t-2 print:border-border print:shadow-none print:rounded-none print:p-3 print:mt-6">
        <div className="space-y-0.5 text-center sm:text-left">
          <p className="font-semibold text-foreground">
            ServiceOne ITSM — Plataforma de Gestão de Serviços de TI
          </p>
          <p>Documento de validação de entregas e recursos homologados.</p>
        </div>
        <div className="text-center sm:text-right font-mono text-[11px]">
          <span>Gerado em {currentDateTime}</span>
          <p className="text-[10px] text-muted-foreground/80">
            Hash de Conformidade: ITSM-REL-{new Date().getFullYear()}-IMP
          </p>
        </div>
      </div>
    </div>
  )
}
