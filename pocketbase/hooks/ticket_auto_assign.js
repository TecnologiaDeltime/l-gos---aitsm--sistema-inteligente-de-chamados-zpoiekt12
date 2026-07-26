onRecordCreate((e) => {
  if (e.record.getString('assigned_to')) return e.next()

  var queueId = e.record.getString('queue')

  try {
    if (queueId) {
      var queue = $app.findRecordById('queues', queueId)
      var members = queue.get('members')

      if (members && members.length > 0) {
        var distributionRule = queue.getString('distribution_rule') || 'Disponibilidade'
        var assignedUserId = ''

        if (distributionRule === 'Menor Carga') {
          var leastLoad = ''
          var leastCount = 999999
          for (var i = 0; i < members.length; i++) {
            var openTickets = $app.findRecordsByFilter(
              'tickets',
              "assigned_to = '" +
                members[i] +
                "' && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
              '-created',
              1000,
              0,
            )
            if (openTickets.length < leastCount) {
              leastCount = openTickets.length
              leastLoad = members[i]
            }
          }
          assignedUserId = leastLoad || members[0]
        } else if (distributionRule === 'Rodízio') {
          var lastTickets = $app.findRecordsByFilter(
            'tickets',
            "queue = '" + queueId + "' && assigned_to != ''",
            '-created',
            1,
            0,
          )
          if (lastTickets.length > 0) {
            var lastAssigned = lastTickets[0].getString('assigned_to')
            var lastIdx = members.indexOf(lastAssigned)
            var nextIdx = (lastIdx + 1) % members.length
            assignedUserId = members[nextIdx]
          } else {
            assignedUserId = members[0]
          }
        } else {
          assignedUserId = members[0]
        }

        if (assignedUserId) {
          e.record.set('assigned_to', assignedUserId)
          e.record.set('status', 'Atribuído')
          return e.next()
        }
      }
    }

    e.record.set('status', 'Aguardando Atribuição')
  } catch (err) {
    $app.logger().error('ticket_auto_assign failed', 'error', err.message)
    e.record.set('status', 'Aguardando Atribuição')
  }

  return e.next()
}, 'tickets')
