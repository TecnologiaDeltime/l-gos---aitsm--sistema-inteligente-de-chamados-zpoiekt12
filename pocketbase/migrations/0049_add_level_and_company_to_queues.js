migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('queues')

    // Nível de atendimento do contrato ao qual a fila pertence.
    // Opcional (null) para manter compatibilidade com filas existentes.
    if (!col.fields.getByName('level')) {
      col.fields.add(
        new SelectField({
          name: 'level',
          required: false,
          values: ['Nível 1', 'Nível 2', 'Nível 3', 'Consultoria', 'Backoffice', 'Administrativo'],
          maxSelect: 1,
        }),
      )
    }

    // Empresa à qual a fila está vinculada.
    // Opcional (null) para manter compatibilidade com filas existentes.
    if (!col.fields.getByName('company')) {
      col.fields.add(
        new RelationField({
          name: 'company',
          required: false,
          collectionId: app.findCollectionByNameOrId('companies').id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('queues')
    const levelField = col.fields.getByName('level')
    if (levelField) col.fields.remove(levelField)
    const companyField = col.fields.getByName('company')
    if (companyField) col.fields.remove(companyField)
    app.save(col)
  },
)
