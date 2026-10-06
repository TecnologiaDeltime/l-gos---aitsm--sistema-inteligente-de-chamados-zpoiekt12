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
    if (!ticket.getString('sla_response_at')) {
      ticket.set('sla_response_at', now)
    }

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

    try {
      var historyCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', id)
      hist.set('user', userId)
      hist.set('action', 'Iniciar Atendimento')
      hist.set('field', 'sla_response_start')
      hist.set('old_value', '')
      hist.set('new_value', 'Atendimento iniciado — SLA Resposta congelado em ' + now)
      $app.save(hist)
    } catch (hErr) {
      $app.logger().error('ticket_start_service: history logging failed', 'error', hErr.message)
    }

    return e.json(200, {
      success: true,
      sla_response_start: now,
      status: ticket.getString('status'),
      sla_status: ticket.getString('sla_status'),
    })
  },
  $apis.requireAuth(),
)
