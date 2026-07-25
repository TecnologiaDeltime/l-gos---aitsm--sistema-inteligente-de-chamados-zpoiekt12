migrate(
  (app) => {
    var ticketsId = app.findCollectionByNameOrId('tickets').id
    var usersId = '_pb_users_auth_'
    var companiesId = app.findCollectionByNameOrId('companies').id
    var queuesId = app.findCollectionByNameOrId('queues').id
    var categoriesId = app.findCollectionByNameOrId('tkt_categories').id

    var ticketsCol = app.findCollectionByNameOrId('tickets')
    if (!ticketsCol.fields.getByName('parent')) {
      ticketsCol.fields.add(
        new RelationField({ name: 'parent', collectionId: ticketsId, maxSelect: 1 }),
      )
    }
    app.save(ticketsCol)

    app.save(
      new Collection({
        name: 'automations',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'code', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'client', type: 'relation', collectionId: companiesId, maxSelect: 1 },
          { name: 'catalog', type: 'relation', collectionId: categoriesId, maxSelect: 1 },
          { name: 'service', type: 'text' },
          {
            name: 'ticket_type',
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
          { name: 'current_version', type: 'number' },
          {
            name: 'status',
            type: 'select',
            values: ['Rascunho', 'Ativa', 'Inativa', 'Arquivada'],
            maxSelect: 1,
          },
          { name: 'execution_priority', type: 'number' },
          { name: 'validity_start', type: 'date' },
          { name: 'validity_end', type: 'date' },
          { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'is_template', type: 'bool' },
          { name: 'template_category', type: 'text' },
          { name: 'schedule_cron', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_automations_status ON automations (status)',
          'CREATE UNIQUE INDEX idx_automations_code ON automations (code)',
        ],
      }),
    )
    var automationsId = app.findCollectionByNameOrId('automations').id

    app.save(
      new Collection({
        name: 'workflow_versions',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'automation',
            type: 'relation',
            collectionId: automationsId,
            required: true,
            maxSelect: 1,
          },
          { name: 'version_number', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            values: ['Rascunho', 'Publicado', 'Arquivado', 'Restaurado'],
            maxSelect: 1,
          },
          { name: 'published_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'published_at', type: 'date' },
          { name: 'changes', type: 'text' },
          { name: 'reason', type: 'text' },
          { name: 'definition', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_wfversions_automation ON workflow_versions (automation)'],
      }),
    )
    var versionsId = app.findCollectionByNameOrId('workflow_versions').id

    app.save(
      new Collection({
        name: 'workflow_executions',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'automation',
            type: 'relation',
            collectionId: automationsId,
            required: true,
            maxSelect: 1,
          },
          { name: 'version', type: 'relation', collectionId: versionsId, maxSelect: 1 },
          { name: 'ticket', type: 'relation', collectionId: ticketsId, maxSelect: 1 },
          {
            name: 'status',
            type: 'select',
            values: [
              'Em Execução',
              'Aguardando Aprovação',
              'Aguardando',
              'Concluído',
              'Erro',
              'Cancelado',
            ],
            maxSelect: 1,
          },
          { name: 'started_at', type: 'date' },
          { name: 'completed_at', type: 'date' },
          { name: 'error', type: 'text' },
          { name: 'current_block', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_wfexec_automation ON workflow_executions (automation)',
          'CREATE INDEX idx_wfexec_ticket ON workflow_executions (ticket)',
        ],
      }),
    )
    var executionsId = app.findCollectionByNameOrId('workflow_executions').id

    var approvalsCol = app.findCollectionByNameOrId('approvals')
    if (!approvalsCol.fields.getByName('workflow_execution')) {
      approvalsCol.fields.add(
        new RelationField({ name: 'workflow_execution', collectionId: executionsId, maxSelect: 1 }),
      )
    }
    app.save(approvalsCol)

    app.save(
      new Collection({
        name: 'workflow_execution_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'execution',
            type: 'relation',
            collectionId: executionsId,
            required: true,
            maxSelect: 1,
          },
          { name: 'block_id', type: 'text' },
          { name: 'block_type', type: 'text' },
          { name: 'block_label', type: 'text' },
          { name: 'timestamp', type: 'date' },
          { name: 'result', type: 'text' },
          { name: 'input', type: 'text' },
          { name: 'output', type: 'text' },
          { name: 'error', type: 'text' },
          { name: 'retries', type: 'number' },
          { name: 'next_action', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_wflogs_execution ON workflow_execution_logs (execution)'],
      }),
    )

    app.save(
      new Collection({
        name: 'workflow_tasks',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          { name: 'ticket', type: 'relation', collectionId: ticketsId, maxSelect: 1 },
          { name: 'automation', type: 'relation', collectionId: automationsId, maxSelect: 1 },
          { name: 'execution', type: 'relation', collectionId: executionsId, maxSelect: 1 },
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'queue', type: 'relation', collectionId: queuesId, maxSelect: 1 },
          { name: 'deadline', type: 'date' },
          {
            name: 'priority',
            type: 'select',
            values: ['P1', 'P2', 'P3', 'P4', 'P5'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            values: ['Pendente', 'Em Andamento', 'Concluída', 'Cancelada'],
            maxSelect: 1,
          },
          { name: 'checklist', type: 'json' },
          { name: 'estimated_time', type: 'number' },
          {
            name: 'hour_type',
            type: 'select',
            values: [
              'Contratada',
              'Excedente',
              'Projeto',
              'Interna',
              'Não Faturável',
              'Cortesia',
              'Deslocamento',
              'Plantão',
              'Gestão',
              'Treinamento',
            ],
            maxSelect: 1,
          },
          { name: 'required_evidence', type: 'bool' },
          { name: 'required_approval', type: 'bool' },
          {
            name: 'parent_task',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('workflow_tasks').id,
            maxSelect: 1,
          },
          {
            name: 'task_type',
            type: 'select',
            values: [
              'Sequencial',
              'Paralela',
              'Independente',
              'Dependente',
              'Obrigatória',
              'Opcional',
            ],
            maxSelect: 1,
          },
          { name: 'completed_at', type: 'date' },
          { name: 'completed_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_wftasks_ticket ON workflow_tasks (ticket)',
          'CREATE INDEX idx_wftasks_responsible ON workflow_tasks (responsible)',
        ],
      }),
    )
    var wfTasksId = app.findCollectionByNameOrId('workflow_tasks').id
    var wfTasksCol = app.findCollectionByNameOrId('workflow_tasks')
    if (!wfTasksCol.fields.getByName('parent_task')) {
      wfTasksCol.fields.add(
        new RelationField({ name: 'parent_task', collectionId: wfTasksId, maxSelect: 1 }),
      )
    }
    app.save(wfTasksCol)

    app.save(
      new Collection({
        name: 'workflow_form_definitions',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'automation',
            type: 'relation',
            collectionId: automationsId,
            required: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'fields', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_wfforms_automation ON workflow_form_definitions (automation)'],
      }),
    )

    app.save(
      new Collection({
        name: 'workflow_audit_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'automation', type: 'relation', collectionId: automationsId, maxSelect: 1 },
          { name: 'user', type: 'relation', collectionId: usersId, required: true, maxSelect: 1 },
          { name: 'action', type: 'text', required: true },
          { name: 'entity_type', type: 'text' },
          { name: 'entity_id', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'old_values', type: 'json' },
          { name: 'new_values', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_wfaudit_automation ON workflow_audit_logs (automation)'],
      }),
    )
  },
  (app) => {
    var cols = [
      'workflow_audit_logs',
      'workflow_form_definitions',
      'workflow_tasks',
      'workflow_execution_logs',
      'workflow_executions',
      'workflow_versions',
      'automations',
    ]
    cols.forEach(function (c) {
      try {
        app.delete(app.findCollectionByNameOrId(c))
      } catch (_) {}
    })
    try {
      var ticketsCol = app.findCollectionByNameOrId('tickets')
      if (ticketsCol.fields.getByName('parent')) ticketsCol.fields.removeByName('parent')
      app.save(ticketsCol)
    } catch (_) {}
    try {
      var ap = app.findCollectionByNameOrId('approvals')
      if (ap.fields.getByName('workflow_execution')) ap.fields.removeByName('workflow_execution')
      app.save(ap)
    } catch (_) {}
  },
)
