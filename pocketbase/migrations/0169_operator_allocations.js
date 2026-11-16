migrate(
  (app) => {
    // Migração 0169: Alocar Operador (alocação de operadores em clientes, presencial na sede/filiais)
    // 1. Cria a coleção operator_allocations (operador, cliente, tipo de alocação, recorrência JSON e vigência)
    // 2. Registra o item 'admin_operator_allocations' no catálogo de permissões (módulo admin),
    //    habilitado por padrão para os perfis administrativos (admin/gestor), seguindo o padrão 0122.
    var usersCol = app.findCollectionByNameOrId('users')
    var companiesCol = app.findCollectionByNameOrId('companies')
    var unitsCol = app.findCollectionByNameOrId('company_units')

    // Idempotente: se a coleção já existe com o campo unit apontando para companies
    // (versão anterior desta migração), remove e recria com o alvo correto (company_units).
    var needsRecreate = false
    try {
      var existingCol = app.findCollectionByNameOrId('operator_allocations')
      var unitField = existingCol.fields.getByName && existingCol.fields.getByName('unit')
      if (unitField && unitField.collectionId !== unitsCol.id) {
        needsRecreate = true
        app.delete(existingCol)
      }
    } catch (_) {}

    var collection = new Collection({
      name: 'operator_allocations',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      updateRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
      fields: [
        {
          name: 'operator',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          minSelect: 1,
          maxSelect: 1,
        },
        {
          name: 'company',
          type: 'relation',
          required: true,
          collectionId: companiesCol.id,
          minSelect: 1,
          maxSelect: 1,
        },
        {
          name: 'unit',
          type: 'relation',
          required: false,
          collectionId: unitsCol.id,
          minSelect: 0,
          maxSelect: 1,
        },
        {
          name: 'allocation_type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['permanente', 'periodo'],
        },
        {
          name: 'recurrence_json',
          type: 'json',
          required: false,
          maxSize: 65536,
        },
        { name: 'start_date', type: 'date', required: false },
        { name: 'end_date', type: 'date', required: false },
        { name: 'active', type: 'bool', required: false },
        { name: 'notes', type: 'text', required: false, maxSize: 4000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_operator_allocations_operator ON operator_allocations (operator)',
        'CREATE INDEX idx_operator_allocations_company ON operator_allocations (company)',
      ],
    })
    app.save(collection)

    // Permissão no catálogo (padrão 0122): admin/gestor configuram; demais nascem sem acesso
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var moduleKey = 'admin'
      var itemKey = 'admin_operator_allocations'

      for (var i = 0; i < profiles.length; i++) {
        var profileId = profiles[i].id
        var profName = (profiles[i].getString('name') || '').toLowerCase()

        var granted = false
        var assignedLevel = 'view'
        if (profName.includes('admin')) {
          granted = true
          assignedLevel = 'configure'
        } else if (profName.includes('gestor')) {
          granted = true
          assignedLevel = 'edit'
        }

        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "' +
            moduleKey +
            '" && item_key = "' +
            itemKey +
            '"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', moduleKey)
          rec.set('item_key', itemKey)
          rec.set('granted', granted)
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('operator_allocations')
      if (col) app.delete(col)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "admin" AND item_key = "admin_operator_allocations"',
        )
        .execute()
    }
  },
)
