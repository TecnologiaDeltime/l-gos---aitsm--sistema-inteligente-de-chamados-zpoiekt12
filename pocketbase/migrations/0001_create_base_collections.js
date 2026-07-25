migrate(
  (app) => {
    const companies = new Collection({
      name: 'companies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'legal_name', type: 'text', required: true },
        { name: 'trade_name', type: 'text', required: true },
        { name: 'document', type: 'text', required: true },
        { name: 'address_street', type: 'text' },
        { name: 'address_number', type: 'text' },
        { name: 'address_neighborhood', type: 'text' },
        { name: 'address_city', type: 'text' },
        { name: 'address_state', type: 'text' },
        { name: 'address_zipcode', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'status', type: 'select', values: ['Ativo', 'Inativo'], maxSelect: 1 },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_companies_code ON companies (code)',
        'CREATE INDEX idx_companies_status ON companies (status)',
      ],
    })
    app.save(companies)

    const compId = companies.id

    const companyUnits = new Collection({
      name: 'company_units',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'company', type: 'relation', collectionId: compId, required: true, maxSelect: 1 },
        { name: 'name', type: 'text', required: true },
        { name: 'address_street', type: 'text' },
        { name: 'address_number', type: 'text' },
        { name: 'address_neighborhood', type: 'text' },
        { name: 'address_city', type: 'text' },
        { name: 'address_state', type: 'text' },
        { name: 'address_zipcode', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'manager_name', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_units_company ON company_units (company)'],
    })
    app.save(companyUnits)

    const unitsId = companyUnits.id

    const companyDepts = new Collection({
      name: 'company_departments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'company', type: 'relation', collectionId: compId, required: true, maxSelect: 1 },
        { name: 'unit', type: 'relation', collectionId: unitsId, maxSelect: 1 },
        { name: 'name', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_depts_company ON company_departments (company)'],
    })
    app.save(companyDepts)

    const contracts = new Collection({
      name: 'contracts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'company', type: 'relation', collectionId: compId, required: true, maxSelect: 1 },
        { name: 'number', type: 'text', required: true },
        { name: 'start_date', type: 'date' },
        { name: 'end_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['Ativo', 'Expirado', 'Cancelado'],
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          values: [
            'Pacote Mensal',
            'Por Chamado',
            'Ilimitado',
            'Banco de Horas',
            'Projeto',
            'Sustentação Mensal',
            'Atendimento Avulso',
            'Híbrido',
          ],
          maxSelect: 1,
        },
        { name: 'monthly_hours', type: 'number' },
        { name: 'accumulative_hours', type: 'bool' },
        { name: 'overtime_hour_value', type: 'number' },
        { name: 'monthly_hour_limit', type: 'number' },
        { name: 'service_hours_start', type: 'text' },
        { name: 'service_hours_end', type: 'text' },
        {
          name: 'service_days',
          type: 'select',
          values: ['Seg-Sex', 'Seg-Sáb', 'Todos', 'Personalizado'],
          maxSelect: 1,
        },
        { name: 'on_duty_coverage', type: 'bool' },
        { name: 'sla_response_time', type: 'number' },
        { name: 'sla_solution_time', type: 'number' },
        { name: 'sla_update_time', type: 'number' },
        { name: 'sla_field_service_time', type: 'number' },
        {
          name: 'priorities_available',
          type: 'select',
          values: ['P1', 'P2', 'P3', 'P4', 'P5'],
          maxSelect: 5,
        },
        { name: 'included_services', type: 'text' },
        { name: 'excluded_services', type: 'text' },
        { name: 'overtime_policy', type: 'text' },
        { name: 'travel_policy', type: 'text' },
        { name: 'technical_visit_policy', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contracts_company ON contracts (company)',
        'CREATE INDEX idx_contracts_status ON contracts (status)',
      ],
    })
    app.save(contracts)

    const tktCategories = new Collection({
      name: 'tkt_categories',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_categories_active ON tkt_categories (active)'],
    })
    app.save(tktCategories)

    // Self relation field for parent category
    tktCategories.fields.add(
      new RelationField({
        name: 'parent',
        collectionId: tktCategories.id,
        maxSelect: 1,
      }),
    )
    app.save(tktCategories)

    const queues = new Collection({
      name: 'queues',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'members', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 50 },
        { name: 'categories', type: 'relation', collectionId: tktCategories.id, maxSelect: 50 },
        {
          name: 'distribution_rule',
          type: 'select',
          values: ['Disponibilidade', 'Menor Carga', 'Rodízio', 'Especialidade'],
          maxSelect: 1,
        },
        { name: 'priority', type: 'number' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_queues_active ON queues (active)'],
    })
    app.save(queues)

    const equipments = new Collection({
      name: 'equipments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'company', type: 'relation', collectionId: compId, required: true, maxSelect: 1 },
        { name: 'unit', type: 'relation', collectionId: unitsId, maxSelect: 1 },
        { name: 'type', type: 'text' },
        { name: 'manufacturer', type: 'text' },
        { name: 'model', type: 'text' },
        { name: 'serial_number', type: 'text' },
        { name: 'patrimony_number', type: 'text' },
        { name: 'ip_address', type: 'text' },
        { name: 'name', type: 'text', required: true },
        { name: 'operating_system', type: 'text' },
        { name: 'responsible_user', type: 'text' },
        { name: 'warranty_until', type: 'date' },
        { name: 'supplier', type: 'text' },
        { name: 'acquisition_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['Ativo', 'Inativo', 'Em Manutenção', 'Descartado'],
          maxSelect: 1,
        },
        { name: 'location', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_equipments_company ON equipments (company)',
        'CREATE INDEX idx_equipments_status ON equipments (status)',
      ],
    })
    app.save(equipments)
  },
  (app) => {
    const cols = [
      'equipments',
      'queues',
      'tkt_categories',
      'contracts',
      'company_departments',
      'company_units',
      'companies',
    ]
    cols.forEach((c) => {
      try {
        const col = app.findCollectionByNameOrId(c)
        app.delete(col)
      } catch (_) {}
    })
  },
)
