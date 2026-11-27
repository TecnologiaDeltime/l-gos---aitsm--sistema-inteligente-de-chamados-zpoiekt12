// Migração 0562: Histórico de Movimentação dos Aparelhos do Inventário.
// 1. inventory_movements — registro cronológico do que aconteceu com cada
//    aparelho (cadastrado, atribuído, devolvido, manutenção, desativado, edição).
//    Gravado automaticamente pelo hook A0_inventory.js a partir das ações já
//    existentes; também permite movimentação manual pelo mesmo hook.
//    NUNCA se apaga registro (histórico preservado).
// 2. Leitura segue inventario_consultar (aplicada via regras + validação no
//    hook); escrita só via hook com inventario_gerenciar — regras da coleção
//    negam escrita direta pela API de coleções.
//
// Padrão do projeto (v0.0.433): todo o corpo DENTRO do callback do migrate —
// o parâmetro do callback é o app; nada de globais fora dele.

migrate(
  (db) => {
    var usersCol = db.findCollectionByNameOrId('users')
    var devicesCol = db.findCollectionByNameOrId('inventory_devices')

    var needsMovements = true
    try {
      db.findCollectionByNameOrId('inventory_movements')
      needsMovements = false
    } catch (_) {}

    if (needsMovements) {
      var movCol = new Collection({
        name: 'inventory_movements',
        type: 'base',
        // Leitura para todos os logados (consulta); escrita só superuser/hook.
        // O hook A0_inventory.js valida inventory_consultar/gerenciar por cima.
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'device',
            type: 'relation',
            required: true,
            collectionId: devicesCol.id,
            minSelect: 1,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'movement_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'cadastrado',
              'atribuido',
              'devolvido',
              'manutencao',
              'editado',
              'desativado',
              'reativado',
              'manual',
            ],
          },
          { name: 'description', type: 'text', required: false, maxSize: 2000 },
          {
            name: 'previous_owner',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            minSelect: 0,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'new_owner',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            minSelect: 0,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'performed_by',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            minSelect: 0,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_inventory_movements_device ON inventory_movements (device)',
          'CREATE INDEX idx_inventory_movements_type ON inventory_movements (movement_type)',
          'CREATE INDEX idx_inventory_movements_created ON inventory_movements (created)',
        ],
      })
      db.save(movCol)
    }
  },
  (db) => {
    try {
      var col = db.findCollectionByNameOrId('inventory_movements')
      if (col) db.delete(col)
    } catch (_) {}
  },
)
