/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração: coleção kb_sources — fontes de aprendizado da Base de Conhecimento.
 * Guarda PDFs enviados (source_type 'pdf') e soluções aprendidas no fechamento
 * de chamados (source_type 'closure'), com o texto extraído para o motor de sugestões.
 */

migrate(
  (app) => {
    const existing = app.findCollectionsByNameOrId('kb_sources')
    if (existing && existing.length > 0) return

    const collection = new Collection({
      type: 'base',
      name: 'kb_sources',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'name', type: 'text', required: true, min: 1, max: 255 },
        {
          name: 'file',
          type: 'file',
          maxSelect: 1,
          maxSize: 52428800,
          mimeTypes: ['application/pdf'],
        },
        {
          name: 'source_type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['pdf', 'closure'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['Processando', 'Pronto', 'Erro'],
        },
        { name: 'extracted_text', type: 'text', max: 0 },
        { name: 'summary', type: 'text', max: 0 },
        { name: 'pages', type: 'number', onlyInt: true },
        { name: 'error', type: 'text', max: 1000 },
        { name: 'ticket', type: 'relation', maxSelect: 1, collectionId: 'tickets' },
        { name: 'ticket_number', type: 'text', max: 40 },
        { name: 'category', type: 'text', max: 100 },
        { name: 'tokens', type: 'json', maxSize: 2000000 },
        { name: 'uploaded_by', type: 'relation', maxSelect: 1, collectionId: '_pb_users_auth_' },
        { name: 'processed_at', type: 'autodate', onCreate: false, onUpdate: false },
      ],
    })

    app.save(collection)
  },
  (app) => {
    const cols = app.findCollectionsByNameOrId('kb_sources')
    if (cols && cols.length > 0) app.delete(cols[0])
  },
)
