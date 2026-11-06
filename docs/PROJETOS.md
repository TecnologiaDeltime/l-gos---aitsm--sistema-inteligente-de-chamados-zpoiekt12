# Módulo de Gestão de Projetos — Lógos AITSM

## 1. Visão Geral

O módulo de **Projetos** integra a gestão de iniciativas e entregas do Lógos AITSM com a operação técnica diária de chamados (tickets) e apontamento de horas de trabalho.

Permite gerenciar tanto **projetos internos** quanto **projetos vinculados a clientes**, respeitando três das principais metodologias e filosofias consagradas do mercado:

1. **Cascata (Waterfall)**: modelo linear preditivo com fases sequenciais clássicas (Iniciação, Planejamento, Execução, Monitoramento & Controle, Encerramento), marcos/deliverables e controle de pré-requisitos.
2. **Ágil (Scrum)**: framework iterativo com Backlog do Produto priorizado, Sprints com meta e datas, quadro de sprint (Backlog → To Do → Em Progresso → Em Review → Done) e cerimônias textuais (Daily, Review, Retrospective).
3. **Lean**: filosofia de fluxo contínuo focada em eliminação de desperdícios, com quadro Kanban de etapas configuráveis, limitação de WIP (Trabalho em Progresso) com alerta visual de violação e destaque de itens parados há muito tempo.

---

## 2. Integração com Chamados & Horas Trabalhadas

Um dos principais diferenciais da solução no Lógos AITSM é conectar a governança do projeto com a execução técnica do operador:

- **Gerar Chamado a partir de Atividade**: Qualquer atividade delegada a um operador permite gerar um chamado ITSM documentando a execução técnica. A descrição é pré-populada com os dados do projeto e atividade.
- **Rastreabilidade**: O chamado armazena a referência para o projeto e a atividade; no detalhe do projeto, a aba "Chamados Vinculados" lista todos os tickets abertos e seu status atual.
- **Apontamento de Horas e Ações**: Os operadores podem lançar horas no formato padrão do sistema (`HH:MM:SS`) e registrar ações e entregas técnicas.
- **Acúmulo de Horas**: Todo lançamento atualiza automaticamente o total de horas gastas na atividade e no projeto.

---

## 3. Catálogo de Permissões (Perfis de Acesso)

Em conformidade com a regra permanente do sistema, o módulo possui chave própria `projects` no catálogo de permissões com 3 níveis:

- **Visualizar (`view`)**: Consulta a lista de projetos, painel, atividades, sprints e chamados vinculados.
- **Editar (`edit`)**: Criação e atualização de projetos, criação de atividades, delegação a operadores, movimentação de status, geração de chamados e lançamento de horas.
- **Configurar / Excluir (`configure`)**: Acesso total, incluindo exclusão de projetos, encerramento de sprints e parametrização de limites Lean.

Itens granulares no catálogo:

- `projects_list`: Acesso à listagem e visão geral dos projetos (`/projetos`).
- `projects_create`: Cadastro de novos projetos, definição de metodologia, datas e equipe (`/projetos/novo`).
- `projects_manage`: Gestão de atividades, sprints, geração de chamados e lançamento de horas (`/projetos/:id`).

---

## 4. Estrutura do Banco de Dados (PocketBase)

- `projects`: Projetos (nome, cliente, descrição, metodologia, status, gestor, equipe, datas, horas estimadas/gastas).
- `project_tasks`: Atividades do projeto (título, descrição, fase/etapa, sprint, prioridade, responsável, status, estimativa, horas gastas, ticket vinculado).
- `project_sprints`: Sprints do Scrum (nome, meta, datas de início/fim, status, notas de cerimônias).
- `project_work_logs`: Apontamentos de horas e ações (usuário, atividade, duração em segundos, descrição da ação, chamado vinculado).
- `profile_permissions`: Registros atualizados via migração `0134_create_projects_module.js`.
