migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('equipments')

    const newFields = [
      { name: 'hostname', type: 'text' },
      { name: 'device_type', type: 'text' },
      { name: 'processor', type: 'text' },
      { name: 'processor_cores', type: 'text' },
      { name: 'owner', type: 'text' },
      { name: 'storage', type: 'text' },
      { name: 'storage_type', type: 'text' },
      { name: 'ram_total', type: 'text' },
    ]

    newFields.forEach((f) => {
      if (!col.fields.getByName(f.name)) {
        col.fields.add(new TextField({ name: f.name }))
      }
    })

    col.addIndex('idx_equipments_hostname', false, 'hostname', '')
    col.addIndex('idx_equipments_device_type', false, 'device_type', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('equipments')

    ;[
      'hostname',
      'device_type',
      'processor',
      'processor_cores',
      'owner',
      'storage',
      'storage_type',
      'ram_total',
    ].forEach((name) => {
      if (col.fields.getByName(name)) col.fields.removeByName(name)
    })

    col.removeIndex('idx_equipments_hostname')
    col.removeIndex('idx_equipments_device_type')

    app.save(col)
  },
)
