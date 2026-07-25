migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('contracts')
    var fieldsToAdd = [
      ['travel_consumes_hours', new BoolField({ name: 'travel_consumes_hours' })],
      ['waiting_consumes_hours', new BoolField({ name: 'waiting_consumes_hours' })],
      ['visit_franchise', new NumberField({ name: 'visit_franchise' })],
      ['visit_fixed_value', new NumberField({ name: 'visit_fixed_value' })],
      ['km_charged', new BoolField({ name: 'km_charged' })],
      ['expenses_charged', new BoolField({ name: 'expenses_charged' })],
      ['monthly_visit_limit', new NumberField({ name: 'monthly_visit_limit' })],
      [
        'visit_hour_type',
        new SelectField({
          name: 'visit_hour_type',
          values: [
            'Contratada',
            'Excedente',
            'Projeto',
            'Interna',
            'Não Faturável',
            'Cortesia',
            'Deslocamento',
            'Plantão',
            'Gestão',
            'Treinamento',
          ],
          maxSelect: 1,
        }),
      ],
    ]
    fieldsToAdd.forEach(function (entry) {
      if (!col.fields.getByName(entry[0])) col.fields.add(entry[1])
    })
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('contracts')
    var fieldsToRemove = [
      'travel_consumes_hours',
      'waiting_consumes_hours',
      'visit_franchise',
      'visit_fixed_value',
      'km_charged',
      'expenses_charged',
      'monthly_visit_limit',
      'visit_hour_type',
    ]
    fieldsToRemove.forEach(function (f) {
      if (col.fields.getByName(f)) col.fields.removeByName(f)
    })
    app.save(col)
  },
)
