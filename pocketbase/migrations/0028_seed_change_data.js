migrate(
  (app) => {
    var changeTypes = app.findCollectionByNameOrId('change_types')

    var standardTypeId = ''
    try {
      var existing = app.findFirstRecordByData('change_types', 'name', 'Mudança Padrão')
      standardTypeId = existing.id
    } catch (_) {
      var record = new Record(changeTypes)
      record.set('name', 'Mudança Padrão')
      record.set(
        'description',
        'Mudança pré-autorizada, recorrente, de baixo risco, conhecida, documentada e executada através de procedimento previamente aprovado. Exemplos: criação de usuário, reset de senha, instalação de software previamente aprovado, alteração de configuração recorrente simples.',
      )
      record.set('risk_level', 'Baixo')
      record.set('approval_required', false)
      record.set('committee_approval', false)
      record.set('eligible_for_automation', true)
      record.set('is_standard', true)
      record.set('recurring', true)
      record.set('active', true)
      app.save(record)
      standardTypeId = record.id
    }

    var otherTypes = [
      {
        name: 'Mudança Normal',
        description: 'Mudança que requer avaliação e aprovação antes da execução.',
        risk_level: 'Médio',
        approval_required: true,
        committee_approval: false,
        eligible_for_automation: false,
        is_standard: false,
        recurring: false,
        active: true,
      },
      {
        name: 'Mudança de Emergência',
        description:
          'Mudança urgente que deve ser implementada o mais rápido possível para restaurar serviço ou corrigir erro crítico.',
        risk_level: 'Alto',
        approval_required: true,
        committee_approval: true,
        eligible_for_automation: false,
        is_standard: false,
        recurring: false,
        active: true,
      },
    ]

    otherTypes.forEach(function (t) {
      try {
        app.findFirstRecordByData('change_types', 'name', t.name)
      } catch (_) {
        var r = new Record(changeTypes)
        r.set('name', t.name)
        r.set('description', t.description)
        r.set('risk_level', t.risk_level)
        r.set('approval_required', t.approval_required)
        r.set('committee_approval', t.committee_approval)
        r.set('eligible_for_automation', t.eligible_for_automation)
        r.set('is_standard', t.is_standard)
        r.set('recurring', t.recurring)
        r.set('active', t.active)
        app.save(r)
      }
    })

    var templates = app.findCollectionByNameOrId('change_templates')
    try {
      app.findFirstRecordByData('change_templates', 'name', 'Criação de Usuário - Modelo Padrão')
    } catch (_) {
      var tmpl = new Record(templates)
      tmpl.set('name', 'Criação de Usuário - Modelo Padrão')
      tmpl.set('change_type', standardTypeId)
      tmpl.set('description', 'Modelo padrão para criação de usuários em sistemas corporativos.')
      tmpl.set(
        'procedure',
        '1. Verificar solicitacao aprovada\n2. Coletar dados do usuario (nome, email, departamento)\n3. Criar conta no sistema\n4. Atribuir perfil de acesso conforme politica\n5. Enviar credenciais ao usuario\n6. Confirmar acesso funcionando',
      )
      tmpl.set(
        'checklist',
        JSON.stringify([
          { item: 'Solicitacao aprovada', required: true },
          { item: 'Dados do usuario coletados', required: true },
          { item: 'Conta criada no sistema', required: true },
          { item: 'Perfil de acesso atribuido', required: true },
          { item: 'Credenciais enviadas', required: true },
          { item: 'Acesso testado e confirmado', required: true },
        ]),
      )
      tmpl.set('default_priority', 'Média')
      tmpl.set('default_impact', 'Baixo')
      tmpl.set('default_urgency', 'Média')
      tmpl.set('default_risk_level', 'Baixo')
      tmpl.set('rollback_procedure', 'Desativar conta criada e remover acessos concedidos.')
      tmpl.set(
        'validation_criteria',
        'Usuario consegue acessar o sistema com as credenciais enviadas e possui o perfil correto.',
      )
      tmpl.set('active', true)
      app.save(tmpl)
    }

    var committee = app.findCollectionByNameOrId('change_committee')
    try {
      app.findFirstRecordByData('change_committee', 'name', 'Comitê Consultivo de Mudanças (CAB)')
    } catch (_) {
      var cab = new Record(committee)
      cab.set('name', 'Comitê Consultivo de Mudanças (CAB)')
      cab.set(
        'description',
        'Comitê responsável por avaliar e aprovar mudanças de médio e alto risco.',
      )
      cab.set('meeting_frequency', 'Semanal - Quartas-feiras 10h')
      cab.set('active', true)
      app.save(cab)
    }
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('change_templates', 'name', 'Criação de Usuário - Modelo Padrão'),
      )
    } catch (_) {}
    try {
      app.delete(
        app.findFirstRecordByData(
          'change_committee',
          'name',
          'Comitê Consultivo de Mudanças (CAB)',
        ),
      )
    } catch (_) {}
    ;['Mudança Padrão', 'Mudança Normal', 'Mudança de Emergência'].forEach(function (n) {
      try {
        app.delete(app.findFirstRecordByData('change_types', 'name', n))
      } catch (_) {}
    })
  },
)
