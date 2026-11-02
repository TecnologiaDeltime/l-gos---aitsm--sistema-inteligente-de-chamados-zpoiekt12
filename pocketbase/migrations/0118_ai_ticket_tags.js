migrate(
  (app) => {
    // 1. Adicionar campo 'tags' à coleção tickets se não existir
    if (app.hasTable('tickets')) {
      const ticketsCol = app.findCollectionByNameOrId('tickets')
      if (!ticketsCol.fields.getByName('tags')) {
        ticketsCol.fields.add(
          new TextField({
            name: 'tags',
            type: 'text',
          }),
        )
        app.save(ticketsCol)
      }
    }

    // 2. Adicionar campo 'tag_suggestions_enabled' à coleção ai_ticket_settings se não existir
    if (app.hasTable('ai_ticket_settings')) {
      const settingsCol = app.findCollectionByNameOrId('ai_ticket_settings')
      if (!settingsCol.fields.getByName('tag_suggestions_enabled')) {
        settingsCol.fields.add(
          new BoolField({
            name: 'tag_suggestions_enabled',
            type: 'bool',
          }),
        )
        app.save(settingsCol)
      }

      // Atualizar registro padrão com tag_suggestions_enabled = true
      try {
        const records = app.findRecordsByFilter('ai_ticket_settings', 'scope = "global"', '', 1, 0)
        if (records.length > 0) {
          const r = records[0]
          r.set('tag_suggestions_enabled', true)
          app.save(r)
        }
      } catch (_) {}
    }

    // 3. Conceder permissão tickets_ai_tags a todos os perfis existentes
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id
        const profName = (prof.getString('name') || '').toLowerCase()

        const existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' + profileId + '" && module_key = "tickets" && item_key = "tickets_ai_tags"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          const rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', 'tickets')
          rec.set('item_key', 'tickets_ai_tags')
          rec.set('granted', true)

          let assignedLevel = 'edit'
          if (profName.includes('admin') || profName.includes('gestor')) {
            assignedLevel = 'configure'
          }
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery('DELETE FROM profile_permissions WHERE item_key = "tickets_ai_tags"')
          .execute()
      }
    } catch (_) {}

    try {
      if (app.hasTable('ai_ticket_settings')) {
        const settingsCol = app.findCollectionByNameOrId('ai_ticket_settings')
        const field = settingsCol.fields.getByName('tag_suggestions_enabled')
        if (field) {
          settingsCol.fields.removeByName('tag_suggestions_enabled')
          app.save(settingsCol)
        }
      }
    } catch (_) {}

    try {
      if (app.hasTable('tickets')) {
        const ticketsCol = app.findCollectionByNameOrId('tickets')
        const field = ticketsCol.fields.getByName('tags')
        if (field) {
          ticketsCol.fields.removeByName('tags')
          app.save(ticketsCol)
        }
      }
    } catch (_) {}
  },
)
