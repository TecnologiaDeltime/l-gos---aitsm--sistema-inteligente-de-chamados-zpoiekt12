migrate(
  (app) => {
    var items = app.findCollectionByNameOrId('configuration_items')
    var companyUnitsId = app.findCollectionByNameOrId('company_units').id

    if (!items.fields.getByName('unit')) {
      items.fields.add(
        new RelationField({
          name: 'unit',
          collectionId: companyUnitsId,
          maxSelect: 1,
        }),
      )
    }

    items.addIndex('idx_ci_unit', false, 'unit', '')
    app.save(items)
  },
  (app) => {
    try {
      var items = app.findCollectionByNameOrId('configuration_items')
      var field = items.fields.getByName('unit')
      if (field) {
        items.fields.remove(field)
      }
      items.removeIndex('idx_ci_unit')
      app.save(items)
    } catch (_) {}
  },
)
