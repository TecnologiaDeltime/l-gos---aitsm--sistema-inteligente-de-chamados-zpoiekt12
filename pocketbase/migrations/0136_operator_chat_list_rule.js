/// <reference path="../pb_data/types.d.ts" />

// 0136 — Correção de entrega em tempo real do chat interno de operadores.
//
// Causa raiz do bug "envio mensagem e o outro não recebe": a coleção
// operator_chat_messages foi criada na migração 0129 SEM listRule (null).
// No PocketBase, tanto a paginação (getFullList) quanto a distribuição de
// eventos realtime de registros são autorizadas pela LIST rule — viewRule
// sozinha não basta. Com listRule nula, apenas superusuários conseguiam
// listar/assinar, então o histórico não carregava e o outro lado nunca
// recebia o evento de nova mensagem.
//
// Correção idempotente: define listRule espelhando a viewRule (participantes
// da conversa) e garante as demais regras no estado correto.

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('operator_chat_messages')

    const participantsRule =
      "@request.auth.id != '' && (@request.auth.id = sender.id || @request.auth.id = recipient.id)"

    const desired = {
      listRule: participantsRule,
      viewRule: participantsRule,
      createRule: "@request.auth.id != '' && @request.auth.id = sender.id",
      updateRule: participantsRule,
      deleteRule: "@request.auth.id != '' && @request.auth.id = sender.id",
    }

    let changed = false
    for (const [key, value] of Object.entries(desired)) {
      if (col[key] !== value) {
        col[key] = value
        changed = true
      }
    }

    if (changed) {
      app.save(col)
      console.log(
        '0136: listRule (e regras de acesso) de operator_chat_messages normalizadas — realtime liberado para participantes da conversa',
      )
    } else {
      console.log('0136: regras de operator_chat_messages já estavam corretas (noop idempotente)')
    }
  },
  (app) => {
    // Revert: volta ao estado da migração 0129 (sem listRule)
    const col = app.findCollectionByNameOrId('operator_chat_messages')
    col.listRule = null
    app.save(col)
  },
)
