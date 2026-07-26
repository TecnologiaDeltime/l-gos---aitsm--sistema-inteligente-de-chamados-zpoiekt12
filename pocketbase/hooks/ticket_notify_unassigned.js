onRecordAfterCreateSuccess((e) => {
  if (e.record.getString('status') !== 'Aguardando Atribuição') return e.next()

  try {
    var recipients = []
    var queueId = e.record.getString('queue')

    if (queueId) {
      var queue = $app.findRecordById('queues', queueId)
      var members = queue.get('members')
      if (members && members.length > 0) {
        recipients = members
      }
    }

    if (recipients.length === 0) {
      var techs = $app.findRecordsByFilter(
        'users',
        "role = 'tecnico' || role = 'gestor' || role = 'admin'",
        'name',
        100,
        0,
      )
      for (var i = 0; i < techs.length; i++) {
        recipients.push(techs[i].id)
      }
    }

    var notifCollection = $app.findCollectionByNameOrId('notifications')
    var ticketNumber = e.record.getString('number')
    var ticketTitle = e.record.getString('title')

    for (var j = 0; j < recipients.length; j++) {
      var notif = new Record(notifCollection)
      notif.set('user', recipients[j])
      notif.set('ticket', e.record.id)
      notif.set('title', 'Chamado aguardando atribuição: #' + ticketNumber)
      notif.set('message', ticketTitle)
      notif.set('type', 'Atribuição')
      notif.set('read', false)
      $app.save(notif)
    }
  } catch (err) {
    $app.logger().error('ticket_notify_unassigned failed', 'error', err.message)
  }

  return e.next()
}, 'tickets')
