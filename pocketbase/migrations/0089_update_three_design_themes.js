migrate(
  (app) => {
    // Atualizar collection design_settings para permitir os 3 novos temas:
    // teal_ops, corporate_blue, amber_alert
    // Mantemos compatibilidade com os anteriores durante migração se necessário
    const col = app.findCollectionByNameOrId('design_settings')
    const themeField = col.fields.getByName('system_theme_variant')
    if (themeField) {
      themeField.values = [
        'teal_ops',
        'corporate_blue',
        'amber_alert',
        // Legados para evitar erro de validação antes de normalizar
        'cyber_cyan',
        'neon_purple',
        'emerald_teal',
        'ice_blue',
        'solar_amber',
        'candy',
      ]
      app.save(col)
    }

    // Normalizar registros existentes que usavam temas legados para 'teal_ops' (padrão)
    // e alinhar as cores de sidebar_bg_color e sidebar_text_color padrão do Teal Ops (#101E20 / #2DD4BF)
    try {
      const records = app.findRecordsByFilter(
        'design_settings',
        "system_theme_variant = 'cyber_cyan' || system_theme_variant = 'neon_purple' || system_theme_variant = 'emerald_teal' || system_theme_variant = 'ice_blue' || system_theme_variant = 'solar_amber' || system_theme_variant = 'candy'",
        '',
        100,
        0,
      )
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        rec.set('system_theme_variant', 'teal_ops')
        rec.set('sidebar_bg_color', '#101E20')
        rec.set('sidebar_text_color', '#2DD4BF')
        app.save(rec)
      }
    } catch (_) {}

    // Agora restringir os valores do select estritamente aos 3 temas do design
    if (themeField) {
      themeField.values = ['teal_ops', 'corporate_blue', 'amber_alert']
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('design_settings')
      const themeField = col.fields.getByName('system_theme_variant')
      if (themeField) {
        themeField.values = [
          'cyber_cyan',
          'neon_purple',
          'emerald_teal',
          'ice_blue',
          'solar_amber',
          'candy',
          'teal_ops',
          'corporate_blue',
          'amber_alert',
        ]
        app.save(col)
      }
    } catch (_) {}
  },
)
