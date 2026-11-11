/// <reference path="../pb_data/types.d.ts" />

// 0157 — Correção estrutural de email_sent_logs (BUG 2) e garantia de campo de marcação em changes (BUG 1).
//
// BUG 2: A coleção email_sent_logs (criada na 0146) foi definida com campos explícitos
// sem incluir os campos autodate `created` e `updated`. Como o PocketBase (e o painel
// do admin e chamadas padrão da API) utiliza `sort=-created` por padrão em listagens,
// qualquer consulta sem ordenação explícita ou com sort=-created falhava com erro HTTP 400
// ("Something went wrong while processing your request").
// Aqui adicionamos os AutodateField `created` e `updated`, criamos índices de ordenação
// e executamos backfill idempotente nos registros já gravados usando o valor de `sent_at`.
//
// BUG 1: Garante que o campo `voting_deadline_notified_at` (tipo date) esteja presente
// na coleção `changes` para suportar a anti-duplicidade permanente do cron de prazo de votação.

migrate(
  (app) => {
    // 1. Corrigir email_sent_logs adicionando created e updated (autodate)
    try {
      var col = app.findCollectionByNameOrId('email_sent_logs')

      var hasCreated = false
      var hasUpdated = false
      try {
        hasCreated = Boolean(col.fields.getByName('created'))
      } catch (_) {}
      try {
        hasUpdated = Boolean(col.fields.getByName('updated'))
      } catch (_) {}

      if (!hasCreated) {
        for (var f1 = 0; f1 < col.fields.length; f1++) {
          if (col.fields[f1].name === 'created') {
            hasCreated = true
            break
          }
        }
      }
      if (!hasUpdated) {
        for (var f2 = 0; f2 < col.fields.length; f2++) {
          if (col.fields[f2].name === 'updated') {
            hasUpdated = true
            break
          }
        }
      }

      var changed = false
      if (!hasCreated) {
        col.fields.add(
          new AutodateField({
            name: 'created',
            onCreate: true,
            system: false,
          }),
        )
        changed = true
      }

      if (!hasUpdated) {
        col.fields.add(
          new AutodateField({
            name: 'updated',
            onUpdate: true,
            system: false,
          }),
        )
        changed = true
      }

      // Adicionar índices úteis de ordenação se não existirem
      try {
        col.addIndex('idx_email_sent_created', false, 'created', '')
        changed = true
      } catch (_) {}
      try {
        col.addIndex('idx_email_sent_sent_at', false, 'sent_at', '')
        changed = true
      } catch (_) {}

      if (changed) {
        app.save(col)
        app
          .logger()
          .info(
            '0157: campos created e updated (autodate) adicionados a email_sent_logs com sucesso',
          )
      }

      // 1.1 Backfill idempotente: preenche created/updated com sent_at nos registros existentes
      try {
        var existingLogs = app.findRecordsByFilter('email_sent_logs', '1=1', '', 5000, 0)
        var nowIso = new Date().toISOString().replace('T', ' ')
        var updatedCount = 0
        for (var i = 0; i < existingLogs.length; i++) {
          var rec = existingLogs[i]
          var sentAt = rec.getString('sent_at') || nowIso
          var needSave = false
          if (!rec.getString('created')) {
            rec.set('created', sentAt)
            needSave = true
          }
          if (!rec.getString('updated')) {
            rec.set('updated', sentAt)
            needSave = true
          }
          if (needSave) {
            app.save(rec)
            updatedCount++
          }
        }
        app
          .logger()
          .info(
            '0157: backfill de created/updated concluído em email_sent_logs',
            'updated_records',
            updatedCount,
          )
      } catch (bfErr) {
        app
          .logger()
          .warn(
            '0157: aviso no backfill de email_sent_logs (não bloqueante)',
            'error',
            bfErr.message,
          )
      }
    } catch (err) {
      app.logger().error('0157: erro ao atualizar coleção email_sent_logs', 'error', err.message)
      throw err
    }

    // 2. Garantir campo voting_deadline_notified_at em changes
    try {
      var changesCol = app.findCollectionByNameOrId('changes')
      var hasNotifiedField = false
      try {
        hasNotifiedField = Boolean(changesCol.fields.getByName('voting_deadline_notified_at'))
      } catch (_) {}

      if (!hasNotifiedField) {
        for (var c = 0; c < changesCol.fields.length; c++) {
          if (changesCol.fields[c].name === 'voting_deadline_notified_at') {
            hasNotifiedField = true
            break
          }
        }
      }

      if (!hasNotifiedField) {
        changesCol.fields.add(
          new Field({
            name: 'voting_deadline_notified_at',
            type: 'date',
          }),
        )
        app.save(changesCol)
        app.logger().info('0157: campo voting_deadline_notified_at garantido em changes')
      }
    } catch (chgErr) {
      app.logger().warn('0157: aviso ao garantir campo em changes', 'error', chgErr.message)
    }
  },
  (app) => {
    // Reversão
    try {
      var col = app.findCollectionByNameOrId('email_sent_logs')
      try {
        col.fields.removeByName('created')
      } catch (_) {}
      try {
        col.fields.removeByName('updated')
      } catch (_) {}
      app.save(col)
    } catch (_) {}
  },
)
