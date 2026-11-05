migrate(
  (app) => {
    // Migração 0131: Registra a permissão 'chat_historico' (módulo chat)
    // Item do catálogo de permissões para o Histórico de Chat por Operador.
    // Concede aos perfis existentes com nível 'view' (Leitura) — a consulta é somente leitura.
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var permCol = app.findCollectionByNameOrId('profile_permissions')
    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)

    var items = [{ module_key: 'chat', item_key: 'chat_historico', level: 'view' }]

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
        'DELETE FROM profile_permissions WHERE module_key = "chat" AND item_key = "chat_historico"',
      )
      .execute()
  },
)
