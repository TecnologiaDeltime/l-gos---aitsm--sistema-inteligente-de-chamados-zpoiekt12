/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0111: Restauração da permissão 'meu_painel' (Painel do Operador)
 *
 * Registra o item 'meu_painel' no módulo 'dashboard' na coleção 'profile_permissions'
 * para todos os perfis existentes, garantindo acesso imediato nos 3 níveis (view, edit, configure).
 */
migrate(
  (app) => {
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id

      var existing = app.findRecordsByFilter(
        'profile_permissions',
        'profile = "' + profileId + '" && module_key = "dashboard" && item_key = "meu_painel"',
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        var rec = new Record(permCol)
        rec.set('profile', profileId)
        rec.set('module_key', 'dashboard')
        rec.set('item_key', 'meu_painel')
        rec.set('granted', true)
        rec.set('level', 'edit')
        app.save(rec)
      } else {
        var r = existing[0]
        if (!r.getBool('granted')) {
          r.set('granted', true)
          if (!r.getString('level')) {
            r.set('level', 'edit')
          }
          app.save(r)
        }
      }
    }
  },
  (app) => {
    if (!app.hasTable('profile_permissions')) return
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "dashboard" AND item_key = "meu_painel"',
        )
        .execute()
    } catch (_) {}
  },
)
