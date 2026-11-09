migrate(
  (app) => {
    // Migração 0145: Registra a permissão 'tickets_child_ai_feedback' (módulo tickets)
    // Permite que operadores visualizem e apliquem feedback/sugestão de IA na abertura de chamados filhos.
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var permCol = app.findCollectionByNameOrId('profile_permissions')
    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)

    var items = [{ module_key: 'tickets', item_key: 'tickets_child_ai_feedback', level: 'edit' }]

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id

      for (var j = 0; j < items.length; j++) {
        var it = items[j]
        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "' +
            it.module_key +
            '" && item_key = "' +
            it.item_key +
            '"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', it.module_key)
          rec.set('item_key', it.item_key)
          rec.set('granted', true)
          rec.set('level', it.level)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    if (!app.hasTable('profile_permissions')) return
    app
      .db()
      .newQuery(
        'DELETE FROM profile_permissions WHERE module_key = "tickets" AND item_key = "tickets_child_ai_feedback"',
      )
      .execute()
  },
)
