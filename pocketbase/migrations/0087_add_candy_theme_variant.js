migrate(
  (app) => {
    // Atualizar collection design_settings para incluir a nova opção 'candy' no select system_theme_variant
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
      ]
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('design_settings')
      const themeField = col.fields.getByName('system_theme_variant')
      if (themeField) {
        themeField.values = ['cyber_cyan', 'neon_purple', 'emerald_teal', 'ice_blue', 'solar_amber']
        app.save(col)
      }
    } catch (_) {}
  },
)
