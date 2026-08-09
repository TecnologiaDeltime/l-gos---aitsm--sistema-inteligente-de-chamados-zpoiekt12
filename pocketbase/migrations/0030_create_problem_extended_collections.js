migrate(
  (app) => {
    var usersId = '_pb_users_auth_'
    var problemsId = app.findCollectionByNameOrId('problems').id
    var changesId = app.findCollectionByNameOrId('changes').id

    var problemWorkarounds = new Collection({
      name: 'problem_workarounds',
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
        { name: 'procedure', type: 'text' },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'deployment_date', type: 'date' },
        { name: 'review_date', type: 'date' },
        { name: 'evidence', type: 'text' },
        { name: 'restrictions', type: 'text' },
        { name: 'risks', type: 'text' },
        { name: 'impacts', type: 'text' },
        { name: 'service_desk_instructions', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pw_problem ON problem_workarounds (problem)'],
    })
    app.save(problemWorkarounds)

    var problemEvaluations = new Collection({
      name: 'problem_effectiveness_evaluations',
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
        {
          name: 'was_effective',
          type: 'select',
          values: ['Sim', 'Parcialmente', 'Não'],
          maxSelect: 1,
        },
        { name: 'had_new_incidents', type: 'select', values: ['Sim', 'Não'], maxSelect: 1 },
        { name: 'new_incidents_count', type: 'number' },
        {
          name: 'impact_reduced',
          type: 'select',
          values: ['Sim', 'Parcialmente', 'Não'],
          maxSelect: 1,
        },
        { name: 'service_stable', type: 'select', values: ['Sim', 'Não'], maxSelect: 1 },
        {
          name: 'root_cause_exists',
          type: 'select',
          values: ['Sim', 'Não', 'Parcialmente'],
          maxSelect: 1,
        },
        { name: 'needs_definitive_solution', type: 'select', values: ['Sim', 'Não'], maxSelect: 1 },
        { name: 'observations', type: 'text', required: true },
        { name: 'evaluated_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pe_problem ON problem_effectiveness_evaluations (problem)'],
    })
    app.save(problemEvaluations)

    var problemDefinitiveSolutions = new Collection({
      name: 'problem_definitive_solutions',
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
        { name: 'objective', type: 'text' },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'planned_date', type: 'date' },
        { name: 'actual_date', type: 'date' },
        { name: 'dependencies', type: 'text' },
        { name: 'risks', type: 'text' },
        { name: 'evidence', type: 'text' },
        { name: 'result', type: 'text' },
        { name: 'related_change', type: 'relation', collectionId: changesId, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pds_problem ON problem_definitive_solutions (problem)'],
    })
    app.save(problemDefinitiveSolutions)

    var problemExtensions = new Collection({
      name: 'problem_extensions',
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
        { name: 'new_period_days', type: 'number', required: true },
        { name: 'justification', type: 'text', required: true },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'approval_required', type: 'bool' },
        { name: 'new_end_date', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pext_problem ON problem_extensions (problem)'],
    })
    app.save(problemExtensions)

    var knownErrors = new Collection({
      name: 'known_errors',
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
        { name: 'known_cause', type: 'text', required: true },
        { name: 'symptoms', type: 'text' },
        { name: 'affected_services', type: 'text' },
        { name: 'workaround', type: 'text' },
        { name: 'restrictions', type: 'text' },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          values: ['Ativo', 'Resolvido', 'Arquivado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ke_problem ON known_errors (problem)',
        'CREATE INDEX idx_ke_status ON known_errors (status)',
      ],
    })
    app.save(knownErrors)

    var problemTimeline = new Collection({
      name: 'problem_timeline',
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
        { name: 'stage', type: 'text', required: true },
        { name: 'status', type: 'text' },
        { name: 'responsible', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'evidence', type: 'text' },
        { name: 'comments', type: 'text' },
        { name: 'event_date', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pt_problem ON problem_timeline (problem)'],
    })
    app.save(problemTimeline)
  },
  (app) => {
    ;[
      'problem_timeline',
      'known_errors',
      'problem_extensions',
      'problem_definitive_solutions',
      'problem_effectiveness_evaluations',
      'problem_workarounds',
    ].forEach(function (c) {
      try {
        app.delete(app.findCollectionByNameOrId(c))
      } catch (_) {}
    })
  },
)
