routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/delegate',
  (e) => {
    const ticketId = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const type = body.type
    const targetId = body.target_id
    const reason = body.reason || ''
    const delegatorId = e.auth ? e.auth.id : ''

    if (!ticketId || !type || !targetId || !delegatorId) {
      return e.badRequestError('Missing required fields')
    }

    try {
      const ticket = $app.findRecordById('tickets', ticketId)
      const ticketNumber = ticket.getString('number')
      const ticketTitle = ticket.getString('title')
      const priority = ticket.getString('priority') || 'Média'

      const delegator = $app.findRecordById('users', delegatorId)
      const delegatorName = delegator.getString('name')

      // Se houver ciclo de trabalho do operador aberto, encerra e acumula em operator_worked_seconds
      const cycleStartStr = ticket.getString('operator_cycle_start')
      if (cycleStartStr) {
        try {
          const nowIso = new Date().toISOString()
          const cycleStartTime = new Date(cycleStartStr).getTime()
          const nowTime = new Date(nowIso).getTime()
          if (!isNaN(cycleStartTime) && nowTime >= cycleStartTime) {
            const elapsedSec = Math.max(1, Math.round((nowTime - cycleStartTime) / 1000))
            const currentWorkedSec = ticket.getInt('operator_worked_seconds') || 0
            const newWorkedSec = currentWorkedSec + elapsedSec
            ticket.set('operator_worked_seconds', newWorkedSec)
            ticket.set('work_hours', Number((newWorkedSec / 3600).toFixed(4)))

            const ch = Math.floor(elapsedSec / 3600)
            const cm = Math.floor((elapsedSec % 3600) / 60)
            const cs = elapsedSec % 60
            const cycleTimeFormatted =
              String(ch).padStart(2, '0') +
              ':' +
              String(cm).padStart(2, '0') +
              ':' +
              String(cs).padStart(2, '0')

            const cycleUser = ticket.getString('operator_cycle_user') || delegatorId
            try {
              const interCol = $app.findCollectionByNameOrId('ticket_interactions')
              const interRec = new Record(interCol)
              interRec.set('ticket', ticketId)
              interRec.set('author', cycleUser)
              interRec.set('type', 'Interno')
              interRec.set(
                'content',
                'Ciclo de atendimento encerrado por delegação (' +
                  cycleTimeFormatted +
                  ' - ' +
                  elapsedSec +
                  's). Tempo salvo em Horas Trabalhadas.',
              )
              interRec.set('origin', 'Cronômetro')
              interRec.set('duration_minutes', Math.round((elapsedSec / 60) * 100) / 100)
              interRec.set('hour_type', 'Contratada')
              interRec.set('billing_status', 'Faturável')
              $app.save(interRec)
            } catch (iErr) {
              $app.logger().error('delegate: cycle interaction error', 'error', iErr.message)
            }
          }
        } catch (cErr) {
          $app.logger().error('delegate: cycle calculation error', 'error', cErr.message)
        }
        ticket.set('operator_cycle_start', '')
        ticket.set('operator_cycle_user', '')
      }

      if (type === 'technician') {
        let oldAssignedName = 'Não atribuído'
        const oldAssignedId = ticket.getString('assigned_to')
        if (oldAssignedId) {
          try {
            const oldUser = $app.findRecordById('users', oldAssignedId)
            oldAssignedName = oldUser.getString('name')
          } catch (_) {}
        }

        const newTech = $app.findRecordById('users', targetId)
        const newTechName = newTech.getString('name')

        ticket.set('assigned_to', targetId)
        ticket.set('status', 'Atribuído')
        $app.save(ticket)

        const historyCol = $app.findCollectionByNameOrId('ticket_history')
        const history = new Record(historyCol)
        history.set('ticket', ticketId)
        history.set('user', delegatorId)
        history.set('action', 'Delegação')
        history.set('field', 'assigned_to')
        history.set('old_value', oldAssignedName)
        history.set('new_value', reason ? newTechName + ' | Motivo: ' + reason : newTechName)
        $app.save(history)

        const notifCol = $app.findCollectionByNameOrId('notifications')
        const notif = new Record(notifCol)
        notif.set('user', targetId)
        notif.set('ticket', ticketId)
        notif.set('title', 'Chamado delegado a você')
        notif.set(
          'message',
          'Chamado ' +
            ticketNumber +
            ' - ' +
            ticketTitle +
            ' foi delegado a você por ' +
            delegatorName,
        )
        notif.set('type', 'Atribuição')
        notif.set('read', false)
        $app.save(notif)

        return e.json(200, { success: true, priority: priority })
      }

      if (type === 'queue') {
        let oldQueueName = 'Nenhuma'
        const oldQueueId = ticket.getString('queue')
        if (oldQueueId) {
          try {
            const oldQueue = $app.findRecordById('queues', oldQueueId)
            oldQueueName = oldQueue.getString('name')
          } catch (_) {}
        }

        const newQueue = $app.findRecordById('queues', targetId)
        const newQueueName = newQueue.getString('name')
        var members = newQueue.get('members')
        var autoAssignedId = ''

        if (members && members.length > 0) {
          var distributionRule = newQueue.getString('distribution_rule') || 'Disponibilidade'
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
            autoAssignedId = leastLoad || members[0]
          } else if (distributionRule === 'Rodízio') {
            var lastTickets = $app.findRecordsByFilter(
              'tickets',
              "queue = '" + targetId + "' && assigned_to != ''",
              '-created',
              1,
              0,
            )
            if (lastTickets.length > 0) {
              var lastAssigned = lastTickets[0].getString('assigned_to')
              var lastIdx = members.indexOf(lastAssigned)
              var nextIdx = (lastIdx + 1) % members.length
              autoAssignedId = members[nextIdx]
            } else {
              autoAssignedId = members[0]
            }
          } else {
            autoAssignedId = members[0]
          }
        }

        ticket.set('queue', targetId)
        if (autoAssignedId) {
          ticket.set('assigned_to', autoAssignedId)
          ticket.set('status', 'Atribuído')
        } else {
          ticket.set('assigned_to', '')
          ticket.set('status', 'Aguardando Atribuição')
        }
        $app.save(ticket)

        const historyCol2 = $app.findCollectionByNameOrId('ticket_history')
        const history2 = new Record(historyCol2)
        history2.set('ticket', ticketId)
        history2.set('user', delegatorId)
        history2.set('action', 'Delegação')
        history2.set('field', 'queue')
        history2.set('old_value', oldQueueName)
        history2.set('new_value', reason ? newQueueName + ' | Motivo: ' + reason : newQueueName)
        $app.save(history2)

        var recipients = []
        if (autoAssignedId) {
          recipients.push(autoAssignedId)
        } else if (members && members.length > 0) {
          recipients = members
        } else {
          var techs = $app.findRecordsByFilter(
            'users',
            "role = 'tecnico' || role = 'gestor' || role = 'admin'",
            'name',
            100,
            0,
          )
          for (var j = 0; j < techs.length; j++) {
            recipients.push(techs[j].id)
          }
        }

        var notifCol2 = $app.findCollectionByNameOrId('notifications')
        for (var k = 0; k < recipients.length; k++) {
          var n = new Record(notifCol2)
          n.set('user', recipients[k])
          n.set('ticket', ticketId)
          if (autoAssignedId && recipients[k] === autoAssignedId) {
            n.set('title', 'Chamado delegado a você')
            n.set(
              'message',
              'Chamado ' +
                ticketNumber +
                ' - ' +
                ticketTitle +
                ' foi delegado a você por ' +
                delegatorName,
            )
          } else {
            n.set('title', 'Chamado delegado para sua equipe')
            n.set(
              'message',
              'Chamado ' +
                ticketNumber +
                ' - ' +
                ticketTitle +
                ' foi delegado para a equipe ' +
                newQueueName +
                ' por ' +
                delegatorName,
            )
          }
          n.set('type', 'Atribuição')
          n.set('read', false)
          $app.save(n)
        }

        return e.json(200, { success: true, priority: priority })
      }

      return e.badRequestError('Invalid delegation type')
    } catch (err) {
      return e.json(500, { error: 'Erro ao delegar chamado' })
    }
  },
  $apis.requireAuth(),
)
