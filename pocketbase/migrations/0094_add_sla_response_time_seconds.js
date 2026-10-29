migrate(
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')

    if (!ticketsCol.fields.getByName('sla_response_time_seconds')) {
      ticketsCol.fields.add(
        new NumberField({
          name: 'sla_response_time_seconds',
        }),
      )
    }

    app.save(ticketsCol)
  },
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    var f1 = ticketsCol.fields.getByName('sla_response_time_seconds')
    if (f1) ticketsCol.fields.remove(f1)
    app.save(ticketsCol)
  },
)
