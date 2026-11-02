migrate(
  (app) => {
    // 1. Criar coleção asset_automation_logs para auditoria de automações de ativos
    if (!app.hasTable('asset_automation_logs')) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const collection = new Collection({
        name: 'asset_automation_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        fields: [
          {
            name: 'operator',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            maxSelect: 1,
          },
          {
            name: 'operator_name',
            type: 'text',
            required: false,
          },
          {
            name: 'action_type',
            type: 'select',
            required: true,
            values: [
              'exclusao_usuario',
              'exclusao_ativo',
              'mudanca_status',
              'cancelamento_exclusao_usuario',
              'cancelamento_exclusao_ativo',
            ],
            maxSelect: 1,
          },
          {
            name: 'description',
            type: 'text',
            required: false,
          },
          {
            name: 'equipment_id',
            type: 'text',
            required: false,
          },
          {
            name: 'equipment_name',
            type: 'text',
            required: false,
          },
          {
            name: 'target_user_name',
            type: 'text',
            required: false,
          },
          {
            name: 'target_user_id',
            type: 'text',
            required: false,
          },
          {
            name: 'details',
            type: 'json',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_asset_autologs_action ON asset_automation_logs (action_type)',
          'CREATE INDEX idx_asset_autologs_equipment ON asset_automation_logs (equipment_id)',
          'CREATE INDEX idx_asset_autologs_created ON asset_automation_logs (created)',
        ],
      })
      app.save(collection)
    }

    // 2. Conceder permissão do novo item no catálogo (rep_asset_automation_logs) para todos os perfis
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id

        const existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "reports" && item_key = "rep_asset_automation_logs"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          const rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', 'reports')
          rec.set('item_key', 'rep_asset_automation_logs')
          rec.set('granted', true)
          rec.set('level', 'edit')
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    if (app.hasTable('asset_automation_logs')) {
      try {
        const col = app.findCollectionByNameOrId('asset_automation_logs')
        app.delete(col)
      } catch (_) {}
    }

    if (app.hasTable('profile_permissions')) {
      try {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "reports" AND item_key = "rep_asset_automation_logs"',
          )
          .execute()
      } catch (_) {}
    }
  },
)
