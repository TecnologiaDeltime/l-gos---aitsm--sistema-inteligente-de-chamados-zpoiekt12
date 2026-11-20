/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração: coleção kb_sources — fontes de aprendizado da Base de Conhecimento.
 * Guarda PDFs enviados (source_type 'pdf') e soluções aprendidas no fechamento
 * de chamados (source_type 'closure'), com o texto extraído para o motor de sugestões.
 * Também semeia o item de permissão 'knowledge_sources' na matriz de perfis.
 */

migrate(
  (app) => {
    const ticketsId = app.findCollectionByNameOrId('tickets').id
    const usersId = '_pb_users_auth_'

    if (!app.hasTable('kb_sources')) {
      const col = new Collection({
        name: 'kb_sources',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
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
          { name: 'extracted_text', type: 'text' },
          { name: 'summary', type: 'text' },
          { name: 'pages', type: 'number', onlyInt: true },
          { name: 'error', type: 'text', max: 1000 },
          {
            name: 'ticket',
            type: 'relation',
            collectionId: ticketsId,
            maxSelect: 1,
          },
          { name: 'ticket_number', type: 'text', max: 40 },
          { name: 'category', type: 'text', max: 100 },
          { name: 'tokens', type: 'json' },
          {
            name: 'uploaded_by',
            type: 'relation',
            collectionId: usersId,
            maxSelect: 1,
          },
          { name: 'processed_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_kb_sources_type ON kb_sources (source_type)',
          'CREATE INDEX idx_kb_sources_status ON kb_sources (status)',
          'CREATE INDEX idx_kb_sources_ticket ON kb_sources (ticket)',
        ],
      })
      app.save(col)
    }

    // 2. Backfill do item de permissão 'knowledge_sources' na matriz de perfis
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      for (let i = 0; i < profiles.length; i++) {
        const profileId = profiles[i].id

        const existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "knowledge" && item_key = "knowledge_sources"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          const rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', 'knowledge')
          rec.set('item_key', 'knowledge_sources')
          rec.set('granted', true)
          rec.set('level', 'edit')
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "knowledge" AND item_key = "knowledge_sources"',
          )
          .execute()
      }
    } catch (_) {}

    try {
      if (app.hasTable('kb_sources')) {
        app.delete(app.findCollectionByNameOrId('kb_sources'))
      }
    } catch (_) {}
  },
)
