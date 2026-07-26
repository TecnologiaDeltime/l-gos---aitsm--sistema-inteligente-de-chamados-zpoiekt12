routerAdd(
  'POST',
  '/backend/v1/tickets/batch-delegate',
  (e) => {
    const body = e.requestInfo().body || {}
    const ticketIds = body.ticket_ids || []
    const type = body.type
    const targetId = body.target_id
    const reason = body.reason || ''
    const delegatorId = e.auth ? e.auth.id : ''

    if (!ticketIds.length || !type || !targetId || !delegatorId) {
      return e.badRequestError('Missing required fields')
    }

    var success = 0
    var errorCount = 0
    var errorDetails = []

    try {
      var delegator = $app.findRecordById('users', delegatorId)
      var delegatorName = delegator.getString('name')

      var targetName = ''
      if (type === 'technician') {
        var targetUser = $app.findRecordById('users', targetId)
        targetName = targetUser.getString('name')
      } else if (type === 'queue') {
        var targetQueue = $app.findRecordById('queues', targetId)
        targetName = targetQueue.getString('name')
      } else {
        return e.badRequestError('Invalid delegation type')
      }

      var historyCol = $app.findCollectionByNameOrId('ticket_history')
      var notifCol = $app.findCollectionByNameOrId('notifications')

      for (var i = 0; i < ticketIds.length; i++) {
        try {
          var ticket = $app.findRecordById('tickets', ticketIds[i])
          var ticketNumber = ticket.getString('number')
          var ticketTitle = ticket.getString('title')

          if (type === 'technician') {
            var oldAssignedId = ticket.getString('assigned_to')
            var oldAssignedName = ''
            if (oldAssignedId) {
              try {
                var oldUser = $app.findRecordById('users', oldAssignedId)
                oldAssignedName = oldUser.getString('name')
              } catch (_) {}
            }

            ticket.set('assigned_to', targetId)
            ticket.set('status', 'Atribuído')
            $app.save(ticket)

            var newVal = reason ? targetName + ' | Motivo: ' + reason : targetName
            var hist = new Record(historyCol)
            hist.set('ticket', ticketIds[i])
            hist.set('user', delegatorId)
            hist.set('action', 'Delegação em lote')
            hist.set('field', 'assigned_to')
            hist.set('old_value', oldAssignedName)
            hist.set('new_value', newVal)
            $app.save(hist)

            var notif = new Record(notifCol)
            notif.set('user', targetId)
            notif.set('ticket', ticketIds[i])
            notif.set('title', 'Chamado delegado a você')
            notif.set(
              'message',
              'Chamado ' +
                ticketNumber +
                ' - ' +
                ticketTitle +
                ' foi delegado a você por ' +
                delegatorName +
                ' (delegação em lote)',
            )
            notif.set('type', 'Atribuição')
            notif.set('read', false)
            $app.save(notif)

            success++
          } else if (type === 'queue') {
            var oldQueueId = ticket.getString('queue')
            var oldQueueName = ''
            if (oldQueueId) {
              try {
                var oldQueueRec = $app.findRecordById('queues', oldQueueId)
                oldQueueName = oldQueueRec.getString('name')
              } catch (_) {}
            }

            ticket.set('queue', targetId)
            ticket.set('assigned_to', '')
            ticket.set('status', 'Aguardando Atribuição')
            $app.save(ticket)

            var newValQ = reason ? targetName + ' | Motivo: ' + reason : targetName
            var histQ = new Record(historyCol)
            histQ.set('ticket', ticketIds[i])
            histQ.set('user', delegatorId)
            histQ.set('action', 'Delegação em lote')
            histQ.set('field', 'queue')
            histQ.set('old_value', oldQueueName)
            histQ.set('new_value', newValQ)
            $app.save(histQ)

            success++
          }
        } catch (err) {
          errorCount++
          var tNum = ''
          try {
            var tRec = $app.findRecordById('tickets', ticketIds[i])
            tNum = tRec.getString('number')
          } catch (_) {}
          errorDetails.push({
            ticket_id: ticketIds[i],
            ticket_number: tNum,
            error: err.message || 'Unknown error',
          })
        }
      }

      return e.json(200, {
        success: success,
        errors: errorCount,
        total: ticketIds.length,
        error_details: errorDetails,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao delegar chamados em lote', details: err.message })
    }
  },
  $apis.requireAuth(),
)
