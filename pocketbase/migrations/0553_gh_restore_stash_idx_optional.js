/**
 * 0553 — Corrige a recriação da 0551: o campo `idx` voltou como required,
 * e o PocketBase trata número 0 como vazio em campo required ("idx: cannot
 * be blank"), o que faz TODA gravação do hook A0_gh_restore_tmp falhar no
 * primeiro chunk (idx=0) de cada arquivo. Remove o required (mesma correção
 * já feita pela 0506) e normaliza o content para o teto real do text (5000).
 */
migrate(
  (app) => {
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
