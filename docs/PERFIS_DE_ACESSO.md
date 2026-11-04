# Perfis de Acesso e Matriz de Permissões (ITSM)

O sistema ITSM adota um modelo de permissões granulares por perfil de acesso, permitindo controle refinado sobre cada módulo, funcionalidade e rota da plataforma.

A partir da versão v0.0.265, a matriz de permissões opera com **3 níveis de acesso**:

---

## Os 3 Níveis de Acesso

1. **Visualizar**

   > _"Visualizar - conseguem ver mas não podem editar"_
   - O usuário consegue consultar e navegar pelas telas e dados do item/módulo.
   - Todos os botões de ação destrutiva ou de alteração (Criar, Adicionar, Editar, Salvar, Excluir) são ocultados da interface.
   - Rotas de criação e edição direta são bloqueadas ou redirecionadas.

2. **Editar**

   > _"Editar - conseguem ver e editar - não pode excluir"_
   - O usuário consegue visualizar os dados e realizar operações de criação e edição (abrir chamados, cadastrar clientes, alterar status, adicionar interações, atualizar registros).
   - Ações destrutivas de exclusão permanente (botões de excluir, apagar, remover em lote) são estritamente ocultadas e bloqueadas.

3. **Configurar**
   > _"Configurar - Acesso total inclusive excluir e editar"_
   - Acesso irrestrito ao item/módulo.
   - Permite visualizar, criar, editar e excluir registros, além de gerenciar configurações avançadas relacionadas ao módulo.

---

## Regras de Imunidade e Novos Itens

- **Administrador Imune**:
  O perfil de **Administrador** (`role === 'admin'`) possui imunidade total e permanente. Ele tem acesso completo (`Configurar`) a todos os módulos, rotas e itens do catálogo, ignorando restrições granulares da matriz.

- **Itens Novos do Catálogo**:
  Sempre que um novo recurso ou funcionalidade for adicionado ao catálogo do sistema (`permissions-registry.ts`), ele **nasce concedido** por padrão para perfis ativos, garantindo que novas versões não quebrem fluxos operacionais pré-existentes. O Administrador pode posteriormente ajustar ou revogar o nível de cada perfil na Matriz de Permissões (`/profiles`).

---

## Hook `usePermissions` e Métodos Utilitários

O hook `@/hooks/use-permissions` disponibiliza métodos consistentes para verificar os níveis de acesso em qualquer componente ou tela:

- `canView(itemKey | moduleKey)`: retorna `true` se o perfil possui nível `view`, `edit` ou `configure` concedido.
- `canEdit(itemKey | moduleKey)`: retorna `true` se o perfil possui nível `edit` ou `configure` concedido (pode criar e editar, mas não excluir).
- `canDelete(itemKey | moduleKey)` / `canConfigure(itemKey | moduleKey)`: retorna `true` apenas se o perfil possui nível `configure` (acesso total incluindo exclusão).
- `canAccessItem(module, item, minLevel)`: checagem detalhada com especificação do nível mínimo desejado (`'view'`, `'edit'`, `'configure'`).
- `canAccessPath(pathname)`: guarda de rotas que avalia automaticamente a permissão do usuário para navegar até a página solicitada.

---

## Telas com Guardas Implementados

Os guardas dos 3 níveis estão aplicados de forma consistente nas seguintes áreas:

1. **Chamados / Tickets** (`TicketDetail.tsx`, `TicketList.tsx`, `KanbanBoard.tsx`):
   - _Visualizar_: apenas consulta de dados e histórico.
   - _Editar_: criação de chamados, envio de interações/comentários, transição de status, pausas de SLA, delegação e tickets filhos.
   - _Configurar_: tudo acima mais exclusão de interações, anexos e exclusão de chamados.

2. **Clientes** (`ClientList.tsx`, `ClientEdit.tsx`, `ClientDetail.tsx`):
   - _Visualizar_: consulta das empresas contratantes, filiais, contatos e contratos.
   - _Editar_: criação e alteração de cadastros de clientes, filiais e contatos.
   - _Configurar_: permissão para exclusão individual e em lote de clientes e registros cascata.

3. **Problemas** (`ProblemList.tsx`, `ProblemDetail.tsx`, `ProblemCreate.tsx`):
   - _Visualizar_: consulta da lista e detalhes do problema, causa raiz e investigação.
   - _Editar_: abertura de problemas, registro de hipóteses, causa raiz (Ishikawa/5 Porquês) e soluções de contorno.
   - _Configurar_: desvinculação e exclusão de incidentes e exclusão de problemas.

4. **Mudanças / RDM** (`ChangeList.tsx`, `ChangeDetail.tsx`, `ChangeCreate.tsx`):
   - _Visualizar_: consulta do calendário, lista e detalhes de mudanças.
   - _Editar_: criação de RDM, envio para aprovação, registro de planos e votos do comitê.
   - _Configurar_: exclusão de mudanças, tipos de mudança e templates.

5. **CMDB / Ativos** (`ConfigurationItemDetail.tsx`, `CiDetailInfo.tsx`, `CiList.tsx`):
   - _Visualizar_: consulta da topologia e atributos dos CIs.
   - _Editar_: cadastro e edição de itens de configuração.
   - _Configurar_: exclusão de itens de infraestrutura e tipos de CI.

6. **Relatórios e Gestão de Visitas** (`MonthlyClientReportPage.tsx`, `Visitas N2 / Gestão de Visitas`):
   - _Visualizar_: consulta de relatórios consolidados e atendimentos presenciais.
   - _Editar_: gerenciamento de visitas, despesas, reembolsos e relatórios mensais.
   - _Configurar_: parâmetros avançados e exclusão.
   - _Observação_: Funcionalidades descontinuadas/removidas temporariamente para futura reconstrução: Agenda de Operadores, Visitas Técnicas legadas fora de Gestão de Visitas, Dashboard de Visitas, Relatórios Gerenciais, Relatório por Filial, Dashboard de SLA, Metas de SLA e Relatórios Agendados.

7. **Configurações Gerais e Catálogo de Atividades** (`ActivityCatalog.tsx`, `ProfilesPage.tsx`):
   - _Visualizar_: consulta do catálogo de atividades e perfis.
   - _Editar_: criação e edição de atividades principais e subatividades.
   - _Configurar_: exclusão/desativação de atividades e alteração da matriz de permissões.

8. **Base de Conhecimento e IA (Geração de Rascunhos & Cura)** (`KnowledgeBase.tsx`, `DraftsReviewPanel.tsx`, `KnowledgeCurationPanel.tsx`):
   - _Visualizar_ (`knowledge_base`, `knowledge_drafts`, `knowledge_curation`): consulta aos artigos publicados, acompanhamento da fila de rascunhos de IA e leitura dos diagnósticos de cura e sugestões algorítmicas sem permissão de mutação.
   - _Editar_: criação e edição de artigos, solicitação de geração de rascunho de IA via agente nativo Skip Cloud (`kb-curator-agent`), aprovação/edição/descarte de rascunhos, publicação de rascunhos na KB oficial, execução do diagnóstico de integridade de artigos e aplicação ou recusa das recomendações de melhoria.
   - _Configurar_: exclusão permanente de artigos oficiais, exclusão de registros de rascunhos e parametrizações avançadas de conhecimento.
