migrate(
  (app) => {
    const companiesCollection = app.findCollectionByNameOrId('companies')
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')

    // Cria a coleção client_monthly_reports
    const collection = new Collection({
      name: 'client_monthly_reports',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'gestor'",
      fields: [
        {
          name: 'company',
          type: 'relation',
          required: true,
          collectionId: companiesCollection.id,
          maxSelect: 1,
        },
        {
          name: 'month_key',
          type: 'text',
          required: true,
        },
        {
          name: 'period_label',
          type: 'text',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'liberado', 'arquivado'],
          maxSelect: 1,
        },
        {
          name: 'released_to_client',
          type: 'bool',
        },
        {
          name: 'released_at',
          type: 'date',
        },
        {
          name: 'released_by',
          type: 'relation',
          collectionId: usersCollection.id,
          maxSelect: 1,
        },
        {
          name: 'generated_by',
          type: 'relation',
          collectionId: usersCollection.id,
          maxSelect: 1,
        },
        {
          name: 'summary_notes',
          type: 'text',
        },
        {
          name: 'report_data',
          type: 'json',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cmr_company ON client_monthly_reports (company)',
        'CREATE INDEX idx_cmr_month ON client_monthly_reports (month_key)',
        'CREATE INDEX idx_cmr_released ON client_monthly_reports (released_to_client)',
        'CREATE UNIQUE INDEX idx_cmr_company_month ON client_monthly_reports (company, month_key)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('client_monthly_reports')
      app.delete(col)
    } catch (_) {}
  },
)
