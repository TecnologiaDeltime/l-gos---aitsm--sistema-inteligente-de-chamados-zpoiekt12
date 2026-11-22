/// <reference path="../pb_data/types.d.ts" />
// Migração 0504 (corretiva da 0503): substitui a index parcial
// (WHERE resumed_at = '') por indexes simples, que são suportados de forma
// estável pela JSVM do PocketBase ao atualizar coleções.
migrate(
  (app) => {
    let col
    try {
      col = app.findCollectionByNameOrId('operator_work_cycle_pauses')
    } catch (_) {
      return
    }
    if (!col) return

    col.indexes = [
      'CREATE INDEX idx_wcp_ticket ON operator_work_cycle_pauses (ticket)',
      'CREATE INDEX idx_wcp_operator ON operator_work_cycle_pauses (operator)',
    ]
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('operator_work_cycle_pauses')
      if (!col) return
      col.indexes = [
        "CREATE INDEX idx_wcp_ticket ON operator_work_cycle_pauses (ticket) WHERE resumed_at = ''",
      ]
      app.save(col)
    } catch (_) {}
  },
)
