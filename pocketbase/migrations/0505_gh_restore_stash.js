migrate(
  (app) => {
    const collection = new Collection({
      name: 'gh_restore_stash',
      type: 'base',
      // TEMPORÁRIA: buffer de fatias de código buscadas do repositório público
      // durante a restauração da ficha do chamado (v0.0.503). Sem segredos —
      // leitura pública ok; escrita só via hook ($app, superuser).
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'path', type: 'text', required: true, max: 300 },
        { name: 'idx', type: 'number', required: true, onlyInt: true },
        { name: 'total', type: 'number', onlyInt: true },
        { name: 'content', type: 'text', required: true, maxSize: 30000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_gh_stash_path_idx ON gh_restore_stash (path, idx)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('gh_restore_stash')
    app.delete(collection)
  },
)
