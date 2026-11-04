# Documentação Oficial: Portal do Cliente — Lógos AITILSM

Esta documentação descreve a arquitetura, convenções de acesso, segurança e regras de negócio do **Portal do Cliente** no Lógos AITILSM (React + Vite + TypeScript + Tailwind, backend PocketBase Skip Cloud).

---

## 1. Visão Geral e Objetivos

O Portal do Cliente foi projetado para conceder transparência completa aos clientes finais e pontos focais das empresas cadastradas no sistema ITSM, permitindo:

1. **Abertura e Acompanhamento de Chamados:** visualização em tempo real de status, histórico e timeline de logs públicos (com estrita omissão de notas internas de operadores).
2. **Aprovações por Pontos Focais:** autorização ou reprovação de chamados que exigem validação prévia de orçamento ou escopo, sincronizado com o fluxo existente de aprovação.
3. **Inventário de Ativos (CMDB):** consulta a equipamentos, itens de configuração, números de série e locais vinculados à empresa.
4. **Visitas Técnicas Presenciais:** acompanhamento de agendamentos presenciais com data, hora, endereço e nome do técnico responsável.
5. **Consumo de Horas Contratadas:** auditoria do saldo do período selecionado (padrão: mês atual), comparando franquia contratada, horas consumidas e saldo restante.

---

## 2. Decisão de Acesso e Convenção de Autenticação

A convenção de acesso foi estabelecida no hook `pocketbase/hooks/client_portal_access.js` e na migration `pocketbase/migrations/0083_client_portal_access_rules.js`:

### 2.1 Papéis de Acesso (Roles)

- **`cliente_solicitante`**:
  - Usuário colaborador da empresa cliente.
  - Pode abrir chamados amarrados à sua empresa.
  - Visualiza os chamados da empresa e seus logs públicos.
  - Consulta os ativos/CMDB e visitas agendadas da empresa.
  - Visualiza o saldo de horas do contrato.
  - _Não possui permissão de aprovação de chamados_.
- **`cliente_gestor` (Ponto Focal)**:
  - Usuário gestor ou ponto focal autorizado da empresa.
  - Possui todas as permissões do solicitante.
  - **Pode aprovar ou reprovar chamados** pendentes de validação para sua empresa.
- **Operadores / Administradores (`admin`, `gestor`, `analista_n1`, etc.)**:
  - Podem acessar `/portal` para auditoria ou visualização, mas possuem a tela principal `/dashboard` e `/atendimento`.

### 2.2 Rotas e Separação de Login

- **`/portal/login`**:
  - Tela de login dedicada e exclusiva para clientes.
  - Design limpo com foco corporativo, sem confundir o cliente com menus ou opções de suporte interno.
  - Links diretos para suporte e alternador do tema oficial.
- **`/login`**:
  - Tela de login para operadores do sistema.
  - Possui link sutil no rodapé direcionando para `/portal/login` caso um cliente acerte a rota de operadores por engano.
- **Redirecionamento Automático e Tela Inicial por Perfil de Acesso:**
  - Usuários autenticados com role `cliente_solicitante` ou `cliente_gestor` são redirecionados automaticamente para `/portal` caso tentem acessar `/login` ou a raiz `/`.
  - Para operadores e administradores, a **Tela Inicial (Landing)** é configurável individualmente em cada **Perfil de Acesso** (em Configurações → Perfis de Acesso).
  - Padrão inicial do backfill: perfis operacionais abrem no Painel do Operador (`/operator-dashboard`) e Administrador no Dashboard (`/dashboard`).
  - Se a tela configurada for revogada na matriz de permissões do perfil, o sistema executa fallback seguro para `/dashboard` sem erro de rota bloqueada.

### 2.3 Auto-provisionamento e Gestão de Acessos

- Ao cadastrar pontos focais ou colaboradores na aba "Portal do Cliente" (em Configurações do sistema) ou pelo hook de auto-provisionamento, a senha inicial padrão é gerada como `Cliente@123` e o usuário é associado ao `companyId` correspondente.

---

## 3. Os Módulos do Portal do Cliente (v0.0.256)

### Módulo 0: Dashboard Analítico do Cliente (Nova Primeira Aba)

A primeira aba padrão ao entrar no portal agora é o **Dashboard Analítico**, fornecendo visibilidade executiva em tempo real sobre a operação da empresa selecionada:

1. **Utilização / Consumo da Franquia por Setor da Empresa:** gráfico em barras horizontais/verticais categorizado por departamento do solicitante, permitindo identificar qual setor da empresa consome mais horas de suporte.
2. **Consumo de Horas nos Últimos 3 Meses:** gráfico comparativo mensal (série temporal do trimestre) entre franquia contratada e horas efetivamente consumidas.
3. **Total de Chamados Abertos:** métrica consolidada de chamados históricos da empresa e chamados ativos em andamento.
4. **Total de Chamados Fechados:** métrica de chamados concluídos/resolvidos com taxa percentual de resolução.
5. **Top 10 de Atividades Mais Requisitadas:** ranking ordenado das 10 atividades/serviços mais demandados pela empresa, com contagem de chamados e volume de horas.
6. **Top 10 de Colaboradores Solicitantes:** ranking ordenado dos 10 colaboradores que mais abriram chamados na central de suporte, exibindo nome, e-mail, setor e horas consumidas.

_Observação:_ No Modo Suporte do Administrador, ao alternar a empresa no seletor do topo, todos os indicadores e gráficos do Dashboard são recalculados instantaneamente para a empresa selecionada.

### Módulo A: Meus Chamados

- Lista completa de chamados vinculados à empresa do usuário.
- Filtros por texto (número, título, descrição) e status (Abertos, Concluídos, Novo, Em Andamento, Aguardando Solicitante, etc.).
- Ao clicar no chamado, abre o `TicketPublicDetailDialog`, exibindo:
  - Detalhes, categoria, SLA, datas e solicitante.
  - Timeline com logs públicos (`is_private = false`), respostas do suporte e anexos.
  - Ocultação garantida de notas internas do operador.
  - Opção para o cliente enviar réplica ou nova mensagem pública.

### Módulo B: Abertura de Chamado

- Dialog `PortalNewTicketDialog` integrado ao topo da tela.
- Amarra automaticamente o chamado à empresa (`company: companyId`) e unidade do cliente logado.
- Permite informar tipo (Incidente, Requisição, Dúvida, Visita Técnica), categoria, urgência, equipamento do CMDB envolvido, título e descrição detalhada.
- **Seleção de Setor e Contato em Cascata:** o seletor "Selecionar o Setor" registra a escolha normalmente (o chamado é criado com `department` do setor escolhido). Ao selecionar um setor, o campo "Nome do contato" lista SOMENTE os colaboradores do cadastro do cliente vinculados àquele setor (`client_contacts.departments` contém o setor); a lista é refeita a cada troca de setor, o valor selecionado anteriormente é limpo e o padrão permanece "quem está logado" (`logged_user`). Sem setor específico ("Geral"), a lista mostra todos os colaboradores da empresa. Se o setor não tiver colaboradores cadastrados, o contato permanece o usuário logado e um aviso orienta o cliente.
- **Nova Ordem dos Campos:** o formulário segue a sequência corporativa **Setor → Nome do contato → Equipamento → Tipo da solicitação**, seguida de categoria, assunto, descrição e anexos.
- **Vínculo Automático Contato → Equipamento:** ao selecionar qualquer colaborador no campo "Nome do contato", o sistema busca automaticamente no CMDB/equipamentos os ativos cujo "Usuário responsável" corresponda àquele contato (por ID ou por nome, inclusive suportando o formato `"Nome — Departamento"` e texto livre de ativos legados) e pré-seleciona a máquina que ele usa no campo Equipamento.
- **Atalho "Meu chamado":** botão destacado no topo do formulário que preenche automaticamente setor, contato (nome, e-mail e telefone) e equipamento com os dados do usuário logado. O equipamento é reconhecido pelo vínculo do responsável (ID) ou pelo nome do responsável cadastrado no ativo — inclusive consultando a coleção `equipments` da empresa quando o CMDB não casa — e, se o usuário não tiver nenhum ativo, o formulário continua normalmente com o equipamento vazio. O atalho respeita a permissão **"Atalho Meu chamado (Portal)"** da matriz de Perfis de Acesso (módulo Chamados, níveis Visualizar/Editar/Configurar): só aparece para quem tiver o item concedido.
- O chamado nasce com `source: "Portal"` e entra imediatamente na fila de atendimento com status "Novo".

### Módulo C: Aprovações dos Pontos Focais

- Aba integrada com contadores em destaque de aprovações pendentes.
- Pontos focais (`cliente_gestor`) podem clicar em "Aprovar Chamado" ou "Reprovar".
- Ao confirmar a decisão, chama a rota de decisão de aprovação (`/api/approval/decide`), atualizando:
  - O registro na coleção `approvals` (`Aprovado` ou `Rejeitado`).
  - O status do chamado: avança para `Novo` ao ser aprovado ou para `Cancelado` ao ser reprovado.
  - Registra o parecer do ponto focal e notifica os envolvidos.

### Módulo D: Inventário de TI (CMDB do Cliente)

- Lista de todos os itens de configuração e equipamentos vinculados à empresa do cliente selecionada, unificando registros cadastrados nas coleções de ativos (`equipments` e `configuration_items`).
- **Resumo no Topo:** Indicadores interativos com contagem total de ativos, quantidade e percentual em operação, ativos em manutenção e sobressalentes/reserva. O clique nos cards de resumo aplica filtro imediato.
- **Filtros e Busca Textual:**
  - Busca em tempo real por nome do equipamento, número de série, marca, modelo e localização.
  - Filtro por Tipo de Ativo com contagem por tipo.
  - Filtro por Status do Ativo (Ativo, Em Manutenção, Reserva, Inativo, Descartado).
  - Filtro por Localização física (sala, andar ou departamento).
  - Tag visual com os filtros ativos e botão rápido para limpeza de filtros.
- **Visualização Flexível (Cards e Tabela):**
  - **Modo Cards:** Cartões responsivos com tipografia tema oficial, badge de status e tipo, metadados de série, filial, localização e observações.
  - **Modo Tabela:** Listagem tabular corporativa para auditoria rápida de parque computacional, com colunas de Equipamento, Tipo, Status, Nº de Série, Localização, Filial e Ação.
- **Modal de Detalhes do Ativo (`AssetDetailModal`):**
  - Acesso ao clicar no card ou na linha da tabela, sem sair do Portal do Cliente.
  - Apresenta especificações técnicas completas, fabricante, modelo, número de série, empresa, filial, sala/andar, notas de configuração e datas de criação/atualização.
  - **Histórico de Manutenção do Ativo:** Seção dedicada na ficha com a lista dos chamados e ordens de atendimento vinculados ao equipamento (`configuration_item = asset.id`), ordenados do mais recente para o mais antigo (`-created`). Para cada entrada, informa número do chamado, título/tipo, status atual, data de abertura, técnico responsável, resumo do atendimento (última interação pública do operador, solução aplicada ou descrição original) e atalho direto para visualizar o chamado na íntegra.
  - **Estado Vazio Amigável:** Quando o equipamento ainda não teve manutenção, exibe mensagem clara e ilustrada sem quebras de layout, com convite para abertura do primeiro chamado.
  - **Sincronização com Modo Suporte:** A listagem de histórico obedece à empresa atualmente selecionada (inclusive ao alternar no seletor de suporte do administrador).
  - **Ação Rápida Integrada:** Botão _"Abrir Chamado para este Ativo"_ que aciona diretamente o modal de novo chamado com o IC já pré-selecionado.

### Módulo E: Visitas Técnicas

- Lista de visitas técnicas da coleção `technical_visits` filtradas para a empresa do cliente.
- Destaque para visitas com status `Agendada` e `Em Andamento`.
- **Exibe claramente o nome do técnico responsável** designado para a visita, telefone de contato, data, horário, motivo do atendimento e endereço de execução.

### Módulo F: Horas Contratadas × Consumidas × Saldo Restante

- Exibição do cálculo:
  - **Franquia Contratada:** obtida a partir do período ativo em `contract_periods` ou do contrato vigente da empresa (`monthly_hours`).
  - **Horas Consumidas:** soma das interações faturáveis em `ticket_interactions` de chamados da empresa no período selecionado.
  - **Saldo Restante:** franquia menos horas consumidas.
- **Padrão:** visualização do mês atual.
- **Seletor de Período:** seletor interativo de Mês e Ano, com botão para retornar rapidamente ao mês vigente.
- Alertas visuais quando o saldo atinge 80% do consumo ou quando a franquia é excedida.

### Módulo G: Relatórios Mensais de Atendimento Liberados

Nova aba **Relatórios** no Portal do Cliente com fluxo de liberação corporativa:

- **Fluxo de Governança e Qualidade:** Quando fecha o mês, a equipe responsável (geralmente Qualidade e Governança) gera e analisa o relatório mensal em `/reports/monthly-client` (Normas ABNT).
- **Ação de Liberação:** Na tela interna do relatório mensal, a equipe possui o botão **"Liberar ao Cliente"** (ou revogar).
- **Visibilidade Estrita:** No Portal do Cliente, aparecem **apenas os relatórios mensais liberados** (`released_to_client: true`) vinculados à empresa do cliente.
- **Visualização do Conteúdo:** O cliente visualiza o parecer técnico da Qualidade, resumo de horas contratadas e consumidas, saldo contratual, consumo por setor, atividades mais requisitadas e recomendações técnicas.

---

## 4. Identidade Visual e Temas Oficiais

O Portal do Cliente respeita rigorosamente as diretrizes de design do sistema:

- **Tema Escuro (Amber Alert):** barra superior grafite `#17181C`, tipografia âmbar `#FCD34D`, destaques em âmbar `#D97706`.
- **Tema Claro (Marrom & Branco):** barra superior grafite `#17181C`, tipografia branca, destaques em âmbar `#D97706`.
- Alternador de modo (Sol/Lua) disponível no cabeçalho superior.
- Logotipo oficial da organização respeitado dinamicamente via `useTheme` / `designSettings`.

---

## 5. Modo Suporte e Impersonação do Administrador

Para possibilitar que o **Administrador do sistema** aferir erros relatados pelos clientes, diagnosticar comportamentos e enxergar exatamente a visão real que a empresa contratante possui sem necessitar de suas credenciais pessoais:

### 5.1 Regras de Acesso e Segurança

1. **Exclusividade:** Válido **apenas** para usuários com perfil `admin` (`role === 'admin'`). Clientes comuns (`cliente_solicitante`, `cliente_gestor`) ou operadores sem perfil de Administrador não possuem acesso a esse atalho e devem realizar o login normal com e-mail e senha.
2. **Sem Senha de Cliente:** O Administrador já autenticado no sistema interno não precisa digitar credenciais de nenhum cliente.

### 5.2 Pontos de Entrada

1. **Em `/portal/login`:** Quando um Administrador autenticado abre a página de login do portal, um painel destacado _"Modo Suporte — Administrador"_ é apresentado com a lista de empresas ativas para escolha imediata e entrada com um clique ("Entrar no Portal como este Cliente").
2. **Em Configurações > Portal do Cliente (`/settings`):** Em cada card de empresa cliente, há o botão _"Acessar como Cliente"_, abrindo diretamente a visão do portal daquela empresa.
3. **Por URL Direta:** O Administrador pode acessar `/portal?company=<company_id>` para impersonar diretamente uma empresa específica.

### 5.3 Indicador Visual e Saída Rápida

- Ao navegar em modo suporte, uma barra superior destacada âmbar é fixada no topo:
  - **Badge visual:** `Modo Suporte • Administrador`.
  - **Seletor dinâmico:** Permite alternar entre empresas clientes em tempo real sem precisar sair do portal.
  - **Botão de saída:** _"Voltar ao Sistema Interno"_, que direciona imediatamente de volta ao Dashboard/Atendimento do ITSM.

### 5.4 Funcionamento dos 6 Módulos em Modo Suporte

Todos os 6 módulos do portal operam amarrados à empresa selecionada pelo Administrador:

- **Meus Chamados:** Chamados da empresa selecionada e timeline de logs públicos (`is_private = false`).
- **Abrir Chamado:** Formulário pré-preenchido com a empresa impersonada e seus ativos do CMDB.
- **Aprovações:** Lista de pendências e histórico de aprovação daquela empresa.
- **Meus Ativos:** Itens de configuração vinculados à empresa.
- **Visitas Técnicas:** Visitas da empresa com o nome do técnico responsável.
- **Horas e Saldo:** Franquia contratada, consumo e saldo do mês atual ou meses históricos para a empresa selecionada.
