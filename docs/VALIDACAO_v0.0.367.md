# Validação v0.0.367 — Deploy do backend e provas fim-a-fim

Rodada de fechamento dos dois bugs corrigidos na v0.0.367. Nenhum código foi alterado nesta rodada:
o que faltava era o **deploy do backend** (o hook JSVM do PocketBase só entra em vigor quando
implantado) e a validação fim-a-fim.

## 1. Deploy do backend

- `deploy_backend` executado com sucesso (pb_hooks do PocketBase).
- O hook `pocketbase/hooks/ticket_auto_assign.js` corrigido entrou em vigor após o deploy.

## 2. Verificação do typo no chat

- Grep em todo o projeto: o typo `isChatOperatorline` **não existe**.
- `src/pages/chat/OperatorChatPage.tsx` já usa a grafia correta `isChatOperatorOnline`
  (import na linha 8, chamada na linha 208). Nada a corrigir.

## 3. Logs do backend após o deploy

- Stream `crons`: `ticket_auto_assign_cron` executando **ok a cada minuto** (status ok, sem erro).
- Stream `hooks`: **nenhum erro** após o deploy. Único erro do dia é anterior e não relacionado:
  `[AI_TICKET] Erro ao executar resposta automática de IA: TypeError: Object has no member 'send'`
  (15:16, antes do deploy — monitorar em rodada futura).

## 4. Prova fim-a-fim da distribuição automática (banco real)

- Chamado **068 - 00033** ("Teste chamado fila N2", criado 15:16, fila **Suporte N2** — fila com
  `members` vazio) estava sem atribuição.
- Às **15:40:00** — primeira execução efetiva do cron após o deploy — o hook atribuiu o chamado
  automaticamente ao operador correto (`operador teste`, id `y76axlkjkx1nute`), exatamente o
  candidato do fallback `users.team = "Suporte N2"` (único usuário ativo com esse team).
- Status do chamado passou a "Atribuído".

### Nota de timing (throttle)

Com `auto_assign_interval_minutes = 5`, o cron roda todo minuto mas só trabalha nos minutos
múltiplos de 5 (:05, :10, :15…). Por isso o chamado ficou ~24 min sem atribuição entre a criação
(15:16) e a atribuição (15:40 — deploy entrou por volta de 15:36). Para atribuição mais ágil,
reduza o intervalo em Configurações → Distribuição Automática.

## 5. Presença online do chat

- `src/services/operator-chat.ts` agora filtra `active = true && role != "cliente" &&
role != "cliente_gestor"` (o filtro antigo por `status = "Ativo"` gerava HTTP 400 e a lista
  do chat voltava vazia).
- Presença online = `session_last_activity < 15 min`; a página recalcula a cada 30s via
  `isChatOperatorOnline`.
- Validação com duas sessões simultâneas reais ficou para o usuário confirmar na interface
  (o endpoint e o filtro respondem sem erro).

## Resultado

- Critério 2 (atribuição automática N2): **comprovado em produção**.
- Critério 3 (backend implantado, hook sem erro nos logs): **comprovado**.
- Critério 1 (presença online com 2 usuários): correção confirmada por código e filtro sem erro;
  validação visual com 2 sessões pendente do usuário.
