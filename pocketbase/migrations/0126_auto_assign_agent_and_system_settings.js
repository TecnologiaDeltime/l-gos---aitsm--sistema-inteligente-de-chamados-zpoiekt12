migrate(
  (app) => {
    // 1. Criar coleção system_settings se não existir
    if (!app.hasTable('system_settings')) {
      const systemSettings = new Collection({
        name: 'system_settings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'key', type: 'text', required: true },
          { name: 'auto_assign_enabled', type: 'bool' },
          { name: 'auto_assign_interval_minutes', type: 'number', min: 1, max: 1440 },
          {
            name: 'auto_assign_rule',
            type: 'select',
            values: [
              'Disponibilidade',
              'Menor Carga',
              'Ociosidade',
              'Líder da Equipe',
              'Cascata Inteligente',
            ],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_system_settings_key ON system_settings (key)'],
      })
      app.save(systemSettings)

      // Seed padrão para o agente de distribuição automática
      const rec = new Record(systemSettings)
      rec.set('key', 'global')
      rec.set('auto_assign_enabled', true)
      rec.set('auto_assign_interval_minutes', 5)
      rec.set('auto_assign_rule', 'Cascata Inteligente')
      app.save(rec)
    }

    // 2. Garantir campo de anexos ou vínculo na coleção scheduled_tickets e ticket_attachments se necessário
    try {
      const schedCol = app.findCollectionByNameOrId('scheduled_tickets')
      if (!schedCol.fields.getByName('attachments')) {
        schedCol.fields.add(
          new FileField({
            name: 'attachments',
            maxSelect: 10,
            maxSize: 10485760, // 10MB
          }),
        )
        app.save(schedCol)
      }
    } catch (_) {}

    try {
      const attachCol = app.findCollectionByNameOrId('ticket_attachments')
      // Permitir associar anexo diretamente a um agendamento se necessário
      if (!attachCol.fields.getByName('scheduled_ticket')) {
        const schedId = app.findCollectionByNameOrId('scheduled_tickets').id
        attachCol.fields.add(
          new RelationField({
            name: 'scheduled_ticket',
            collectionId: schedId,
            maxSelect: 1,
          }),
        )
        app.save(attachCol)
      }
    } catch (_) {}

    // 3. Cadastrar permissão settings_auto_assign com 3 níveis em profile_permissions
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const moduleKey = 'settings'
      const itemKey = 'settings_auto_assign'

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
      const col = app.findCollectionByNameOrId('system_settings')
      if (col) app.delete(col)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "settings" AND item_key = "settings_auto_assign"',
        )
        .execute()
    }
  },
)
