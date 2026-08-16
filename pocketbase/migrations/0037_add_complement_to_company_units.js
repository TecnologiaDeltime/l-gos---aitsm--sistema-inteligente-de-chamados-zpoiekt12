migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('company_units')
    if (!col.fields.getByName('address_complement')) {
      col.fields.add(new TextField({ name: 'address_complement' }))
    }
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('company_units')
    var field = col.fields.getByName('address_complement')
    if (field) col.fields.remove(field)
    app.save(col)
  },
)
