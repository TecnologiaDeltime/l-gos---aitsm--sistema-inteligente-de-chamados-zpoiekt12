migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const companies = app.findCollectionByNameOrId('companies')

    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: [
            'admin',
            'gestor',
            'tecnico',
            'cliente_gestor',
            'cliente_solicitante',
            'auditor',
          ],
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('company')) {
      users.fields.add(
        new RelationField({
          name: 'company',
          collectionId: companies.id,
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('phone')) {
      users.fields.add(new TextField({ name: 'phone' }))
    }

    if (!users.fields.getByName('position')) {
      users.fields.add(new TextField({ name: 'position' }))
    }

    if (!users.fields.getByName('active')) {
      users.fields.add(new BoolField({ name: 'active' }))
    }

    app.save(users)
  },
  (app) => {},
)
