/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0103: Evolução dos níveis de permissão em profile_permissions
 *
 * Adiciona o campo 'level' (select: 'view' | 'edit' | 'configure') na coleção 'profile_permissions'
 * e migra de forma idempotente e conservadora os registros existentes:
 * - Se granted === false => level = null / apagado ou mantido 'view' com granted=false
 * - Se granted === true e perfil é Administrador => level = 'configure'
 * - Se granted === true e perfil NÃO é Administrador => level = 'edit' (conservador, sem perda de edição)
 *
 * Itens concedidos continuam com granted = true para retrocompatibilidade.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('profile_permissions')

    // Adiciona campo 'level' se não existir
    let hasLevel = false
    try {
      collection.fields.getByName('level')
      hasLevel = true
    } catch (_) {
      hasLevel = false
    }

    if (!hasLevel) {
      collection.fields.add(
        new SelectField({
          name: 'level',
          required: false,
          maxSelect: 1,
          values: ['view', 'edit', 'configure'],
        }),
      )
      app.save(collection)
    }

    // Identifica perfil Administrador para conceder 'configure'
    let adminProfileId = null
    try {
      const adminRecord = app.findFirstRecordByFilter(
        'profiles',
        'name = "Administrador" || is_system = true',
      )
      if (adminRecord) {
        adminProfileId = adminRecord.id
      }
    } catch (_) {
      // segue sem erro se não encontrar
    }

    // Backfill dos registros existentes em profile_permissions
    const records = app.findAllRecords('profile_permissions')
    for (const record of records) {
      const currentLevel = record.get('level')
      const isGranted = record.getBool('granted')
      const profileId = record.getString('profile')

      if (!currentLevel && isGranted) {
        if (adminProfileId && profileId === adminProfileId) {
          record.set('level', 'configure')
        } else {
          record.set('level', 'edit')
        }
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('profile_permissions')
      const levelField = collection.fields.getByName('level')
      if (levelField) {
        collection.fields.removeByName('level')
        app.save(collection)
      }
    } catch (_) {}
  },
)
