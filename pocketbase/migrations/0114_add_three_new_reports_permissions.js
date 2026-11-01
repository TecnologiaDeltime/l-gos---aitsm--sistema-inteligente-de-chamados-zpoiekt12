migrate(
  (app) => {
    // Migração 0114: Registra os 3 novos relatórios na matriz de permissões
    // - rep_tickets: Relatório de chamados
    // - rep_ticket_interactions: Relatório de interações nos chamados (logs de acompanhamento)
    // - rep_worked_hours: Relatório de interações horas trabalhadas (play/pause cronômetro)
    // Concede aos perfis existentes com nível 'edit' (Visualizar/Editar/Configurar)
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var items = ['rep_tickets', 'rep_ticket_interactions', 'rep_worked_hours']

    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id

      for (var j = 0; j < items.length; j++) {
        var itemKey = items[j]
        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' + profileId + '" && module_key = "reports" && item_key = "' + itemKey + '"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', 'reports')
          rec.set('item_key', itemKey)
          rec.set('granted', true)
          rec.set('level', 'edit')
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
        'DELETE FROM profile_permissions WHERE module_key = "reports" AND item_key IN ("rep_tickets", "rep_ticket_interactions", "rep_worked_hours")',
      )
      .execute()
  },
)
