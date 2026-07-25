migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId('companies')
    const units = app.findCollectionByNameOrId('company_units')
    const depts = app.findCollectionByNameOrId('company_departments')
    const contracts = app.findCollectionByNameOrId('contracts')
    const tktCategories = app.findCollectionByNameOrId('tkt_categories')
    const queues = app.findCollectionByNameOrId('queues')
    const equipments = app.findCollectionByNameOrId('equipments')

    const tickets = new Collection({
      name: 'tickets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'number', type: 'text', required: true },
        {
          name: 'company',
          type: 'relation',
          collectionId: companies.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'unit', type: 'relation', collectionId: units.id, maxSelect: 1 },
        { name: 'department', type: 'relation', collectionId: depts.id, maxSelect: 1 },
        { name: 'requester_name', type: 'text', required: true },
        { name: 'requester_email', type: 'text' },
        { name: 'requester_phone', type: 'text' },
        { name: 'contract', type: 'relation', collectionId: contracts.id, maxSelect: 1 },
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
        { name: 'category', type: 'relation', collectionId: tktCategories.id, maxSelect: 1 },
        { name: 'subcategory', type: 'relation', collectionId: tktCategories.id, maxSelect: 1 },
        { name: 'service', type: 'text' },
        { name: 'equipment', type: 'relation', collectionId: equipments.id, maxSelect: 1 },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        {
          name: 'source',
          type: 'select',
          values: ['Portal', 'E-mail', 'Manual', 'API'],
          maxSelect: 1,
        },
        { name: 'impact', type: 'select', values: ['Alto', 'Médio', 'Baixo'], maxSelect: 1 },
        { name: 'urgency', type: 'select', values: ['Alta', 'Média', 'Baixa'], maxSelect: 1 },
        { name: 'priority', type: 'select', values: ['P1', 'P2', 'P3', 'P4', 'P5'], maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          values: [
            'Novo',
            'Em Triagem',
            'Aguardando Atribuição',
            'Atribuído',
            'Em Atendimento',
            'Aguardando Cliente',
            'Aguardando Aprovação',
            'Aguardando Terceiro',
            'Agendado',
            'Escalonado',
            'Resolvido',
            'Aguardando Validação',
            'Encerrado',
            'Cancelado',
            'Reaberto',
          ],
          maxSelect: 1,
        },
        { name: 'queue', type: 'relation', collectionId: queues.id, maxSelect: 1 },
        { name: 'assigned_to', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'participants', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 50 },
        { name: 'sla_response_deadline', type: 'date' },
        { name: 'sla_solution_deadline', type: 'date' },
        { name: 'sla_response_at', type: 'date' },
        { name: 'sla_solution_at', type: 'date' },
        { name: 'resolution_date', type: 'date' },
        { name: 'closure_date', type: 'date' },
        { name: 'reopen_count', type: 'number' },
        { name: 'solution', type: 'text' },
        { name: 'root_cause', type: 'text' },
        { name: 'work_hours', type: 'number' },
        { name: 'billable_hours', type: 'number' },
        { name: 'non_billable_hours', type: 'number' },
        { name: 'sla_paused', type: 'bool' },
        { name: 'sla_pause_total_minutes', type: 'number' },
        {
          name: 'sla_status',
          type: 'select',
          values: ['Dentro do Prazo', 'Atenção', 'Risco', 'Crítico', 'Violado', 'Pausado'],
          maxSelect: 1,
        },
        { name: 'satisfaction_score', type: 'number' },
        { name: 'needs_technical_visit', type: 'bool' },
        { name: 'availability_info', type: 'text' },
        { name: 'closed_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tickets_number ON tickets (number)',
        'CREATE INDEX idx_tickets_company ON tickets (company)',
        'CREATE INDEX idx_tickets_assigned ON tickets (assigned_to)',
        'CREATE INDEX idx_tickets_status ON tickets (status)',
        'CREATE INDEX idx_tickets_priority ON tickets (priority)',
        'CREATE INDEX idx_tickets_sla_status ON tickets (sla_status)',
      ],
    })
    app.save(tickets)

    const tktId = tickets.id

    const ticketInteractions = new Collection({
      name: 'ticket_interactions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: tktId, required: true, maxSelect: 1 },
        {
          name: 'author',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'type', type: 'select', values: ['Público', 'Interno'], maxSelect: 1 },
        { name: 'content', type: 'text', required: true },
        {
          name: 'mentioned_users',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 20,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_interactions_ticket ON ticket_interactions (ticket)'],
    })
    app.save(ticketInteractions)

    const ticketAttachments = new Collection({
      name: 'ticket_attachments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: tktId, required: true, maxSelect: 1 },
        {
          name: 'interaction',
          type: 'relation',
          collectionId: ticketInteractions.id,
          maxSelect: 1,
        },
        { name: 'file', type: 'file', maxSelect: 1 },
        { name: 'file_name', type: 'text' },
        { name: 'file_size', type: 'number' },
        { name: 'file_type', type: 'text' },
        {
          name: 'uploaded_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_attachments_ticket ON ticket_attachments (ticket)'],
    })
    app.save(ticketAttachments)

    const ticketHistory = new Collection({
      name: 'ticket_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: tktId, required: true, maxSelect: 1 },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'action', type: 'text', required: true },
        { name: 'field', type: 'text' },
        { name: 'old_value', type: 'text' },
        { name: 'new_value', type: 'text' },
        { name: 'ip_address', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_history_ticket ON ticket_history (ticket)'],
    })
    app.save(ticketHistory)

    const slaPauses = new Collection({
      name: 'sla_pauses',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: tktId, required: true, maxSelect: 1 },
        {
          name: 'reason',
          type: 'select',
          values: [
            'Aguardando Cliente',
            'Aguardando Aprovação',
            'Aguardando Terceiro',
            'Aguardando Fornecedor',
            'Aguardando Peça',
            'Aguardando Janela de Manutenção',
            'Chamado Agendado',
            'Cliente Indisponível',
          ],
          maxSelect: 1,
        },
        { name: 'justification', type: 'text', required: true },
        {
          name: 'paused_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'resumed_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'paused_at', type: 'date' },
        { name: 'resumed_at', type: 'date' },
        { name: 'expected_resume_at', type: 'date' },
        { name: 'duration_minutes', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_slapauses_ticket ON sla_pauses (ticket)'],
    })
    app.save(slaPauses)

    const timeEntries = new Collection({
      name: 'time_entries',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: tktId, required: true, maxSelect: 1 },
        {
          name: 'technician',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'entry_date', type: 'date' },
        { name: 'start_time', type: 'text' },
        { name: 'end_time', type: 'text' },
        { name: 'duration_minutes', type: 'number', required: true },
        {
          name: 'activity_type',
          type: 'select',
          values: [
            'Atendimento Remoto',
            'Atendimento Presencial',
            'Análise',
            'Desenvolvimento',
            'Reunião',
            'Gestão',
            'Deslocamento',
            'Projeto',
            'Plantão',
            'Hora Adicional',
          ],
          maxSelect: 1,
        },
        { name: 'billable', type: 'bool' },
        { name: 'description', type: 'text', required: true },
        { name: 'approved', type: 'bool' },
        { name: 'approved_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_timeentries_ticket ON time_entries (ticket)'],
    })
    app.save(timeEntries)

    const notifications = new Collection({
      name: 'notifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'ticket', type: 'relation', collectionId: tktId, maxSelect: 1 },
        { name: 'title', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['SLA', 'Atribuição', 'Interação', 'Aprovação', 'Sistema', 'Alerta'],
          maxSelect: 1,
        },
        { name: 'read', type: 'bool' },
        { name: 'read_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_notifications_user ON notifications (user)'],
    })
    app.save(notifications)

    const satisfactionSurveys = new Collection({
      name: 'satisfaction_surveys',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: tktId, required: true, maxSelect: 1 },
        {
          name: 'company',
          type: 'relation',
          collectionId: companies.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'respondent',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'quality_score', type: 'number' },
        { name: 'time_score', type: 'number' },
        { name: 'communication_score', type: 'number' },
        { name: 'technical_score', type: 'number' },
        { name: 'solution_score', type: 'number' },
        { name: 'overall_score', type: 'number' },
        { name: 'comment', type: 'text' },
        { name: 'responded_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_surveys_ticket ON satisfaction_surveys (ticket)'],
    })
    app.save(satisfactionSurveys)

    const auditLogs = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        { name: 'action', type: 'text', required: true },
        { name: 'entity_type', type: 'text', required: true },
        { name: 'entity_id', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'old_values', type: 'json' },
        { name: 'new_values', type: 'json' },
        { name: 'ip_address', type: 'text' },
        { name: 'user_agent', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_audit_user ON audit_logs (user)'],
    })
    app.save(auditLogs)

    const knowledgeArticles = new Collection({
      name: 'knowledge_articles',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'category', type: 'relation', collectionId: tktCategories.id, maxSelect: 1 },
        { name: 'summary', type: 'text' },
        { name: 'content', type: 'text', required: true },
        { name: 'tags', type: 'text' },
        { name: 'author', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'views', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_kb_category ON knowledge_articles (category)'],
    })
    app.save(knowledgeArticles)
  },
  (app) => {
    const cols = [
      'knowledge_articles',
      'audit_logs',
      'satisfaction_surveys',
      'notifications',
      'time_entries',
      'sla_pauses',
      'ticket_history',
      'ticket_attachments',
      'ticket_interactions',
      'tickets',
    ]
    cols.forEach((c) => {
      try {
        const col = app.findCollectionByNameOrId(c)
        app.delete(col)
      } catch (_) {}
    })
  },
)
