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
    const isApproved = body.decision === 'approved'
    approval.set('status', isApproved ? 'Aprovado' : 'Reprovado')
    approval.set(
      'approver_comment',
      body.comment || (isApproved ? 'Aprovado via interface web' : 'Reprovado via interface web'),
    )
    if (e.auth) {
      approval.set('approver', e.auth.id)
    }
    if (isApproved) {
      approval.set('approved_at', now)
    } else {
      approval.set('rejected_at', now)
    }
    $app.save(approval)

    const ticketId = approval.getString('ticket')
    const ticket = $app.findRecordById('tickets', ticketId)
    var oldTicketStatus = ticket.getString('status')

    if (isApproved) {
      // Se for modo paralelo, cancela outros tokens pendentes deste ticket
      try {
        var otherPending = $app.findRecordsByFilter(
          'approvals',
          'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
          '',
          50,
          0,
        )
        for (var op = 0; op < otherPending.length; op++) {
          otherPending[op].set('status', 'Aprovado')
          otherPending[op].set(
            'approver_comment',
            'Aprovado por outro participante (Modo Paralelo)',
          )
          otherPending[op].set('approved_at', now)
          $app.save(otherPending[op])
        }
      } catch (_) {}

      ticket.set('status', 'Novo')
      $app.save(ticket)
    } else {
      // Reprovado -> cancela o chamado e outras aprovações pendentes
      try {
        var otherPendingRej = $app.findRecordsByFilter(
          'approvals',
          'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
          '',
          50,
          0,
        )
        for (var or = 0; or < otherPendingRej.length; or++) {
          otherPendingRej[or].set('status', 'Reprovado')
          otherPendingRej[or].set('approver_comment', 'Cancelado devido à reprovação')
          otherPendingRej[or].set('rejected_at', now)
          $app.save(otherPendingRej[or])
        }
      } catch (_) {}

      ticket.set('status', 'Cancelado')
      $app.save(ticket)
    }

    const historyCol = $app.findCollectionByNameOrId('ticket_history')
    const hist = new Record(historyCol)
    hist.set('ticket', ticketId)
    hist.set('user', approval.getString('requester'))
    hist.set('action', isApproved ? 'Aprovação autorizada' : 'Aprovação recusada')
    hist.set('field', 'status')
    hist.set('old_value', oldTicketStatus)
    hist.set('new_value', isApproved ? 'Novo' : 'Cancelado')
    $app.save(hist)

    const notifsCol = $app.findCollectionByNameOrId('notifications')
    const requesterId = approval.getString('requester')
    const assignedId = ticket.getString('assigned_to')
    const msg =
      'Aprovação ' + (isApproved ? 'aprovada' : 'reprovada') + ' - #' + ticket.getString('number')

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

// Endpoint direto acionado via clique dos botões no e-mail:
// GET /backend/v1/approvals/act?token=...&action=approve|reject
// Processa a decisão, grava histórico/auditoria e renderiza uma página HTML limpa e amigável
routerAdd('GET', '/backend/v1/approvals/act', (e) => {
  var token = e.request.url.query().get('token') || ''
  var action = (e.request.url.query().get('action') || '').toLowerCase().trim()

  function renderResultHtml(title, isSuccess, message, details) {
    var brandColor = isSuccess ? (action === 'approve' ? '#16a34a' : '#dc2626') : '#f59e0b'
    var icon = isSuccess ? (action === 'approve' ? '✅' : '🚫') : '⚠️'
    var statusTitle = title || (isSuccess ? 'Decisão Processada com Sucesso' : 'Atenção')

    function esc(s) {
      if (s === null || s === undefined) return ''
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    var html =
      '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <title>' +
      esc(statusTitle) +
      ' - ServiceOne ITSM</title>\n' +
      '  <style>\n' +
      '    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; }\n' +
      '    .card { background: #ffffff; border-radius: 12px; max-width: 540px; width: 90%; margin: 20px; padding: 36px 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07); border: 1px solid #e2e8f0; text-align: center; }\n' +
      '    .icon { font-size: 48px; line-height: 1; margin-bottom: 16px; }\n' +
      '    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; }\n' +
      '    p { font-size: 15px; color: #475569; line-height: 24px; margin: 0 0 20px 0; }\n' +
      '    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; color: #ffffff; background-color: ' +
      brandColor +
      '; }\n' +
      '    .details { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; text-align: left; font-size: 13px; color: #334155; margin-bottom: 24px; line-height: 20px; }\n' +
      '    .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; }\n' +
      '  </style>\n</head>\n<body>\n' +
      '  <div class="card">\n' +
      '    <div class="icon">' +
      icon +
      '</div>\n' +
      '    <div class="badge">' +
      (action === 'approve' ? 'Aprovado' : action === 'reject' ? 'Reprovado' : 'Aviso') +
      '</div>\n' +
      '    <h1>' +
      esc(statusTitle) +
      '</h1>\n' +
      '    <p>' +
      esc(message) +
      '</p>\n' +
      (details ? '    <div class="details">' + details + '</div>\n' : '') +
      '    <div class="footer">ServiceOne ITSM • Sistema de Gestão de Chamados e Aprovações</div>\n' +
      '  </div>\n</body>\n</html>'

    return e.html(200, html)
  }

  if (!token) {
    return renderResultHtml(
      'Token Ausente',
      false,
      'O link de aprovação utilizado não possui um token válido.',
      '',
    )
  }

  if (action !== 'approve' && action !== 'reject') {
    return renderResultHtml(
      'Ação Inválida',
      false,
      'A ação solicitada deve ser aprovação (approve) ou reprovação (reject).',
      '',
    )
  }

  try {
    var approval = $app.findFirstRecordByData('approvals', 'token', token)
    var currentStatus = approval.getString('status')

    var ticketId = approval.getString('ticket')
    var ticket = null
    try {
      ticket = $app.findRecordById('tickets', ticketId)
    } catch (_) {}

    var ticketNumber = ticket ? ticket.getString('number') : '-'
    var ticketTitle = ticket ? ticket.getString('title') : '-'

    if (currentStatus !== 'Pendente') {
      var detailsHtml =
        '<strong>Chamado:</strong> #' +
        ticketNumber +
        '<br>' +
        '<strong>Título:</strong> ' +
        ticketTitle +
        '<br>' +
        '<strong>Status já registrado:</strong> ' +
        currentStatus +
        '<br>' +
        (approval.getString('approver_comment')
          ? '<strong>Observação:</strong> ' + approval.getString('approver_comment')
          : '')

      return renderResultHtml(
        'Solicitação Já Processada',
        false,
        'Esta solicitação de aprovação já foi previamente finalizada como "' +
          currentStatus +
          '". Não é possível alterar a decisão por este link.',
        detailsHtml,
      )
    }

    var now = new Date().toISOString()
    var isApprove = action === 'approve'
    var newApprovalStatus = isApprove ? 'Aprovado' : 'Reprovado'
    approval.set('status', newApprovalStatus)
    approval.set(
      'approver_comment',
      'Decisão registrada diretamente via botão do e-mail institucional',
    )
    if (isApprove) {
      approval.set('approved_at', now)
    } else {
      approval.set('rejected_at', now)
    }
    $app.save(approval)

    var oldTicketStatus = ticket ? ticket.getString('status') : 'Aguardando Aprovação'
    var newTicketStatus = isApprove ? 'Novo' : 'Cancelado'
    if (ticket) {
      // Se aprovado em modo paralelo ou sequencial, encerra outras aprovações pendentes
      if (isApprove) {
        try {
          var others = $app.findRecordsByFilter(
            'approvals',
            'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
            '',
            50,
            0,
          )
          for (var o = 0; o < others.length; o++) {
            others[o].set('status', 'Aprovado')
            others[o].set(
              'approver_comment',
              'Aprovado por outro participante (Modo ' +
                (approval.getString('mode') || 'Geral') +
                ')',
            )
            others[o].set('approved_at', now)
            $app.save(others[o])
          }
        } catch (_) {}
      } else {
        try {
          var othersRej = $app.findRecordsByFilter(
            'approvals',
            'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
            '',
            50,
            0,
          )
          for (var or2 = 0; or2 < othersRej.length; or2++) {
            othersRej[or2].set('status', 'Reprovado')
            othersRej[or2].set('approver_comment', 'Chamado reprovado')
            othersRej[or2].set('rejected_at', now)
            $app.save(othersRej[or2])
          }
        } catch (_) {}
      }

      ticket.set('status', newTicketStatus)
      $app.save(ticket)
    }

    // Registra histórico no ticket
    try {
      var historyCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', ticketId)
      hist.set('user', approval.getString('requester') || '')
      hist.set(
        'action',
        isApprove ? 'Aprovação autorizada via e-mail' : 'Aprovação recusada via e-mail',
      )
      hist.set('field', 'status')
      hist.set('old_value', oldTicketStatus)
      hist.set('new_value', newTicketStatus)
      $app.save(hist)
    } catch (hErr) {
      $app.logger().warn('approvals/act: falha ao salvar ticket_history', 'err', hErr.message)
    }

    // Notificações in-app
    try {
      var notifsCol = $app.findCollectionByNameOrId('notifications')
      var requesterId = approval.getString('requester')
      var assignedId = ticket ? ticket.getString('assigned_to') : ''
      var msg =
        'Aprovação ' +
        (isApprove ? 'aprovada' : 'reprovada') +
        ' via e-mail - Chamado #' +
        ticketNumber

      ;[requesterId, assignedId].filter(Boolean).forEach(function (uid) {
        try {
          var notif = new Record(notifsCol)
          notif.set('user', uid)
          notif.set('ticket', ticketId)
          notif.set('title', 'Decisão de Aprovação via E-mail')
          notif.set('message', msg)
          notif.set('type', 'Aprovação')
          notif.set('read', false)
          $app.save(notif)
        } catch (_) {}
      })
    } catch (_) {}

    var successDetails =
      '<strong>Chamado:</strong> #' +
      ticketNumber +
      '<br>' +
      '<strong>Título:</strong> ' +
      ticketTitle +
      '<br>' +
      '<strong>Novo Status do Chamado:</strong> ' +
      newTicketStatus +
      '<br>' +
      '<strong>Data do Registro:</strong> ' +
      new Date().toLocaleString('pt-BR')

    var successMsg = isApprove
      ? 'Você aprovou a solicitação com sucesso! O chamado foi movido para o status "' +
        newTicketStatus +
        '" e o atendimento continuará.'
      : 'Você reprovou a solicitação. O chamado foi cancelado com o status "' +
        newTicketStatus +
        '" e o solicitante foi notificado.'

    return renderResultHtml(
      isApprove ? 'Chamado Aprovado com Sucesso' : 'Chamado Reprovado',
      true,
      successMsg,
      successDetails,
    )
  } catch (err) {
    return renderResultHtml(
      'Aprovação Não Encontrada',
      false,
      'Não foi possível localizar o registro desta aprovação ou o token expirou.',
      'Detalhes do erro: ' + err.message,
    )
  }
})
