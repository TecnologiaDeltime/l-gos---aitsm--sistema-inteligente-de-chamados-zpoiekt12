migrate(
  (app) => {
    var changeTypesId = app.findCollectionByNameOrId('change_types').id
    var changeTemplatesId = app.findCollectionByNameOrId('change_templates').id
    var companiesId = app.findCollectionByNameOrId('companies').id
    var unitsId = app.findCollectionByNameOrId('company_units').id
    var tktCategoriesId = app.findCollectionByNameOrId('tkt_categories').id
    var ticketsId = app.findCollectionByNameOrId('tickets').id
    var usersId = '_pb_users_auth_'

    var changes = new Collection({
      name: 'changes',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'number', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'change_type', type: 'relation', collectionId: changeTypesId, maxSelect: 1 },
        { name: 'template', type: 'relation', collectionId: changeTemplatesId, maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          values: [
            'Rascunho',
            'Solicitada',
            'Em Avaliação',
            'Aguardando Aprovação',
            'Aprovada',
            'Recusada',
            'Em Planejamento',
            'Agendada',
            'Em Execução',
            'Em Validação',
            'Concluída',
            'Cancelada',
            'Reaberta',
          ],
          maxSelect: 1,
        },
        {
          name: 'priority',
          type: 'select',
          values: ['Crítica', 'Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        { name: 'impact', type: 'select', values: ['Alto', 'Médio', 'Baixo'], maxSelect: 1 },
        { name: 'urgency', type: 'select', values: ['Alta', 'Média', 'Baixa'], maxSelect: 1 },
        {
          name: 'risk_level',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto', 'Crítico'],
          maxSelect: 1,
        },
        { name: 'risk_assessment', type: 'text' },
        {
          name: 'requester',
          type: 'relation',
          collectionId: usersId,
          required: true,
          maxSelect: 1,
        },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'assigned_to', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'participants', type: 'relation', collectionId: usersId, maxSelect: 50 },
        { name: 'company', type: 'relation', collectionId: companiesId, maxSelect: 1 },
        { name: 'unit', type: 'relation', collectionId: unitsId, maxSelect: 1 },
        { name: 'category', type: 'relation', collectionId: tktCategoriesId, maxSelect: 1 },
        { name: 'ticket', type: 'relation', collectionId: ticketsId, maxSelect: 1 },
        { name: 'planned_start', type: 'date' },
        { name: 'planned_end', type: 'date' },
        { name: 'actual_start', type: 'date' },
        { name: 'actual_end', type: 'date' },
        { name: 'execution_plan', type: 'text' },
        { name: 'rollback_plan', type: 'text' },
        { name: 'validation_results', type: 'text' },
        { name: 'evidence', type: 'text' },
        { name: 'closure_notes', type: 'text' },
        {
          name: 'approval_status',
          type: 'select',
          values: ['Não Requerida', 'Pendente', 'Aprovada', 'Recusada'],
          maxSelect: 1,
        },
        { name: 'approved_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'approved_at', type: 'date' },
        { name: 'committee_decision', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_changes_number ON changes (number)',
        'CREATE INDEX idx_changes_status ON changes (status)',
        'CREATE INDEX idx_changes_type ON changes (change_type)',
        'CREATE INDEX idx_changes_requester ON changes (requester)',
        'CREATE INDEX idx_changes_assigned ON changes (assigned_to)',
        'CREATE INDEX idx_changes_priority ON changes (priority)',
        'CREATE INDEX idx_changes_created ON changes (created)',
      ],
    })
    app.save(changes)
    var changesId = changes.id

    var changeApprovals = new Collection({
      name: 'change_approvals',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'change', type: 'relation', collectionId: changesId, required: true, maxSelect: 1 },
        { name: 'approver', type: 'relation', collectionId: usersId, required: true, maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          values: ['Pendente', 'Aprovado', 'Recusado'],
          maxSelect: 1,
        },
        { name: 'decision', type: 'text' },
        { name: 'decided_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_change_approvals_change ON change_approvals (change)',
        'CREATE INDEX idx_change_approvals_status ON change_approvals (status)',
        'CREATE INDEX idx_change_approvals_approver ON change_approvals (approver)',
      ],
    })
    app.save(changeApprovals)

    var changeCalendarEntries = new Collection({
      name: 'change_calendar_entries',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'change', type: 'relation', collectionId: changesId, required: true, maxSelect: 1 },
        { name: 'scheduled_start', type: 'date' },
        { name: 'scheduled_end', type: 'date' },
        { name: 'title', type: 'text' },
        { name: 'type', type: 'text' },
        { name: 'status', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_change_calendar_change ON change_calendar_entries (change)',
        'CREATE INDEX idx_change_calendar_start ON change_calendar_entries (scheduled_start)',
      ],
    })
    app.save(changeCalendarEntries)

    var changeAuditLogs = new Collection({
      name: 'change_audit_logs',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'change', type: 'relation', collectionId: changesId, required: true, maxSelect: 1 },
        { name: 'user', type: 'relation', collectionId: usersId, required: true, maxSelect: 1 },
        { name: 'action', type: 'text', required: true },
        { name: 'field', type: 'text' },
        { name: 'old_value', type: 'text' },
        { name: 'new_value', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_change_audit_change ON change_audit_logs (change)'],
    })
    app.save(changeAuditLogs)
  },
  (app) => {
    ;['change_audit_logs', 'change_calendar_entries', 'change_approvals', 'changes'].forEach(
      function (c) {
        try {
          app.delete(app.findCollectionByNameOrId(c))
        } catch (_) {}
      },
    )
  },
)
