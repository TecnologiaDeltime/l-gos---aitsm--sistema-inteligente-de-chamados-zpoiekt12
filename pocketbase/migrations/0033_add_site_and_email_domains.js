migrate(
  (app) => {
    var companiesCol = app.findCollectionByNameOrId('companies')
    if (!companiesCol.fields.getByName('site')) {
      companiesCol.fields.add(new TextField({ name: 'site' }))
    }
    app.save(companiesCol)

    var compId = app.findCollectionByNameOrId('companies').id

    app.save(
      new Collection({
        name: 'client_email_domains',
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
            collectionId: compId,
            required: true,
            maxSelect: 1,
          },
          { name: 'domain', type: 'text', required: true },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_client_email_domains_client ON client_email_domains (client)',
          'CREATE INDEX idx_client_email_domains_active ON client_email_domains (active)',
        ],
      }),
    )
  },
  (app) => {
    var companiesCol = app.findCollectionByNameOrId('companies')
    var siteField = companiesCol.fields.getByName('site')
    if (siteField) companiesCol.fields.remove(siteField)
    app.save(companiesCol)

    try {
      app.delete(app.findCollectionByNameOrId('client_email_domains'))
    } catch (_) {}
  },
)
