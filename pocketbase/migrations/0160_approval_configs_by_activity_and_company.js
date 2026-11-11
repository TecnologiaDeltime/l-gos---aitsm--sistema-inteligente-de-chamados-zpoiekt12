migrate(
  (app) => {
    const approvalConfigs = app.findCollectionByNameOrId('approval_configs')
    const companies = app.findCollectionByNameOrId('companies')
    const clientContacts = app.findCollectionByNameOrId('client_contacts')
    const users = app.findCollectionByNameOrId('users')

    // 1. Campo company (relação única com companies) para seleção da empresa no topo
    if (!approvalConfigs.fields.getByName('company')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'company',
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
    }

    // 2. approver_type: 'focal_point' ou 'internal_user'
    if (!approvalConfigs.fields.getByName('approver_type')) {
      approvalConfigs.fields.add(
        new SelectField({
          name: 'approver_type',
          values: ['focal_point', 'internal_user'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 3. approver_focal_point: ponto focal do cliente
    if (!approvalConfigs.fields.getByName('approver_focal_point')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'approver_focal_point',
          collectionId: clientContacts.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
    }

    // 4. approver_user: aprovador interno alternativo
    if (!approvalConfigs.fields.getByName('approver_user')) {
      approvalConfigs.fields.add(
        new RelationField({
          name: 'approver_user',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
    }

    app.save(approvalConfigs)

    // Índice na empresa e na atividade
    try {
      approvalConfigs.addIndex('idx_approval_configs_company', false, 'company', '')
      app.save(approvalConfigs)
    } catch (_) {}

    // Backfill idempotente: para regras legadas que já têm clients (array de IDs) e internal_approvers / focal_points,
    // preencher company, approver_type, approver_focal_point ou approver_user
    try {
      const records = app.findRecordsByFilter('approval_configs', 'id != ""', '', 0, 0)
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        let changed = false

        // Preenche company se estiver vazio e clients tiver valor
        if (!rec.getString('company')) {
          let cliArr = []
          try {
            cliArr = rec.get('clients') || []
            if (typeof cliArr === 'string') {
              cliArr = JSON.parse(cliArr)
            }
          } catch (_) {
            cliArr = []
          }
          if (Array.isArray(cliArr) && cliArr.length > 0 && cliArr[0]) {
            rec.set('company', cliArr[0])
            changed = true
          }
        }

        // Preenche approver_type e aprovador se não estiver configurado
        if (!rec.getString('approver_type')) {
          let fps = []
          try {
            fps = rec.get('focal_points') || []
            if (typeof fps === 'string') fps = JSON.parse(fps)
          } catch (_) {
            fps = []
          }

          let ops = []
          try {
            ops = rec.get('internal_approvers') || []
            if (typeof ops === 'string') ops = JSON.parse(ops)
          } catch (_) {
            ops = []
          }

          if (Array.isArray(fps) && fps.length > 0 && fps[0]) {
            rec.set('approver_type', 'focal_point')
            rec.set('approver_focal_point', fps[0])
            changed = true
          } else if (Array.isArray(ops) && ops.length > 0 && ops[0]) {
            rec.set('approver_type', 'internal_user')
            rec.set('approver_user', ops[0])
            changed = true
          }
        }

        if (changed) {
          app.save(rec)
        }
      }
    } catch (bfErr) {
      console.log('Backfill approval_configs warning:', bfErr.message)
    }

    // Regra permanente: Garantir item no catálogo de permissões tickets_approval_flow
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
      approvalConfigs.removeIndex('idx_approval_configs_company')
      ;['company', 'approver_type', 'approver_focal_point', 'approver_user'].forEach((f) => {
        if (approvalConfigs.fields.getByName(f)) approvalConfigs.fields.removeByName(f)
      })
      app.save(approvalConfigs)
    } catch (_) {}
  },
)
