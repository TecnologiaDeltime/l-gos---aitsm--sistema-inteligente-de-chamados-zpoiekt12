// Migração 0557: votos nas sugestões da Área de Sugestões.
// Cria a coleção 'suggestion_votes' (um voto por usuário por sugestão, garantido
// por índice único suggestion+voter). O próprio usuário cria/remove o voto;
// a contagem é visível para todos os logados (list/view). Idempotente: em uma
// base vazia (sem 'suggestions') a criação é pulada e a migração é no-op.
migrate(
  (app) => {
    var suggestionsCol
    try {
      suggestionsCol = app.findCollectionByNameOrId('suggestions')
    } catch (_) {
      // Base vazia (replay em cópia/template): nada a fazer.
      return
    }

    var usersCol = app.findCollectionByNameOrId('users')

    var needsCreate = true
    try {
      app.findCollectionByNameOrId('suggestion_votes')
      needsCreate = false
    } catch (_) {}

    if (needsCreate) {
      var collection = new Collection({
        name: 'suggestion_votes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && @request.body.suggestion != '' && @request.body.voter = @request.auth.id",
        updateRule: null,
        deleteRule: "@request.auth.id != '' && voter = @request.auth.id",
        fields: [
          {
            name: 'suggestion',
            type: 'relation',
            required: true,
            collectionId: suggestionsCol.id,
            minSelect: 1,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'voter',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            minSelect: 1,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_suggestion_votes_pair ON suggestion_votes (suggestion, voter)',
          'CREATE UNIQUE INDEX idx_suggestion_votes_pair_uniq ON suggestion_votes (suggestion, voter)',
          'CREATE INDEX idx_suggestion_votes_voter ON suggestion_votes (voter)',
        ],
      })
      app.save(collection)
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('suggestion_votes')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
