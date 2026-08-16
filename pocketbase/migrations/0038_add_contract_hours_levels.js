migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contracts')

    // Distribuição de Horas por Nível de Atendimento
    // Cada campo armazena a quantidade de horas acordadas para o nível, ou null se não contratado.
    const levelFields = [
      'hours_level1',
      'hours_level2',
      'hours_level3',
      'hours_consultoria',
      'hours_backoffice',
      'hours_administrativo',
    ]

    levelFields.forEach((name) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(
          new NumberField({
            name: name,
            required: false,
          }),
        )
      }
    })

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contracts')
    const levelFields = [
      'hours_level1',
      'hours_level2',
      'hours_level3',
      'hours_consultoria',
      'hours_backoffice',
      'hours_administrativo',
    ]
    levelFields.forEach((name) => {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    })
    app.save(col)
  },
)
