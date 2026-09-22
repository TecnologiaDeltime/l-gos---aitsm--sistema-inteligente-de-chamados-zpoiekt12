migrate(
  (app) => {
    // 1. Atualizar select 'source' de tickets para incluir 'Programado'
    const tickets = app.findCollectionByNameOrId('tickets')
    const sourceField = tickets.fields.getByName('source')
    if (sourceField) {
      const currentValues = sourceField.values || []
      if (currentValues.indexOf('Programado') === -1) {
        sourceField.values = [...currentValues, 'Programado']
        app.save(tickets)
      }
    }

    // 2. Criar coleção scheduled_tickets
    const companiesId = app.findCollectionByNameOrId('companies').id
    const queuesId = app.findCollectionByNameOrId('queues').id
    const tktCategoriesId = app.findCollectionByNameOrId('tkt_categories').id
    const contractsId = app.findCollectionByNameOrId('contracts').id
    const companyUnitsId = app.findCollectionByNameOrId('company_units').id
    const companyDepartmentsId = app.findCollectionByNameOrId('company_departments').id
    const equipmentsId = app.findCollectionByNameOrId('equipments').id
    const ticketsId = tickets.id

    const scheduledTickets = new Collection({
      name: 'scheduled_tickets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        {
          name: 'company',
          type: 'relation',
          collectionId: companiesId,
          required: true,
          maxSelect: 1,
        },
        { name: 'unit', type: 'relation', collectionId: companyUnitsId, maxSelect: 1 },
        { name: 'department', type: 'relation', collectionId: companyDepartmentsId, maxSelect: 1 },
        { name: 'contract', type: 'relation', collectionId: contractsId, maxSelect: 1 },
        { name: 'requester_name', type: 'text', required: true },
        { name: 'requester_email', type: 'text' },
        { name: 'requester_phone', type: 'text' },
        {
          name: 'type',
          type: 'select',
          values: [
            'Incidente',
            'Requisição de Serviço',
            'Problema',
            'Mudança',
            'Projeto',
            'Tarefa Interna',
            'Visita Técnica',
            'Dúvida',
          ],
          maxSelect: 1,
        },
        { name: 'category', type: 'relation', collectionId: tktCategoriesId, maxSelect: 1 },
        { name: 'subcategory', type: 'relation', collectionId: tktCategoriesId, maxSelect: 1 },
        { name: 'equipment', type: 'relation', collectionId: equipmentsId, maxSelect: 1 },
        { name: 'queue', type: 'relation', collectionId: queuesId, maxSelect: 1 },
        { name: 'assigned_to', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'priority',
          type: 'select',
          values: ['Crítica', 'Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        {
          name: 'impact',
          type: 'select',
          values: ['Alto', 'Médio', 'Baixo'],
          maxSelect: 1,
        },
        {
          name: 'urgency',
          type: 'select',
          values: ['Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        { name: 'scheduled_date', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['agendado', 'processado', 'cancelado', 'erro'],
          maxSelect: 1,
        },
        {
          name: 'recurrence_type',
          type: 'select',
          values: ['none', 'daily', 'weekly', 'monthly'],
          maxSelect: 1,
        },
        {
          name: 'recurrence_days_of_week',
          type: 'json',
        },
        { name: 'recurrence_day_of_month', type: 'number', min: 1, max: 31 },
        { name: 'recurrence_end_date', type: 'date' },
        { name: 'advance_notice_minutes', type: 'number' },
        { name: 'notice_sent', type: 'bool' },
        { name: 'notice_sent_at', type: 'date' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'last_executed_at', type: 'date' },
        { name: 'last_ticket_created', type: 'relation', collectionId: ticketsId, maxSelect: 1 },
        { name: 'error_message', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sched_status ON scheduled_tickets (status)',
        'CREATE INDEX idx_sched_date ON scheduled_tickets (scheduled_date)',
        'CREATE INDEX idx_sched_company ON scheduled_tickets (company)',
      ],
    })
    app.save(scheduledTickets)
  },
  (app) => {
    try {
      const scheduledTickets = app.findCollectionByNameOrId('scheduled_tickets')
      app.delete(scheduledTickets)
    } catch (_) {}
  },
)
