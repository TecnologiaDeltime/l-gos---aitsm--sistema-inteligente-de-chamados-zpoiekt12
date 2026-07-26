routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/start',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var ticket = $app.findRecordById('tickets', id)

    var existingStart = ticket.getString('sla_response_start')
    if (existingStart) {
      return e.json(400, { error: 'Atendimento já iniciado' })
    }

    var now = new Date().toISOString()
    ticket.set('sla_response_start', now)

    var currentStatus = ticket.getString('status')
    if (currentStatus !== 'Em Atendimento') {
      ticket.set('status', 'Em Atendimento')
    }

    var responseDeadline = ticket.getString('sla_response_deadline')
    if (responseDeadline) {
      var deadline = new Date(responseDeadline)
      var startTime = new Date(now)
      if (startTime <= deadline) {
        ticket.set('sla_status', 'Dentro do Prazo')
      } else {
        ticket.set('sla_status', 'Violado')
      }
    }

    $app.save(ticket)

    return e.json(200, {
      success: true,
      sla_response_start: now,
      status: ticket.getString('status'),
      sla_status: ticket.getString('sla_status'),
    })
  },
  $apis.requireAuth(),
)
