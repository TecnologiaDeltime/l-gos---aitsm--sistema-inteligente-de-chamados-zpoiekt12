migrate(
  (app) => {
    // 1. Adicionar availability_status na coleção equipments se não existir
    if (app.hasTable('equipments')) {
      var equipments = app.findCollectionByNameOrId('equipments')
      if (!equipments.fields.getByName('availability_status')) {
        equipments.fields.add(
          new SelectField({
            name: 'availability_status',
            required: false,
            values: ['Em uso', 'Obsoleto', 'Descartado', 'Disponível', 'Em Estoque'],
            maxSelect: 1,
          }),
        )
        app.save(equipments)

        // Backfill idempotente: registros existentes sem availability_status recebem 'Em uso'
        app
          .db()
          .newQuery(
            "UPDATE equipments SET availability_status = 'Em uso' WHERE availability_status IS NULL OR availability_status = ''",
          )
          .execute()
      }
    }

    // 2. Se a coleção configuration_items existir, adiciona também para consistência do CMDB
    if (app.hasTable('configuration_items')) {
      var ci = app.findCollectionByNameOrId('configuration_items')
      if (!ci.fields.getByName('availability_status')) {
        ci.fields.add(
          new SelectField({
            name: 'availability_status',
            required: false,
            values: ['Em uso', 'Obsoleto', 'Descartado', 'Disponível', 'Em Estoque'],
            maxSelect: 1,
          }),
        )
        app.save(ci)

        app
          .db()
          .newQuery(
            "UPDATE configuration_items SET availability_status = 'Em uso' WHERE availability_status IS NULL OR availability_status = ''",
          )
          .execute()
      }
    }

    // 3. Registrar o novo Relatório de Ativos (rep_assets) na matriz de permissões para todos os perfis existentes
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      for (var i = 0; i < profiles.length; i++) {
        var prof = profiles[i]
        var profileId = prof.id

        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' + profileId + '" && module_key = "reports" && item_key = "rep_assets"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', 'reports')
          rec.set('item_key', 'rep_assets')
          rec.set('granted', true)
          rec.set('level', 'edit')
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    // Reversão
    if (app.hasTable('equipments')) {
      try {
        var equipments = app.findCollectionByNameOrId('equipments')
        var fld = equipments.fields.getByName('availability_status')
        if (fld) {
          equipments.fields.remove(fld)
          app.save(equipments)
        }
      } catch (_) {}
    }

    if (app.hasTable('configuration_items')) {
      try {
        var ci = app.findCollectionByNameOrId('configuration_items')
        var fldCi = ci.fields.getByName('availability_status')
        if (fldCi) {
          ci.fields.remove(fldCi)
          app.save(ci)
        }
      } catch (_) {}
    }

    if (app.hasTable('profile_permissions')) {
      try {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "reports" AND item_key = "rep_assets"',
          )
          .execute()
      } catch (_) {}
    }
  },
)
