migrate(
  (app) => {
    const approvalsCol = app.findCollectionByNameOrId('approvals')
    const visitsCol = app.findCollectionByNameOrId('technical_visits')

    try {
      app.findFirstRecordByData(
        'approvals',
        'justification',
        'Aprovação para compra de memória RAM adicional',
      )
    } catch (_) {
      try {
        const ticket = app.findFirstRecordByData('tickets', 'number', '2024-00001')
        const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'inovacao@deltime.com.br')
        const tech = app.findAuthRecordByEmail('_pb_users_auth_', 'tecnico@deltime.com.br')

        const approval = new Record(approvalsCol)
        approval.set('ticket', ticket.id)
        approval.set('requester', tech.id)
        approval.set('approver', admin.id)
        approval.set('type', 'Compra de Equipamento')
        approval.set('justification', 'Aprovação para compra de memória RAM adicional')
        approval.set('estimated_cost', 450)
        approval.set('deadline', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
        approval.set('status', 'Aprovado')
        approval.set('approved_at', new Date().toISOString())
        approval.set('approver_comment', 'Aprovado conforme orçamento apresentado')
        approval.set('token', $security.randomString(32))
        app.save(approval)
      } catch (_) {}
    }

    try {
      app.findFirstRecordByData(
        'technical_visits',
        'notes',
        'Visita técnica para manutenção preventiva',
      )
    } catch (_) {
      try {
        const ticket = app.findFirstRecordByData('tickets', 'number', '2024-00001')
        const tech = app.findAuthRecordByEmail('_pb_users_auth_', 'tecnico@deltime.com.br')

        const visit = new Record(visitsCol)
        visit.set('ticket', ticket.id)
        visit.set('technician', tech.id)
        visit.set('client_address', 'Av. Paulista, 1000 - São Paulo, SP')
        visit.set('scheduled_date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
        visit.set('scheduled_time', '10:00')
        visit.set('checkin_at', new Date(Date.now() - 86400000 + 3600000).toISOString())
        visit.set('checkout_at', new Date(Date.now() - 86400000 + 7200000).toISOString())
        visit.set('checkin_location', '-23.5610,-46.6562')
        visit.set('checkout_location', '-23.5610,-46.6562')
        visit.set('materials', '2x Módulo RAM 16GB, pasta térmica')
        visit.set('distance_km', 15.5)
        visit.set('status', 'Concluída')
        visit.set('notes', 'Visita técnica para manutenção preventiva')
        app.save(visit)
      } catch (_) {}
    }
  },
  (app) => {
    try {
      app.truncateCollection(app.findCollectionByNameOrId('approvals'))
    } catch (_) {}
    try {
      app.truncateCollection(app.findCollectionByNameOrId('technical_visits'))
    } catch (_) {}
  },
)
