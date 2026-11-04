migrate(
  (app) => {
    // Migração 0121: Garante as permissões de Importação em Massa no catálogo e perfis:
    // 1. cmdb_import (Importação de Ativos / CMDB)
    // 2. clients_import (Importação de Colaboradores / Clientes)
    if (!app.hasTable('profile_permissions') || !app.hasTable('profiles')) {
      return
    }

    var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
    var permCol = app.findCollectionByNameOrId('profile_permissions')

    var itemsToAdd = [
      { module_key: 'cmdb', item_key: 'cmdb_import' },
      { module_key: 'clients', item_key: 'clients_import' },
    ]

    for (var i = 0; i < profiles.length; i++) {
      var prof = profiles[i]
      var profileId = prof.id
      var profName = (prof.getString('name') || '').toLowerCase()

      var assignedLevel = 'edit'
      if (profName.includes('admin') || profName.includes('gestor')) {
        assignedLevel = 'configure'
      }

      for (var j = 0; j < itemsToAdd.length; j++) {
        var item = itemsToAdd[j]
        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "' +
            item.module_key +
            '" && item_key = "' +
            item.item_key +
            '"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', item.module_key)
          rec.set('item_key', item.item_key)
          rec.set('granted', true)
          rec.set('level', assignedLevel)
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
        'DELETE FROM profile_permissions WHERE (module_key = "clients" AND item_key = "clients_import")',
      )
      .execute()
  },
)
