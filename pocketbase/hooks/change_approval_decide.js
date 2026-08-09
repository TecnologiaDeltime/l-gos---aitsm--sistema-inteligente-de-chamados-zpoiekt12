routerAdd(
  'POST',
  '/backend/v1/changes/{id}/approve',
  (e) => {
    var changeId = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    var decision = body.decision
    var comment = body.comment || ''
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')
    if (decision !== 'Aprovado' && decision !== 'Recusado') {
      return e.badRequestError('decision must be Aprovado or Recusado')
    }

    try {
      var approvals = $app.findRecordsByFilter(
        'change_approvals',
        'change = "' + changeId + '" && approver = "' + userId + '" && status = "Pendente"',
        '',
        10,
        0,
      )
      if (approvals.length === 0) return e.notFoundError('No pending approval found')

      approvals.forEach(function (a) {
        a.set('status', decision)
        a.set('decision', comment)
        a.set('decided_at', new Date().toISOString())
        $app.save(a)
      })

      var change = $app.findRecordById('changes', changeId)
      var oldStatus = change.getString('status')
      if (decision === 'Aprovado') {
        change.set('approval_status', 'Aprovada')
        change.set('status', 'Aprovada')
        change.set('approved_by', userId)
        change.set('approved_at', new Date().toISOString())
      } else {
        change.set('approval_status', 'Recusada')
        change.set('status', 'Recusada')
      }
      $app.save(change)

      var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
      var log = new Record(auditCol)
      log.set('change', changeId)
      log.set('user', userId)
      log.set('action', decision === 'Aprovado' ? 'Mudança aprovada' : 'Mudança recusada')
      log.set('field', 'status')
      log.set('old_value', oldStatus)
      log.set('new_value', decision === 'Aprovado' ? 'Aprovada' : 'Recusada')
      $app.save(log)

      var notifCol = $app.findCollectionByNameOrId('notifications')
      var requesterId = change.getString('requester')
      if (requesterId) {
        var notif = new Record(notifCol)
        notif.set('user', requesterId)
        notif.set('title', 'Decisão de Mudança')
        notif.set(
          'message',
          'Mudança #' +
            change.getString('number') +
            ' foi ' +
            (decision === 'Aprovado' ? 'aprovada' : 'recusada'),
        )
        notif.set('type', 'Aprovação')
        notif.set('read', false)
        $app.save(notif)
      }

      return e.json(200, { success: true, status: decision })
    } catch (err) {
      return e.internalServerError(err.message)
    }
  },
  $apis.requireAuth(),
)
