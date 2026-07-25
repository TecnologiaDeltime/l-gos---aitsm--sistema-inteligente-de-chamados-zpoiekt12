migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('operator_daily_snapshots')
    var fieldsToAdd = [
      ['onsite_visits', new NumberField({ name: 'onsite_visits' })],
      ['remote_visits', new NumberField({ name: 'remote_visits' })],
      ['total_travel_time', new NumberField({ name: 'total_travel_time' })],
      ['total_service_time', new NumberField({ name: 'total_service_time' })],
      ['total_mileage', new NumberField({ name: 'total_mileage' })],
      ['total_expenses', new NumberField({ name: 'total_expenses' })],
      ['total_reimbursement', new NumberField({ name: 'total_reimbursement' })],
    ]
    fieldsToAdd.forEach(function (entry) {
      if (!col.fields.getByName(entry[0])) col.fields.add(entry[1])
    })
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('operator_daily_snapshots')
    var fieldsToRemove = [
      'onsite_visits',
      'remote_visits',
      'total_travel_time',
      'total_service_time',
      'total_mileage',
      'total_expenses',
      'total_reimbursement',
    ]
    fieldsToRemove.forEach(function (f) {
      if (col.fields.getByName(f)) col.fields.removeByName(f)
    })
    app.save(col)
  },
)
