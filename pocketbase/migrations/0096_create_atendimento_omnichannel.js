migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const ticketsCollection = app.findCollectionByNameOrId('tickets')

    // 1. Coleção: atendimento_conversas
    const conversas = new Collection({
      name: 'atendimento_conversas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'canal',
          type: 'select',
          required: true,
          values: ['whatsapp', 'webchat', 'email'],
          maxSelect: 1,
        },
        {
          name: 'estado',
          type: 'select',
          required: true,
          values: [
            'NOVA',
            'TRIAGEM_BOT',
            'BOT_RESOLVENDO',
            'HANDOFF_PENDENTE',
            'HUMANO_ATIVO',
            'RESOLVIDA',
          ],
          maxSelect: 1,
        },
        {
          name: 'prioridade',
          type: 'select',
          required: true,
          values: ['P1', 'P2', 'P3', 'P4'],
          maxSelect: 1,
        },
        {
          name: 'pratica',
          type: 'select',
          values: ['incident', 'service_request', 'change', 'question'],
          maxSelect: 1,
        },
        { name: 'categoria', type: 'text' },
        {
          name: 'impacto',
          type: 'select',
          values: ['menor', 'moderado', 'significativo', 'extenso'],
          maxSelect: 1,
        },
        {
          name: 'urgencia',
          type: 'select',
          values: ['baixa', 'média', 'alta', 'crítica'],
          maxSelect: 1,
        },
        { name: 'contato_nome', type: 'text', required: true },
        { name: 'contato_handle', type: 'text' },
        { name: 'contato_vip', type: 'bool' },
        { name: 'contato_locale', type: 'text' },
        { name: 'sentimento', type: 'number' },
        { name: 'confianca_bot', type: 'number' },
        { name: 'motivo_handoff', type: 'text' },
        {
          name: 'operador_atribuido',
          type: 'relation',
          collectionId: usersCollection.id,
          maxSelect: 1,
        },
        {
          name: 'chamado_vinculado',
          type: 'relation',
          collectionId: ticketsCollection.id,
          maxSelect: 1,
        },
        { name: 'sla_resposta_deadline', type: 'date' },
        { name: 'sla_resolucao_deadline', type: 'date' },
        { name: 'sla_resposta_at', type: 'date' },
        { name: 'sla_resolucao_at', type: 'date' },
        { name: 'ultima_mensagem_texto', type: 'text' },
        { name: 'ultima_atividade_at', type: 'date' },
        { name: 'metadata', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_atend_conv_canal ON atendimento_conversas (canal)',
        'CREATE INDEX idx_atend_conv_estado ON atendimento_conversas (estado)',
        'CREATE INDEX idx_atend_conv_prioridade ON atendimento_conversas (prioridade)',
        'CREATE INDEX idx_atend_conv_operador ON atendimento_conversas (operador_atribuido)',
        'CREATE INDEX idx_atend_conv_chamado ON atendimento_conversas (chamado_vinculado)',
      ],
    })
    app.save(conversas)

    // 2. Coleção: atendimento_mensagens
    const mensagens = new Collection({
      name: 'atendimento_mensagens',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'conversa',
          type: 'relation',
          required: true,
          collectionId: conversas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'direcao',
          type: 'select',
          required: true,
          values: ['entrada', 'saida'],
          maxSelect: 1,
        },
        {
          name: 'autor_tipo',
          type: 'select',
          required: true,
          values: ['usuario', 'bot', 'operador', 'sistema'],
          maxSelect: 1,
        },
        { name: 'autor_nome', type: 'text', required: true },
        { name: 'operador', type: 'relation', collectionId: usersCollection.id, maxSelect: 1 },
        { name: 'texto', type: 'text', required: true },
        { name: 'artigos_consultados', type: 'json' },
        { name: 'classificacao', type: 'json' },
        { name: 'id_externo', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_atend_msg_conversa ON atendimento_mensagens (conversa)',
        'CREATE INDEX idx_atend_msg_autor ON atendimento_mensagens (autor_tipo)',
      ],
    })
    app.save(mensagens)

    // 3. Coleção: atendimento_dossies
    const dossies = new Collection({
      name: 'atendimento_dossies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'conversa',
          type: 'relation',
          required: true,
          collectionId: conversas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'headline', type: 'text', required: true },
        { name: 'narrativa', type: 'text', required: true },
        { name: 'objetivo_cliente', type: 'text', required: true },
        { name: 'passos_tomados', type: 'json' },
        { name: 'artigos_tentados', type: 'json' },
        { name: 'perguntas_abertas', type: 'json' },
        { name: 'riscos', type: 'json' },
        { name: 'proxima_acao_recomendada', type: 'text', required: true },
        { name: 'roteamento_score', type: 'text' },
        { name: 'roteamento_justificativa', type: 'text' },
        { name: 'skills_avaliadas', type: 'json' },
        {
          name: 'agente_sugerido',
          type: 'relation',
          collectionId: usersCollection.id,
          maxSelect: 1,
        },
        { name: 'eventos_handoff', type: 'json' },
        { name: 'aceito_por', type: 'relation', collectionId: usersCollection.id, maxSelect: 1 },
        { name: 'aceito_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_atend_dossie_conv ON atendimento_dossies (conversa)'],
    })
    app.save(dossies)

    // 4. Seed inicial realista de conversas e mensagens para demonstrar a tela de imediato
    try {
      const agora = new Date()

      // Conversa 1 - WhatsApp (VPN com instabilidade, P2, HANDOFF_PENDENTE)
      const conv1 = new Record(conversas)
      conv1.set('canal', 'whatsapp')
      conv1.set('estado', 'HANDOFF_PENDENTE')
      conv1.set('prioridade', 'P2')
      conv1.set('pratica', 'incident')
      conv1.set('categoria', 'VPN / Acesso remoto')
      conv1.set('impacto', 'significativo')
      conv1.set('urgencia', 'alta')
      conv1.set('contato_nome', 'Mariana Costa')
      conv1.set('contato_handle', '+55 11 98877-6655')
      conv1.set('contato_vip', true)
      conv1.set('contato_locale', 'pt-BR')
      conv1.set('sentimento', -0.7)
      conv1.set('confianca_bot', 0.58)
      conv1.set('motivo_handoff', 'sentimento_negativo')
      conv1.set('sla_resposta_deadline', new Date(agora.getTime() + 12 * 60000).toISOString()) // 12 min restantes
      conv1.set('sla_resolucao_deadline', new Date(agora.getTime() + 380 * 60000).toISOString())
      conv1.set(
        'ultima_mensagem_texto',
        'Estou muito irritada, perdi metade do trabalho porque a VPN caiu de novo!',
      )
      conv1.set('ultima_atividade_at', new Date(agora.getTime() - 2 * 60000).toISOString())
      app.save(conv1)

      // Mensagens da conversa 1
      const m1_1 = new Record(mensagens)
      m1_1.set('conversa', conv1.id)
      m1_1.set('direcao', 'entrada')
      m1_1.set('autor_tipo', 'usuario')
      m1_1.set('autor_nome', 'Mariana Costa')
      m1_1.set(
        'texto',
        'Minha VPN corporativa está desconectando toda hora, já reiniciei o modem e não resolveu.',
      )
      m1_1.set('classificacao', {
        pratica: 'incident',
        categoria: 'VPN / Acesso remoto',
        impacto: 'significativo',
        urgencia: 'alta',
        prioridade: 'P2',
      })
      app.save(m1_1)

      const m1_2 = new Record(mensagens)
      m1_2.set('conversa', conv1.id)
      m1_2.set('direcao', 'saida')
      m1_2.set('autor_tipo', 'bot')
      m1_2.set('autor_nome', 'AITSM Bot')
      m1_2.set(
        'texto',
        'Tentei verificar o gateway da VPN corporativa, mas notei instabilidade intermitente no túnel IPSec.',
      )
      m1_2.set('artigos_consultados', ['KB-1042 – Diagnóstico de VPN instável'])
      app.save(m1_2)

      const m1_3 = new Record(mensagens)
      m1_3.set('conversa', conv1.id)
      m1_3.set('direcao', 'entrada')
      m1_3.set('autor_tipo', 'usuario')
      m1_3.set('autor_nome', 'Mariana Costa')
      m1_3.set(
        'texto',
        'Estou muito irritada, perdi metade do trabalho porque a VPN caiu de novo! Quero um atendente.',
      )
      m1_3.set('classificacao', {
        pratica: 'incident',
        categoria: 'VPN / Acesso remoto',
        impacto: 'significativo',
        urgencia: 'alta',
        prioridade: 'P2',
      })
      app.save(m1_3)

      // Conversa 2 - E-mail (Acesso a Sistema Financeiro P3, NOVA)
      const conv2 = new Record(conversas)
      conv2.set('canal', 'email')
      conv2.set('estado', 'NOVA')
      conv2.set('prioridade', 'P3')
      conv2.set('pratica', 'service_request')
      conv2.set('categoria', 'Acesso a Sistema')
      conv2.set('impacto', 'moderado')
      conv2.set('urgencia', 'média')
      conv2.set('contato_nome', 'Carlos Eduardo Mendes')
      conv2.set('contato_handle', 'carlos.mendes@cliente.com.br')
      conv2.set('contato_vip', false)
      conv2.set('contato_locale', 'pt-BR')
      conv2.set('sentimento', 0.0)
      conv2.set('confianca_bot', 0.62)
      conv2.set('sla_resposta_deadline', new Date(agora.getTime() + 45 * 60000).toISOString())
      conv2.set('sla_resolucao_deadline', new Date(agora.getTime() + 1200 * 60000).toISOString())
      conv2.set(
        'ultima_mensagem_texto',
        'Preciso de liberação de permissão no módulo financeiro para fechar o mês contábil.',
      )
      conv2.set('ultima_atividade_at', new Date(agora.getTime() - 15 * 60000).toISOString())
      app.save(conv2)

      const m2_1 = new Record(mensagens)
      m2_1.set('conversa', conv2.id)
      m2_1.set('direcao', 'entrada')
      m2_1.set('autor_tipo', 'usuario')
      m2_1.set('autor_nome', 'Carlos Eduardo Mendes')
      m2_1.set(
        'texto',
        'Olá equipe, preciso de liberação de permissão no módulo financeiro do ERP para fechar o mês contábil da filial até amanhã.',
      )
      m2_1.set('classificacao', {
        pratica: 'service_request',
        categoria: 'Acesso a Sistema',
        impacto: 'moderado',
        urgencia: 'média',
        prioridade: 'P3',
      })
      app.save(m2_1)

      // Conversa 3 - Webchat (Reset de Senha Portal P4, RESOLVIDA)
      const conv3 = new Record(conversas)
      conv3.set('canal', 'webchat')
      conv3.set('estado', 'RESOLVIDA')
      conv3.set('prioridade', 'P4')
      conv3.set('pratica', 'service_request')
      conv3.set('categoria', 'Conta / Senha')
      conv3.set('impacto', 'menor')
      conv3.set('urgencia', 'baixa')
      conv3.set('contato_nome', 'Aline Rocha')
      conv3.set('contato_handle', 'aline.rocha@empresa.com')
      conv3.set('contato_vip', false)
      conv3.set('contato_locale', 'pt-BR')
      conv3.set('sentimento', 0.8)
      conv3.set('confianca_bot', 0.94)
      conv3.set('sla_resposta_deadline', new Date(agora.getTime() - 100 * 60000).toISOString())
      conv3.set('sla_resolucao_deadline', new Date(agora.getTime() + 3000 * 60000).toISOString())
      conv3.set('sla_resposta_at', new Date(agora.getTime() - 120 * 60000).toISOString())
      conv3.set('sla_resolucao_at', new Date(agora.getTime() - 80 * 60000).toISOString())
      conv3.set('ultima_mensagem_texto', 'Muito obrigada, consegui redefinir pelo link do portal!')
      conv3.set('ultima_atividade_at', new Date(agora.getTime() - 80 * 60000).toISOString())
      app.save(conv3)

      const m3_1 = new Record(mensagens)
      m3_1.set('conversa', conv3.id)
      m3_1.set('direcao', 'entrada')
      m3_1.set('autor_tipo', 'usuario')
      m3_1.set('autor_nome', 'Aline Rocha')
      m3_1.set(
        'texto',
        'Boa tarde, esqueci minha senha do Portal do Colaborador, como faço para resetar?',
      )
      m3_1.set('classificacao', {
        pratica: 'service_request',
        categoria: 'Conta / Senha',
        impacto: 'menor',
        urgencia: 'baixa',
        prioridade: 'P4',
      })
      app.save(m3_1)

      const m3_2 = new Record(mensagens)
      m3_2.set('conversa', conv3.id)
      m3_2.set('direcao', 'saida')
      m3_2.set('autor_tipo', 'bot')
      m3_2.set('autor_nome', 'AITSM Bot')
      m3_2.set(
        'texto',
        "Para resetar sua senha, acesse o Portal do Colaborador, clique em 'Esqueci minha senha' e valide o link recebido por e-mail corporativo.",
      )
      m3_2.set('artigos_consultados', ['KB-0207 – Reset de senha do Portal'])
      app.save(m3_2)

      const m3_3 = new Record(mensagens)
      m3_3.set('conversa', conv3.id)
      m3_3.set('direcao', 'entrada')
      m3_3.set('autor_tipo', 'usuario')
      m3_3.set('autor_nome', 'Aline Rocha')
      m3_3.set('texto', 'Muito obrigada, consegui redefinir pelo link do portal! Tudo certo.')
      m3_3.set('classificacao', {
        pratica: 'question',
        categoria: 'Conta / Senha',
        impacto: 'menor',
        urgencia: 'baixa',
        prioridade: 'P4',
      })
      app.save(m3_3)
    } catch (err) {
      console.log('Erro ao semear conversas iniciais (não fatal): ' + err)
    }
  },
  (app) => {
    try {
      const dossies = app.findCollectionByNameOrId('atendimento_dossies')
      app.delete(dossies)
    } catch (_) {}
    try {
      const mensagens = app.findCollectionByNameOrId('atendimento_mensagens')
      app.delete(mensagens)
    } catch (_) {}
    try {
      const conversas = app.findCollectionByNameOrId('atendimento_conversas')
      app.delete(conversas)
    } catch (_) {}
  },
)
