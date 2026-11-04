migrate(
  (app) => {
    // Migração 0122: Agente de Consumo Médio de Horas por Cliente
    // 1. Cria coleção client_consumption_agents para armazenar o aprendizado e configuração por cliente
    // 2. Garante permissão settings_consumption_agent no catálogo profile_permissions
    var companiesCol = app.findCollectionByNameOrId('companies')

    var collection = new Collection({
      name: 'client_consumption_agents',
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
          name: 'company',
          type: 'relation',
          required: true,
          collectionId: companiesCol.id,
          cascadeDelete: true,
          minSelect: 1,
          maxSelect: 1,
        },
        { name: 'enabled', type: 'bool', required: false },
        // Margens percentuais de desvio aceitáveis
        { name: 'deviation_high_pct', type: 'number', required: false },
        { name: 'deviation_low_pct', type: 'number', required: false },
        // Janela de aprendizado (número de meses com dados analisados, ex: 3 a 6)
        { name: 'learning_window_months', type: 'number', required: false },
        // Snapshot aprendido pelo agente
        { name: 'learned_average_hours', type: 'number', required: false },
        { name: 'learned_average_seconds', type: 'number', required: false },
        { name: 'learned_reference_period', type: 'text', required: false },
        { name: 'learned_history_json', type: 'json', required: false, maxSize: 1048576 },
        { name: 'last_evaluation_at', type: 'date', required: false },
        // Detalhes da última avaliação
        { name: 'current_period_consumed_hours', type: 'number', required: false },
        { name: 'current_period_deviation_pct', type: 'number', required: false },
        { name: 'current_status', type: 'text', required: false }, // 'normal' | 'high' | 'low' | 'no_data'
        // Anti-ruído: chave do último alerta disparado (ex.: "2026-11:high")
        { name: 'last_alerted_key', type: 'text', required: false },
        { name: 'last_alerted_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_client_consumption_agent_company ON client_consumption_agents (company)',
      ],
    })
    app.save(collection)

    // Backfill de permissões no profile_permissions
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var moduleKey = 'settings'
      var itemKey = 'settings_consumption_agent'

      for (var i = 0; i < profiles.length; i++) {
        var prof = profiles[i]
        var profileId = prof.id
        var profName = (prof.getString('name') || '').toLowerCase()

        var assignedLevel = 'view'
        var granted = false

        if (profName.includes('admin') || profName.includes('gestor')) {
          assignedLevel = 'configure'
          granted = true
        } else if (profName.includes('qualidade')) {
          assignedLevel = 'edit'
          granted = true
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
      var col = app.findCollectionByNameOrId('client_consumption_agents')
      if (col) app.delete(col)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "settings" AND item_key = "settings_consumption_agent"',
        )
        .execute()
    }
  },
)
