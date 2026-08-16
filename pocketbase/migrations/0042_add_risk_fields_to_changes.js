migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('changes')

    if (!col.fields.getByName('risk_not_executing')) {
      col.fields.add(new TextField({ name: 'risk_not_executing' }))
    }
    if (!col.fields.getByName('risk_executing')) {
      col.fields.add(new TextField({ name: 'risk_executing' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('changes')

    const f1 = col.fields.getByName('risk_not_executing')
    if (f1) col.fields.remove(f1)
    const f2 = col.fields.getByName('risk_executing')
    if (f2) col.fields.remove(f2)

    app.save(col)
  },
)
