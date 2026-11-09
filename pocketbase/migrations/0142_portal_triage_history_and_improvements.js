/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Criar coleção portal_triage_history para registrar o histórico de categorizações IA
    let historyCol = null
    try {
      historyCol = app.findCollectionByNameOrId('portal_triage_history')
    } catch (_) {}

    if (!historyCol) {
      historyCol = new Collection({
        name: 'portal_triage_history',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || @request.auth.role = "cliente_gestor" || @request.auth.role = "cliente_solicitante")',
        viewRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || @request.auth.role = "cliente_gestor" || @request.auth.role = "cliente_solicitante")',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "gestor"',
        deleteRule: '@request.auth.role = "admin"',
        fields: [
          new TextField({ name: 'ticket_id', max: 50, required: true }),
          new TextField({ name: 'ticket_number', max: 50 }),
          new TextField({ name: 'title', max: 300 }),
          new TextField({ name: 'suggested_category_id', max: 50 }),
          new TextField({ name: 'suggested_category_name', max: 200 }),
          new TextField({ name: 'suggested_subcategory_id', max: 50 }),
          new TextField({ name: 'suggested_subcategory_name', max: 200 }),
          new TextField({ name: 'queue_id', max: 50 }),
          new TextField({ name: 'queue_name', max: 200 }),
          new NumberField({ name: 'confidence', min: 0, max: 1, onlyInt: false }),
          new TextField({ name: 'reason', max: 1000 }),
          new BoolField({ name: 'applied' }),
          new TextField({ name: 'source', max: 50 }),
          new TextField({ name: 'match_method', max: 50 }),
        ],
      })
      app.save(historyCol)
    }

    // 2. Garantir que portal_auto_triage_enabled esteja ativado por padrão em system_settings se estava false/vazio
    try {
      const settingsRecords = app.findRecordsByFilter('system_settings', 'key = "global"', '', 1, 0)
      if (settingsRecords.length > 0) {
        const s = settingsRecords[0]
        if (!s.getBool('portal_auto_triage_enabled')) {
          s.set('portal_auto_triage_enabled', true)
        }
        if (
          !s.getFloat('portal_triage_min_confidence') ||
          s.getFloat('portal_triage_min_confidence') <= 0
        ) {
          s.set('portal_triage_min_confidence', 0.45)
        }
        app.save(s)
      }
    } catch (_) {}

    // 3. Atualizar agente nativo com prompt aprimorado e contexto mais rico
    try {
      $ai.agents.define(app, {
        slug: 'portal-ticket-triage-agent',
        name: 'Agente de Triagem do Portal',
        description:
          'Lê o título e a descrição de um chamado do Portal, cruza com o catálogo de atividades (principais e subatividades com descrições) e base de conhecimento, retornando a atividade, subatividade, fila e justificativa.',
        systemPrompt:
          'Você é o especialista de triagem automática e classificação de chamados do Lógos AITSM (ITIL 4). ' +
          'Seu objetivo é analisar minuciosamente o TÍTULO e a DESCRIÇÃO fornecidos pelo cliente e selecionar a ATIVIDADE PRINCIPAL (category_id) ' +
          'e a SUBATIVIDADE ESPECÍFICA (subcategory_id, se houver correspondente no catálogo) que melhor solucionam o relato. ' +
          'Você também recebe o catálogo completo de atividades com suas subatividades, descrições e artigos da Base de Conhecimento. ' +
          'Diretrizes obrigatórias: ' +
          '1. Entenda sinônimos e linguagem informal do usuário (ex.: "rede lenta", "sem internet", "cabo quebrado", "VPN desconectando", "troca de monitor", "acesso ao sistema", "impressora travada"). ' +
          '2. Se o problema se encaixar com precisão em uma subatividade específica, informe tanto o category_id (atividade pai) quanto o subcategory_id (subatividade filha). ' +
          '3. Se o problema se encaixar apenas na atividade pai de forma genérica, preencha category_id e deixe subcategory_id vazio. ' +
          '4. Se nenhuma atividade for adequada (relato vago ou fora do catálogo), retorne ids vazios com confidence baixa (< 0.4). ' +
          '5. Responda ESTRITAMENTE em formato JSON puro, sem markdown e sem preâmbulos: ' +
          '{"category_id": "ID_PAI", "subcategory_id": "ID_FILHA", "confidence": 0.0_A_1.0, "reason": "explicação curta em português", "suggested_queue_id": "ID_FILA_SE_HOUVER"}.',
        tier: 'fast',
        tools: [
          { collection: 'tkt_categories', perms: { list: true, read: true } },
          { collection: 'queues', perms: { list: true, read: true } },
          { collection: 'knowledge_articles', perms: { list: true, read: true } },
        ],
      })
    } catch (_) {}

    // 4. Cadastrar novas permissões no catálogo de perfis
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const newPerms = [
        {
          moduleKey: 'tickets',
          itemKey: 'tickets_categoria_edit',
          adminLevel: 'edit',
          operatorLevel: 'edit',
          clientLevel: 'none',
        },
        {
          moduleKey: 'tickets',
          itemKey: 'tickets_triage_history',
          adminLevel: 'view',
          operatorLevel: 'view',
          clientLevel: 'none',
        },
      ]

      for (const p of newPerms) {
        for (let i = 0; i < profiles.length; i++) {
          const prof = profiles[i]
          const profileId = prof.id
          const profName = (prof.getString('name') || '').toLowerCase()

          let granted = false
          let assignedLevel = 'view'

          if (profName.includes('admin') || profName.includes('gestor')) {
            granted = true
            assignedLevel = p.adminLevel || 'edit'
          } else if (
            profName.includes('operador') ||
            profName.includes('tecnico') ||
            profName.includes('qualidade') ||
            profName.includes('field') ||
            profName.includes('helpdesk')
          ) {
            granted = p.operatorLevel !== 'none'
            assignedLevel = p.operatorLevel || 'view'
          }

          const existing = app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profileId +
              '" && module_key = "' +
              p.moduleKey +
              '" && item_key = "' +
              p.itemKey +
              '"',
            '',
            1,
            0,
          )

          if (existing.length === 0) {
            const rec = new Record(permCol)
            rec.set('profile', profileId)
            rec.set('module_key', p.moduleKey)
            rec.set('item_key', p.itemKey)
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
      const col = app.findCollectionByNameOrId('portal_triage_history')
      if (col) app.delete(col)
    } catch (_) {}
    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "tickets" AND (item_key = "tickets_categoria_edit" OR item_key = "tickets_triage_history")',
          )
          .execute()
      }
    } catch (_) {}
  },
)
