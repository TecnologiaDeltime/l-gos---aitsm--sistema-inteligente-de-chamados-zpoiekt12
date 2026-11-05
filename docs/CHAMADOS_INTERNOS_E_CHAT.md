# Chamados Internos e Chat de Operadores — Lógos AITSM

Este documento detalha o funcionamento e a arquitetura das funcionalidades de **Chamados Internos** e **Chat Interno de Operadores**, desenvolvidas para permitir que a própria empresa operadora do Lógos AITSM gerencie demandas entre seus setores (incluindo a Área de Inovação) e mantenha comunicação instantânea entre operadores.

---

## 1. Chamados Internos entre Setores

### 1.1 Contexto e Motivação

A empresa que opera o Lógos AITSM realiza demandas internas entre seus departamentos e áreas (como Inovação, TI Interna, RH, Compras, Operações e Suporte). Anteriormente, a criação de chamados exigia a vinculação de um cliente externo previamente cadastrado.

Com a nova funcionalidade de **Chamados Internos**:

- **Não é necessário cadastrar a empresa como cliente externo.**
- O operador pode alternar o tipo de chamado para **Interno** diretamente na tela de abertura (`/chamados/novo`).
- O formulário oculta o campo de cliente e disponibiliza os campos de **Setor Solicitante** (ex.: Inovação, RH, Comercial) e **Solicitante / Ramal / E-mail interno**.
- A fila e a equipe de destino continuam funcionando com base no Catálogo de Atividades ou na seleção de fila interna.

### 1.2 Regras de Negócio e Faturamento

- **Isenção de Franquia de Horas**: O backend (`pocketbase/hooks/on_interaction_consume.js`) e as rotas de acompanhamento garantem que interações e horas trabalhadas em chamados com `is_internal = true` ou sem `company` vinculada **não debitam saldo de franquia de nenhum cliente**.
- **Isolamento do Portal do Cliente**: O serviço `client-portal.ts` adiciona a cláusula `is_internal != true` nas consultas de chamados abertos e no histórico do Portal do Cliente, garantindo que demandas e discussões internas de setores nunca vazem para clientes externos.
- **Identificação Visual**:
  - Na **Listagem de Chamados** (`/tickets`), chamados internos exibem uma badge roxa `"Interno"`, e no lugar do nome do cliente é exibido `"Interno: [Setor]"`.
  - No **Kanban de Chamados**, o card exibe a tag destacada `"Interno"`.
  - No **Detalhe do Chamado** (`/tickets/:id`), o cabeçalho e a barra lateral de informações do solicitante identificam claramente que se trata de uma demanda interna com o respectivo setor solicitante.

---

## 2. Chat Interno entre Operadores

### 2.1 Visão Geral

O **Chat de Operadores** (`/chat`) é um módulo de comunicação instantânea 1:1 projetado para acelerar o alinhamento técnico, transferências de contexto e discussões rápidas sem poluir a timeline pública dos chamados.

### 2.2 Funcionalidades do Chat

1. **Lista de Operadores em Tempo Real**:
   - Exibe todos os operadores cadastrados no sistema com avatar e status de presença (**Online**, **Ausente**, **Ocupado**, **Offline**).
   - O status é derivado da coleção `operator_availability` e de atividades recentes no sistema.
2. **Histórico e Troca de Mensagens 1:1**:
   - Mensagens armazenadas na coleção `operator_chat_messages`.
   - Atualizações e novas mensagens recebidas instantaneamente via assinatura Realtime do PocketBase.
   - Status de entrega com visualização de mensagens lidas/não lidas (`read = true`).
3. **Notificação Global**:
   - O componente `GlobalNotifications` monitora novas mensagens direcionadas ao operador autenticado.
   - Quando uma nova mensagem é recebida de outro operador, um aviso sonoro discreto e uma notificação no topo alertam o usuário com atalho direto para a conversa.
4. **Contador de Não Lidas**:
   - Badges numéricas na lista de contatos do chat indicam mensagens pendentes de leitura por operador.

---

## 3. Catálogo de Permissões e Segurança

Seguindo a regra permanente do projeto Lógos AITSM, ambas as funcionalidades são 100% controladas por perfis de acesso:

| Módulo    | Chave do Item     | Nome no Catálogo   | Níveis Suportados             |
| :-------- | :---------------- | :----------------- | :---------------------------- |
| `tickets` | `tickets_interno` | Chamados Internos  | Nenhum / Leitura / Configurar |
| `chat`    | `chat_operadores` | Chat de Operadores | Nenhum / Leitura / Configurar |

### Comportamento dos Guards:

- **Menu Lateral (`Layout.tsx`)**: O item **Chat de Operadores** só é exibido para perfis com permissão `chat.chat_operadores`.
- **Rota Protegida (`App.tsx`)**: A rota `/chat` possui `ProtectedRoute requiredModule="chat" requiredItem="chat_operadores"`. Perfis sem acesso são redirecionados automaticamente para a página inicial autorizada.
- **Abertura de Chamados Internos**: A opção de alternar para chamado interno é protegida pelo item `tickets_interno`.

---

## 4. Migrações e Estrutura de Banco de Dados

1. **`0129_add_internal_tickets_and_operator_chat.js`**:
   - Adiciona os campos `is_internal` (bool) e `internal_sector` (text) na coleção `tickets`.
   - Cria a coleção `operator_chat_messages` com campos `sender` (relação users), `recipient` (relação users), `content` (text), `read` (bool) e regras de acesso restritas aos participantes da conversa.
2. **`0130_add_internal_tickets_and_operator_chat_permissions.js`**:
   - Registra as permissões `tickets_interno` e `chat_operadores` para todos os perfis existentes com nível `edit`, permitindo customização granular posterior na tela de Perfis de Acesso (`/profiles`).
3. **`0131_add_chat_history_permission.js`**:
   - Registra a permissão `chat_historico` para todos os perfis existentes com nível `view` (Leitura), permitindo customização granular posterior na tela de Perfis de Acesso.

---

## 5. Histórico de Chat por Operador (/chat/historico)

### 5.1 Visão Geral

Consulta **somente leitura** de todo o histórico de conversas e mensagens trocadas no chat interno entre operadores, acessível em `/chat/historico` ou pelo item **Histórico de Chat** no menu principal.

- **Reutilização**: A consulta reutiliza o serviço `operator-chat.ts` (coleção `operator_chat_messages` criada na migração 0129) e **não duplica lógica** do chat em tempo real.
- **Somente leitura**: A tela nunca cria, altera ou exclui mensagens e **não altera flags de leitura** (`read`) das conversas — o chat em tempo real continua funcionando exatamente como antes.
- **Agrupamento**: As mensagens são agrupadas por conversa (par de participantes) e exibidas em ordem cronológica, da mais recente para a mais antiga.
- **Expansão**: Cada conversa pode ser expandida para ver as mensagens individuais, com **remetente**, **destinatário**, **conteúdo** e **data/hora** de cada uma.

### 5.2 Filtros Disponíveis

| Filtro             | Descrição                                                                                                                                       |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| Operador           | Seleção do operador (participante como remetente ou destinatário da mensagem). "Todos os operadores" lista tudo.                                |
| Período (De / Até) | Intervalo de datas inclusivo, aplicado sobre a data de criação das mensagens.                                                                   |
| Buscar no conteúdo | Busca textual livre contida no texto das mensagens. Suporta tolerância a acentos (NFD), múltiplas palavras em qualquer ordem e destaque visual. |

- **Busca por texto avançada e flexível**:
  - **Insensível a acentos e a maiúsculas/minúsculas**: digitando `informacao` a busca localiza `Informação`, `nao` localiza `não`.
  - **Múltiplas palavras em qualquer ordem**: termos separados por espaço (ex.: `backup falhou`) localizam mensagens que contenham ambas as palavras em qualquer ordem ou posição (`falhou o backup ontem`).
  - **Destaque visual (highlight)**: o trecho encontrado aparece destacado com marcação dourada/amarela suave diretamente no balão da mensagem, preservando a acentuação e caixa original.
  - **Contadores de ocorrências**: cada conversa exibe badge com a quantidade exata de mensagens casadas na busca, e o cabeçalho exibe badge de destaque com o totalizador geral de mensagens encontradas para o termo pesquisado.
  - **Alcance ampliado**: consulta na coleção de mensagens otimizada para abranger conversas antigas e refino em memória sem truncamento prematuro.
- Totalizadores exibidos no topo: **quantidade de mensagens**, **conversas distintas** e **participantes distintos** do resultado filtrado.
- Botão "Limpar filtros" e botão rápido ✕ no campo de busca restauram a consulta completa.

### 5.3 Permissão no Catálogo de Acesso

| Módulo | Chave do Item    | Nome no Catálogo               | Níveis Suportados             |
| :----- | :--------------- | :----------------------------- | :---------------------------- |
| `chat` | `chat_historico` | Histórico de Chat por Operador | Nenhum / Leitura / Configurar |

- **Herança**: O histórico **possui permissão própria** (`chat_historico`) mas o item de menu só aparece para quem **TAMBÉM tem acesso ao chat** (`chat_operadores`), garantindo coerência: quem não enxerga o chat não precisa enxergar seu histórico.
- **Guard de rota**: `/chat/historico` está protegida por `ProtectedRoute requiredModule="chat" requiredItem="chat_historico"`; perfis sem acesso são redirecionados.
- **Menu**: O item "Histórico de Chat" só aparece quando o perfil tem `chat_operadores` **E** `chat_historico` concedidos.
- **Acesso dentro da tela**: Os dados lidos são restritos pelas mesmas regras de acesso da coleção `operator_chat_messages` (regras da migração 0129), garantindo que cada operador só consulte conversas das quais participa ou que seu perfil autorize.
