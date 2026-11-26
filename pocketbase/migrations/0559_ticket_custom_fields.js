// Migração 0559: Campos customizados da ficha do chamado.
// 1. custom_field_defs — definições (nome, tipo, opções, ordem, ativo) — somente admin/gestor
// 2. custom_field_values — valor por (ticket, field) — quem edita o chamado preenche
// 3. Item do catálogo de permissões: tickets.campos_customizados_gerenciar
//    (admin/gestor/qualidade concedidos; demais perfis ficam sem — regra permanente do projeto).
//
// Padrão do projeto (v0.0.433): todo o corpo DENTRO do callback do migrate —
// o parâmetro do callback é o app; nada de globais fora dele.
// `field` em custom_field_values é um texto (id da definição) e não uma relação
// auto-referente: relação apontando para a própria coleção recém-criada falha
// na validação de regras do PocketBase ("unknown field").
// `options` é gravado como ARRAY JSON pelo hook (não string).

migrate(
  (db) => {
    var usersCol = db.findCollectionByNameOrId('users')
    var ticketsCol = db.findCollectionByNameOrId('tickets')

    // Definições: listagem para todos logados (a ficha precisa renderizar os campos),
    // mas criar/editar/excluir fica restrito a admin/gestor (dupla barreira com o hook).
    var needsDefs = true
    try {
      db.findCollectionByNameOrId('custom_field_defs')
      needsDefs = false
    } catch (_) {}

    if (needsDefs) {
      var defsCol = new Collection({
        name: 'custom_field_defs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          { name: 'name', type: 'text', required: true, maxSize: 120 },
          {
            name: 'field_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['texto_curto', 'texto_longo', 'numero', 'data', 'selecao', 'sim_nao'],
          },
          { name: 'options', type: 'json', required: false, maxSize: 20000 },
          { name: 'sort_order', type: 'number', required: false, onlyInt: true },
          { name: 'active', type: 'bool', required: false },
          {
            name: 'created_by',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            minSelect: 0,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_custom_field_defs_active ON custom_field_defs (active)'],
      })
      db.save(defsCol)
    }

    // Valores: um registro por (ticket, field). Quem acessa chamados lê; update restrito
    // a admin/gestor/técnico/qualidade (a ficha é operada por quem atende).
    var needsValues = true
    try {
      db.findCollectionByNameOrId('custom_field_values')
      needsValues = false
    } catch (_) {}

    if (needsValues) {
      var valuesCol = new Collection({
        name: 'custom_field_values',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico' || @request.auth.role = 'qualidade')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico' || @request.auth.role = 'qualidade')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          {
            name: 'ticket',
            type: 'relation',
            required: true,
            collectionId: ticketsCol.id,
            minSelect: 1,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'field_id',
            type: 'text',
            required: true,
            maxSize: 40,
          },
          { name: 'value_text', type: 'text', required: false, maxSize: 8000 },
          { name: 'value_number', type: 'number', required: false },
          { name: 'value_date', type: 'date', required: false },
          { name: 'value_bool', type: 'bool', required: false },
          {
            name: 'created_by',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            minSelect: 0,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_custom_field_values_unique ON custom_field_values (ticket, field_id)',
          'CREATE INDEX idx_custom_field_values_ticket ON custom_field_values (ticket)',
          'CREATE INDEX idx_custom_field_values_field ON custom_field_values (field_id)',
        ],
      })
      db.save(valuesCol)
    }

    // ------------------------------------------------------------- permissões
    // Regra permanente: item novo no catálogo. Admin sempre tem (resolve no
    // frontend/hook mesmo sem linha); concedemos explicitamente a admin/gestor/qualidade.
    if (db.hasTable('profile_permissions') && db.hasTable('profiles')) {
      var profiles = db.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = db.findCollectionByNameOrId('profile_permissions')
      var moduleKey = 'tickets'
      var itemKey = 'campos_customizados_gerenciar'

      for (var i = 0; i < profiles.length; i++) {
        var profName = (profiles[i].getString('name') || '').toLowerCase()
        var granted = false
        var assignedLevel = 'view'
        if (profName.includes('admin')) {
          granted = true
          assignedLevel = 'configure'
        } else if (profName.includes('gestor') || profName.includes('qualidade')) {
          granted = true
          assignedLevel = 'edit'
        }

        var existing = db.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profiles[i].id +
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
          rec.set('profile', profiles[i].id)
          rec.set('module_key', moduleKey)
          rec.set('item_key', itemKey)
          rec.set('granted', granted)
          rec.set('level', assignedLevel)
          db.save(rec)
        }
      }
    }
  },
  (db) => {
    try {
      var col = db.findCollectionByNameOrId('custom_field_values')
      if (col) db.delete(col)
    } catch (_) {}
    try {
      var col2 = db.findCollectionByNameOrId('custom_field_defs')
      if (col2) db.delete(col2)
    } catch (_) {}
    if (db.hasTable('profile_permissions')) {
      db.db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "tickets" AND item_key = "campos_customizados_gerenciar"',
        )
        .execute()
    }
  },
)
