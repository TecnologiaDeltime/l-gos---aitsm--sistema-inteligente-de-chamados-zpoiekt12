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
5. **Conversa em bolhas (estilo mensageiros)**:
   - Mensagens próprias e recebidas com lados e cores distintas: enviadas em âmbar à direita (tema escuro Amber Alert) / âmbar sobre cartão claro (tema Marrom & Branco); recebidas em cartão neutro à esquerda.
   - Cada bolha exibe nome do remetente (nas recebidas), hora de envio e ticks de leitura (✓ / ✓✓) nas enviadas.
6. **Histórico de conversas na página do chat (seção "Conversas")**:
   - Painel próprio ao lado da lista de operadores que agrupa **todas as conversas anteriores** do operador logado (mensagens em que ele é remetente OU destinatário) **por parceiro**, com:
     - Nome do operador com quem conversou (e avatar).
     - Prévia truncada da última mensagem (prefixada com "Você: " quando a última mensagem foi enviada pelo próprio usuário).
     - Data/hora relativa da última mensagem ("agora", "hh:mm" hoje, "Ontem", dia da semana ou "dd/mm/aaaa").
     - Contador de não lidas daquela conversa (badge âmbar).
   - Ordenação da conversa mais recente para a mais antiga; nova mensagem recebida move a conversa para o topo em tempo real.
   - **Clique numa conversa do histórico reabre a conversa ativa** com aquele operador no painel do chat (reutiliza a conversa 1:1 existente), carregando a **janela das mensagens mais recentes** (50) e com botão **"Carregar mensagens mais antigas"** para paginar o histórico anterior — e seguindo em tempo real (envio, leitura, ticks e bolhas funcionam normalmente na conversa reaberta).
   - O agrupamento **respeita a listRule** da coleção (`sender/recipient = @request.auth.id`, migração 0136): cada operador enxerga somente as próprias conversas.
   - Permissão: **reutiliza o item existente** `chat.chat_operadores` do catálogo (parte do chat em tempo real); sem item novo.
   - Serviço: `getChatConversations` e `getConversationMessagesPage` em `src/services/operator-chat.ts`; componente `src/components/chat/ConversationHistoryList.tsx`.
7. **Ícone de chat na barra superior**:
   - Ao lado do alternador de modo claro/escuro, o ícone de balão de conversa exibe badge numérica com a **quantidade total** de mensagens não lidas do operador (mesma fonte de dados do chat: coleção `operator_chat_messages` via `getUnreadCountsBySender`).
   - Clique navega direto ao `/chat`. Ao abrir uma conversa no chat, as mensagens são marcadas como lidas via realtime (evento `update` com `read = true`) e o badge zera automaticamente — sem duplicar mecanismos (o sino global e o ícone compartilham a mesma contagem).
8. **Alerta sonoro discreto de nova mensagem**:
   - Som curto gerado via **Web Audio API** (duas notas suaves, ~0,4 s, ganho baixo), sem arquivos nem dependências externas.
   - Toca **somente na chegada** de mensagem nova de outra pessoa — nunca ao abrir o chat, nunca ao enviar.
   - **Não toca** quando a mensagem chega na conversa que o operador está visualizando aberta na tela (a conversa ativa é registrada em `setActiveConversationPartner`); o comportamento é silencioso por design, pois a mensagem já está visível.
   - Respeita o mute global de alertas sonoros do sistema ( sino com mudo, `useAlertMute`).
   - A reprodução é centralizada no ícone da barra superior (`ChatTopBarIcon`), evitando toques duplicados com o sino global.
9. **Resiliência e fluidez (v0.0.370+)**:
   - **Sem travas na digitação**: o campo de mensagem e os botões de anexo/microfone **nunca desabilitam durante o envio** — o estado de envio aparece apenas no botão Enviar ("Enviando..." com spinner), que evita duplo clique.
   - **Feedback de falha garantido**: se um envio (texto, foto ou áudio) falhar, o motivo aparece **em dois lugares** — faixa vermelha acima da caixa com botão **"Tentar de novo"** e toast descritivo (`describeChatError` traduz erros do PocketBase — campo inválido, 5 MB, rede — em texto legível). O texto digitado e o anexo escolhidos são **restaurados** para reenvio.
   - **Conexão em tempo real**: queda de conexão SSE avisa o operador uma única vez com toast ("Conexão em tempo real perdida — reconectando"); o callback vive em `ref`, então a assinatura não é recriada a cada render.
   - **Perda de autenticação** durante o uso (token expirado etc.) redireciona para `/login` em vez de o chat ficar mudo.
10. **Busca interna na conversa aberta**:

- Campo de busca acima das mensagens da conversa ativa: filtra localmente as mensagens já carregadas, **sem chamadas extras ao backend**.
- **Insensível a acentos e maiúsculas/minúsculas** e aceita múltiplas palavras em qualquer ordem — reutiliza `matchesAllTokens` e `splitTextWithHighlight` de `src/lib/search-text.ts` (mesmo padrão do Histórico de Chat).
- **Contagem de ocorrências**: badge no cabeçalho da conversa mostra quantas mensagens casam com o termo; as bolhas não casadas ficam ocultas durante a busca.
- **Destaque visual (highlight)**: o trecho encontrado dentro da bolha aparece com marcação âmbar suave, preservando acentos e caixa originais.
- Botão ✕ limpa a busca e restaura a conversa completa.

11. **Anexos: foto, vídeo e áudio gravado**:

- Botão de clipe na caixa de mensagem abre o seletor de arquivos (foto/vídeo); mensagem aceita **um anexo** por envio, com **limite de 5 MB** (`CHAT_ATTACHMENT_MAX_BYTES`, mesmo limite do campo `file` da migração 0137).
- **Gravação de áudio pelo microfone** via botão de microfone, usando a API **MediaRecorder** do navegador (`src/lib/chat-audio-recorder.ts`): contagem de segundos ao vivo, botão de parar (anexa) e botão de descartar; erros de permissão/ausência de microfone são exibidos de forma amigável.
- Renderização na conversa via `getChatMessageFileUrl` / `getChatAttachmentKind` (`src/services/operator-chat.ts`):
  - **Foto**: imagem visível inline na bolha (clique abre em nova aba).
  - **Vídeo**: player `<video>` tocável dentro da bolha, com controles.
  - **Áudio**: player `<audio>` tocável dentro da bolha, com controles.
- O acesso ao arquivo é protegido pelas regras da coleção (participantes da conversa — migração 0136).
- Permissão: **reutiliza o item existente** `chat.chat_operadores` do catálogo; sem item novo.

11. **Menção `@` de chamado, mudança ou problema**:

- Digitar `@` na caixa de mensagem abre um **seletor** (`src/components/chat/MentionSelector.tsx`) que consulta em tempo real as coleções `tickets`, `changes` e `problems`, filtrando por número ou título (números reais no banco: chamado `"068 - 00033"`, mudança `"MUD-2026-94268"`, problema `"PRB-000003"`).
- Chamados listados priorizam status em aberto (Novo, Em Atendimento, Escalonado etc.); mudanças e problemas listam os mais recentes.
- A menção selecionada é inserida na mensagem e enviada como texto no formato `@{tipo}:{id}` dentro de um marcador invisível — **o conteúdo do item não é duplicado na mensagem**.
- Na conversa, a menção vira um **cartão clicável** (`src/components/chat/ChatMentionCard.tsx`) que busca os dados atuais do item no momento do render (número, título, status e prioridade) e navega para `/tickets/:id`, `/changes/:id` ou `/problems/:id` (rotas já existentes).
- Permissão: **reutiliza o item existente** `chat.chat_operadores` do catálogo; sem item novo.

12. **Mensagem para operador offline (entrega garantida ao voltar)**:

- Nenhum bloqueio de envio por presença: a lista de contatos e o histórico permitem selecionar/iniciar conversa com operador **offline** exatamente como com um online — a mensagem (texto ou anexo) é criada normalmente na coleção `operator_chat_messages`.
- A entrega depende do realtime do PocketBase + contadores existentes (badge de não lidas e alerta sonoro), **sem fila nova**: quando o destinatário conecta/abre o chat, o evento realtime e o refresh periódico de 30 s entregam a mensagem, tocam o som e incrementam o badge normalmente.
- **Estado offline explícito na lista de contatos**: ponto cinza + rótulo "Offline — visto há X" (última atividade em `session_last_activity`, recalculado a cada tick de 30 s); tooltip do ponto indica há quanto tempo.
- **Cabeçalho da conversa** mostra o badge de presença ("Offline — visto há X") e a linha "As mensagens serão entregues quando ele ficar online".
- **Estado vazio da conversa** avisa: "O operador está offline no momento — a mensagem fica guardada e é entregue assim que ele voltar, com badge e alerta sonoro normais."
- Permissão: **reutiliza o item existente** `chat.chat_operadores` do catálogo; sem item novo.

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
4. **`0136_operator_chat_list_rule.js`**:
   - **Correção de bug de entrega em tempo real**: a coleção `operator_chat_messages` foi criada na migração 0129 sem `listRule`. No PocketBase, a distribuição Realtime e a paginação de registros são autorizadas pela _list rule_ — com ela nula, apenas superusuários conseguiam listar/assinar a coleção, e as mensagens nunca chegavam ao outro lado (o remetente via a própria mensagem porque a criação usa a _create rule_, mas o destinatário não recebia o evento nem o histórico).
   - A migração define a `listRule` idêntica às demais regras: apenas participantes da conversa (`sender = @request.auth.id || recipient = @request.auth.id`). Idempotente (reexecutar não altera o resultado).
   - Sem item novo no catálogo de permissões: o acesso continua regido pelo item existente `chat.chat_operadores`.
5. **`0137_add_operator_chat_file.js`**:
   - Adiciona o campo `file` (arquivo único) na coleção `operator_chat_messages`, com tamanho máximo de **5 MB** e tipos aceitos de imagem, áudio e vídeo — suporte aos anexos de foto, vídeo e áudio gravado no chat.
   - Regras de acesso intactas (migração 0136): participantes da conversa.
   - Sem item novo no catálogo de permissões: o acesso continua regido pelo item existente `chat.chat_operadores`.
6. **`0138_operator_chat_autodate_and_file_mimes.js`** — **correção de raiz do chat "amarrado"**:
   - A coleção `operator_chat_messages` foi criada na migração 0129 **sem os campos autodate `created`/`updated`**. Como o serviço ordena por `sort: '-created'` (conversas, mensagens, não lidas), **toda listagem retornava HTTP 400** — nada carregava, e os índices da coleção referenciavam a coluna inexistente, derrubando também a criação (mensagem "não sai").
   - A migração adiciona os autodate e faz **backfill** de `created`/`updated` (registros antigos ganham a data da última alteração; sem isso a ordenação seria indefinida).
   - Ampla a allowlist de MIME do campo `file` para as detecções reais de conteúdo dos gravadores dos navegadores: `application/ogg` (Firefox grava `.ogg`), `audio/x-m4a` (Safari), `audio/x-wav`, `audio/aac`, `audio/mp3`, `audio/mpeg3`, `video/x-m4v`, `video/quicktime` e `video/x-msvideo` — o áudio gravado passou a subir sem rejeição de tipo.
7. **`0139_chat_backfill_created.js`** — backfill idempotente separado de `created`/`updated` para as mensagens antigas (complementa a 0138; reexecutar é no-op).

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
