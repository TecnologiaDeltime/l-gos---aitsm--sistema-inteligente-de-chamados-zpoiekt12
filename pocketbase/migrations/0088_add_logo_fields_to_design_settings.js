migrate(
  (app) => {
    // Adiciona os campos de logotipo no design_settings:
    // 1. logo: logotipo principal da empresa (menu lateral, topo, tela de login)
    // 2. report_logo: logotipo para documentos, relatórios, PDFs e dashboards
    const col = app.findCollectionByNameOrId('design_settings')

    if (!col.fields.getByName('logo')) {
      col.fields.add(
        new FileField({
          name: 'logo',
          maxSelect: 1,
          maxSize: 2097152, // 2MB
          mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
        }),
      )
    }

    if (!col.fields.getByName('report_logo')) {
      col.fields.add(
        new FileField({
          name: 'report_logo',
          maxSelect: 1,
          maxSize: 2097152, // 2MB
          mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('design_settings')
      col.fields.removeByName('logo')
      col.fields.removeByName('report_logo')
      app.save(col)
    } catch (_) {}
  },
)
