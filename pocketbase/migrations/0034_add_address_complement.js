migrate(
  (app) => {
    var companiesCol = app.findCollectionByNameOrId('companies')
    if (!companiesCol.fields.getByName('address_complement')) {
      companiesCol.fields.add(new TextField({ name: 'address_complement' }))
    }
    app.save(companiesCol)
  },
  (app) => {
    var companiesCol = app.findCollectionByNameOrId('companies')
    var field = companiesCol.fields.getByName('address_complement')
    if (field) companiesCol.fields.remove(field)
    app.save(companiesCol)
  },
)
