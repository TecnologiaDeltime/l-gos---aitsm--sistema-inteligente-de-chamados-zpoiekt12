/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Adicionar campos 'type' e 'deleted' na coleção 'tkt_categories'
    try {
      var categoriesCol = app.findCollectionByNameOrId('tkt_categories')
      if (categoriesCol) {
        var hasType = false
        var hasDeleted = false
        var fields = categoriesCol.fields

        for (var i = 0; i < fields.length; i++) {
          if (fields[i].name === 'type') hasType = true
          if (fields[i].name === 'deleted') hasDeleted = true
        }

        if (!hasType) {
          categoriesCol.fields.add(
            new SelectField({
              name: 'type',
              maxSelect: 1,
              values: ['Incidente', 'Requisição de Serviço', 'Dúvida', 'Visita Técnica'],
            }),
          )
        }

        if (!hasDeleted) {
          categoriesCol.fields.add(
            new BoolField({
              name: 'deleted',
            }),
          )
        }

        app.save(categoriesCol)
      }
    } catch (e) {
      console.log('Erro ao atualizar campos de tkt_categories:', e)
    }

    // 2. Registrar permissão tickets_catalogo_delete no perfil de permissões
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var item = {
        module_key: 'tickets',
        item_key: 'tickets_catalogo_delete',
      }

      for (var p = 0; p < profiles.length; p++) {
        var prof = profiles[p]
        var profileId = prof.id
        var profName = (prof.getString('name') || '').toLowerCase()

        var isAdm =
          profName.includes('admin') || profName.includes('gestor') || profName.includes('gerente')
        var assignedLevel = isAdm ? 'configure' : 'view'
        var granted = isAdm

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
    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "tickets" AND item_key = "tickets_catalogo_delete"',
        )
        .execute()
    }
  },
)
