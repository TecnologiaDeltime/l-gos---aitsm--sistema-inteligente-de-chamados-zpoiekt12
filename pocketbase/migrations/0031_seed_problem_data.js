migrate(
  (app) => {
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var adminId = ''
    try {
      var admin = app.findFirstRecordByData('_pb_users_auth_', 'email', 'inovacao@deltime.com.br')
      adminId = admin.id
    } catch (_) {}

    var problemsCol = app.findCollectionByNameOrId('problems')
    var existingCount = 0
    try {
      existingCount = app.countRecords('problems')
    } catch (_) {}

    if (existingCount === 0 && adminId) {
      var samples = [
        {
          number: 'PRB-000001',
          title: 'Indisponibilidade intermitente servidor de e-mail',
          description:
            'Servidor de e-mail apresenta quedas intermitentes afetando todos os usuários.',
          symptom: 'E-mails não chegam ou atrasam',
          origin: 'Incidente recorrente',
          status: 'Em Investigação',
          priority: 'Alta',
          impact: 'Alto',
          urgency: 'Alta',
          frequency: 'Recorrente',
          affected_users_count: 150,
          affected_services: 'E-mail corporativo',
          avg_downtime: '45 min por ocorrência',
        },
        {
          number: 'PRB-000002',
          title: 'Lentidão em sistema de ERP após atualização',
          description:
            'Sistema ERP apresenta lentidão generalizada após última atualização de versão.',
          symptom: 'Tempo de resposta acima de 30 segundos',
          origin: 'Monitoramento',
          status: 'Causa Identificada',
          priority: 'Crítica',
          impact: 'Crítico',
          urgency: 'Alta',
          frequency: 'Frequente',
          affected_users_count: 300,
          affected_services: 'ERP Corporativo',
          avg_downtime: 'N/A - degradação contínua',
          root_cause_identified: 'Query N+1 introduzida na nova versão do módulo de faturamento',
        },
        {
          number: 'PRB-000003',
          title: 'Falhas de conexão com banco de dados em horário de pico',
          description: 'Conexões com o banco de dados são recusadas durante horário de pico.',
          symptom: 'Erro de timeout na conexão',
          origin: 'Capacidade',
          status: 'Solução de Contorno Implantada',
          priority: 'Alta',
          impact: 'Alto',
          urgency: 'Média',
          frequency: 'Recorrente',
          affected_users_count: 80,
          affected_services: 'Aplicações que usam o banco',
          avg_downtime: '20 min',
          root_cause_identified: 'Pool de conexões insuficiente para o volume de pico',
          effectiveness_start_date: '2026-07-15T00:00:00Z',
          effectiveness_end_date: '2026-07-30T00:00:00Z',
          effectiveness_period_days: 15,
          incidents_before_count: 12,
          incidents_after_count: 2,
        },
      ]

      samples.forEach(function (s) {
        var r = new Record(problemsCol)
        r.set('number', s.number)
        r.set('title', s.title)
        r.set('description', s.description)
        r.set('symptom', s.symptom || '')
        r.set('origin', s.origin)
        r.set('status', s.status)
        r.set('priority', s.priority)
        r.set('impact', s.impact)
        r.set('urgency', s.urgency)
        r.set('frequency', s.frequency)
        r.set('requester', adminId)
        r.set('affected_users_count', s.affected_users_count || 0)
        r.set('affected_services', s.affected_services || '')
        r.set('avg_downtime', s.avg_downtime || '')
        if (s.root_cause_identified) r.set('root_cause_identified', s.root_cause_identified)
        if (s.effectiveness_start_date)
          r.set('effectiveness_start_date', s.effectiveness_start_date)
        if (s.effectiveness_end_date) r.set('effectiveness_end_date', s.effectiveness_end_date)
        if (s.effectiveness_period_days)
          r.set('effectiveness_period_days', s.effectiveness_period_days)
        if (s.incidents_before_count !== undefined)
          r.set('incidents_before_count', s.incidents_before_count)
        if (s.incidents_after_count !== undefined)
          r.set('incidents_after_count', s.incidents_after_count)
        app.save(r)
      })
    }

    var knownErrorsCol = app.findCollectionByNameOrId('known_errors')
    try {
      app.findFirstRecordByData('known_errors', 'known_cause', 'Query N+1 no módulo de faturamento')
    } catch (_) {
      var prb2 = app.findFirstRecordByData('problems', 'number', 'PRB-000002')
      var ke = new Record(knownErrorsCol)
      ke.set('problem', prb2.id)
      ke.set('known_cause', 'Query N+1 no módulo de faturamento')
      ke.set('symptoms', 'Lentidão generalizada no ERP, tempo de resposta acima de 30 segundos')
      ke.set('affected_services', 'ERP Corporativo - Módulo de Faturamento')
      ke.set('workaround', 'Otimização manual de queries críticas via índice temporário')
      ke.set('restrictions', 'Solução temporária, necessita correção no código')
      ke.set('responsible', adminId)
      ke.set('status', 'Ativo')
      app.save(ke)
    }
  },
  (app) => {},
)
