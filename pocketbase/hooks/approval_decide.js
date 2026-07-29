routerAdd('POST', '/backend/v1/approvals/{token}/decide', (e) => {
  const token = e.request.pathValue('token')
  if (!token) return e.badRequestError('Token is required')

  const body = e.requestInfo().body || {}
  if (!body.decision || (body.decision !== 'approved' && body.decision !== 'rejected')) {
    return e.badRequestError("Decision must be 'approved' or 'rejected'")
  }

  try {
    const approval = $app.findFirstRecordByData('approvals', 'token', token)
    if (approval.getString('status') !== 'Pendente') {
      return e.badRequestError('Approval already processed')
    }

    const now = new Date().toISOString()
    approval.set('status', body.decision === 'approved' ? 'Aprovado' : 'Reprovado')
    approval.set('approver_comment', body.comment || '')
    if (e.auth) {
      approval.set('approver', e.auth.id)
    }
    if (body.decision === 'approved') {
      approval.set('approved_at', now)
    } else {
      approval.set('rejected_at', now)
    }
    $app.save(approval)

    const ticketId = approval.getString('ticket')
    const ticket = $app.findRecordById('tickets', ticketId)
    var oldTicketStatus = ticket.getString('status')
    if (body.decision === 'approved') {
      ticket.set('status', 'Novo')
    } else {
      ticket.set('status', 'Cancelado')
    }
    $app.save(ticket)

    const historyCol = $app.findCollectionByNameOrId('ticket_history')
    const hist = new Record(historyCol)
    hist.set('ticket', ticketId)
    hist.set('user', approval.getString('requester'))
    hist.set('action', body.decision === 'approved' ? 'Aprovação aprovada' : 'Reprovação')
    hist.set('field', 'status')
    hist.set('old_value', oldTicketStatus)
    hist.set('new_value', body.decision === 'approved' ? 'Novo' : 'Cancelado')
    $app.save(hist)

    const notifsCol = $app.findCollectionByNameOrId('notifications')
    const requesterId = approval.getString('requester')
    const assignedId = ticket.getString('assigned_to')
    const msg =
      'Aprovação ' +
      (body.decision === 'approved' ? 'aprovada' : 'reprovada') +
      ' - #' +
      ticket.getString('number')

    ;[requesterId, assignedId].filter(Boolean).forEach(function (uid) {
      try {
        var notif = new Record(notifsCol)
        notif.set('user', uid)
        notif.set('ticket', ticketId)
        notif.set('title', 'Decisão de Aprovação')
        notif.set('message', msg)
        notif.set('type', 'Aprovação')
        notif.set('read', false)
        $app.save(notif)
      } catch (_) {}
    })

    return e.json(200, { success: true, status: approval.getString('status') })
  } catch (err) {
    return e.notFoundError('Approval not found')
  }
})
