# Pontos de Restauração e Procedimento de Rollback — Lógos AITILSM

Este documento registra oficialmente os **Pontos de Restauração (Restore Points)** do Lógos AITILSM, estabelecidos a partir de versões homologadas, entregues e com QA 100% limpo, além de descrever os procedimentos de recuperação (rollback), limitações técnicas e governança para novos pontos de restauração.

---

## 1. Ponto de Restauração Atual — `restore-point-0.0.352` (Vigente)

- **Identificador de Referência:** `restore-point-0.0.352`
- **Versão Base Homologada:** `0.0.352` (registrada no commit atual do repositório)
- **Data de Registro:** Novembro de 2026
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

O projeto é hospedado e versionado na plataforma Skip, com histórico de versões sequenciais (ex: 0.0.291 ... 0.0.352). Não há repositório GitHub remoto externo conectado.

### 3.1 Reversão pelo Histórico de Versões da Plataforma Skip (Recomendado)

1. Na interface do projeto no painel Skip Cloud / Histórico de Versões (Versions / Deployments):
   - Localize a versão marcada como **`0.0.352`** (ou `0.0.291` para o marco legado).
   - Selecione a opção **"Rollback to this version"** / **"Restaurar esta versão"**.
   - O ambiente de Preview e a branch ativa de compilação serão imediatamente revertidos para o snapshot do código-fonte exato daquela versão.

### 3.2 Reversão Manual via Git (Ambiente Local ou Repositório Clonado)

Caso esteja trabalhando diretamente em um clone git local do projeto:

- **Para inspecionar o estado do ponto de restauração vigente sem alterar o histórico atual:**

  ```bash
  git checkout restore-point-0.0.352
  ```

- **Para inspecionar o ponto de restauração legado (0.0.291):**

  ```bash
  git checkout restore-point-0.0.291
  # ou navegando pelo commit registrado 22a8d58
  ```

- **Para criar uma nova branch a partir do ponto vigente:**

  ```bash
  git checkout -b recuperacao-v352 restore-point-0.0.352
  ```

- **Para desfazer commits defeituosos preservando o histórico (Revert seguro):**

  ```bash
  git revert HEAD~..restore-point-0.0.352
  ```

- **Para forçar o branch principal ao estado exato do ponto de restauração (Reset):**
  ```bash
  git reset --hard restore-point-0.0.352
  ```

### 3.3 Comportamento do Preview da Plataforma após o Rollback

- Ao realizar o rollback do código, a plataforma recompila o frontend React + Vite e atualiza o servidor de preview instantaneamente.
- Quaisquer telas, componentes, scripts ou rotas criados após a v0.0.352 deixarão de ser servidos, retornando ao estado estável homologado deste ponto.

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
