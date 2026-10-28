/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0091: Atualização da barra lateral do sistema ITSM para grafite escuro #17181C.
 *
 * 1. Atualiza registros existentes em 'design_settings' para:
 *    - sidebar_bg_color: '#17181C' (mesma cor grafite do fundo do sistema)
 *    - sidebar_text_color: '#FCD34D' (âmbar suave/legível sobre o grafite)
 *    - system_theme_variant: 'amber_alert'
 * 2. Totalmente idempotente e seguro em banco vazio.
 */
migrate(
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('design_settings')
      if (!collection) {
        return
      }

      const records = app.findRecordsByFilter(
        'design_settings',
        "scope = 'global' || id != ''",
        '-created',
        50,
      )

      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        rec.set('system_theme_variant', 'amber_alert')
        rec.set('sidebar_bg_color', '#17181C')
        rec.set('sidebar_text_color', '#FCD34D')
        app.save(rec)
      }
    } catch (err) {
      console.log('Migração 0091 notice:', err)
    }
  },
  (app) => {
    // Reversão opcional (não destrutiva)
    try {
      const records = app.findRecordsByFilter(
        'design_settings',
        "scope = 'global' || id != ''",
        '-created',
        50,
      )
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        rec.set('sidebar_bg_color', '#FFFFFF')
        rec.set('sidebar_text_color', '#92400E')
        app.save(rec)
      }
    } catch (e) {
      // noop
    }
  },
)
