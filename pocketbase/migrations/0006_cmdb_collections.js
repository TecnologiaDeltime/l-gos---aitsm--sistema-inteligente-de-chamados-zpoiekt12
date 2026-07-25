migrate(
  (app) => {
    const eqCol = app.findCollectionByNameOrId('equipments')

    const oldStatus = eqCol.fields.getByName('status')
    if (oldStatus) eqCol.fields.remove(oldStatus)
    eqCol.fields.add(
      new SelectField({
        name: 'status',
        values: [
          'Planejado',
          'Ativo',
          'Inativo',
          'Em Manutenção',
          'Descartado',
          'Reserva',
          'Emprestado',
        ],
        maxSelect: 1,
      }),
    )

    if (!eqCol.fields.getByName('department')) {
      const depts = app.findCollectionByNameOrId('company_departments')
      eqCol.fields.add(
        new RelationField({ name: 'department', collectionId: depts.id, maxSelect: 1 }),
      )
    }
    app.save(eqCol)

    const eqId = eqCol.id

    const ciRelationships = new Collection({
      name: 'ci_relationships',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'source_ci', type: 'relation', collectionId: eqId, required: true, maxSelect: 1 },
        { name: 'target_ci', type: 'relation', collectionId: eqId, required: true, maxSelect: 1 },
        {
          name: 'relationship_type',
          type: 'select',
          values: [
            'Conectado a',
            'Instalado em',
            'Roda em',
            'Depende de',
            'Contém',
            'Pertence a',
            'Backup de',
          ],
          maxSelect: 1,
        },
        { name: 'description', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cirel_source ON ci_relationships (source_ci)',
        'CREATE INDEX idx_cirel_target ON ci_relationships (target_ci)',
      ],
    })
    app.save(ciRelationships)

    const ciTypes = new Collection({
      name: 'ci_types',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'icon', type: 'text' },
        { name: 'custom_attributes', type: 'json' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_citypes_active ON ci_types (active)'],
    })
    app.save(ciTypes)

    const ciDocuments = new Collection({
      name: 'ci_documents',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'equipment', type: 'relation', collectionId: eqId, required: true, maxSelect: 1 },
        { name: 'file', type: 'file', maxSelect: 1, maxSize: 10485760 },
        { name: 'file_name', type: 'text' },
        { name: 'file_type', type: 'text' },
        { name: 'file_size', type: 'number' },
        { name: 'document_type', type: 'text' },
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
      indexes: ['CREATE INDEX idx_cidocs_equipment ON ci_documents (equipment)'],
    })
    app.save(ciDocuments)
  },
  (app) => {
    ;['ci_documents', 'ci_types', 'ci_relationships'].forEach((c) => {
      try {
        app.delete(app.findCollectionByNameOrId(c))
      } catch (_) {}
    })
    try {
      const eqCol = app.findCollectionByNameOrId('equipments')
      const sf = eqCol.fields.getByName('status')
      if (sf) eqCol.fields.remove(sf)
      eqCol.fields.add(
        new SelectField({
          name: 'status',
          values: ['Ativo', 'Inativo', 'Em Manutenção', 'Descartado'],
          maxSelect: 1,
        }),
      )
      const df = eqCol.fields.getByName('department')
      if (df) eqCol.fields.remove(df)
      app.save(eqCol)
    } catch (_) {}
  },
)
