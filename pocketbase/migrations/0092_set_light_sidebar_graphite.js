/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0092: Atualização da barra lateral do modo claro para grafite escuro #17181C
 * com letras e ícones em branco #FFFFFF.
 *
 * Atualiza registros existentes em 'design_settings' com:
 * - sidebar_bg_color: '#17181C' (mesmo grafite do modo escuro)
 * - sidebar_text_color: '#FFFFFF' (branco puro para alto contraste)
 *
 * Idempotente e seguro em banco vazio.
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
        const variant = rec.getString('system_theme_variant')
        const currentBg = rec.getString('sidebar_bg_color')

        // Se for modo claro ou estiver com o marrom antigo #3D2314
        if (variant === 'amber_light' || currentBg.toUpperCase() === '#3D2314') {
          rec.set('sidebar_bg_color', '#17181C')
          rec.set('sidebar_text_color', '#FFFFFF')
          app.save(rec)
        }
      }
    } catch (err) {
      console.log('Migração 0092 notice:', err)
    }
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter(
        'design_settings',
        "scope = 'global' || id != ''",
        '-created',
        50,
      )
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        const variant = rec.getString('system_theme_variant')
        if (variant === 'amber_light') {
          rec.set('sidebar_bg_color', '#3D2314')
          rec.set('sidebar_text_color', '#FFFFFF')
          app.save(rec)
        }
      }
    } catch (e) {
      // noop
    }
  },
)
