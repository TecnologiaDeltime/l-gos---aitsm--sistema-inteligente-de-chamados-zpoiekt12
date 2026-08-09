migrate(
  (app) => {
    var changeTypes = new Collection({
      name: 'change_types',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        {
          name: 'risk_level',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto', 'Crítico'],
          maxSelect: 1,
        },
        { name: 'approval_required', type: 'bool' },
        { name: 'committee_approval', type: 'bool' },
        { name: 'eligible_for_automation', type: 'bool' },
        { name: 'is_standard', type: 'bool' },
        { name: 'recurring', type: 'bool' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_change_types_name ON change_types (name)',
        'CREATE INDEX idx_change_types_active ON change_types (active)',
      ],
    })
    app.save(changeTypes)

    var changeTemplates = new Collection({
      name: 'change_templates',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'change_type', type: 'relation', collectionId: changeTypes.id, maxSelect: 1 },
        { name: 'description', type: 'text' },
        { name: 'procedure', type: 'text' },
        { name: 'checklist', type: 'json' },
        {
          name: 'default_priority',
          type: 'select',
          values: ['Crítica', 'Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        {
          name: 'default_impact',
          type: 'select',
          values: ['Alto', 'Médio', 'Baixo'],
          maxSelect: 1,
        },
        {
          name: 'default_urgency',
          type: 'select',
          values: ['Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        {
          name: 'default_risk_level',
          type: 'select',
          values: ['Baixo', 'Médio', 'Alto', 'Crítico'],
          maxSelect: 1,
        },
        { name: 'rollback_procedure', type: 'text' },
        { name: 'validation_criteria', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_change_templates_type ON change_templates (change_type)',
        'CREATE INDEX idx_change_templates_active ON change_templates (active)',
      ],
    })
    app.save(changeTemplates)

    var changeCommittee = new Collection({
      name: 'change_committee',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'members', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 50 },
        { name: 'chairperson', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'meeting_frequency', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_change_committee_active ON change_committee (active)'],
    })
    app.save(changeCommittee)
  },
  (app) => {
    ;['change_committee', 'change_templates', 'change_types'].forEach(function (c) {
      try {
        app.delete(app.findCollectionByNameOrId(c))
      } catch (_) {}
    })
  },
)
