/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0105: Limpeza do item 'painel_gerencial' na coleção 'profile_permissions'
 *
 * Remove os registros órfãos de permissão correspondentes ao 'painel_gerencial' que foi
 * retirado da interface do sistema.
 */
migrate(
  (app) => {
    try {
      const records = app.findRecordsByFilter(
        'profile_permissions',
        'item_key = "painel_gerencial"',
        '',
        0,
        0,
      )
      for (const record of records) {
        try {
          app.delete(record)
        } catch (delErr) {
          console.log('Erro ao remover permissão painel_gerencial:', delErr)
        }
      }
    } catch (err) {
      console.log('Erro ao buscar registros painel_gerencial:', err)
    }
  },
  (app) => {
    // Reverter recriando itens para os perfis existentes se necessário
    try {
      const allProfiles = app.findRecordsByFilter('profiles', '', '', 0, 0)
      const permCollection = app.findCollectionByNameOrId('profile_permissions')
      allProfiles.forEach((prof) => {
        try {
          const rec = new Record(permCollection)
          rec.set('profile', prof.id)
          rec.set('module_key', 'dashboard')
          rec.set('item_key', 'painel_gerencial')
          rec.set('granted', true)
          rec.set('level', 'edit')
          app.save(rec)
        } catch (_) {}
      })
    } catch (_) {}
  },
)
