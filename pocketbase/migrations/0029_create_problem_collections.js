migrate(
  (app) => {
    var usersId = '_pb_users_auth_'
    var companiesId = app.findCollectionByNameOrId('companies').id
    var contractsId = app.findCollectionByNameOrId('contracts').id
    var queuesId = app.findCollectionByNameOrId('queues').id
    var categoriesId = app.findCollectionByNameOrId('tkt_categories').id
    var ticketsId = app.findCollectionByNameOrId('tickets').id

    var problems = new Collection({
      name: 'problems',
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
        { name: 'symptom', type: 'text' },
        { name: 'expected_behavior', type: 'text' },
        { name: 'current_behavior', type: 'text' },
        { name: 'impact_description', type: 'text' },
        {
          name: 'frequency',
          type: 'select',
          values: ['Única ocorrência', 'Eventual', 'Recorrente', 'Frequente', 'Contínua'],
          maxSelect: 1,
        },
        { name: 'first_occurrence_date', type: 'date' },
        { name: 'last_occurrence_date', type: 'date' },
        {
          name: 'origin',
          type: 'select',
          values: [
            'Incidente recorrente',
            'Incidente grave',
            'Incidente Major',
            'Análise preventiva',
            'Monitoramento',
            'Auditoria',
            'Segurança',
            'Fornecedor',
            'Capacidade',
            'Disponibilidade',
            'Tendência identificada',
            'Identificação manual',
            'Outra',
          ],
          maxSelect: 1,
        },
        { name: 'origin_record_id', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: [
            'Novo',
            'Em Investigação',
            'Causa Identificada',
            'Solução de Contorno Planejada',
            'Solução de Contorno Implantada',
            'Em Análise de Efetividade',
            'Análise de Efetividade Pendente',
            'Avaliação Realizada',
            'Encerrado',
            'Reaberto',
            'Plano de Solução Definitiva',
          ],
          maxSelect: 1,
        },
        {
          name: 'priority',
          type: 'select',
          values: ['Baixa', 'Média', 'Alta', 'Crítica'],
          maxSelect: 1,
        },
        {
          name: 'impact',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto', 'Crítico'],
          maxSelect: 1,
        },
        {
          name: 'urgency',
          type: 'select',
          values: ['Baixa', 'Média', 'Alta', 'Crítica'],
          maxSelect: 1,
        },
        {
          name: 'requester',
          type: 'relation',
          collectionId: usersId,
          required: true,
          maxSelect: 1,
        },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'team', type: 'relation', collectionId: queuesId, maxSelect: 1 },
        { name: 'company', type: 'relation', collectionId: companiesId, maxSelect: 1 },
        { name: 'contract', type: 'relation', collectionId: contractsId, maxSelect: 1 },
        { name: 'service', type: 'text' },
        { name: 'category', type: 'relation', collectionId: categoriesId, maxSelect: 1 },
        { name: 'subcategory', type: 'relation', collectionId: categoriesId, maxSelect: 1 },
        {
          name: 'impact_classification',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto', 'Crítico'],
          maxSelect: 1,
        },
        { name: 'affected_services', type: 'text' },
        { name: 'affected_clients', type: 'text' },
        { name: 'affected_users_count', type: 'number' },
        { name: 'avg_downtime', type: 'text' },
        { name: 'financial_impact', type: 'text' },
        { name: 'security_impact', type: 'text' },
        { name: 'reputational_impact', type: 'text' },
        { name: 'regulatory_impact', type: 'text' },
        {
          name: 'investigation_responsible',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'investigation_start_date', type: 'date' },
        { name: 'investigation_evidence', type: 'text' },
        { name: 'investigation_logs', type: 'text' },
        { name: 'investigation_tests', type: 'text' },
        { name: 'investigation_analyses', type: 'text' },
        { name: 'investigation_tools', type: 'text' },
        { name: 'investigation_observations', type: 'text' },
        { name: 'root_cause_identified', type: 'text' },
        { name: 'root_cause_evidence', type: 'text' },
        { name: 'root_cause_method', type: 'text' },
        { name: 'root_cause_responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'root_cause_date', type: 'date' },
        {
          name: 'root_cause_confidence',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto'],
          maxSelect: 1,
        },
        { name: 'five_whys', type: 'json' },
        { name: 'ishikawa', type: 'json' },
        { name: 'is_known_error', type: 'bool' },
        { name: 'effectiveness_start_date', type: 'date' },
        { name: 'effectiveness_end_date', type: 'date' },
        { name: 'effectiveness_period_days', type: 'number' },
        {
          name: 'effectiveness_result',
          type: 'select',
          values: ['Efetiva', 'Parcialmente efetiva', 'Não efetiva'],
          maxSelect: 1,
        },
        { name: 'incidents_before_count', type: 'number' },
        { name: 'incidents_after_count', type: 'number' },
        { name: 'closure_notes', type: 'text' },
        { name: 'reopened_count', type: 'number' },
        { name: 'reopen_reason', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_problems_number ON problems (number)',
        'CREATE INDEX idx_problems_status ON problems (status)',
        'CREATE INDEX idx_problems_priority ON problems (priority)',
        'CREATE INDEX idx_problems_company ON problems (company)',
        'CREATE INDEX idx_problems_responsible ON problems (responsible)',
        'CREATE INDEX idx_problems_created ON problems (created)',
      ],
    })
    app.save(problems)
    var problemsId = problems.id

    var problemIncidents = new Collection({
      name: 'problem_incidents',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        {
          name: 'problem',
          type: 'relation',
          collectionId: problemsId,
          required: true,
          maxSelect: 1,
        },
        { name: 'ticket', type: 'relation', collectionId: ticketsId, required: true, maxSelect: 1 },
        { name: 'relation_type', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pi_problem ON problem_incidents (problem)',
        'CREATE INDEX pi_ticket ON problem_incidents (ticket)',
      ],
    })
    app.save(problemIncidents)

    var problemHypotheses = new Collection({
      name: 'problem_hypotheses',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        {
          name: 'problem',
          type: 'relation',
          collectionId: problemsId,
          required: true,
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: true },
        { name: 'probability', type: 'select', values: ['Baixa', 'Média', 'Alta'], maxSelect: 1 },
        { name: 'evidence', type: 'text' },
        { name: 'result', type: 'text' },
        { name: 'confirmed', type: 'bool' },
        { name: 'discarded', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_ph_problem ON problem_hypotheses (problem)'],
    })
    app.save(problemHypotheses)

    var problemAuditLogs = new Collection({
      name: 'problem_audit_logs',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        {
          name: 'problem',
          type: 'relation',
          collectionId: problemsId,
          required: true,
          maxSelect: 1,
        },
        { name: 'user', type: 'relation', collectionId: usersId, required: true, maxSelect: 1 },
        { name: 'action', type: 'text', required: true },
        { name: 'field', type: 'text' },
        { name: 'old_value', type: 'text' },
        { name: 'new_value', type: 'text' },
        { name: 'comment', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pal_problem ON problem_audit_logs (problem)'],
    })
    app.save(problemAuditLogs)
  },
  (app) => {
    ;['problem_audit_logs', 'problem_hypotheses', 'problem_incidents', 'problems'].forEach(
      function (c) {
        try {
          app.delete(app.findCollectionByNameOrId(c))
        } catch (_) {}
      },
    )
  },
)
