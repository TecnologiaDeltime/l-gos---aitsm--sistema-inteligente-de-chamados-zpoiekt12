migrate(
  (app) => {
    var usersId = '_pb_users_auth_'
    var companiesId = app.findCollectionByNameOrId('companies').id

    // 1. Criar collection technician_goals
    app.save(
      new Collection({
        name: 'technician_goals',
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
            name: 'period_type',
            type: 'select',
            values: ['geral', 'mensal'],
            required: true,
            maxSelect: 1,
          },
          {
            name: 'period_month',
            type: 'text', // Formato YYYY-MM para metas mensais (ex: "2025-05") ou vazio para vigência geral
          },
          {
            name: 'response_sla_target',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
          },
          {
            name: 'solution_sla_target',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
          },
          {
            name: 'resolution_effectiveness_target',
            type: 'number',
            required: true,
            min: 0,
            max: 100,
          },
          {
            name: 'notes',
            type: 'text',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_techgoals_tech ON technician_goals (technician)',
          'CREATE INDEX idx_techgoals_period ON technician_goals (technician, period_type, period_month)',
        ],
      }),
    )

    // 2. Criar collection monthly_report_schedules
    app.save(
      new Collection({
        name: 'monthly_report_schedules',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        fields: [
          {
            name: 'company',
            type: 'relation',
            collectionId: companiesId,
            required: true,
            maxSelect: 1,
          },
          {
            name: 'enabled',
            type: 'bool',
          },
          {
            name: 'send_day',
            type: 'number',
            required: true,
            min: 1,
            max: 28,
          },
          {
            name: 'use_focal_points',
            type: 'bool',
          },
          {
            name: 'manual_recipients',
            type: 'text', // E-mails separados por vírgula ou linha
          },
          {
            name: 'last_sent_at',
            type: 'date',
          },
          {
            name: 'last_sent_month',
            type: 'text', // Ex: "2025-04" para garantir idempotência por mês de referência
          },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: usersId,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_rep_sched_company ON monthly_report_schedules (company)',
        ],
      }),
    )

    // 3. Criar collection monthly_report_send_logs
    app.save(
      new Collection({
        name: 'monthly_report_send_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        fields: [
          {
            name: 'company',
            type: 'relation',
            collectionId: companiesId,
            required: true,
            maxSelect: 1,
          },
          {
            name: 'report_month',
            type: 'text', // Ex: "2025-04"
            required: true,
          },
          {
            name: 'recipients',
            type: 'text', // Destinatários que receberam
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            values: ['sucesso', 'falha'],
            required: true,
            maxSelect: 1,
          },
          {
            name: 'error_message',
            type: 'text',
          },
          {
            name: 'sent_at',
            type: 'date',
          },
          {
            name: 'triggered_by',
            type: 'text', // 'cron' ou 'manual'
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_replogs_company ON monthly_report_send_logs (company)',
          'CREATE INDEX idx_replogs_sent_at ON monthly_report_send_logs (sent_at)',
        ],
      }),
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('monthly_report_send_logs'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('monthly_report_schedules'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('technician_goals'))
    } catch (_) {}
  },
)
