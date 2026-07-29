onRecordAfterCreateSuccess((e) => {
  var ticket = e.record
  var companyId = ticket.getString('company')
  if (!companyId) return e.next()

  var categoryId = ticket.getString('category')
  var subcategoryId = ticket.getString('subcategory')

  var configs = []
  try {
    configs = $app.findRecordsByFilter(
      'approval_configs',
      'active = true && clients ~ "' + companyId + '"',
      '-created',
      100,
      0,
    )
  } catch (err) {
    return e.next()
  }

  if (!configs || configs.length === 0) return e.next()

  var matched = false
  for (var i = 0; i < configs.length; i++) {
    var activityId = configs[i].getString('activity')
    if (!activityId) {
      matched = true
      break
    }
    if (activityId === categoryId || activityId === subcategoryId) {
      matched = true
      break
    }
  }

  if (!matched) return e.next()

  try {
    $app.findFirstRecordByFilter('approvals', 'ticket = "' + ticket.id + '" && status = "Pendente"')
    return e.next()
  } catch (_) {}

  var assignedTo = ticket.getString('assigned_to')
  var requesterId = assignedTo || ''
  if (!requesterId && e.auth) {
    requesterId = e.auth.id
  }
  if (!requesterId) return e.next()

  try {
    var approvalsCol = $app.findCollectionByNameOrId('approvals')
    var approval = new Record(approvalsCol)
    approval.set('ticket', ticket.id)
    approval.set('requester', requesterId)
    approval.set('type', 'Outros')
    approval.set('justification', 'Chamado criado com atividade que requer aprovação')
    approval.set('status', 'Pendente')
    approval.set('token', $security.randomString(32))
    $app.save(approval)

    var ticketRecord = $app.findRecordById('tickets', ticket.id)
    var oldStatus = ticketRecord.getString('status')
    ticketRecord.set('status', 'Aguardando Aprovação')
    $app.save(ticketRecord)

    var historyCol = $app.findCollectionByNameOrId('ticket_history')
    var hist = new Record(historyCol)
    hist.set('ticket', ticket.id)
    hist.set('user', requesterId)
    hist.set('action', 'Aprovação automática solicitada')
    hist.set('field', 'status')
    hist.set('old_value', oldStatus)
    hist.set('new_value', 'Aguardando Aprovação')
    $app.save(hist)

    try {
      var notifCol = $app.findCollectionByNameOrId('notifications')
      var gestores = $app.findRecordsByFilter(
        'users',
        'role = "admin" || role = "gestor"',
        '',
        50,
        0,
      )
      for (var j = 0; j < gestores.length; j++) {
        var notif = new Record(notifCol)
        notif.set('user', gestores[j].id)
        notif.set('ticket', ticket.id)
        notif.set('title', 'Nova aprovação pendente')
        notif.set('message', 'Chamado #' + ticket.getString('number') + ' requer aprovação')
        notif.set('type', 'Aprovação')
        notif.set('read', false)
        $app.save(notif)
      }
    } catch (_) {}
  } catch (err) {
    $app.logger().error('ticket_approval_check: failed to create approval', 'error', err.message)
  }

  return e.next()
}, 'tickets')
