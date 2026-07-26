cronAdd('ticket_escalation', '* * * * *', function () {
  var threshold = 30
  var now = new Date()
  var cutoff = new Date(now.getTime() - threshold * 60000).toISOString()

  var tickets = []
  try {
    tickets = $app.findRecordsByFilter(
      'tickets',
      'status = "Aguardando Atribuição" && created <= "' + cutoff + '"',
      'created',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('ticket_escalation: query failed', 'error', err.message)
    return
  }

  if (tickets.length === 0) return

  var supervisors = []
  try {
    supervisors = $app.findRecordsByFilter(
      'users',
      'role = "admin" || role = "gestor"',
      'name',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('ticket_escalation: supervisor query failed', 'error', err.message)
    return
  }

  var historyCol = $app.findCollectionByNameOrId('ticket_history')
  var notifCol = $app.findCollectionByNameOrId('notifications')

  for (var i = 0; i < tickets.length; i++) {
    var ticket = tickets[i]
    var ticketNumber = ticket.getString('number')
    var ticketTitle = ticket.getString('title')
    var ticketId = ticket.id

    ticket.set('status', 'Escalonado')
    $app.save(ticket)

    try {
      var history = new Record(historyCol)
      history.set('ticket', ticketId)
      history.set(
        'action',
        'Chamado escalonado automaticamente apos ' + threshold + ' minutos sem atribuicao',
      )
      history.set('field', 'status')
      history.set('old_value', 'Aguardando Atribuicao')
      history.set('new_value', 'Escalonado')
      $app.save(history)
    } catch (err) {
      $app.logger().error('ticket_escalation: history save failed', 'error', err.message)
    }

    for (var j = 0; j < supervisors.length; j++) {
      try {
        var notif = new Record(notifCol)
        notif.set('user', supervisors[j].id)
        notif.set('ticket', ticketId)
        notif.set('title', 'Chamado Escalonado #' + ticketNumber)
        notif.set(
          'message',
          'O chamado #' +
            ticketNumber +
            ' - ' +
            ticketTitle +
            ' ficou em Aguardando Atribuicao por mais de ' +
            threshold +
            ' minutos e foi escalonado.',
        )
        notif.set('type', 'Sistema')
        notif.set('read', false)
        $app.save(notif)
      } catch (err) {
        $app.logger().error('ticket_escalation: notification save failed', 'error', err.message)
      }
    }
  }

  $app.logger().info('ticket_escalation: escalated ' + tickets.length + ' ticket(s)')
})
