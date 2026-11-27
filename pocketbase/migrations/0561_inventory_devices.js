// Migração 0561: Inventário de Aparelhos (celulares e câmeras).
// 1. inventory_devices — cadastro de aparelhos usados pela empresa/equipe
//    (tipo, marca, modelo, serial/IMEI, estado, status, responsável, observação).
//    NUNCA se apaga registro: desativar = status 'desativado' (histórico preservado).
// 2. Item do catálogo de permissões: inventory.inventario_gerenciar
//    (cadastrar/editar/desativar — admin/gestor por padrão). Leitura para todos
//    os logados via regras da coleção + item inventory.inventario_consultar.
//
// Padrão do projeto (v0.0.433): todo o corpo DENTRO do callback do migrate —
// o parâmetro do callback é o app; nada de globais fora dele.

migrate(
  (db) => {
    var usersCol = db.findCollectionByNameOrId('users')

    var needsDevices = true
    try {
      db.findCollectionByNameOrId('inventory_devices')
      needsDevices = false
    } catch (_) {}

    if (needsDevices) {
      var devCol = new Collection({
        name: 'inventory_devices',
        type: 'base',
        // Leitura para todos os logados (consulta); escrita só admin/gestor —
        // o hook A0_inventory.js valida a permissão granular por cima disso.
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor')",
        deleteRule: null,
        fields: [
          {
            name: 'device_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['celular', 'camera'],
          },
          { name: 'brand', type: 'text', required: true, maxSize: 80 },
          { name: 'model', type: 'text', required: true, maxSize: 120 },
          { name: 'serial_number', type: 'text', required: false, maxSize: 120 },
          { name: 'phone_number', type: 'text', required: false, maxSize: 40 },
          {
            name: 'condition',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['novo', 'uso'],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['disponivel', 'em_uso', 'manutencao', 'desativado'],
          },
          {
            name: 'assigned_to',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            minSelect: 0,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'notes', type: 'text', required: false, maxSize: 2000 },
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
          'CREATE INDEX idx_inventory_devices_type ON inventory_devices (device_type)',
          'CREATE INDEX idx_inventory_devices_status ON inventory_devices (status)',
          'CREATE INDEX idx_inventory_devices_serial ON inventory_devices (serial_number)',
        ],
      })
      db.save(devCol)
    }

    // ------------------------------------------------------------- permissões
    // Regra permanente: funcionalidade nova = item no catálogo. Concessões:
    // admin (configure), gestor (edit), qualidade/tecnico (leitura via inventario_consultar).
    if (db.hasTable('profile_permissions') && db.hasTable('profiles')) {
      var profiles = db.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = db.findCollectionByNameOrId('profile_permissions')
      var moduleKey = 'inventory'

      var perms = [
        { itemKey: 'inventario_gerenciar', roles: ['admin', 'gestor'] },
        { itemKey: 'inventario_consultar', roles: ['admin', 'gestor', 'qualidade', 'tecnico'] },
      ]

      for (var p = 0; p < perms.length; p++) {
        var itemKey = perms[p].itemKey
        for (var i = 0; i < profiles.length; i++) {
          var profName = (profiles[i].getString('name') || '').toLowerCase()
          var granted = false
          var assignedLevel = 'view'
          if (profName.indexOf('admin') !== -1) {
            granted = true
            assignedLevel = 'configure'
          } else if (profName.indexOf('gestor') !== -1) {
            granted = true
            assignedLevel = 'edit'
          } else if (itemKey === 'inventario_consultar' && profName.indexOf('qualidade') !== -1) {
            granted = true
            assignedLevel = 'view'
          } else if (itemKey === 'inventario_consultar' && profName.indexOf('tecnico') !== -1) {
            granted = true
            assignedLevel = 'view'
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
    }
  },
  (db) => {
    try {
      var col = db.findCollectionByNameOrId('inventory_devices')
      if (col) db.delete(col)
    } catch (_) {}
    if (db.hasTable('profile_permissions')) {
      db.db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "inventory" AND (item_key = "inventario_gerenciar" OR item_key = "inventario_consultar")',
        )
        .execute()
    }
  },
)
