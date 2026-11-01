/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0104: Garante a coluna 'level' em profile_permissions e backfill de registros
 *
 * Adiciona o campo 'level' na coleção 'profile_permissions' usando collection.fields.addAt
 * e popula:
 * - Se perfil é Administrador => level = 'configure'
 * - Se concedido (granted !== false) => level = 'edit'
 * - Se não concedido => level = 'view' ou null
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('profile_permissions')

    let hasLevel = false
    try {
      const f = collection.fields.getByName('level')
      if (f) hasLevel = true
    } catch (_) {
      hasLevel = false
    }

    if (!hasLevel) {
      collection.fields.addAt(
        collection.fields.length,
        new SelectField({
          name: 'level',
          required: false,
          maxSelect: 1,
          values: ['view', 'edit', 'configure'],
        }),
      )
      app.save(collection)
    }

    // Identifica perfil Administrador
    let adminProfileId = null
    try {
      const adminRecord = app.findFirstRecordByFilter(
        'profiles',
        'name = "Administrador" || is_system = true',
      )
      if (adminRecord) {
        adminProfileId = adminRecord.id
      }
    } catch (_) {}

    // Backfill em profile_permissions
    try {
      const records = app.findRecordsByFilter('profile_permissions', '', '', 0, 0)
      for (const record of records) {
        const currentLevel = record.getString('level')
        const isGranted = record.getBool('granted')
        const profileId = record.getString('profile')

        if (!currentLevel) {
          if (adminProfileId && profileId === adminProfileId) {
            record.set('level', 'configure')
            record.set('granted', true)
          } else if (isGranted) {
            record.set('level', 'edit')
          } else {
            record.set('level', 'view')
          }
          app.save(record)
        }
      }
    } catch (err) {
      console.log('Erro no backfill 0104:', err)
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('profile_permissions')
      collection.fields.removeByName('level')
      app.save(collection)
    } catch (_) {}
  },
)
