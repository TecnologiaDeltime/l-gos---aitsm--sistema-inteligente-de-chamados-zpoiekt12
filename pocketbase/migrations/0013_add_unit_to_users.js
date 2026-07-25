migrate(
  (app) => {
    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    var companyUnitsId = app.findCollectionByNameOrId('company_units').id

    if (!users.fields.getByName('unit')) {
      users.fields.add(
        new RelationField({
          name: 'unit',
          collectionId: companyUnitsId,
          maxSelect: 1,
        }),
      )
    }

    users.addIndex('idx_users_unit', false, 'unit', '')
    app.save(users)
  },
  (app) => {
    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    var field = users.fields.getByName('unit')
    if (field) {
      users.fields.remove(field)
    }
    users.removeIndex('idx_users_unit')
    app.save(users)
  },
)
