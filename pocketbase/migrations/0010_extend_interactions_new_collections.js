migrate(
  (app) => {
    var interactions = app.findCollectionByNameOrId('ticket_interactions')
    var fieldsToAdd = [
      ['start_time', new TextField({ name: 'start_time' })],
      ['end_time', new TextField({ name: 'end_time' })],
      ['duration_minutes', new NumberField({ name: 'duration_minutes' })],
      [
        'hour_type',
        new SelectField({
          name: 'hour_type',
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
        }),
      ],
      [
        'billing_status',
        new SelectField({
          name: 'billing_status',
          values: ['Faturável', 'Não Faturável', 'Pendente'],
          maxSelect: 1,
        }),
      ],
      [
        'origin',
        new SelectField({
          name: 'origin',
          values: ['Cronômetro', 'Manual', 'Automático'],
          maxSelect: 1,
        }),
      ],
      ['approved', new BoolField({ name: 'approved' })],
      [
        'approved_by',
        new RelationField({ name: 'approved_by', collectionId: '_pb_users_auth_', maxSelect: 1 }),
      ],
      ['justification', new TextField({ name: 'justification' })],
    ]
    fieldsToAdd.forEach(function (entry) {
      if (!interactions.fields.getByName(entry[0])) interactions.fields.add(entry[1])
    })
    interactions.addIndex('idx_interactions_author', false, 'author', '')
    interactions.addIndex('idx_interactions_hour_type', false, 'hour_type', '')
    app.save(interactions)

    var contractsId = app.findCollectionByNameOrId('contracts').id
    var companiesId = app.findCollectionByNameOrId('companies').id
    var ticketsId = app.findCollectionByNameOrId('tickets').id
    var usersId = '_pb_users_auth_'

    app.save(
      new Collection({
        name: 'contract_periods',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'contract',
            type: 'relation',
            collectionId: contractsId,
            required: true,
            maxSelect: 1,
          },
          { name: 'period_start', type: 'date' },
          { name: 'period_end', type: 'date' },
          { name: 'contracted_hours', type: 'number' },
          { name: 'consumed_hours', type: 'number' },
          { name: 'status', type: 'select', values: ['Ativo', 'Encerrado'], maxSelect: 1 },
          { name: 'cycle_number', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_contractperiods_contract ON contract_periods (contract)',
          'CREATE INDEX idx_contractperiods_status ON contract_periods (status)',
        ],
      }),
    )

    app.save(
      new Collection({
        name: 'operator_daily_snapshots',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'operator',
            type: 'relation',
            collectionId: usersId,
            required: true,
            maxSelect: 1,
          },
          { name: 'date', type: 'date' },
          { name: 'tickets_attended', type: 'number' },
          { name: 'tickets_resolved', type: 'number' },
          { name: 'slas_met', type: 'number' },
          { name: 'slas_violated', type: 'number' },
          { name: 'hours_worked', type: 'number' },
          { name: 'avg_first_response_minutes', type: 'number' },
          { name: 'avg_resolution_minutes', type: 'number' },
          { name: 'avg_interaction_gap_minutes', type: 'number' },
          { name: 'max_idle_minutes', type: 'number' },
          { name: 'reopens', type: 'number' },
          { name: 'backlog', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_opdaily_operator_date ON operator_daily_snapshots (operator, date)',
        ],
      }),
    )

    app.save(
      new Collection({
        name: 'blocking_records',
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
          {
            name: 'reason',
            type: 'select',
            values: [
              'Limite de Horas',
              'Solicitação Diretoria',
              'Contrato Vencido',
              'Inadimplência',
              'Contrato Suspenso',
              'Cliente Inativo',
              'Pendência Aprovação',
              'Bloqueio Administrativo',
              'Outro',
            ],
            maxSelect: 1,
          },
          { name: 'justification', type: 'text', required: true },
          { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'start_date', type: 'date' },
          { name: 'expected_end_date', type: 'date' },
          {
            name: 'block_type',
            type: 'select',
            values: [
              'Bloquear Abertura Portal',
              'Bloquear Abertura Email',
              'Bloquear Abertura API',
              'Bloquear Todos Canais',
              'Permitir Abertura mas Impedir Atendimento',
              'Bloquear Serviços Específicos',
              'Permitir Somente Críticos',
            ],
            maxSelect: 1,
          },
          { name: 'allow_critical', type: 'bool' },
          { name: 'message', type: 'text' },
          { name: 'evidence', type: 'file', maxSelect: 1 },
          { name: 'approver', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'active', type: 'bool' },
          { name: 'unblocked_at', type: 'date' },
          { name: 'unblocked_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_blocking_client ON blocking_records (client)',
          'CREATE INDEX idx_blocking_active ON blocking_records (active)',
        ],
      }),
    )

    app.save(
      new Collection({
        name: 'blocked_attempts',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'client', type: 'relation', collectionId: companiesId, maxSelect: 1 },
          { name: 'requester_email', type: 'text' },
          { name: 'channel', type: 'select', values: ['Portal', 'Email'], maxSelect: 1 },
          { name: 'blocked', type: 'bool' },
          { name: 'ticket_created', type: 'relation', collectionId: ticketsId, maxSelect: 1 },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_blockedattempts_client ON blocked_attempts (client)'],
      }),
    )

    app.save(
      new Collection({
        name: 'continuity_decisions',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'contract', type: 'relation', collectionId: contractsId, maxSelect: 1 },
          { name: 'client', type: 'relation', collectionId: companiesId, maxSelect: 1 },
          {
            name: 'decision',
            type: 'select',
            values: [
              'Autorizar Continuidade com Excedente',
              'Solicitar Contratação Horas Adicionais',
              'Solicitar Novo Orçamento',
              'Suspender Atendimentos',
              'Solicitar Contato Comercial',
              'Continuar Apenas Críticos',
            ],
            maxSelect: 1,
          },
          { name: 'hours_authorized', type: 'number' },
          { name: 'value_authorized', type: 'number' },
          { name: 'respondent_email', type: 'text' },
          { name: 'ip_address', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'responded_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_continuity_contract ON continuity_decisions (contract)'],
      }),
    )

    var existingContracts = app.findRecordsByFilter('contracts', 'id != ""', '', 0, 0)
    var periodsCol = app.findCollectionByNameOrId('contract_periods')
    for (var i = 0; i < existingContracts.length; i++) {
      var c = existingContracts[i]
      try {
        app.findFirstRecordByFilter('contract_periods', 'contract = "' + c.id + '"')
      } catch (_) {
        var p = new Record(periodsCol)
        p.set('contract', c.id)
        p.set('period_start', c.getString('start_date') || new Date().toISOString().slice(0, 10))
        p.set('contracted_hours', c.getFloat('monthly_hours') || 0)
        p.set('consumed_hours', 0)
        p.set('status', 'Ativo')
        p.set('cycle_number', 1)
        app.save(p)
      }
    }
  },
  (app) => {
    var cols = [
      'continuity_decisions',
      'blocked_attempts',
      'blocking_records',
      'operator_daily_snapshots',
      'contract_periods',
    ]
    cols.forEach(function (c) {
      try {
        app.delete(app.findCollectionByNameOrId(c))
      } catch (_) {}
    })
  },
)
