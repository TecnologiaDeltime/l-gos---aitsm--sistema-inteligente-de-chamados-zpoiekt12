migrate(
  (app) => {
    // Migração: registra o item 'admin_accompaniment_hours_edit' no módulo 'clients'
    // (Editar/Excluir Horas de Acompanhamento). Ligado no nível 'configure' para os
    // perfis Administrador e Qualidade; desligado (granted=false explícito) para os
    // demais perfis. Idempotente: só cria a linha se ainda não existir.
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profId = prof.id
      var name = (prof.getString('name') || '').toLowerCase()
      var isAdminProfile = name.indexOf('admin') !== -1
      var isQualityProfile = name.indexOf('qualidade') !== -1
      var granted = isAdminProfile || isQualityProfile

      var existing = app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' +
          profId +
          '" && module_key = "clients" && item_key = "admin_accompaniment_hours_edit"',
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        var rec = new Record(permCol)
        rec.set('profile', profId)
        rec.set('module_key', 'clients')
        rec.set('item_key', 'admin_accompaniment_hours_edit')
        rec.set('granted', granted)
        rec.set('level', granted ? 'configure' : 'view')
        app.save(rec)
      }
    }
  },
  (app) => {
    if (!app.hasTable('profile_permissions')) return
    app
      .db()
      .newQuery(
        'DELETE FROM profile_permissions WHERE module_key = "clients" AND item_key = "admin_accompaniment_hours_edit"',
      )
      .execute()
  },
)
