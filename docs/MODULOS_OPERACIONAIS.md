# Módulos Operacionais — Lógos AITILSM

Este documento descreve detalhadamente todos os módulos operacionais do Lógos AITILSM, seus fluxos de trabalho, regras de validação e pontos de interface do usuário.

---

## 1. Módulo de Chamados / Tickets

O módulo de chamados é o núcleo do sistema ITSM, cobrindo o ciclo completo de incidentes e requisições de serviço em conformidade com as melhores práticas ITIL.

### 1.1 Fila de Tickets (`/tickets`)

A tela principal de chamados permite a visualização em dois modos comutáveis:

- **Modo Tabela**: listagem corporativa com paginação, ordenação e colunas de identificação rápida: Número do Ticket, Título, Cliente, Solicitante, Categoria, Prioridade, Status, Operador Responsável, SLA e Ações.
- **Modo Kanban**: visualização por cartões organizada pelas colunas de status operacionais (_Novo, Em Andamento, Aguardando Solicitante, Aguardando Terceiro, Pendente Aprovação, Resolvido, Fechado_).
- **Filtros Avançados**: busca textual (número, título, conteúdo), filtro por Empresa/Cliente, Unidade/Filial, Categoria, Operador, Prioridade, Status e visualização de chamados sob minha responsabilidade.
- **Ações em Lote**: seleção múltipla para delegação em lote (_Batch Delegate_) e resolução em lote com justificativa padronizada (_Batch Resolve_).

_[print: tela de listagem de chamados em modo tabela]_
_[print: visualização kanban de chamados com colunas de status]_
_[print: modal de delegação de chamados em lote]_

---

### 1.2 Abertura de Novo Chamado (`/chamados/novo` ou `/tickets/new`)

Formulário dinâmico estruturado para captura estruturada de incidentes e requisições:

- **Seleção de Cliente / Empresa**: carrega em cascata as filiais, setores e solicitantes vinculados.
- **Dados do Solicitante**: seleção do colaborador solicitante com exibição instantânea de telefone, e-mail e departamento. Possui botão para cadastro rápido de novo solicitante caso não exista.
- **Equipamento do CMDB**: seletor de ativo de TI associado ao cliente/solicitante, exibindo número de série e hostname.
- **Tipo de Chamado e Urgência**: Incidente, Requisição, Dúvida ou Problema, combinados com Matriz de Prioridade ITIL (Impacto × Urgência).
- **Categoria e Catálogo de Atividades**: árvore de categorias com pré-carregamento de SLA configurado.
- **Título e Descrição Formatada**: editor de texto rico com suporte a anexos (imagens, documentos e logs).
- **Campos Opcionais**: data limite de atendimento, observações internas e envio de confirmação imediata por e-mail ao solicitante.

_[print: tela de abertura de novo chamado com seleção de cliente e solicitante]_
_[print: seleção de equipamento do CMDB e categoria no novo chamado]_

---

### 1.3 Detalhes do Chamado e Ciclo Operacional (`/tickets/:id`)

A tela de detalhes do chamado centraliza todos os controles operacionais e de auditoria:

- **Cabeçalho**: número do ticket, badge de status, prioridade, cliente e filial.
- **Botão Play (Verde) e Pause de SLA (Amarelo)**:
  - Localizados estrategicamente no canto superior direito do chamado.
  - **Ação do Play**: inicia o cronômetro de trabalho efetivo do operador. Na primeira vez que o Play é clicado, o **SLA de Resposta é apurado e paralisado imediatamente**, registrando _"Em conformidade"_ (se dentro do prazo estipulado) ou _"Fora de conformidade"_ (se o prazo foi ultrapassado).
  - O Play altera o status para _"Em Andamento"_ caso o chamado estivesse como _"Novo"_.
  - O cronômetro de trabalho passa a rodar em tempo real na tela do operador, exibindo formato `00:00`.
  - Ao clicar no botão de parar/pausar o ciclo, o tempo transcorrido é acumulado como **Horas Trabalhadas** do operador (origem `Cronômetro`), que **não debita a franquia do cliente**.
  - **Botão Pause de SLA (Amarelo)**: permite suspender formalmente o prazo de resolução mediante seleção de motivo obrigatório (_Aguardando Solicitante, Aguardando Peça, Aguardando Terceiro_).
- **Timeline e Interações**:
  - Registro cronológico de todas as ações, comentários e alterações de status.
  - Separação clara entre mensagens públicas (visíveis no Portal do Cliente) e notas internas exclusivas para a equipe técnica.
  - Lançamento manual de interações com **Tempo Gasto de Acompanhamento**: utiliza máscara com dois pontos fixos (`00:00`), com validação estrita de minutos (00 a 59). Esse tempo lançado debita a franquia do contrato do cliente.
- **Bloco de SLA Lateral**:
  - Exibe barra de progresso visual de SLA de Resposta e SLA de Solução.
  - Destaque para a conformidade do SLA de Resposta obtida no primeiro Play.
  - Contagem regressiva em tempo real e sinalizadores visuais de proximidade de estouro.
- **Ações Laterais**:
  - Delegar chamado para outro operador ou fila de atendimento.
  - Criar chamado filho (_Child Ticket_) para tarefas dependentes.
  - Associar a problemas (_Problem Management_) ou requisições de mudança (_GMUD_).

_[print: tela de detalhes do chamado com cabeçalho e botões play e pause de sla]_
_[print: bloco lateral de detalhes de sla de resposta e solução com conformidade no play]_
_[print: formulário de nova interação com máscara de tempo gasto 00:00 e seletor público ou privado]_
_[print: modal de pausa de sla com justificativa obrigatória]_

---

### 1.4 Encerramento e Resolução do Chamado

O encerramento do chamado é realizado através do botão _"Resolver Chamado"_, que abre o `ResolveTicketDialog`:

- **Validação de Início Prévio**: o sistema impede a resolução de um chamado que nunca tenha recebido o Play (evita chamados fantasmas fechados sem atendimento).
- **Registro Obrigatório da Solução**: texto descritivo detalhando o procedimento técnico aplicado (mínimo de 10 caracteres).
- **Modelos Rápidos de Solução**: seletor de templates pré-configurados em _Modelos de Chamados_ para agilizar o preenchimento de resoluções padronizadas.
- **Gravação de SLA de Solução**: grava a data/hora exata do encerramento, congelando a apuração de cumprimento do SLA de Solução.
- **Transição de Status**: o chamado passa para _"Resolvido"_, notificando automaticamente o solicitante por e-mail com convite para avaliação de satisfação.

_[print: modal de resolução de chamado com seleção de modelo e texto da solução]_

---

### 1.5 Reabertura de Chamados

Mecanismo de governança para clientes que necessitem reativar um chamado encerrado:

- **Prazo Parametrizável em Configurações**: definido globalmente na aba de notificações/portal (padrão de 2 dias corridos após a resolução).
- **Comportamento no Portal do Cliente**:
  - Enquanto estiver dentro da janela de reabertura, o botão _"Reabrir Chamado"_ fica visível e ativo no detalhe do chamado.
  - Se a janela expirar, o botão é desabilitado com o aviso explicativo: _"Prazo de reabertura expirado (X dia(s) após a resolução)"_.
- **Motivo Obrigatório**: ao clicar em reabrir, um modal exige a justificativa detalhada do solicitante (mínimo de 10 caracteres).
- **Ações do Sistema**:
  - O chamado tem seu status revertido para _"Em Andamento"_.
  - Uma interação pública é registrada com o motivo da reabertura.
  - O histórico de auditoria grava a ação com autoria do cliente.
  - O operador responsável e a fila de atendimento recebem notificação imediata de reabertura.

_[print: aviso de chamado resolvido com botão de reabertura no portal do cliente]_
_[print: modal de confirmação de reabertura com justificativa obrigatória]_

---

### 1.6 Pesquisa de Satisfação com Estrelas (NPS / CSAT)

Avaliação da experiência do usuário após a resolução:

- **Disponibilização**: acessível no Portal do Cliente ao visualizar o chamado resolvido e através de link público direto (`/survey/:token`) enviado por e-mail.
- **Escala de 1 a 5 Estrelas**: interface interativa com seleção visual de estrelas (1 = Muito insatisfeito, 5 = Excelente).
- **Comentário Justificativo**: campo opcional para elogios ou sugestões; torna-se **obrigatório** caso o solicitante atribua 1 estrela (detrator).
- **Consolidação em Tempo Real**: as notas alimentam o Dashboard de Satisfação (`/satisfaction`) e o Relatório Mensal do Cliente.

_[print: componente de pesquisa de satisfação com avaliação de 1 a 5 estrelas e comentário]_
_[print: painel do dashboard de satisfação com média nps e distribuição de notas]_

---

## 2. Atendimento Omnichannel (`/atendimento`)

A Central de Atendimento Omnichannel proporciona uma interface moderna de chat unificado para operadores interagirem com solicitantes em tempo real:

- **Fila Lateral de Conversas**: listagem de atendimentos ativos categorizados por canal (WhatsApp, Webchat, E-mail), exibindo foto do solicitante, última mensagem, tempo de espera e indicador de SLA Live Countdown.
- **Painel Central de Mensagens**: histórico contínuo da conversa com balões diferenciados, anexos de mídia, áudios e respostas rápidas.
- **SLA Live Countdown**: cronômetro regressivo destacado na barra superior da conversa, sinalizando em verde, amarelo ou vermelho a proximidade do vencimento do tempo de primeira resposta e interação.
- **Dossiê de Handoff com Inteligência Artificial**:
  - Modal acionado durante a transferência de conversa entre operadores ou escalonamento de nível (N1 para N2).
  - A IA gera um resumo executivo dos pontos já abordados pelo cliente, sentimentos identificados, dados coletados e pendências pendentes, poupando o cliente de repetir informações.
- **Nova Conversa (`NovaConversaModal`)**: abertura proativa de atendimento para clientes cadastrados com busca instantânea.
- **Vinculação de Chamados (`VincularChamadoDialog`)**: atalho para associar a conversa a um chamado existente ou converter a conversa diretamente em um novo chamado com importação automática do histórico de mensagens.

_[print: console central de atendimento omnichannel com conversas ativas e sla live countdown]_
_[print: modal de dossiê de handoff com resumo gerado por ia para transferência]_
_[print: diálogo de vinculação da conversa a um chamado de suporte]_

---

## 3. Clientes, Filiais, Setores e Colaboradores

Gestão completa da estrutura organizacional das empresas contratantes:

### 3.1 Empresas Clientes (`/clients`)

- Listagem geral com busca, filtros por status (Ativo, Bloqueado) e contadores de filiais, contratos e ativos.
- Cadastro e edição de empresa com Razão Social, Nome Fantasia, CNPJ, Telefone, E-mail de contato, Endereço completo e Regra de Faturamento.

### 3.2 Filiais / Unidades

- Cadastro de múltiplas unidades físicas por cliente, com CEP, endereço, cidade, estado e fuso horário.

### 3.3 Setores / Departamentos

- Estruturação hierárquica dos setores da empresa (ex: Financeiro, RH, Operações, Diretoria), permitindo apuração de consumo de horas por setor nos relatórios gerenciais e no Portal do Cliente.

### 3.4 Colaboradores e Pontos Focais

- **Colaboradores**: usuários finais da empresa que abrem chamados.
- **Pontos Focais (`cliente_gestor`)**: gestores autorizados a deliberar sobre aprovações de orçamentos e chamados de sua empresa.
- **Automação de Ativos na Exclusão**:
  - Ao excluir um colaborador ou ponto focal, o sistema verifica se existem equipamentos ou itens de configuração vinculados ao seu nome (campos `owner` ou `responsible_user`).
  - Se houver, um diálogo de confirmação é exibido: _"Este usuário é responsável por X equipamento(s). Assim que a exclusão for confirmada, o status do(s) equipamento(s) ficará como Disponível. Deseja continuar?"_.
  - Ao clicar em **Sim**, o usuário é removido e os ativos têm seu Status de Disponibilidade atualizado imediatamente para **"Disponível"**.
  - A ação é auditada em `asset_automation_logs`. Se o operador clicar em **Cancelar**, a exclusão é abortada e nenhum ativo é alterado.

_[print: tela de cadastro e detalhes do cliente com abas de filiais setores e colaboradores]_
_[print: aviso de confirmação na exclusão de colaborador com equipamentos vinculados]_

---

## 4. CMDB e Gestão de Ativos (`/cmdb`)

O CMDB (Configuration Management Database) gerencia o inventário de hardware, software, serviços e itens de configuração.

### 4.1 Cadastro Completo de Ativos (`/cmdb/assets/new` e `/cmdb/assets/:id`)

- **Dados Principais**: Nome do ativo, Hostname, Marca/Fabricante, Modelo, Número de Série, Tipo de Ativo e Empresa/Cliente proprietário.
- **Localização Física**: Filial, Andar, Sala e Departamento.
- **Responsáveis**:
  - **Dono do Equipamento (`owner`)**: pessoa física ou jurídica titular do ativo.
  - **Usuário Responsável (`responsible_user`)**: operador ou colaborador que está utilizando o equipamento no dia a dia. Tanto no cadastro (`/cmdb/assets/new`) quanto na edição (`/cmdb/assets/:id`), o campo conta com seletor pesquisável inteligente (`ResponsibleUserCombobox`) com busca em tempo real por nome e e-mail dos colaboradores da empresa cliente, exibição de badge de Ponto Focal e suporte a texto livre legado.
- **Status Operacional Tradicional**: Ativo, Em Manutenção, Reserva, Inativo, Descartado.
- **Novo Campo: Status de Disponibilidade (`availability_status`)**:
  - `Em uso`: equipamento alocado e em utilização ativa por um colaborador.
  - `Disponível`: equipamento livre no estoque técnico para ser atribuído a outro colaborador.
  - `Em Estoque`: equipamento armazenado aguardando preparação ou remanejamento.
  - `Obsoleto`: equipamento desatualizado tecnologicamente que não deve ser alocado.
  - `Descartado`: equipamento baixado do patrimônio e encaminhado para descarte.
- **Exclusão de Ativos com Usuário Vinculado**:
  - Ao tentar excluir um equipamento que possua dono ou usuário responsável preenchido, o sistema abre modal de aviso alertando que o vínculo será desfeito e o status de disponibilidade final será registrado como "Disponível" no log de auditoria.

### 4.2 Histórico de Manutenção do Ativo

- Na ficha detalhada do equipamento e no Portal do Cliente, a seção de histórico lista em ordem cronológica decrescente todos os chamados e ordens de serviço atrelados ao ativo (`configuration_item = asset.id`), com link direto para o chamado e resumo da solução técnica aplicada.

### 4.3 Importação em Lote e Tipos de CI

- Ferramenta de importação via arquivo CSV/planilha mapeando colunas de patrimônio, número de série, dono e filial.
- Catálogo de Tipos de CI com atributos técnicos customizáveis por categoria de hardware.

_[print: tela de listagem de ativos do cmdb com badges de status de disponibilidade]_
_[print: formulário de cadastro de ativo com campos dono usuário responsável e status de disponibilidade]_
_[print: histórico de manutenção do ativo com chamados vinculados]_

---

## 5. Gestão de Contratos (`/contracts`)

- **Contratos Vigentes**: cadastro das condições comerciais de cada empresa cliente, tipo de franquia (Horas Pré-pagas, Horas Faturadas, Suporte Ilimitado) e valor da hora excedente.
- **Franquia Mensal de Horas (`monthly_hours`)**: saldo base creditado para o ciclo mensal de atendimento.
- **Períodos Contratuais (`contract_periods`)**: controle do ciclo de apuração (data de início e fechamento da fatura).
- **Dashboard de Consumo (`/contracts/consumption`)**: visão gráfica de alerta para empresas que atingiram 80%, 100% ou ultrapassaram a franquia no mês vigente.

_[print: tela de listagem e acompanhamento de contratos com saldo de franquia]_
_[print: dashboard de consumo de contratos com alertas percentuais de utilização]_

---

## 6. Gestão de Visitas Técnicas N2 (`/visitas-n2`)

Módulo completo para controle de atendimentos presenciais e ordens de serviço em campo:

- **Dashboard de Visitas (`/visitas-n2/dashboard`)**: métricas de visitas agendadas, em andamento, concluídas, quilometragem total rodada e custos de deslocamento.
- **Agenda e Calendário (`/visitas-n2/calendar`)**: grade visual por técnico e horário, evitando sobreposição de itinerários.
- **Execução e Minhas Visitas (`/visitas-n2/my`)**: visão móvel do técnico em campo com botões de _Check-in_ (registro de chegada no cliente) e _Check-out_ (conclusão).
- **Checklists Técnicos**: roteiros de checagem obrigatórios parametrizados por tipo de atendimento (preventiva de servidores, cabeamento, troca de estações).
- **Despesas e Reembolsos (`/visitas-n2/expenses`)**: lançamento de comprovantes de pedágio, alimentação, estacionamento e cálculo automático de KM rodado com base na tabela de taxas da empresa (`/visitas-n2/km-rates`).
- **Ordem de Serviço e Assinatura Digital**: captura da assinatura do cliente na tela do celular/tablet ao término da visita e geração instantânea de PDF da Ordem de Serviço (`/visitas-n2/service-orders`).
- **Visitas Recorrentes (`/visitas-n2/recurring`)**: programação automática de manutenções preventivas com repetição periódica configurável.

_[print: dashboard gerencial de visitas técnicas n2]_
_[print: grade de calendário e agenda técnica presencial]_
_[print: tela de despesas e reembolsos de deslocamento com cálculo de km]_
_[print: captura de assinatura digital do cliente na ordem de serviço]_

---

## 7. Base de Conhecimento e Inteligência Artificial (`/knowledge-base`)

A Base de Conhecimento do Sistema ITSM combina repositório técnico com automação avançada de IA via agente nativo Skip Cloud (`kb-curator-agent`):

### 7.1 Artigos Oficiais

- Repositório centralizado de manuais, procedimentos operacionais padrão (POPs), scripts e tutoriais.
- Editor de texto rico com suporte a formatação, blocos de código, tags de busca e controle de versões.
- Busca inteligente por palavras-chave, categoria e relevância.

### 7.2 Geração Automática de Rascunhos por IA (`DraftsReviewPanel`)

- **Gatilho de Criação**: quando técnicos seniores encerram chamados com soluções detalhadas e bem-sucedidas, a IA analisa a nota de resolução e redige automaticamente um rascunho de artigo estruturado.
- **Fila de Revisão de Rascunhos**: os rascunhos gerados entram em uma esteira de aprovação exibindo título sugerido, categoria, problema relatado, causa provável e procedimento passo a passo da solução.
- **Ações do Curador**: operadores seniores ou gestores de conhecimento podem revisar o texto, ajustar detalhes técnicos, reprovar ou clicar em _"Publicar na Base de Conhecimento"_, transformando o rascunho em artigo oficial instantaneamente.

### 7.3 Painel de Cura e Atualização Contínua (`KnowledgeCurationPanel`)

- **Diagnóstico Algorítmico de Artigos**: a IA avalia periodicamente o acervo de artigos em busca de conteúdos desatualizados, incompletos, com baixa taxa de resolução ou termos técnicos defasados.
- **Sugestões de Melhoria**: para cada artigo sinalizado, o painel exibe o diagnóstico e uma proposta detalhada de melhoria (adicionar tópicos, atualizar comandos, clarificar etapas).
- **Aplicação ou Recusa**: com um clique, o curador pode aplicar a sugestão de melhoria diretamente ao artigo ou recusar a recomendação caso julgue inadequada.

### 7.4 Agente Nativo de IA para Resposta a Chamados (`ticket-responder-agent`)

O sistema integra o agente nativo do Skip Cloud (`ticket-responder-agent`), configurado via migração `0117_ai_ticket_responder.js` e hook `ai_ticket_responder.js`, atuando no atendimento interno e no Portal do Cliente em **dois modos configuráveis**:

- **Modo Sugestão (Rascunho do Operador)**:
  - Na tela de detalhes do chamado interno (`TicketDetail.tsx`), o operador dispõe do painel/botão **"Gerar Resposta com IA"** (`TicketAiReplyPanel.tsx`).
  - O agente analisa o contexto integral do chamado: título, descrição, dados do solicitante, ativo e item de configuração (CI) vinculado, interações anteriores e artigos técnicos relevantes da Base de Conhecimento.
  - O operador pode refinar o rascunho com instruções pontuais (ex.: _"oriente reiniciar o modem"_), revisar/editar o texto e transferi-lo com um clique para a caixa de comentário/interação oficial.
- **Modo Automático**:
  - Quando ativado em Configurações, o agente responde automaticamente aos novos chamados recém-abertos, acolhendo o solicitante e fornecendo diagnóstico preliminar imediato.
  - Configuração granular de canais: permite escolher se a resposta automática atua no **Sistema Interno**, no **Portal do Cliente**, ou em ambos.
  - As interações automáticas recebem o cabeçalho `🤖 [Resposta Automática por IA]` e badge visual dedicado, identificando a autoria da IA tanto para os técnicos quanto para os clientes no portal (`TicketPublicDetailDialog.tsx`).
- **Regra de Horas e Franquia (0108 / 0109)**:
  - Respostas geradas automaticamente são criadas com `origin: 'Automático'`, `duration_minutes: 0` e `billing_status: 'Não Faturável'`.
  - **Não debitam a franquia de horas do cliente**, mantendo rigorosa aderência à política contratual vigente.
- **Configuração Centralizada**:
  - Aba dedicada **"Inteligência Artificial (IA)"** em Configurações (`/settings?tab=ai_reply`), permitindo ativar/desativar o recurso, selecionar o modo (Sugestão, Automático ou Ambos), definir canais e customizar diretrizes organizacionais.
- **Controle de Acesso Granular**:
  - Itens dedicados no catálogo de Perfis de Acesso com 3 níveis (Visualizar / Editar / Configurar): `tickets_ai_reply` (módulo Chamados) e `settings_ai_reply` (módulo Configurações).

_[print: tela principal da base de conhecimento com busca e categorias de artigos]_
_[print: painel de rascunhos de artigos gerados por ia pendentes de revisão]_
_[print: painel de cura algorítmica de artigos com sugestões de melhoria]_

---

## 8. Portal do Cliente (`/portal`)

Ambiente corporativo exclusivo e responsivo para clientes e solicitantes finais:

### 8.1 Acesso e Telas de Login Dedicadas

- **Rota Dedicada `/portal/login`**: design sóbrio corporativo para o cliente final.
- **Redirecionamento Seguro**: clientes autenticados são impedidos de navegar na área administrativa interna e são mantidos no ambiente do Portal.
- **Modo Suporte do Administrador**: barra superior âmbar permitindo ao Administrador impersonar qualquer empresa cliente para conferência de chamados, saldos e permissões sem necessitar de senha de cliente.

### 8.2 Os Módulos Integrados do Portal

1. **Dashboard Analítico**:
   - Gráficos de utilização e consumo de franquia por setor da empresa cliente.
   - Comparativo trimestral de consumo de horas (série dos últimos 3 meses).
   - Indicadores de total de chamados abertos e resolvidos com taxa percentual.
   - Ranking do Top 10 de atividades mais requisitadas e Top 10 de colaboradores que mais abrem chamados.
   - Média de satisfação com distribuição de estrelas.
2. **Meus Chamados**:
   - Lista completa com busca e filtros por status.
   - Abertura do diálogo `TicketPublicDetailDialog` com histórico de mensagens públicas (omissão garantida de notas internas de técnicos).
   - Envio de réplicas e novos anexos pelo cliente.
   - Botão de reabertura com justificativa obrigatória dentro da janela de dias configurada.
   - Avaliação de satisfação por estrelas para chamados resolvidos.
3. **Abertura de Chamado (`PortalNewTicketDialog`)**:
   - Formulário ágil amarrado automaticamente à empresa e filial do cliente.
   - Associação opcional de equipamento do CMDB e anexação de arquivos.
4. **Aprovações dos Pontos Focais**:
   - Aba exclusiva para usuários com perfil `cliente_gestor`.
   - Cards com detalhamento de orçamentos, alterações de escopo ou compras solicitadas.
   - Botões de _Aprovar_ ou _Reprovar_ com parecer textual obrigatório, avançando o chamado para "Novo" ou "Cancelado".
5. **Inventário de TI (CMDB do Cliente)**:
   - Visualização alternável entre Cards e Tabela corporativa.
   - Indicadores de resumo de ativos totais, em operação, em manutenção e reserva.
   - Ficha do ativo (`AssetDetailModal`) com histórico completo de manutenções e atalho direto _"Abrir Chamado para este Ativo"_.
6. **Visitas Técnicas Presenciais**:
   - Calendário e lista de visitas com data, horário, motivo, endereço e **exibição clara do nome e contato do técnico designado**.
7. **Horas Contratadas, Consumo e Saldo**:
   - Resumo gráfico da franquia mensal, total de horas de acompanhamento consumidas e saldo remanescente.
   - Seletor de período (Mês/Ano) para conferência de ciclos contratuais anteriores e alertas visuais de proximidade de estouro da franquia.
8. **Relatórios Mensais Liberados**:
   - Consulta aos laudos mensais ABNT que a equipe de Governança/Qualidade deliberou como liberados para o cliente (`released_to_client: true`), com parecer técnico e estatísticas consolidadas.

_[print: tela de login exclusiva do portal do cliente]_
_[print: dashboard analítico do cliente com gráficos de consumo por setor e top 10 atividades]_
_[print: visualização de chamados no portal do cliente com timeline pública e réplica]_
_[print: aba de aprovações pendentes para o ponto focal do cliente]_
_[print: inventário de ti cmdb no portal com histórico de manutenção do ativo]_
_[print: consulta de visitas técnicas agendadas com nome do técnico responsável no portal]_
_[print: extrato de horas contratadas consumidas e saldo restante no portal]_
_[print: relatório mensal abnt liberado visualizado pelo cliente no portal]_
