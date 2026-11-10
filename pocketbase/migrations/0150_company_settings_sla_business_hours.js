migrate(
  (app) => {
    // 1. Coleção company_settings — cadastro da empresa operadora do Lógos AITSM
    if (!app.hasTable('company_settings')) {
      const col = new Collection({
        name: 'company_settings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'legal_name', type: 'text' },
          { name: 'trade_name', type: 'text' },
          { name: 'cnpj', type: 'text' },
          { name: 'email', type: 'text' },
          { name: 'phone', type: 'text' },
          { name: 'address_street', type: 'text' },
          { name: 'address_number', type: 'text' },
          { name: 'address_complement', type: 'text' },
          { name: 'address_neighborhood', type: 'text' },
          { name: 'address_city', type: 'text' },
          { name: 'address_state', type: 'text' },
          { name: 'address_zipcode', type: 'text' },
          // JSON: { "0": {enabled,start,end}, ... "6": ... } — 0 = domingo
          { name: 'business_hours', type: 'json' },
          // JSON: [ { date: "YYYY-MM-DD", name: "..." }, ... ]
          { name: 'holidays', type: 'json' },
          { name: 'timezone', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_company_settings_single ON company_settings (id)'],
      })
      app.save(col)
    }

    // 2. Permissão settings_company_profile no catálogo de perfis (regra permanente)
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const moduleKey = 'settings'
      const itemKey = 'settings_company_profile'

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id
        const profName = (prof.getString('name') || '').toLowerCase()

        let assignedLevel = 'view'
        let granted = false

        if (profName.includes('admin') || profName.includes('gestor')) {
          assignedLevel = 'configure'
          granted = true
        } else if (profName.includes('qualidade') || profName.includes('coordenador')) {
          assignedLevel = 'edit'
          granted = true
        } else if (profName.includes('helpdesk') || profName.includes('suporte')) {
          assignedLevel = 'view'
          granted = true
        }

        const existing = app.findRecordsByFilter(
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
          const rec = new Record(permCol)
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
      const col = app.findCollectionByNameOrId('company_settings')
      if (col) app.delete(col)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "settings" AND item_key = "settings_company_profile"',
        )
        .execute()
    }
  },
)
