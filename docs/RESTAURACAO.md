# Pontos de Restauração e Procedimento de Rollback — Lógos AITSM

Este documento registra oficialmente os **Pontos de Restauração (Restore Points)** do Lógos AITSM, estabelecidos a partir de versões homologadas, entregues e com QA 100% limpo, além de descrever os procedimentos de recuperação (rollback), limitações técnicas e governança para novos pontos de restauração.

---

## 0. Ponto de Restauração Solicitado — v0.0.503 (pendente de execução, 22/11/2026)

- **Versão Base Homologada:** `0.0.503` (última versão ANTES da separação da Pausa de Ciclo do SLA).
- **Commit Exato no GitHub:** `1479b1538a8ef6dc88a981e926fc5a4941a5b550` (tree `9f8bd47ae912bd74ec5ebc5bfa0a83e3d3802a27`, mensagem "v0.0.503", commit pai `814c80580dfe485d76fb6e0697e9c9f59b4258dc`, 21/11/2026 17:44 UTC).
- **Repositório Conectado:** `TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12` (público; histórico navegável e intacto — o HEAD atual está 32 commits à frente, nenhum force-push é necessário).
- **Estado da Restauração:** o usuário confirmou a perda das entregas v0.0.504 a v0.0.513 (separação Pausa de Ciclo × SLA, restauração visual das 4 telas, Fila de Tickets no formato do print). A execução do checkout ficou impedida nesta rodada pela ausência de git/checkout no workspace e de conector GitHub para leitura de blobs — a restauração NÃO foi reconstituída "de cabeça" por decisão de segurança (ver incidente v0.0.505–0.0.507).
- **Comando de Restauração (executar em ambiente com git disponível ou com conector GitHub habilitado):**

  ```bash
  # Restaurar o conteúdo completo da v0.0.503 como um NOVO commit (sem force-push, sem apagar histórico):
  git checkout 1479b1538a8ef6dc88a981e926fc5a4941a5b550 -- .
  git add -A
  git commit -m "restaura v0.0.503 (rollback do código ao estado anterior à separação Pausa de Ciclo × SLA)"
  # Arquivos criados após a 0.0.503 e inexistentes nela devem ser removidos manualmente antes do add (git clean -fd ou remoção individual)
  ```

- **Migrações/Backend:** conforme a Seção 4, rollback cobre só código — não destruir coleções no banco; endpoints/coleções criados após a 0.0.503 e sem uso ficam inofensivos.
- **Package.json:** protegido contra edição (preventAI) — a versão é incrementada automaticamente a cada commit, não editar.

---

## 1. Ponto de Restauração Atual — `restore-point-0.0.567` (Vigente)

- **Identificador de Referência:** `restore-point-0.0.567`
- **Versão Base Homologada:** `0.0.567` (commit base `539fec5` — "Correção da exclusão de operador", 27/11/2026; SHA completo verificável no histórico de Versões da plataforma Skip e no GitHub)
- **Data de Registro:** 27 de Novembro de 2026
- **Status de Qualidade:** Testes estáticos (oxlint), verificação de tipos (TypeScript tsc) e build Vite 100% aprovados sem erros nem advertências.
- **Estado do Banco de Dados PocketBase:**
  - Migrações aplicadas no Skip Cloud até a migração **`0562_inventory_movements.js`** (migrações ativas, incluindo os blocos 055x de sugestões/votos, laudos fotográficos, campos customizados com regras de validação e inventário de aparelhos com histórico de movimentação).
- **Estado do Sistema neste Ponto (Evoluções Consolidadas):**
  - Todos os módulos e evoluções consolidadas até o ponto `restore-point-0.0.353` (Seção 1.1 abaixo), além de:
  - **Exclusão de Operador corrigida e validada:** neutralização de vínculos atributivos e bloqueio operacional com mensagem nomeada (chamados, interações, anexos, visitas, horas, aprovações, agendados, laudos técnicos, sugestões, chat, projetos, inventário) e limpeza dos vínculos de autenticação interna do PocketBase.
  - **Laudos Fotográficos (`/laudos`):** módulo completo com templates, execução em campo, ambientes, assinatura por toque e câmera; item no grupo CMDB do menu; permissões `laudos_enviar`/`laudos_gerenciar`.
  - **Inventário de Aparelhos (`/inventario`):** cadastro de aparelhos com histórico de movimentação gravado por hook (atribuição, devolução, manutenção); item no grupo CMDB do menu.
  - **Área de Sugestões:** sugestões de operadores com votos e busca, alerta de e-mail `suggestion_created_notify` (nasce desligado no Centro de Alertas).
  - **Campos Customizados de Chamados:** configuração por categoria com regras de validação e valores por chamado.
  - **Fila de Tickets refrita:** 4 cards de criticidade, seletor de Tela Dividida (Kanban + resumo do chamado) e ciclo Play/Pause de horas no detalhe.
  - **Central de Ajuda (`/ajuda`)** e edição de horas trabalhadas com auditoria (permissão `admin_accompaniment_hours_edit`).
  - **Adaptação Mobile/PWA:** alvos de toque ≥44px, câmera, assinatura por toque, ícones PWA gerados no build; breakpoint mobile 1024.
- **Tag Git de Referência (clones exportados):**
  ```bash
  git tag -a restore-point-0.0.567 539fec5 -m "Ponto de Restauracao Logos AITSM v0.0.567 (Correcao exclusao de operador; Laudos, Inventario, Sugestoes, Campos customizados, Tela Dividida, Central de Ajuda, Mobile/PWA)"
  git checkout restore-point-0.0.567
  ```

---

## 1.1 Ponto de Restauração Anterior — `restore-point-0.0.353` / `restore-point-0.0.352`

- **Identificador de Referência:** `restore-point-0.0.353` (equivalente ao snapshot estável homologado da v0.0.352)
- **Versão Base Homologada:** `0.0.352` / `0.0.353` (consolidada com QA 100% aprovado)
- **Data de Registro:** 05 de Novembro de 2026
- **Status de Qualidade:** Testes estáticos (oxlint), verificação de tipos (TypeScript tsc) e build Vite 100% aprovados sem erros nem advertências.
- **Estado do Banco de Dados PocketBase:**
  - Migrações aplicadas no Skip Cloud até a migração **`0131_add_chat_history_permission.js`** (131 migrações ativas e integradas).
- **Estado do Sistema neste Ponto (Evoluções Consolidadas):**
  - **Módulos Originais e Core ITSM (desde v0.0.291):**
    - Central de Atendimento Omnichannel e Fila de Chamados.
    - Gestão de Perfis de Acesso com Matriz Granular de permissões e Landing Route personalizada por perfil.
    - Portal do Cliente completo com 6 módulos (Dashboard Analítico, Chamados, Abertura, Aprovações, Ativos CMDB, Visitas Técnicas N2, Saldo de Horas e Relatórios Mensais com liberação).
    - Módulos ITIL: Incidentes, Requisições, Problemas (Erros Conhecidos), Mudanças (GMUD / CAB), Ativos (CMDB), Cofre de Senhas (Vault), Visitas Técnicas N2 com despesas e reembolsos.
    - Painel Executivo, Painel do Operador e Dashboards de SLA e Contratos.
    - Temas oficiais ativos: Escuro Amber Alert (padrão) e Claro Marrom & Branco.
  - **Evoluções Integradas entre v0.0.292 e v0.0.352:**
    - **Chamados Internos entre Setores (`/tickets` e `/tickets/new`):**
      - Alternador de chamado Externo (cliente) vs. Interno entre setores da empresa/área de inovação.
      - Atribuição a setor solicitante interno sem débito de franquia de horas de cliente.
      - Identificação visual via badge dedicada na listagem, no Kanban e no detalhe do chamado.
    - **Chat Interno de Operadores em Tempo Real (`/chat`):**
      - Comunicação instantânea P2P entre operadores e área de inovação via WebSocket PocketBase (`operator_chat_messages`).
      - Indicador de presença online/offline (baseado em última atividade de sessão), contadores de mensagens não lidas e marcação bidirecional de leitura.
      - Permissão de acesso dedicada no catálogo de perfis (`chat_operadores`).
    - **Histórico de Chat por Operador (`/chat/history`):**
      - Consulta auditável e somente leitura de conversas históricas entre operadores.
      - Busca textual avançada com normalização Unicode NFD (insensível a acentos e maiúsculas/minúsculas), suporte a múltiplos termos com AND lógico e destaque visual das ocorrências na mensagem.
      - Permissão própria `chat_historico` com nível padrão 'view'.
    - **Modo TV e Rotação Automática de Dashboards (`/tv`):**
      - 7 painéis executivos e operacionais em tela cheia com alternância temporizada automática para exibição em televisores e NOC.
      - Dashboards de Status de Chamados, Chamados por Fila, Metas Executivas, Usuários Online, Horas de Clientes, Problemas e Mudanças (GMUD).
      - Permissão dedicada `dashboard_tv`.
    - **Integração com Monitoramento PRTG (`/settings?tab=prtg`):**
      - Monitoramento de sensores de infraestrutura, sincronização de alarmes e abertura automática de incidentes correlacionados a CIs do CMDB.
    - **Agente de Distribuição Automática de Chamados (`settings_auto_assign`):**
      - Distribuição inteligente baseada em disponibilidade, ociosidade e liderança de fila com rotina agendada no backend.
    - **Agente Inteligente de Consumo de Horas do Cliente (`client_consumption_agent`):**
      - Alertas preditivos de esgotamento de franquia contratual e relatórios automatizados de consumo.
    - **Automação de Ativos CMDB:**
      - Proteção contra ativos órfãos com transição automática para "Disponível" e auditoria em `asset_automation_logs`.

---

## 2. Histórico de Pontos de Restauração Anteriores

### 2.1 Ponto `restore-point-0.0.291` (Legado — Commit `22a8d58`)

- **Identificador de Referência:** `restore-point-0.0.291`
- **Commit Base:** `22a8d58`
- **Versão Base Homologada:** `0.0.291` (registrada no commit subsequente `0.0.292`)
- **Data de Registro:** Março de 2025
- **Migrações PocketBase:** Até a migração `0116_asset_automation_logs.js` (116 migrações ativas).
- **Escopo Histórico:** Marco de estabilização do Portal do Cliente, Matriz de Perfis Granulares, Landing Routes e módulo de Visitas Técnicas N2.
- **Comando Git Histórico:**
  ```bash
  git checkout restore-point-0.0.291
  ```

---

## 3. Como Realizar o Rollback do Código

O projeto é hospedado e versionado nativamente na plataforma Skip Cloud (React + Vite + TypeScript), onde cada commit aprovado pelo ciclo de QA (`run_qa` + `commit_changes`) gera uma nova versão sequencial imutável no histórico da plataforma (ex.: `0.0.291`, `0.0.352`, `0.0.353`), com o versionamento do `package.json` gerenciado automaticamente pelo ecossistema.

### 3.1 Mecanismo Oficial: Histórico de Versões e Rollback Nativo da Plataforma Skip (Recomendado)

Na plataforma Skip, o versionamento é atômico por commit e dispensa ferramentas externas:

1. Acesse o painel do projeto no Skip Cloud / Histórico de Versões (**Versions / Deployments**).
2. Localize a versão marcada como **`0.0.567`** (ponto vigente — "Correção da exclusão de operador"), ou versões anteriores **`0.0.352`/`0.0.353`** (consolidação estável pós-migração 0131 e chat/TV) ou a versão histórica **`0.0.291`**.
3. Clique em **"Rollback to this version"** / **"Restaurar esta versão"**.
4. A plataforma restaura imediatamente o snapshot do código-fonte daquele commit, executa o build limpo do frontend e atualiza o servidor de Preview em tempo real.

### 3.2 Equivalência em Ambientes Git Locais ou Clones Exportados

Para desenvolvedores que trabalham com uma cópia exportada/clonada do repositório Git:

- **Tags Recomendadas de Restauração:**
  - `restore-point-0.0.567` (commit base `539fec5`) para o ponto vigente estável.
  - `restore-point-0.0.353` (ou `restore-point-0.0.352`) para o ponto estável anterior.
  - `restore-point-0.0.291` (commit base `22a8d58`) para o marco histórico legado.

- **Comandos Git para criação da tag (caso não tenha sido exportada no clone):**

  ```bash
  # Criar a tag no commit vigente da versão 0.0.353:
  git tag -a restore-point-0.0.353 -m "Ponto de Restauracao Lógos AITSM v0.0.353 (Chat, TV, Internos, PRTG, Migracao 0131)"

  # Ou caso deseje apontar para o commit específico da 0.0.352:
  git tag -a restore-point-0.0.352 <hash-do-commit-0.0.352> -m "Ponto de Restauracao Lógos AITSM v0.0.352"

  # Verificar as tags de ponto de restauração registradas:
  git tag --list 'restore-point*'
  ```

- **Para inspecionar o estado do ponto de restauração vigente sem alterar o branch atual:**

  ```bash
  git checkout restore-point-0.0.567
  # ou navegando pelo commit registrado 539fec5
  ```

- **Para inspecionar o ponto de restauração legado (0.0.291):**

  ```bash
  git checkout restore-point-0.0.291
  # ou navegando pelo commit registrado 22a8d58
  ```

- **Para criar uma nova branch a partir do ponto vigente:**

  ```bash
  git checkout -b recuperacao-v567 restore-point-0.0.567
  ```

- **Para desfazer commits defeituosos preservando o histórico (Revert seguro):**

  ```bash
  git revert HEAD~..restore-point-0.0.567
  ```

- **Para forçar o branch principal ao estado exato do ponto de restauração (Reset):**
  ```bash
  git reset --hard restore-point-0.0.567
  ```

### 3.3 Comportamento do Preview da Plataforma após o Rollback

- Ao realizar o rollback do código, a plataforma recompila o frontend React + Vite e atualiza o servidor de preview instantaneamente.
- Quaisquer telas, componentes, scripts ou rotas criados após o ponto restaurado deixarão de ser servidos, retornando ao estado estável homologado deste ponto.

---

## 4. Limitação Importante e Honesta: Código vs. Banco de Dados

> ⚠️ **ATENÇÃO:** O procedimento de Rollback restaura **EXCLUSIVAMENTE o código-fonte da aplicação** (frontend React, páginas, componentes, estilos, bibliotecas e hooks).

### O que o Rollback restaura:

- Todo o código TypeScript/React (`src/**`).
- Dependências e configurações de build (`package.json`, Tailwind, Vite).
- Regras de frontend, componentes visuais e lógica de navegação.
- Arquivos de migração locais na pasta `pocketbase/migrations/`.

### O que o Rollback NÃO desfaz:

1. **Dados transacionais existentes no banco PocketBase:**
   - Chamados abertos, mensagens de atendimento, logs de horas, interações, itens de configuração (CMDB), visitas técnicas, usuários, senhas e mensagens de chat criados após o ponto de restauração **permanecem intactos**.
2. **Migrações de banco já executadas:**
   - As migrações executadas na instância PocketBase Skip Cloud (até a 0131) continuam aplicadas no banco.
   - Caso novas migrações tenham sido aplicadas após a 0131, elas **não são revertidas automaticamente por um rollback de código**, pois o banco PocketBase executa migrações de forma cumulativa. Para reverter alterações estruturais no banco seria necessária uma migração corretiva compensatória (`down` / corretiva).

---

## 5. Como Criar Novos Pontos de Restauração no Futuro

Para criar um novo ponto de restauração em qualquer momento após a conclusão de uma nova funcionalidade ou marco do projeto:

1. Solicite diretamente ao assistente no chat:
   > _"Crie a partir daqui um novo ponto de restauração para rollback"_
2. O assistente irá:
   - Validar que o sistema está estável e compila sem falhas (QA limpo).
   - Registrar no documento `docs/RESTAURACAO.md` a nova versão de referência, a tag correspondente (`restore-point-<versão>`), a data, a lista de migrações ativas e as novidades incluídas.
   - Atualizar a memória do projeto e commitar o novo marco com mensagem identificável na timeline do projeto.
