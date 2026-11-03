migrate(
  (app) => {
    // Migração 0119: Registra o item "Atalho Meu chamado (Portal)" na matriz de permissões
    // e o concede aos perfis existentes (padrão das migrações 0114/0117/0118).
    // Idempotente: só cria o registro se ainda não existir para o perfil.
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id
      var profName = (prof.getString('name') || '').toLowerCase()

      var existing = app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' +
          profileId +
          '" && module_key = "tickets" && item_key = "tickets_portal_meu_chamado"',
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        var rec = new Record(permCol)
        rec.set('profile', profileId)
        rec.set('module_key', 'tickets')
        rec.set('item_key', 'tickets_portal_meu_chamado')
        rec.set('granted', true)

        // Administrador e Gestor recebem 'configure'; demais perfis, 'edit' (padrão da 0118)
        var assignedLevel = 'edit'
        if (profName.includes('admin') || profName.includes('gestor')) {
          assignedLevel = 'configure'
        }
        rec.set('level', assignedLevel)
        app.save(rec)
      }
    }
  },
  (app) => {
    if (!app.hasTable('profile_permissions')) return
    app
      .db()
      .newQuery(
        'DELETE FROM profile_permissions WHERE module_key = "tickets" AND item_key = "tickets_portal_meu_chamado"',
      )
      .execute()
  },
)
