migrate(
  (app) => {
    const kb = app.findCollectionByNameOrId('knowledge_articles')
    const tktCategories = app.findCollectionByNameOrId('tkt_categories')

    if (!kb.fields.getByName('content_html')) {
      kb.fields.add(
        new TextField({
          name: 'content_html',
          required: false,
        }),
      )
    }

    if (!kb.fields.getByName('attachment')) {
      kb.fields.add(
        new FileField({
          name: 'attachment',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
        }),
      )
    }

    if (!kb.fields.getByName('attachment_name')) {
      kb.fields.add(
        new TextField({
          name: 'attachment_name',
          required: false,
        }),
      )
    }

    if (!kb.fields.getByName('tokens')) {
      kb.fields.add(
        new JSONField({
          name: 'tokens',
          required: false,
        }),
      )
    }

    if (!kb.fields.getByName('activity')) {
      kb.fields.add(
        new RelationField({
          name: 'activity',
          collectionId: tktCategories.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    kb.addIndex('idx_kb_activity', false, 'activity', '')
    app.save(kb)
  },
  (app) => {
    try {
      const kb = app.findCollectionByNameOrId('knowledge_articles')
      const fieldsToRemove = ['content_html', 'attachment', 'attachment_name', 'tokens', 'activity']
      fieldsToRemove.forEach((f) => {
        const field = kb.fields.getByName(f)
        if (field) {
          kb.fields.remove(field)
        }
      })
      kb.removeIndex('idx_kb_activity')
      app.save(kb)
    } catch (_) {}
  },
)
