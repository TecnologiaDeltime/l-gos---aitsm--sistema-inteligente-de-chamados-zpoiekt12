migrate(
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    var usersCol = app.findCollectionByNameOrId('users')

    if (!ticketsCol.fields.getByName('operator_cycle_start')) {
      ticketsCol.fields.add(
        new DateField({
          name: 'operator_cycle_start',
        }),
      )
    }

    if (!ticketsCol.fields.getByName('operator_cycle_user')) {
      ticketsCol.fields.add(
        new RelationField({
          name: 'operator_cycle_user',
          collectionId: usersCol.id,
          maxSelect: 1,
        }),
      )
    }

    if (!ticketsCol.fields.getByName('operator_worked_seconds')) {
      ticketsCol.fields.add(
        new NumberField({
          name: 'operator_worked_seconds',
        }),
      )
    }

    if (!ticketsCol.fields.getByName('accompaniment_seconds')) {
      ticketsCol.fields.add(
        new NumberField({
          name: 'accompaniment_seconds',
        }),
      )
    }

    app.save(ticketsCol)
  },
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    var f1 = ticketsCol.fields.getByName('operator_cycle_start')
    if (f1) ticketsCol.fields.remove(f1)
    var f2 = ticketsCol.fields.getByName('operator_cycle_user')
    if (f2) ticketsCol.fields.remove(f2)
    var f3 = ticketsCol.fields.getByName('operator_worked_seconds')
    if (f3) ticketsCol.fields.remove(f3)
    var f4 = ticketsCol.fields.getByName('accompaniment_seconds')
    if (f4) ticketsCol.fields.remove(f4)
    app.save(ticketsCol)
  },
)
