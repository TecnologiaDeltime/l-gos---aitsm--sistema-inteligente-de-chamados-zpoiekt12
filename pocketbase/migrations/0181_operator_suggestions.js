migrate(
  (app) => {
    // Migração 0181: Área de Sugestões dos Operadores
    // 1. Cria a coleção 'suggestions' (título, descrição, categoria, autor, status,
    //    motivo da recusa, resposta da gestão e janela de implantação vinculada a uma mudança).
    // 2. Registra a permissão 'suggestions_gerenciar' no catálogo (módulo 'suggestions'),
    //    concedida por padrão a perfis administrativos (admin/gestor) — operadores comuns
    //    nascem sem gestão (só enviam/acompanham).
    var usersCol = app.findCollectionByNameOrId('users')

    var needsCreate = true
    try {
      app.findCollectionByNameOrId('suggestions')
      needsCreate = false
    } catch (_) {}

    if (needsCreate) {
      var collection = new Collection({
        name: 'suggestions',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.body.author = @request.auth.id",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || (author = @request.auth.id && status = 'pendente'))",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'title', type: 'text', required: true, maxSize: 200 },
          { name: 'description', type: 'text', required: true, maxSize: 8000 },
          {
            name: 'category',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['processo', 'sistema', 'automacao', 'infraestrutura', 'outro'],
          },
          {
            name: 'author',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            minSelect: 1,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'aceita', 'negada', 'implantada'],
          },
          { name: 'admin_reply', type: 'text', required: false, maxSize: 4000 },
          { name: 'reject_reason', type: 'text', required: false, maxSize: 4000 },
          {
            name: 'change_window',
            type: 'relation',
            required: false,
            collectionId: '',
            minSelect: 0,
            maxSelect: 1,
          },
          { name: 'implantation_date', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_suggestions_author ON suggestions (author)',
          'CREATE INDEX idx_suggestions_status ON suggestions (status)',
        ],
      })

      // Ajusta a relação para a coleção real 'changes' (janela de implantação)
      var changesCol = app.findCollectionByNameOrId('changes')
      var changeField = collection.fields.getByName('change_window')
      if (changeField) {
        changeField.collectionId = changesCol.id
      }
      app.save(collection)
    }

    // Permissão no catálogo (padrão 0169): admin/gestor gerenciam; demais nascem sem gestão
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var moduleKey = 'suggestions'

      // Dois itens: enviar/ver (todos) e gerenciar (admin/gestor/qualidade)
      var items = [
        { key: 'suggestions_enviar', mgmt: false },
        { key: 'suggestions_gerenciar', mgmt: true },
      ]

      for (var i = 0; i < profiles.length; i++) {
        var profileId = profiles[i].id
        var profName = (profiles[i].getString('name') || '').toLowerCase()

        for (var j = 0; j < items.length; j++) {
          var itemKey = items[j].key

          var granted = !items[j].mgmt
          var assignedLevel = 'edit'
          if (items[j].mgmt) {
            if (profName.includes('admin')) {
              granted = true
              assignedLevel = 'configure'
            } else if (profName.includes('gestor') || profName.includes('qualidade')) {
              granted = true
              assignedLevel = 'edit'
            }
          }

          var existing = app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profileId +
              '" && module_key = "' +
              moduleKey +
              '" && item_key = "' +
              itemKey +
              '"',
            '',
            1,
            0,
          )

          if (existing.length === 0) {
            var rec = new Record(permCol)
            rec.set('profile', profileId)
            rec.set('module_key', moduleKey)
            rec.set('item_key', itemKey)
            rec.set('granted', granted)
            rec.set('level', assignedLevel)
            app.save(rec)
          }
        }
      }
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('suggestions')
      if (col) app.delete(col)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "suggestions" AND item_key IN ("suggestions_gerenciar", "suggestions_enviar")',
        )
        .execute()
    }
  },
)
