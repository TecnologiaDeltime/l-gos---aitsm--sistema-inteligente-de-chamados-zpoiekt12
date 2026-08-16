migrate(
  (app) => {
    // Campo JSON para armazenar acordos de atendimento personalizados cadastrados
    // pelo usuário (além dos 6 níveis fixos: Nível 1, 2, 3, Consultoria, Backoffice, Administrativo).
    // Cada item: { slug, name, hours, active }
    const col = app.findCollectionByNameOrId('contracts')

    if (!col.fields.getByName('custom_agreements')) {
      col.fields.add(
        new JSONField({
          name: 'custom_agreements',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contracts')
    const f = col.fields.getByName('custom_agreements')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
