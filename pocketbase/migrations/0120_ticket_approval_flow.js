migrate(
  (app) => {
    // 1. Estende approval_configs com campos do fluxo avançado de aprovação de chamados
    const approvalConfigs = app.findCollectionByNameOrId('approval_configs')

    if (!approvalConfigs.fields.getByName('request_types')) {
      approvalConfigs.fields.add(
        new JSONField({
          name: 'request_types',
        }),
      )
    }

    if (!approvalConfigs.fields.getByName('require_high_priority')) {
      approvalConfigs.fields.add(
        new BoolField({
          name: 'require_high_priority',
        }),
      )
    }

    if (!approvalConfigs.fields.getByName('require_client_approval')) {
      approvalConfigs.fields.add(
        new BoolField({
          name: 'require_client_approval',
        }),
      )
    }

    if (!approvalConfigs.fields.getByName('require_internal_approval')) {
      approvalConfigs.fields.add(
        new BoolField({
          name: 'require_internal_approval',
        }),
      )
    }

    app.save(approvalConfigs)

    // 2. Estende approvals com perfil (cliente / interno) e motivo de recusa
    const approvals = app.findCollectionByNameOrId('approvals')

    if (!approvals.fields.getByName('approval_role')) {
      approvals.fields.add(
        new SelectField({
          name: 'approval_role',
          values: ['client', 'internal', 'general'],
          maxSelect: 1,
        }),
      )
    }

    if (!approvals.fields.getByName('rejection_reason')) {
      approvals.fields.add(
        new TextField({
          name: 'rejection_reason',
        }),
      )
    }

    app.save(approvals)

    // 3. Concede permissão da nova funcionalidade no catálogo de perfis (Regra permanente)
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id
        const profName = (prof.getString('name') || '').toLowerCase()

        const existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "tickets" && item_key = "tickets_approval_flow"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          const rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', 'tickets')
          rec.set('item_key', 'tickets_approval_flow')
          rec.set('granted', true)

          let assignedLevel = 'edit'
          if (profName.includes('admin') || profName.includes('gestor')) {
            assignedLevel = 'configure'
          } else if (profName.includes('cliente') || profName.includes('visualizador')) {
            assignedLevel = 'view'
          }
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      const approvalConfigs = app.findCollectionByNameOrId('approval_configs')
      const fields = [
        'request_types',
        'require_high_priority',
        'require_client_approval',
        'require_internal_approval',
      ]
      fields.forEach((f) => {
        if (approvalConfigs.fields.getByName(f)) approvalConfigs.fields.removeByName(f)
      })
      app.save(approvalConfigs)
    } catch (_) {}

    try {
      const approvals = app.findCollectionByNameOrId('approvals')
      ;['approval_role', 'rejection_reason'].forEach((f) => {
        if (approvals.fields.getByName(f)) approvals.fields.removeByName(f)
      })
      app.save(approvals)
    } catch (_) {}

    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "tickets" AND item_key = "tickets_approval_flow"',
          )
          .execute()
      }
    } catch (_) {}
  },
)
