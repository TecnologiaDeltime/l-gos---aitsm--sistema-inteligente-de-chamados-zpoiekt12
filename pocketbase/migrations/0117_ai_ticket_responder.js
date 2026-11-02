migrate(
  (app) => {
    // 1. Criar coleção ai_ticket_settings (configuração central da IA para chamados)
    if (!app.hasTable('ai_ticket_settings')) {
      const settingsCol = new Collection({
        name: 'ai_ticket_settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        updateRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        fields: [
          {
            name: 'scope',
            type: 'select',
            required: true,
            values: ['global'],
            maxSelect: 1,
          },
          { name: 'enabled', type: 'bool' },
          {
            name: 'mode',
            type: 'select',
            required: true,
            values: ['suggestion', 'automatic', 'both'],
            maxSelect: 1,
          },
          { name: 'auto_reply_internal', type: 'bool' },
          { name: 'auto_reply_portal', type: 'bool' },
          { name: 'include_kb', type: 'bool' },
          { name: 'include_history', type: 'bool' },
          { name: 'include_asset', type: 'bool' },
          { name: 'system_instructions', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_ai_ticket_settings_scope ON ai_ticket_settings (scope)'],
      })
      app.save(settingsCol)

      // Inserir registro padrão global
      const rec = new Record(settingsCol)
      rec.set('scope', 'global')
      rec.set('enabled', true)
      rec.set('mode', 'both') // suggestion, automatic ou both
      rec.set('auto_reply_internal', true)
      rec.set('auto_reply_portal', true)
      rec.set('include_kb', true)
      rec.set('include_history', true)
      rec.set('include_asset', true)
      rec.set(
        'system_instructions',
        'Seja cordial, profissional e forneça passos técnicos objetivos e claros baseados no histórico do chamado e na base de conhecimento.',
      )
      app.save(rec)
    }

    // 2. Definir o agente nativo Skip Cloud de resposta a chamados ITSM
    $ai.agents.define(app, {
      slug: 'ticket-responder-agent',
      name: 'Agente de Resposta a Chamados ITSM',
      description:
        'Agente nativo de IA especializado em analisar o contexto completo do chamado (título, descrição, histórico de interações, ativos e itens de configuração vinculados, e artigos da base de conhecimento) para redigir respostas precisas, claras e corteses nos modos sugestão (rascunho para operador) e automático.',
      systemPrompt:
        'Você é um especialista em Service Desk e ITSM (ITIL 4) da equipe de suporte de TI. ' +
        'Sua missão é redigir respostas atenciosas, técnicas e resolutivas para os chamados dos usuários. ' +
        'Diretrizes obrigatórias: ' +
        '(1) Cumprimente cordialmente e demonstre empatia pelo problema relatado. ' +
        '(2) Utilize todo o contexto fornecido (descrição do chamado, interações anteriores, dados do equipamento/ativo envolvido e procedimentos da base de conhecimento). ' +
        '(3) Estruture a resposta com clareza: explique o diagnóstico inicial ou procedimento recomendado, apresente passos passo a passo numerados se houver ações para o usuário testar, e oriente sobre os próximos passos. ' +
        '(4) Se a resposta for para o cliente/portal, mantenha linguagem acessível, evitando jargões obscuros, mas com precisão técnica. Se for para a equipe interna, seja objetivo e aprofundado. ' +
        '(5) Sempre responda em Português do Brasil.',
      tier: 'fast',
      tools: [
        { collection: 'tickets', perms: { list: true, read: true } },
        { collection: 'ticket_interactions', perms: { list: true, read: true } },
        { collection: 'knowledge_articles', perms: { list: true, read: true } },
        { collection: 'equipments', perms: { list: true, read: true } },
        { collection: 'configuration_items', perms: { list: true, read: true } },
        { collection: 'tkt_categories', perms: { list: true, read: true } },
        { collection: 'companies', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text:
              'Padrão de Resposta a Chamados ITSM:\n' +
              '1. Saudação personalizada com o nome do solicitante.\n' +
              '2. Confirmação do entendimento da demanda ou incidente reportado.\n' +
              '3. Orientação técnica ou solução clara e detalhada com passos de validação.\n' +
              '4. Solicitação de retorno do usuário caso o teste tenha sido satisfatório.\n' +
              '5. Despedida profissional com assinatura da Equipe de Suporte e Atendimento.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question:
                  'Como proceder quando o chamado reporta lentidão ou travamento no computador?',
                answer:
                  'Orientar o usuário a verificar programas em execução no Gerenciador de Tarefas, reiniciar a máquina se estiver ligada há muitos dias, e validar se há espaço livre no disco C:.',
              },
              {
                question: 'Como proceder em falhas de VPN ou acesso remoto?',
                answer:
                  'Checar conectividade com a internet, conferir credenciais de acesso, confirmar se o cliente de VPN está atualizado e orientar desconectar e reconectar.',
              },
              {
                question: 'Como orientar problemas de impressão na rede?',
                answer:
                  'Orientar verificar se a impressora está ligada, com papel e sem mensagens de erro no painel, e reiniciar o spooler de impressão se necessário.',
              },
            ],
          },
        },
      ],
    })

    // 3. Backfill das novas permissões no catálogo de perfis (profile_permissions)
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const newItems = [
        { module_key: 'tickets', item_key: 'tickets_ai_reply', level: 'edit' },
        { module_key: 'settings', item_key: 'settings_ai_reply', level: 'configure' },
      ]

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id
        const isSystem = !!prof.getBool('is_system')
        const profName = (prof.getString('name') || '').toLowerCase()

        for (let j = 0; j < newItems.length; j++) {
          const item = newItems[j]
          const existing = app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profileId +
              '" && module_key = "' +
              item.module_key +
              '" && item_key = "' +
              item.item_key +
              '"',
            '',
            1,
            0,
          )

          if (existing.length === 0) {
            const rec = new Record(permCol)
            rec.set('profile', profileId)
            rec.set('module_key', item.module_key)
            rec.set('item_key', item.item_key)
            rec.set('granted', true)

            // Administrador e Gestor recebem 'configure'
            let assignedLevel = item.level
            if (profName.includes('admin') || profName.includes('gestor')) {
              assignedLevel = 'configure'
            }
            rec.set('level', assignedLevel)
            app.save(rec)
          }
        }
      }
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'ticket-responder-agent')
    } catch (_) {}

    try {
      if (app.hasTable('profile_permissions')) {
        app
          .db()
          .newQuery(
            'DELETE FROM profile_permissions WHERE item_key IN ("tickets_ai_reply", "settings_ai_reply")',
          )
          .execute()
      }
    } catch (_) {}

    try {
      if (app.hasTable('ai_ticket_settings')) {
        const col = app.findCollectionByNameOrId('ai_ticket_settings')
        app.delete(col)
      }
    } catch (_) {}
  },
)
