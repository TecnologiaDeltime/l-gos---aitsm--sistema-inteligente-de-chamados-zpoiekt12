migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'assistente-tecnico',
      name: 'Assistente Técnico ITSM',
      description: 'Auxilia na resolução de problemas, consulta de chamados e artigos de TI.',
      systemPrompt:
        'Você é um assistente técnico especialista em ITIL e ITSM para o Sistema de Chamados. Seu papel é auxiliar técnicos e gestores a resolver problemas de TI, encontrar soluções na base de conhecimento e sugerir procedimentos. Responda em Português do Brasil com clareza e objetividade.',
      tier: 'fast',
      tools: [
        { collection: 'tickets', perms: { list: true, read: true } },
        { collection: 'tkt_categories', perms: { list: true, read: true } },
        { collection: 'equipments', perms: { list: true, read: true } },
        { collection: 'knowledge_articles', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Política de SLA padrão: P1 (Resposta 15min, Solução 2h), P2 (Resposta 30min, Solução 4h), P3 (Resposta 1h, Solução 8h), P4 (Resposta 2h, Solução 24h), P5 (Resposta 4h, Solução 48h).',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como redefinir senha do Windows no Active Directory?',
                answer:
                  'Acesse o Server Manager > Active Directory Users and Computers > selecione o usuário > clique em Reset Password e marque para alterar no próximo logon.',
              },
              {
                question: 'Impressora na rede não responde',
                answer:
                  '1. Verifique o ping do IP. 2. Cheque o serviço do Spooler de impressão. 3. Verifique cabo de rede e papel.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'assistente-tecnico')
    } catch (_) {}
  },
)
