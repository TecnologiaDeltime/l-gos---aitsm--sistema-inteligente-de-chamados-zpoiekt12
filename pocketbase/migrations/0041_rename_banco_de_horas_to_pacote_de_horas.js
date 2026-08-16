migrate(
  (app) => {
    var newValues = [
      'Pacote Mensal',
      'Por Chamado',
      'Ilimitado',
      'Pacote de Horas',
      'Projeto',
      'Sustentação Mensal',
      'Atendimento Avulso',
      'Híbrido',
    ]

    // Renomeia registros existentes que usam o rótulo antigo.
    app
      .db()
      .newQuery("UPDATE contracts SET type = 'Pacote de Horas' WHERE type = 'Banco de Horas'")
      .execute()

    var col = app.findCollectionByNameOrId('contracts')
    col.fields.removeByName('type')
    col.fields.add(new SelectField({ name: 'type', values: newValues, maxSelect: 1 }))
    app.save(col)
  },
  (app) => {
    var oldValues = [
      'Pacote Mensal',
      'Por Chamado',
      'Ilimitado',
      'Banco de Horas',
      'Projeto',
      'Sustentação Mensal',
      'Atendimento Avulso',
      'Híbrido',
    ]

    app
      .db()
      .newQuery("UPDATE contracts SET type = 'Banco de Horas' WHERE type = 'Pacote de Horas'")
      .execute()

    var col = app.findCollectionByNameOrId('contracts')
    col.fields.removeByName('type')
    col.fields.add(new SelectField({ name: 'type', values: oldValues, maxSelect: 1 }))
    app.save(col)
  },
)
