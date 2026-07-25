migrate(
  (app) => {
    var companiesId = app.findCollectionByNameOrId('companies').id
    var companyDeptsId = app.findCollectionByNameOrId('company_departments').id

    app.save(
      new Collection({
        name: 'client_contacts',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'client',
            type: 'relation',
            collectionId: companiesId,
            required: true,
            maxSelect: 1,
          },
          { name: 'full_name', type: 'text', required: true },
          { name: 'email', type: 'text' },
          { name: 'phone', type: 'text' },
          { name: 'cell_phone', type: 'text' },
          { name: 'has_whatsapp', type: 'bool' },
          {
            name: 'departments',
            type: 'relation',
            collectionId: companyDeptsId,
            maxSelect: 50,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_client_contacts_client ON client_contacts (client)',
          'CREATE INDEX idx_client_contacts_departments ON client_contacts (departments)',
        ],
      }),
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('client_contacts'))
    } catch (_) {}
  },
)
