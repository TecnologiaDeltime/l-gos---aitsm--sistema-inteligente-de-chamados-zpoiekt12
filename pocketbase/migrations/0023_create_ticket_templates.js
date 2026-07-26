migrate(
  (app) => {
    const templates = new Collection({
      name: 'ticket_templates',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'content', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['Resolução', 'Comentário', 'Ambos'],
          required: true,
          maxSelect: 1,
        },
        { name: 'active', type: 'bool' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ticket_templates_type ON ticket_templates (type)',
        'CREATE INDEX idx_ticket_templates_active ON ticket_templates (active)',
      ],
    })
    app.save(templates)

    var interactions = app.findCollectionByNameOrId('ticket_interactions')
    if (!interactions.fields.getByName('template')) {
      interactions.fields.add(
        new RelationField({
          name: 'template',
          collectionId: templates.id,
          maxSelect: 1,
        }),
      )
    }
    app.save(interactions)

    var adminId = ''
    try {
      var admin = app.findAuthRecordByEmail('_pb_users_auth_', 'inovacao@deltime.com.br')
      adminId = admin.id
    } catch (_) {}

    var seedTemplates = [
      {
        name: 'Resolução Padrão - Reinicialização de Serviço',
        content:
          'O problema foi resolvido através da reinicialização do serviço/equipamento. Foi verificada a estabilidade apos a acao e confirmado o funcionamento correto. Nenhum monitoramento adicional necessario.',
        type: 'Resolução',
        active: true,
      },
      {
        name: 'Comentário - Aguardando Retorno do Cliente',
        content:
          'Aguardando retorno do cliente com as informacoes solicitadas para dar continuidade ao atendimento.',
        type: 'Comentário',
        active: true,
      },
      {
        name: 'Acesso Concedido - Resolução/Comentário',
        content:
          'Acesso concedido ao usuario conforme solicitado. Foram aplicadas as permissoes adequadas e testado o login com sucesso.',
        type: 'Ambos',
        active: true,
      },
    ]

    seedTemplates.forEach(function (t) {
      try {
        app.findFirstRecordByData('ticket_templates', 'name', t.name)
      } catch (_) {
        var record = new Record(templates)
        record.set('name', t.name)
        record.set('content', t.content)
        record.set('type', t.type)
        record.set('active', t.active)
        if (adminId) record.set('created_by', adminId)
        app.save(record)
      }
    })
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('ticket_templates'))
    } catch (_) {}
  },
)
