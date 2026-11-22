/**
 * 0554 — Drop da coleção temporária gh_restore_stash ao fim da restauração
 * da v0.0.486 (mesma limpeza já feita pela 0550 para a ponte da v0.0.503).
 * O conteúdo dos 11 arquivos já está gravado verbatim em src/ e commitado;
 * o hook temporário A0_gh_restore_tmp.js (que servia /chunks e /stash-list)
 * é removido no mesmo commit.
 */

migrate(
  (app) => {
    const existing = app.findCollectionByNameOrId('gh_restore_stash')
    if (existing) {
      app.delete(existing)
    }
  },
  (app) => {
    const collection = new Collection({
      name: 'gh_restore_stash',
      type: 'base',
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
)
