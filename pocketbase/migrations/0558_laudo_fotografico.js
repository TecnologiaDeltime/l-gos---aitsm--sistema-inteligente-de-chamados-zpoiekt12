migrate(
  (app) => {
    // Migração 0558: Módulo Laudos Fotográficos de Visitas Preventivas
    // 1. checklist_templates  — templates de checklist por cliente (ambientes + itens em JSON)
    // 2. laudos               — laudo fotográfico de uma visita preventiva (cliente, técnico, status, assinatura)
    // 3. laudo_ambientes      — execução por ambiente do laudo (checklist + fotos antes/depois)
    // 4. Registra permissões no catálogo (módulo 'laudos'): laudos_enviar (técnicos) e laudos_gerenciar (admin/qualidade).

    var usersCol = app.findCollectionByNameOrId('users')
    var companiesCol = app.findCollectionByNameOrId('companies')

    // ---------------------------------------------------------------- collections

    var needsTemplates = true
    try {
      app.findCollectionByNameOrId('checklist_templates')
      needsTemplates = false
    } catch (_) {}

    if (needsTemplates) {
      var templatesCol = new Collection({
        name: 'checklist_templates',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          { name: 'title', type: 'text', required: true, maxSize: 200 },
          { name: 'description', type: 'text', required: false, maxSize: 2000 },
          {
            name: 'company',
            type: 'relation',
            required: false,
            collectionId: companiesCol.id,
            minSelect: 0,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'ambients',
            type: 'json',
            required: true,
            maxSize: 2000000,
          },
          {
            name: 'active',
            type: 'bool',
            required: false,
          },
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
        indexes: ['CREATE INDEX idx_checklist_templates_company ON checklist_templates (company)'],
      })
      app.save(templatesCol)
    }

    var needsLaudos = true
    try {
      app.findCollectionByNameOrId('laudos')
      needsLaudos = false
    } catch (_) {}

    if (needsLaudos) {
      var laudosCol = new Collection({
        name: 'laudos',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && @request.body.technician = @request.auth.id && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico' || @request.auth.role = 'qualidade')",
        updateRule:
          "@request.auth.id != '' && (technician = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'gestor') && status != 'concluido'",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        fields: [
          { name: 'title', type: 'text', required: true, maxSize: 200 },
          { name: 'description', type: 'text', required: false, maxSize: 4000 },
          {
            name: 'company',
            type: 'relation',
            required: true,
            collectionId: companiesCol.id,
            minSelect: 1,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'technician',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            minSelect: 1,
            maxSelect: 1,
          },
          {
            name: 'template',
            type: 'relation',
            required: false,
            collectionId: app.findCollectionByNameOrId('checklist_templates').id,
            minSelect: 0,
            maxSelect: 1,
          },
          {
            name: 'visit_date',
            type: 'date',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['rascunho', 'em_andamento', 'concluido'],
          },
          { name: 'companion_name', type: 'text', required: false, maxSize: 200 },
          { name: 'companion_role', type: 'text', required: false, maxSize: 200 },
          {
            name: 'companion_signature',
            type: 'file',
            required: false,
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['image/png'],
          },
          { name: 'signed_at', type: 'date', required: false },
          { name: 'final_notes', type: 'text', required: false, maxSize: 4000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_laudos_company ON laudos (company)',
          'CREATE INDEX idx_laudos_technician ON laudos (technician)',
          'CREATE INDEX idx_laudos_status ON laudos (status)',
        ],
      })
      app.save(laudosCol)
    }

    var needsAmbientes = true
    try {
      app.findCollectionByNameOrId('laudo_ambientes')
      needsAmbientes = false
    } catch (_) {}

    if (needsAmbientes) {
      var ambientesCol = new Collection({
        name: 'laudo_ambientes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico' || @request.auth.role = 'qualidade')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || laudo.technician = @request.auth.id) && laudo.status != 'concluido'",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || laudo.technician = @request.auth.id) && laudo.status != 'concluido'",
        fields: [
          {
            name: 'laudo',
            type: 'relation',
            required: true,
            collectionId: app.findCollectionByNameOrId('laudos').id,
            minSelect: 1,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'ambient_name', type: 'text', required: true, maxSize: 200 },
          { name: 'sort_order', type: 'number', required: false, onlyInt: true },
          { name: 'checklist_items', type: 'json', required: false, maxSize: 1000000 },
          { name: 'observations', type: 'text', required: false, maxSize: 4000 },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'em_andamento', 'concluido'],
          },
          {
            name: 'photos_before',
            type: 'file',
            required: false,
            maxSelect: 10,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          {
            name: 'photos_after',
            type: 'file',
            required: false,
            maxSelect: 10,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_laudo_ambientes_laudo ON laudo_ambientes (laudo)'],
      })
      app.save(ambientesCol)
    }

    // ------------------------------------------------------------- permissões

    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var moduleKey = 'laudos'
      var items = [
        { key: 'laudos_enviar', mgmt: false },
        { key: 'laudos_gerenciar', mgmt: true },
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
      var col = app.findCollectionByNameOrId('laudo_ambientes')
      if (col) app.delete(col)
    } catch (_) {}
    try {
      var col2 = app.findCollectionByNameOrId('laudos')
      if (col2) app.delete(col2)
    } catch (_) {}
    try {
      var col3 = app.findCollectionByNameOrId('checklist_templates')
      if (col3) app.delete(col3)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "laudos" AND item_key IN ("laudos_gerenciar", "laudos_enviar")',
        )
        .execute()
    }
  },
)
