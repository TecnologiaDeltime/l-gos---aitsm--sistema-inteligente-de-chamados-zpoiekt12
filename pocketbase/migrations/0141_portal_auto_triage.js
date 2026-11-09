migrate(
  (app) => {
    // 1. Novos campos em system_settings para a Triagem Automática do Portal (IA)
    try {
      const settingsCol = app.findCollectionByNameOrId('system_settings')

      if (!settingsCol.fields.getByName('portal_auto_triage_enabled')) {
        settingsCol.fields.add(new BoolField({ name: 'portal_auto_triage_enabled' }))
      }
      if (!settingsCol.fields.getByName('portal_triage_default_queue')) {
        settingsCol.fields.add(new TextField({ name: 'portal_triage_default_queue', max: 30 }))
      }
      if (!settingsCol.fields.getByName('portal_triage_min_confidence')) {
        settingsCol.fields.add(
          new NumberField({ name: 'portal_triage_min_confidence', min: 0, max: 1, onlyInt: false }),
        )
      }
      app.save(settingsCol)
    } catch (_) {}

    // Seed de valores padrão no registro global (idempotente)
    try {
      const rec = app.findFirstRecordByFilter('system_settings', 'key = "global"', '', 0, 0)
      if (rec) {
        if (rec.getString('portal_triage_min_confidence') === '') {
          rec.set('portal_auto_triage_enabled', true)
          rec.set('portal_triage_min_confidence', 0.5)
          app.save(rec)
        }
      }
    } catch (_) {}

    // 2. Agente nativo Skip Cloud de categorização de chamados do Portal
    $ai.agents.define(app, {
      slug: 'portal-ticket-triage-agent',
      name: 'Agente de Triagem do Portal',
      description:
        'Lê o título e a descrição de um chamado aberto no Portal do Cliente, encontra a atividade correspondente no catálogo de serviços (com suas subatividades) e indica a categoria, subcategoria e a equipe responsável configurada no catálogo para distribuição automática.',
      systemPrompt:
        'Você é o agente de triagem automática de chamados do Lógos AITSM (ITIL 4). ' +
        'Recebe o TÍTULO e a DESCRIÇÃO de um chamado aberto por um cliente no portal, junto com o catálogo de serviços ' +
        '(atividades principais e subatividades, cada uma com seu id e equipe). ' +
        'Sua única tarefa é identificar qual atividade/subatividade do catálogo melhor descreve o problema relatado. ' +
        'Regras obrigatórias: ' +
        '(1) Responda ESTRITAMENTE com um JSON, sem texto antes ou depois, no formato: ' +
        '{"activity_id": "ID_DA_ATIVIDADE_OU_VAZIO", "subcategory_id": "ID_DA_SUBATIVIDADE_OU_VAZIO", "confidence": 0.0, "reason": "justificativa curta em português"}. ' +
        '(2) "subcategory_id", quando preenchido, DEVE ser o id de uma subatividade cujo pai seja a atividade informada em "activity_id". ' +
        '(3) Se não houver correspondência razoável no catálogo, deixe os ids vazios e use "confidence" baixo (menor que 0.5). ' +
        '(4) Nunca invente ids que não estejam no catálogo. ' +
        '(5) Considere sinônimos e linguagem informal do cliente (ex.: "e-mail não abre" pode corresponder à atividade de E-mail/Outlook/Correio). ' +
        '(6) Responda em Português do Brasil.',
      tier: 'fast',
      tools: [
        { collection: 'tkt_categories', perms: { list: true, read: true } },
        { collection: 'queues', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text:
              'A saída é sempre um JSON pego por machine parsing: {"activity_id", "subcategory_id", "confidence", "reason"}. ' +
              'Confiança >= 0.5 significa correspondência razoável; abaixo disso o chamado cai no destino padrão.',
          },
        },
      ],
    })

    // 3. Item no catálogo de permissões: configuração da triagem do portal (uso interno)
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const moduleKey = 'settings'
      const itemKey = 'settings_portal_triage'

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id
        const profName = (prof.getString('name') || '').toLowerCase()

        let assignedLevel = 'view'
        let granted = false

        if (profName.includes('admin') || profName.includes('gestor')) {
          assignedLevel = 'configure'
          granted = true
        }

        const existing = app.findRecordsByFilter(
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
          const rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', moduleKey)
          rec.set('item_key', itemKey)
          rec.set('granted', granted)
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'portal-ticket-triage-agent')
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('system_settings')
      for (const f of [
        'portal_auto_triage_enabled',
        'portal_triage_default_queue',
        'portal_triage_min_confidence',
      ]) {
        try {
          if (col.fields.getByName(f)) col.fields.removeByName(f)
        } catch (_) {}
      }
      app.save(col)
    } catch (_) {}

    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE module_key = "settings" AND item_key = "settings_portal_triage"',
          )
          .execute()
      }
    } catch (_) {}
  },
)
