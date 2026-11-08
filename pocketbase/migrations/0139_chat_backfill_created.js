/// <reference path="../pb_data/types.d.ts" />

// 0139 — Backfill de created/updated das mensagens antigas do chat interno.
//
// As mensagens gravadas ANTES da 0138 ficaram com created/updated vazios
// (autodate só preenche no create novo). Com created vazio, a ordenação
// sort=-created fica indefinida — mensagens antigas podem aparecer no fim
// da conversa. Este backfill preenche com read_at (quando existir) ou now,
// via SQL direto (campos autodate não aceitam set() no record API).

migrate(
  (app) => {
    const res = app
      .db()
      .newQuery(
        "UPDATE operator_chat_messages SET created = COALESCE(NULLIF(read_at, ''), datetime('now')), updated = COALESCE(NULLIF(read_at, ''), datetime('now')) WHERE created IS NULL OR created = ''",
      )
      .execute()
    console.log('0139: backfill created/updated do chat concluído', res)
  },
  (app) => {
    // Revert: não é possível re-vaziar os dados — noop seguro
  },
)
