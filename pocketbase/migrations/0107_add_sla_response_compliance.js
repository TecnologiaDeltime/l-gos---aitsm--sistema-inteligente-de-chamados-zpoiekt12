migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('tickets')
    if (!col.fields.getByName('sla_response_compliance')) {
      col.fields.add(
        new SelectField({
          name: 'sla_response_compliance',
          values: ['Em conformidade', 'Fora de conformidade'],
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('tickets')
    if (col.fields.getByName('sla_response_compliance')) {
      col.fields.removeByName('sla_response_compliance')
      app.save(col)
    }
  },
)
