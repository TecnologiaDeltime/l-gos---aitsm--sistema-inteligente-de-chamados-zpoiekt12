migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('contract_periods')

    if (!col.fields.getByName('last_notified_pct')) {
      col.fields.add(new NumberField({ name: 'last_notified_pct' }))
    }

    app.save(col)

    var existing = app.findRecordsByFilter('contract_periods', 'id != ""', '', 0, 0)
    for (var i = 0; i < existing.length; i++) {
      if (!existing[i].getFloat('last_notified_pct')) {
        existing[i].set('last_notified_pct', 0)
        app.save(existing[i])
      }
    }
  },
  (app) => {
    var col = app.findCollectionByNameOrId('contract_periods')
    var field = col.fields.getByName('last_notified_pct')
    if (field) {
      col.fields.remove(field)
    }
    app.save(col)
  },
)
