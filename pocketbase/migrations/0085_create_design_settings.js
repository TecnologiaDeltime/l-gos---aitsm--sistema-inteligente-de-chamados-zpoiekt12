migrate(
  (app) => {
    // Criar coleção design_settings para salvar personalização visual do sistema
    // (cor da barra lateral, cor dos textos/ícones da barra e variação de tema do sistema)
    try {
      if (app.findCollectionByNameOrId('design_settings')) {
        return
      }
    } catch (_) {
      // Collection does not exist yet, proceed to create
    }

    const designCol = new Collection({
      name: 'design_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      updateRule:
        '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
      deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
      fields: [
        {
          name: 'sidebar_bg_color',
          type: 'text',
          required: false,
        },
        {
          name: 'sidebar_text_color',
          type: 'text',
          required: false,
        },
        {
          name: 'system_theme_variant',
          type: 'select',
          required: false,
          values: ['cyber_cyan', 'neon_purple', 'emerald_teal'],
          maxSelect: 1,
        },
        {
          name: 'scope',
          type: 'select',
          required: false,
          values: ['global'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_design_settings_scope ON design_settings (scope)'],
    })
    app.save(designCol)

    // Seed com valores padrão do dark tech
    try {
      app.findFirstRecordByData('design_settings', 'scope', 'global')
    } catch (_) {
      const rec = new Record(designCol)
      rec.set('sidebar_bg_color', '#070b14') // dark tech profundo padrão
      rec.set('sidebar_text_color', '#22d3ee') // ciano neon padrão
      rec.set('system_theme_variant', 'cyber_cyan')
      rec.set('scope', 'global')
      app.save(rec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('design_settings')
      app.delete(col)
    } catch (_) {}
  },
)
