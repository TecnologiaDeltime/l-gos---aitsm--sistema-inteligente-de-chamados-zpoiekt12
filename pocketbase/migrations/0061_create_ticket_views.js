migrate(
  (app) => {
    // Idempotência: verifica se a coleção já existe
    try {
      app.findCollectionByNameOrId('ticket_views')
      return // Já existe
    } catch (_) {}

    var ticketsCol = app.findCollectionByNameOrId('tickets')

    var fields = [
      {
        name: 'ticket',
        type: 'relation',
        required: true,
        collectionId: ticketsCol.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: '_pb_users_auth_',
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'viewed_at',
        type: 'date',
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
    ]

    var collection = new Collection({
      name: 'ticket_views',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule:
        "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin')",
      fields: fields,
      indexes: [],
    })

    app.save(collection)
  },
  (app) => {
    try {
      var collection = app.findCollectionByNameOrId('ticket_views')
      app.delete(collection)
    } catch (_) {}
  },
)
