migrate(
  (app) => {
    const ticketsId = app.findCollectionByNameOrId('tickets').id
    const usersId = '_pb_users_auth_'
    const equipmentsId = app.findCollectionByNameOrId('equipments').id

    const surveys = app.findCollectionByNameOrId('satisfaction_surveys')
    if (!surveys.fields.getByName('token')) {
      surveys.fields.add(new TextField({ name: 'token' }))
    }
    surveys.addIndex('idx_surveys_company', false, 'company', '')
    surveys.addIndex('idx_surveys_respondent', false, 'respondent', '')
    app.save(surveys)

    const approvals = new Collection({
      name: 'approvals',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: ticketsId, required: true, maxSelect: 1 },
        {
          name: 'requester',
          type: 'relation',
          collectionId: usersId,
          required: true,
          maxSelect: 1,
        },
        { name: 'approver', type: 'relation', collectionId: usersId, maxSelect: 1 },
        {
          name: 'type',
          type: 'select',
          values: [
            'Horas Adicionais',
            'Compra de Equipamento',
            'Visita Técnica',
            'Mudança',
            'Reinicialização de Servidor',
            'Criação de Usuário',
            'Liberação de Acesso',
            'Instalação de Software',
            'Fora do Horário',
            'Outros',
          ],
          maxSelect: 1,
        },
        { name: 'justification', type: 'text', required: true },
        { name: 'estimated_hours', type: 'number' },
        { name: 'estimated_cost', type: 'number' },
        { name: 'deadline', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['Pendente', 'Aprovado', 'Reprovado'],
          maxSelect: 1,
        },
        { name: 'approved_at', type: 'date' },
        { name: 'rejected_at', type: 'date' },
        { name: 'approver_comment', type: 'text' },
        { name: 'token', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_approvals_ticket ON approvals (ticket)',
        'CREATE INDEX idx_approvals_status ON approvals (status)',
      ],
    })
    app.save(approvals)

    const technicalVisits = new Collection({
      name: 'technical_visits',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket', type: 'relation', collectionId: ticketsId, required: true, maxSelect: 1 },
        { name: 'equipment', type: 'relation', collectionId: equipmentsId, maxSelect: 1 },
        { name: 'technician', type: 'relation', collectionId: usersId, maxSelect: 1 },
        { name: 'client_address', type: 'text' },
        { name: 'scheduled_date', type: 'date' },
        { name: 'scheduled_time', type: 'text' },
        { name: 'checkin_at', type: 'date' },
        { name: 'checkout_at', type: 'date' },
        { name: 'checkin_location', type: 'text' },
        { name: 'checkout_location', type: 'text' },
        { name: 'materials', type: 'text' },
        { name: 'distance_km', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: ['Agendada', 'Em Andamento', 'Concluída', 'Cancelada'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_visits_ticket ON technical_visits (ticket)',
        'CREATE INDEX idx_visits_equipment ON technical_visits (equipment)',
        'CREATE INDEX idx_visits_technician ON technical_visits (technician)',
      ],
    })
    app.save(technicalVisits)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('approvals'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('technical_visits'))
    } catch (_) {}
    try {
      const surveys = app.findCollectionByNameOrId('satisfaction_surveys')
      if (surveys.fields.getByName('token')) surveys.fields.removeByName('token')
      surveys.removeIndex('idx_surveys_company')
      surveys.removeIndex('idx_surveys_respondent')
      app.save(surveys)
    } catch (_) {}
  },
)
