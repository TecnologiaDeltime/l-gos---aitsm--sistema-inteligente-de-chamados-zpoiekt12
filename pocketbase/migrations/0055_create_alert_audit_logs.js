migrate(
  (app) => {
    // Idempotência: verifica se a coleção já existe
    try {
      app.findCollectionByNameOrId('alert_audit_logs')
      return // Já existe
    } catch (_) {}

    var ticketsCol = null
    try {
      ticketsCol = app.findCollectionByNameOrId('tickets')
    } catch (_) {}

    var contractsCol = null
    try {
      contractsCol = app.findCollectionByNameOrId('contracts')
    } catch (_) {}

    var fields = [
      {
        name: 'alert_type',
        type: 'select',
        required: true,
        values: ['STALE_TICKET', 'SLA_RESPONSE', 'SLA_RESOLUTION', 'CONSUMPTION'],
        maxSelect: 1,
      },
    ]

    if (ticketsCol) {
      fields.push({
        name: 'ticket',
        type: 'relation',
        required: false,
        collectionId: ticketsCol.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      })
    }

    if (contractsCol) {
      fields.push({
        name: 'contract',
        type: 'relation',
        required: false,
        collectionId: contractsCol.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      })
    }

    fields.push(
      {
        name: 'operator',
        type: 'relation',
        required: true,
        collectionId: '_pb_users_auth_',
        cascadeDelete: false,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'action',
        type: 'select',
        required: true,
        values: ['DISMISSED', 'OPENED', 'VIEWED'],
        maxSelect: 1,
      },
      {
        name: 'metadata',
        type: 'json',
        required: false,
      },
      {
        name: 'created',
        type: 'autodate',
        onCreate: true,
        onUpdate: false,
      },
      {
        name: 'updated',
        type: 'autodate',
        onCreate: true,
        onUpdate: true,
      },
    )

    var collection = new Collection({
      name: 'alert_audit_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
      fields: fields,
      indexes: [],
    })

    app.save(collection)
  },
  (app) => {
    try {
      var collection = app.findCollectionByNameOrId('alert_audit_logs')
      app.delete(collection)
    } catch (_) {}
  },
)
