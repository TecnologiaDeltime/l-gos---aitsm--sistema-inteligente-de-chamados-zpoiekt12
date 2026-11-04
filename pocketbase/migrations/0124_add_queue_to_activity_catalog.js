/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Adicionar campo 'queue' na coleção 'tkt_categories'
    try {
      var categoriesCol = app.findCollectionByNameOrId('tkt_categories')
      if (categoriesCol) {
        var hasQueue = false
        var fields = categoriesCol.fields

        for (var i = 0; i < fields.length; i++) {
          if (fields[i].name === 'queue') hasQueue = true
        }

        if (!hasQueue) {
          var queuesCol = app.findCollectionByNameOrId('queues')
          var queuesColId = queuesCol ? queuesCol.id : ''

          if (queuesColId) {
            categoriesCol.fields.add(
              new RelationField({
                name: 'queue',
                collectionId: queuesColId,
                cascadeDelete: false,
                maxSelect: 1,
                required: false,
              }),
            )
          } else {
            categoriesCol.fields.add(
              new TextField({
                name: 'queue',
                required: false,
              }),
            )
          }
          app.save(categoriesCol)
        }
      }
    } catch (e) {
      console.log('Erro ao adicionar campo queue em tkt_categories:', e)
    }

    // 2. Registrar permissão tickets_equipe_responsavel no catálogo de perfis
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var item = {
        module_key: 'tickets',
        item_key: 'tickets_equipe_responsavel',
      }

      for (var p = 0; p < profiles.length; p++) {
        var prof = profiles[p]
        var profileId = prof.id
        var profName = (prof.getString('name') || '').toLowerCase()

        var isAdm =
          profName.includes('admin') || profName.includes('gestor') || profName.includes('gerente')
        var assignedLevel = isAdm ? 'configure' : 'edit'
        var granted = true

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
          rec.set('granted', granted)
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      var categoriesCol = app.findCollectionByNameOrId('tkt_categories')
      if (categoriesCol) {
        categoriesCol.fields.removeByName('queue')
        app.save(categoriesCol)
      }
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "tickets" AND item_key = "tickets_equipe_responsavel"',
        )
        .execute()
    }
  },
)
