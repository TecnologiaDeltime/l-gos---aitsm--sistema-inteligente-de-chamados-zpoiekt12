# Agente de Distribuição Automática de Chamados (Lógos AITILSM)

Este documento detalha o funcionamento, arquitetura, regras de negócio, parametrizações e controle de permissões do **Agente de Distribuição Automática de Chamados**, implantado no sistema Lógos AITILSM.

---

## 1. Objetivo e Visão Geral

O **Agente de Distribuição Automática** elimina o gargalo de triagem manual e o tempo de espera de chamados órfãos na fila técnica. Sempre que um chamado é aberto sem um operador diretamente designado (`assigned_to` vazio), ou permanece na fila aguardando atribuição, o agente analisa a equipe responsável vinculada (`queue`) e delega o chamado de forma inteligente para o técnico mais adequado.

A funcionalidade é executada em três momentos complementares:

1. **Gatilho Síncrono no Momento da Abertura**: via hook `onRecordCreate` de tickets no PocketBase (`pocketbase/hooks/ticket_auto_assign.js`).
2. **Cron Periódico Agendado**: rotina agendada no backend PocketBase (`cronAdd('ticket_auto_assign_cron', '* * * * *')`) que varre e reavalia chamados não atribuídos em intervalo configurável.
3. **Execução Manual Imediata**: botão disponível no painel de configurações para forçar a reavaliação sob demanda (`POST /backend/v1/tickets/auto-assign/run`).

---

## 2. Ordem de Atribuição Inteligente (Cascata de Critérios)

A distribuição avalia os membros da equipe técnica da fila (`queues.members`) e segue uma cascata estrita de prioridades:

```
[ Chamado sem Operador ]
          │
          ▼
1. Operadores da Fila com Status "Disponível"?
   ├── SIM ──► Filtra apenas os disponíveis
   └── NÃO ──► Considera todos os membros da fila como pool de contingência
          │
          ▼
2. Menor Carga de Chamados Ativos (Mais Ocioso)
   └── Conta tickets onde status != 'Encerrado', 'Cancelado', 'Resolvido'
   └── Seleciona o operador com o menor número de chamados em andamento
          │
          ▼
3. Fallback: Responsável / Líder da Equipe (queue.manager)
   └── Se a fila não tiver membros cadastrados ou houver empate irresolúvel,
       atribui ao líder/responsável configurado na fila
          │
          ▼
4. Fallback Final: Primeiro Membro da Fila
   └── Caso nenhum critério anterior produza um operador
```

### Detalhamento dos Critérios:

1. **Disponibilidade do Operador (`availability_status = 'Disponível'`)**:
   - O agente inspeciona o campo `availability_status` de cada operador da fila (`users`).
   - Operadores em pausa, almoço, atendimento presencial, férias ou indisponíveis são poupados da atribuição automática enquanto houver algum operador com status **Disponível**.
   - Caso nenhum operador da fila esteja com status "Disponível", o sistema utiliza todos os membros da fila para não deixar o chamado desatendido.

2. **Ociosidade e Menor Volume Ativo de Chamados**:
   - Entre os candidatos elegíveis, o agente contabiliza os chamados em aberto atribuídos a cada um (`status` diferente de `Encerrado`, `Cancelado` e `Resolvido`).
   - O chamado é direcionado para aquele que possuir a **menor carga ativa** no momento da avaliação.
   - Isso garante equilíbrio contínuo da carga de trabalho entre os analistas da equipe.

3. **Fallback para o Responsável da Equipe (`queue.manager`)**:
   - Se a equipe não possuir membros associados na listagem de integrantes, o chamado é delegado automaticamente para o **Responsável/Líder da Fila** cadastrado no campo `manager` de `queues`.

4. **Registro de Auditoria e Status**:
   - Ao ser atribuído pelo agente, o chamado tem seu status atualizado para **"Atribuído"** (caso estivesse como "Aguardando Atribuição" ou "Novo").
   - Uma interação interna é gravada na timeline do chamado:
     > `🤖 Chamado distribuído automaticamente pelo Agente de Distribuição (critério: Disponibilidade / Menor Volume / Líder da Fila).`

---

## 3. Parametrização em Configurações (`/settings?tab=auto_assign`)

A gestão do agente é centralizada na aba **Distribuição Automática** nas configurações do sistema:

### 3.1. Campos Configuráveis:

- **Ativar Distribuição Automática (`auto_assign_enabled`)**:
  - Chave tipo Switch para ligar ou desligar globalmente a atuação do agente.
  - Quando desativado, novos chamados abertos sem operador permanecem com status `Aguardando Atribuição`.
- **Intervalo de Reavaliação em Minutos (`auto_assign_interval_minutes`)**:
  - Define a periodicidade com que o cron do PocketBase roda a varredura de chamados pendentes (padrão: **5 minutos**; configurável entre 1 e 1440 minutos).
  - O cron avalia os chamados em aberto sem operador e os redistribui caso técnicos fiquem disponíveis ou novos membros entrem na fila.
- **Regra de Distribuição (`auto_assign_rule`)**:
  - Exibe a estratégia ativa: _Cascata Inteligente (Disponibilidade → Menor Volume → Responsável da Fila)_.

### 3.2. Ação Manual Imediata:

- Botão **"Executar Distribuição Agora"**:
  - Aciona o endpoint `POST /backend/v1/tickets/auto-assign/run`.
  - Avalia imediatamente todos os chamados em aberto sem operador nas filas e exibe notificação toast com o total de chamados atribuídos.

---

## 4. Controle de Acesso e Permissões (3 Níveis)

A funcionalidade segue a política de segurança do sistema, com item registrado no catálogo de permissões (`src/lib/permissions-registry.ts`) e na matriz de perfis de acesso (`/profiles`):

- **Módulo**: `settings` (Configurações)
- **Item**: `settings_auto_assign`
- **Nome no Catálogo**: `Distribuição Automática de Chamados`
- **Descrição**: `Agente de distribuição automática de chamados por disponibilidade, ociosidade e responsável da fila`
- **Níveis de Acesso**:
  1. **Nenhum / Sem Acesso**: a aba "Distribuição Automática" não é exibida na tela de Configurações para o perfil.
  2. **Visualizar (`view`)**: o operador pode consultar os parâmetros configurados e o status do agente, mas os campos ficam desabilitados e os botões de salvar/executar são ocultados ou bloqueados com aviso de modo somente-leitura.
  3. **Configurar (`configure` / `edit`)**: permite alterar o switch de ativação, modificar o intervalo de reavaliação em minutos, salvar as configurações e disparar a execução manual imediata.

> **Nota**: O perfil de Administrador (`admin`) possui imunidade total e acesso irrestrito de configuração por padrão.

---

## 5. Arquitetura Técnica e Arquivos Relacionados

- `pocketbase/hooks/ticket_auto_assign.js`: hook de ciclo de vida (`onRecordCreate`), rotina agendada (`cronAdd`) e rota de execução manual (`routerAdd`).
- `pocketbase/migrations/0126_auto_assign_settings.js`: migração de banco com os campos `auto_assign_enabled`, `auto_assign_interval_minutes` e `auto_assign_rule` em `system_settings`, além do auto-registro da permissão `settings_auto_assign` nos perfis ativos.
- `src/components/settings/AutoAssignSettingsTab.tsx`: componente React da aba de parametrização e execução manual do agente.
- `src/pages/settings/SettingsPage.tsx`: registro da aba na tela de Configurações, protegida pela permissão `settings_auto_assign`.
- `src/lib/permissions-registry.ts`: registro formal no catálogo de perfis de acesso do sistema.
