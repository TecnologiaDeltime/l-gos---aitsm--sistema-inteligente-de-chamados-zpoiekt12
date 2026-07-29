migrate(
  (app) => {
    const tktCategoriesId = app.findCollectionByNameOrId('tkt_categories').id
    const companiesId = app.findCollectionByNameOrId('companies').id

    const approvalConfigs = new Collection({
      name: 'approval_configs',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
      updateRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
      deleteRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
      fields: [
        {
          name: 'activity',
          type: 'relation',
          collectionId: tktCategoriesId,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'clients',
          type: 'relation',
          collectionId: companiesId,
          required: true,
          maxSelect: 0,
        },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_approval_configs_activity ON approval_configs (activity)',
        'CREATE INDEX idx_approval_configs_clients ON approval_configs (clients)',
      ],
    })
    app.save(approvalConfigs)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('approval_configs'))
    } catch (_) {}
  },
)
