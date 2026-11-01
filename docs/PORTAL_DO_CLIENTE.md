# Documentação Oficial: Portal do Cliente — Sistema ITSM LUIZ

Esta documentação descreve a arquitetura, convenções de acesso, segurança e regras de negócio do **Portal do Cliente** no Sistema ITSM LUIZ (React + Vite + TypeScript + Tailwind, backend PocketBase Skip Cloud).

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
- **Redirecionamento Automático:**
  - Usuários autenticados com role `cliente_solicitante` ou `cliente_gestor` são redirecionados automaticamente para `/portal` caso tentem acessar `/login` ou a raiz `/`.

### 2.3 Auto-provisionamento e Gestão de Acessos

- Ao cadastrar pontos focais ou colaboradores na aba "Portal do Cliente" (em Configurações do sistema) ou pelo hook de auto-provisionamento, a senha inicial padrão é gerada como `Cliente@123` e o usuário é associado ao `companyId` correspondente.

---

## 3. Os 6 Módulos do Portal do Cliente

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
- O chamado nasce com `source: "Portal"` e entra imediatamente na fila de atendimento com status "Novo".

### Módulo C: Aprovações dos Pontos Focais

- Aba integrada com contadores em destaque de aprovações pendentes.
- Pontos focais (`cliente_gestor`) podem clicar em "Aprovar Chamado" ou "Reprovar".
- Ao confirmar a decisão, chama a rota de decisão de aprovação (`/api/approval/decide`), atualizando:
  - O registro na coleção `approvals` (`Aprovado` ou `Rejeitado`).
  - O status do chamado: avança para `Novo` ao ser aprovado ou para `Cancelado` ao ser reprovado.
  - Registra o parecer do ponto focal e notifica os envolvidos.

### Módulo D: Meus Ativos (CMDB)

- Lista de todos os itens de configuração da coleção `configuration_items` cuja empresa seja a do cliente.
- Filtros por busca textual, tipo de ativo (Servidor, Desktop, Notebook, Roteador, etc.) e status.
- Exibição de número de série, marca, modelo, localização e filial.

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

---

## 4. Identidade Visual e Temas Oficiais

O Portal do Cliente respeita rigorosamente as diretrizes de design do sistema:

- **Tema Escuro (Amber Alert):** barra superior grafite `#17181C`, tipografia âmbar `#FCD34D`, destaques em âmbar `#D97706`.
- **Tema Claro (Marrom & Branco):** barra superior grafite `#17181C`, tipografia branca, destaques em âmbar `#D97706`.
- Alternador de modo (Sol/Lua) disponível no cabeçalho superior.
- Logotipo oficial da organização respeitado dinamicamente via `useTheme` / `designSettings`.
