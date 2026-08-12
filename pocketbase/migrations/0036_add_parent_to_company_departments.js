migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('company_departments')

    if (!col.fields.getByName('parent')) {
      col.fields.add(
        new RelationField({
          name: 'parent',
          collectionId: col.id,
          maxSelect: 1,
        }),
      )
    }

    col.addIndex('idx_company_departments_parent', false, 'parent', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('company_departments')
    var parentField = col.fields.getByName('parent')
    if (parentField) col.fields.remove(parentField)
    col.removeIndex('idx_company_departments_parent')
    app.save(col)
  },
)
