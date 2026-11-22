/// <reference path="../pb_data/types.d.ts" />
// Cria a coleção operator_work_cycle_pauses — registro EXCLUSIVO das pausas do
// Ciclo de Trabalho (contabilização de horas do operador). Independente de
// sla_pauses: a pausa do ciclo NÃO interfere no SLA em hipótese alguma.
migrate(
  (app) => {
    try {
      if (app.findCollectionByNameOrId('operator_work_cycle_pauses')) return
    } catch (_) {
      // coleção ainda não existe — segue para a criação
    }

    const col = new Collection({
      name: 'operator_work_cycle_pauses',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'ticket',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('tickets').id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'operator',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'reason', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        { name: 'paused_at', type: 'date' },
        { name: 'resumed_at', type: 'date' },
        { name: 'worked_seconds_in_cycle', type: 'number', onlyInt: true },
        { name: 'paused_minutes', type: 'number', onlyInt: true },
      ],
    })
    col.indexes = [
      'CREATE INDEX idx_wcp_ticket ON operator_work_cycle_pauses (ticket)',
      "CREATE INDEX idx_wcp_ticket_open ON operator_work_cycle_pauses (ticket) WHERE resumed_at = ''",
    ]
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('operator_work_cycle_pauses')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
