migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('tkt_categories')

    if (!col.fields.getByName('impact')) {
      col.fields.add(
        new SelectField({
          name: 'impact',
          values: ['Alto', 'Médio', 'Baixo'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('urgency')) {
      col.fields.add(
        new SelectField({
          name: 'urgency',
          values: ['Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('priority')) {
      col.fields.add(
        new SelectField({
          name: 'priority',
          values: ['Crítica', 'Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('sla_response_minutes')) {
      col.fields.add(new NumberField({ name: 'sla_response_minutes', min: 1 }))
    }

    if (!col.fields.getByName('sla_solution_minutes')) {
      col.fields.add(new NumberField({ name: 'sla_solution_minutes', min: 1 }))
    }

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('tkt_categories')
    var fieldsToRemove = [
      'impact',
      'urgency',
      'priority',
      'sla_response_minutes',
      'sla_solution_minutes',
    ]
    fieldsToRemove.forEach(function (f) {
      if (col.fields.getByName(f)) col.fields.removeByName(f)
    })
    app.save(col)
  },
)
