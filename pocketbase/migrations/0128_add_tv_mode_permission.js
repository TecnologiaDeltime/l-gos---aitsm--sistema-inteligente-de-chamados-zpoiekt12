migrate(
  (app) => {
    // Migração 0128: Registra a permissão 'modo_tv' no módulo 'dashboard'
    // Concede aos perfis existentes com nível 'edit' (Visualizar/Editar/Configurar)
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var itemKey = 'modo_tv'
    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id

      var existing = app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' + profileId + '" && module_key = "dashboard" && item_key = "' + itemKey + '"',
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        var rec = new Record(permCol)
        rec.set('profile', profileId)
        rec.set('module_key', 'dashboard')
        rec.set('item_key', itemKey)
        rec.set('granted', true)
        rec.set('level', 'edit')
        app.save(rec)
      }
    }
  },
  (app) => {
    if (!app.hasTable('profile_permissions')) return
    app
      .db()
      .newQuery(
        'DELETE FROM profile_permissions WHERE module_key = "dashboard" AND item_key = "modo_tv"',
      )
      .execute()
  },
)
