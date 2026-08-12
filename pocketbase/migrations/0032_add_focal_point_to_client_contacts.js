migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('client_contacts')

    if (!col.fields.getByName('user')) {
      col.fields.add(
        new RelationField({
          name: 'user',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('is_focal_point')) {
      col.fields.add(new BoolField({ name: 'is_focal_point' }))
    }

    col.addIndex('idx_client_contacts_is_focal_point', false, 'is_focal_point', '')
    col.addIndex('idx_client_contacts_user', false, 'user', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('client_contacts')
    var userField = col.fields.getByName('user')
    if (userField) col.fields.remove(userField)
    var fpField = col.fields.getByName('is_focal_point')
    if (fpField) col.fields.remove(fpField)
    col.removeIndex('idx_client_contacts_is_focal_point')
    col.removeIndex('idx_client_contacts_user')
    app.save(col)
  },
)
