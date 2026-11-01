migrate(
  (app) => {
    // Migração 0110: Registra o novo item 'rep_operator_hours' na matriz de permissões
    // para todos os perfis cadastrados no sistema, com suporte aos 3 níveis:
    // Visualizar (view) / Editar (edit) / Configurar (configure).
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id

      // Verifica se já existe para este perfil de forma idempotente
      var existing = app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' +
          profileId +
          '" && module_key = "reports" && item_key = "rep_operator_hours"',
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        var rec = new Record(permCol)
        rec.set('profile', profileId)
        rec.set('module_key', 'reports')
        rec.set('item_key', 'rep_operator_hours')
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
        'DELETE FROM profile_permissions WHERE module_key = "reports" AND item_key = "rep_operator_hours"',
      )
      .execute()
  },
)
