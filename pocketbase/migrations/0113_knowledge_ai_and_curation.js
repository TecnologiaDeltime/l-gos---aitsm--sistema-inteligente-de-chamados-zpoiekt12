/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const kb = app.findCollectionByNameOrId('knowledge_articles')
    const tickets = app.findCollectionByNameOrId('tickets')
    const tktCategories = app.findCollectionByNameOrId('tkt_categories')

    // 1. Coleção knowledge_drafts (Rascunhos de artigos gerados por IA a partir de chamados encerrados)
    if (!app.hasTable('knowledge_drafts')) {
      const draftsCol = new Collection({
        name: 'knowledge_drafts',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'problem_description', type: 'text' },
          { name: 'resolution_steps', type: 'text' },
          { name: 'content', type: 'text', required: true },
          { name: 'content_html', type: 'text' },
          { name: 'summary', type: 'text' },
          { name: 'tags', type: 'text' },
          { name: 'tokens', type: 'json' },
          {
            name: 'category',
            type: 'relation',
            collectionId: tktCategories.id,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'activity',
            type: 'relation',
            collectionId: tktCategories.id,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'source_ticket',
            type: 'relation',
            collectionId: tickets.id,
            maxSelect: 1,
            required: false,
          },
          { name: 'source_ticket_number', type: 'text' },
          { name: 'source_technician_name', type: 'text' },
          { name: 'source_technician_seniority', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Pendente de Revisão', 'Aprovado', 'Publicado', 'Descartado'],
            maxSelect: 1,
          },
          {
            name: 'published_article',
            type: 'relation',
            collectionId: kb.id,
            maxSelect: 1,
            required: false,
          },
          {
            name: 'reviewed_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            required: false,
          },
          { name: 'reviewed_at', type: 'date' },
          { name: 'review_notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_kb_drafts_status ON knowledge_drafts (status)',
          'CREATE INDEX idx_kb_drafts_ticket ON knowledge_drafts (source_ticket)',
        ],
      })
      app.save(draftsCol)
    }

    // 2. Coleção knowledge_curations (Cura e monitoramento de artigos desatualizados/incompletos/ineficazes)
    if (!app.hasTable('knowledge_curations')) {
      const curationsCol = new Collection({
        name: 'knowledge_curations',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'article',
            type: 'relation',
            collectionId: kb.id,
            maxSelect: 1,
            required: true,
          },
          { name: 'article_title', type: 'text', required: true },
          {
            name: 'flag_reason',
            type: 'select',
            required: true,
            values: ['Desatualizado', 'Incompleto', 'Falhando em Resolver', 'Múltiplos Fatores'],
            maxSelect: 1,
          },
          { name: 'diagnostic_details', type: 'text' },
          { name: 'suggested_improvements', type: 'text', required: true },
          { name: 'suggested_content', type: 'text' },
          { name: 'suggested_summary', type: 'text' },
          { name: 'suggested_tags', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Pendente', 'Aplicada', 'Recusada'],
            maxSelect: 1,
          },
          {
            name: 'action_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            required: false,
          },
          { name: 'action_at', type: 'date' },
          { name: 'action_notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_kb_curations_status ON knowledge_curations (status)',
          'CREATE INDEX idx_kb_curations_article ON knowledge_curations (article)',
        ],
      })
      app.save(curationsCol)
    }

    // 3. Definir o agente nativo Skip Cloud de IA para a Base de Conhecimento
    $ai.agents.define(app, {
      slug: 'kb-curator-agent',
      name: 'Curador e Gerador de Artigos KB',
      description:
        'Agente nativo ITSM especializado em gerar rascunhos de base de conhecimento a partir de soluções bem-sucedidas e diagnosticar/curar artigos desatualizados ou ineficazes.',
      systemPrompt:
        'Você é um especialista sênior em Gerenciamento do Conhecimento ITIL 4 e ITSM. ' +
        'Suas responsabilidades são: (1) Gerar rascunhos didáticos, objetivos e precisos de artigos de base de conhecimento (KB) a partir de chamados resolvidos com sucesso, priorizando a sabedoria e notas de técnicos seniores. ' +
        'Nunca publique automaticamente — forneça um rascunho com título claro, descrição do problema, passos passo a passo da resolução e tags relevantes. ' +
        '(2) Curar e monitorar artigos existentes, identificando se estão desatualizados, incompletos ou falhando em resolver chamados recorrentes, sugerindo melhorias concretas e texto revisado para a equipe técnica. ' +
        'Sempre responda em Português do Brasil.',
      tier: 'fast',
      tools: [
        { collection: 'knowledge_articles', perms: { list: true, read: true } },
        { collection: 'tickets', perms: { list: true, read: true } },
        { collection: 'tkt_categories', perms: { list: true, read: true } },
        { collection: 'users', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text:
              'Padrão de Artigo ITIL para ITSM: Título claro indicando o problema ou procedimento. ' +
              'Resumo sucinto de 1 a 2 frases. ' +
              'Problema/Sintoma: O que acontece e quando ocorre. ' +
              'Passos de Resolução: Lista ordenada 1, 2, 3 com comandos, caminhos e procedimentos exatos. ' +
              'Validação: Como confirmar que a solução surtiu efeito. ' +
              'Tags e Palavras-chave para facilitar a busca do técnico e do usuário.',
          },
        },
      ],
    })

    // 4. Backfill dos novos itens na matriz de permissões (profile_permissions)
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const newItems = [
        { item_key: 'knowledge_drafts', level: 'edit' },
        { item_key: 'knowledge_curation', level: 'edit' },
      ]

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id

        for (let j = 0; j < newItems.length; j++) {
          const item = newItems[j]
          const existing = app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profileId +
              '" && module_key = "knowledge" && item_key = "' +
              item.item_key +
              '"',
            '',
            1,
            0,
          )

          if (existing.length === 0) {
            const rec = new Record(permCol)
            rec.set('profile', profileId)
            rec.set('module_key', 'knowledge')
            rec.set('item_key', item.item_key)
            rec.set('granted', true)
            rec.set('level', item.level)
            app.save(rec)
          }
        }
      }
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'kb-curator-agent')
    } catch (_) {}

    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "knowledge" AND item_key IN ("knowledge_drafts", "knowledge_curation")',
          )
          .execute()
      }
    } catch (_) {}

    try {
      if (app.hasTable('knowledge_curations')) {
        const col = app.findCollectionByNameOrId('knowledge_curations')
        app.delete(col)
      }
    } catch (_) {}

    try {
      if (app.hasTable('knowledge_drafts')) {
        const col = app.findCollectionByNameOrId('knowledge_drafts')
        app.delete(col)
      }
    } catch (_) {}
  },
)
