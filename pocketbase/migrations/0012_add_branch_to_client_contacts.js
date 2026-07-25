migrate(
  (app) => {
    var companyUnitsId = app.findCollectionByNameOrId('company_units').id
    var col = app.findCollectionByNameOrId('client_contacts')

    if (!col.fields.getByName('unit')) {
      col.fields.add(
        new RelationField({
          name: 'unit',
          collectionId: companyUnitsId,
          maxSelect: 1,
        }),
      )
    }

    col.addIndex('idx_client_contacts_unit', false, 'unit', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('client_contacts')
    var field = col.fields.getByName('unit')
    if (field) {
      col.fields.remove(field)
    }
    col.removeIndex('idx_client_contacts_unit')
    app.save(col)
  },
)
