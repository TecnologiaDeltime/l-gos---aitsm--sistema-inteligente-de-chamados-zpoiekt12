/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0090: Atualização do tema padrão do ITSM para Amber Alert.
 *
 * 1. Garante os valores válidos no campo select 'system_theme_variant' da coleção 'design_settings':
 *    'amber_alert', 'amber_light', 'corporate_blue', 'teal_ops'.
 * 2. Converte registros legados ou que ainda apontam para 'teal_ops' para 'amber_alert',
 *    com barra lateral branca (#FFFFFF) e letras âmbar (#92400E).
 * 3. Preserva explicitamente quando o usuário selecionou 'corporate_blue'.
 * 4. Totalmente idempotente e seguro em banco vazio.
 */
migrate(
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('design_settings')
      if (!collection) {
        return
      }

      // Atualiza os valores permitidos do select system_theme_variant
      let fieldUpdated = false
      const themeField = collection.fields.getByName('system_theme_variant')
      if (themeField) {
        themeField.values = ['amber_alert', 'amber_light', 'corporate_blue', 'teal_ops']
        fieldUpdated = true
      }

      if (fieldUpdated) {
        app.save(collection)
      }

      // Atualiza registros existentes que estejam com teal_ops ou legados para amber_alert
      const records = app.findRecordsByFilter(
        'design_settings',
        "system_theme_variant = 'teal_ops' || system_theme_variant = '' || system_theme_variant = null || system_theme_variant = 'emerald_teal' || system_theme_variant = 'cyber_cyan' || system_theme_variant = 'solar_amber' || system_theme_variant = 'candy'",
        '-created',
        50,
      )

      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        rec.set('system_theme_variant', 'amber_alert')
        rec.set('sidebar_bg_color', '#FFFFFF')
        rec.set('sidebar_text_color', '#92400E')
        app.save(rec)
      }
    } catch (err) {
      console.log('Migração 0090 notice:', err)
    }
  },
  (app) => {
    // Reversão opcional (não destrutiva)
    try {
      const collection = app.findCollectionByNameOrId('design_settings')
      if (!collection) return
      const themeField = collection.fields.getByName('system_theme_variant')
      if (themeField) {
        themeField.values = ['teal_ops', 'corporate_blue', 'amber_alert']
        app.save(collection)
      }
    } catch (e) {
      // noop
    }
  },
)
