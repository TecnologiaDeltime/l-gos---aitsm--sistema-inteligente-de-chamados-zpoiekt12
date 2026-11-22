migrate(
  (app) => {
    // Correção da stash temporária: o cron do hook falhava com
    // "content: Must be no more than 5000 character(s)" (maxSize do text
    // tem teto de 5000 no PocketBase, não 30000) e "idx: cannot be blank"
    // (idx=0 é tratado como vazio). Reduz a fatia para 4000 chars e remove
    // o required de idx (o hook já grava idx numérico; 0 passa a ser aceito).
    const collection = app.findCollectionByNameOrId('gh_restore_stash')
    const idxField = collection.fields.getByName('idx')
    if (idxField) {
      idxField.required = false
    }
    const contentField = collection.fields.getByName('content')
    if (contentField) {
      contentField.required = false
      contentField.maxSize = 5000
    }
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('gh_restore_stash')
    const idxField = collection.fields.getByName('idx')
    if (idxField) {
      idxField.required = true
    }
    const contentField = collection.fields.getByName('content')
    if (contentField) {
      contentField.required = true
      contentField.maxSize = 30000
    }
    app.save(collection)
  },
)
