migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('approval_configs')
    if (col.fields.getByName('activity')) {
      col.fields.removeByName('activity')
      col.fields.add(
        new RelationField({
          name: 'activity',
          collectionId: app.findCollectionByNameOrId('tkt_categories').id,
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('approval_configs')
    if (col.fields.getByName('activity')) {
      col.fields.removeByName('activity')
      col.fields.add(
        new RelationField({
          name: 'activity',
          collectionId: app.findCollectionByNameOrId('tkt_categories').id,
          required: true,
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
)
