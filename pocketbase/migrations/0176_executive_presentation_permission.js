migrate(
  (app) => {
    // Migração 0176: Registra a permissão 'apresentacao_executiva' no módulo 'dashboard'
    // (Apresentação Executiva — slides da direção).
    // Padrão da casa: ligada para Administrador (admin é imune à matriz) e Qualidade,
    // desligada para os demais perfis (granted=false; o item aparece no catálogo para
    // ser liberado manualmente na matriz de Perfis de Acesso).
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var itemKey = 'apresentacao_executiva'
    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id
      var profileName = (prof.get('name') || '').toString().trim().toLowerCase()

      // Ligado por padrão somente para o perfil Qualidade (o Administrador é imune à matriz)
      var granted = profileName === 'qualidade'

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
        rec.set('granted', granted)
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
        'DELETE FROM profile_permissions WHERE module_key = "dashboard" AND item_key = "apresentacao_executiva"',
      )
      .execute()
  },
)
