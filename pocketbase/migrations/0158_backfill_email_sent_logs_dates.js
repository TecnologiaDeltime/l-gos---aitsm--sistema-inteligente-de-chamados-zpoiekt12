/// <reference path="../pb_data/types.d.ts" />

// 0158 — Backfill SQL de created/updated em email_sent_logs.
//
// Como observado na migração 0139 para operator_chat_messages, campos AutodateField
// não aceitam preenchimento via record.set() no Record API do PocketBase.
// Este migration preenche via app.db().newQuery("UPDATE ...") os registros anteriores
// para que created e updated contenham o valor de sent_at.

migrate(
  (app) => {
    try {
      var res = app
        .db()
        .newQuery(
          "UPDATE email_sent_logs SET created = COALESCE(NULLIF(sent_at, ''), datetime('now')), updated = COALESCE(NULLIF(sent_at, ''), datetime('now')) WHERE created IS NULL OR created = ''",
        )
        .execute()
      app
        .logger()
        .info('0158: backfill SQL de created/updated em email_sent_logs concluído com sucesso')
    } catch (err) {
      app.logger().warn('0158: aviso no backfill SQL de email_sent_logs', 'error', err.message)
    }
  },
  (app) => {
    // Revert: noop seguro
  },
)
