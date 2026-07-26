migrate(
  (app) => {
    var usersId = '_pb_users_auth_'

    app.save(
      new Collection({
        name: 'sla_goals',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        fields: [
          {
            name: 'technician',
            type: 'relation',
            collectionId: usersId,
            required: true,
            maxSelect: 1,
          },
          {
            name: 'sla_type',
            type: 'select',
            values: ['Resposta', 'Solução'],
            required: true,
            maxSelect: 1,
          },
          {
            name: 'target_percentage',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_sla_goals_tech ON sla_goals (technician)'],
      }),
    )

    app.save(
      new Collection({
        name: 'scheduled_reports',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin"',
        updateRule: '@request.auth.role = "admin"',
        deleteRule: '@request.auth.role = "admin"',
        fields: [
          { name: 'name', type: 'text', required: true },
          {
            name: 'report_types',
            type: 'select',
            values: ['sla', 'atividades_recorrentes'],
            required: true,
            maxSelect: 2,
          },
          { name: 'recipient_emails', type: 'text', required: true },
          { name: 'day_of_month', type: 'number', required: true, min: 1, max: 28 },
          { name: 'last_sent', type: 'date' },
          { name: 'next_run', type: 'date' },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_scheduled_reports_active ON scheduled_reports (active)'],
      }),
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('sla_goals'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('scheduled_reports'))
    } catch (_) {}
  },
)
