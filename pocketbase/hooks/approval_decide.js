// pocketbase/hooks/approval_decide.js
// Lógos AITSM - Processamento de Decisões de Aprovação (Web + E-mail + Portal)
// Regra "BASTA UM" (múltiplos aprovadores): a PRIMEIRA aprovação libera o chamado;
// a PRIMEIRA reprovação encerra o chamado com status "Reprovado" (não "Resolvido").
// Reprovação: encerra, retoma SLA (pausa "Aguardando Aprovação" fechada), grava log
// com o motivo e envia e-mail ao solicitante (alerta ticket_approval_rejected_notify).
// Aprovação: retoma SLA (padrão resume-sla) e grava log com o comentário.
//
// PADRÃO GOJA OBRIGATÓRIO (pool de VMs — provado em produção): NADA de declarações
// top-level compartilhadas entre callbacks (o deploy falha com "Hook scoping error:
// top-level decl" e/ou helpers ficam invisíveis). TODA a lógica e TODOS os helpers
// — inclusive o despacho de e-mail pela Central de Alertas — vivem DENTRO do corpo
// de cada rota, duplicados entre elas (mesmo padrão de ticket_approval_check.js e
// ticket_created_client_email.js). Nenhuma referência externa, nem globalThis/_g.

// ============================================================================
// ROTA 1 — POST /backend/v1/approvals/{token}/decide (interface web/portal)
// ============================================================================
routerAdd('POST', '/backend/v1/approvals/{token}/decide', (e) => {
  const token = e.request.pathValue('token')
  if (!token) return e.badRequestError('Token is required')

  const body = e.requestInfo().body || {}
  if (!body.decision || (body.decision !== 'approved' && body.decision !== 'rejected')) {
    return e.badRequestError("Decision must be 'approved' or 'rejected'")
  }

  // ==========================================================================
  // HELPER AUTOCONTIDO — e-mail de reprovação via Central de Alertas
  // (duplicado inline em cada rota; padrão Goja comprovado em produção)
  // ==========================================================================
  function sendRejectionEmail(opts) {
    if (!opts) return
    var ticket = opts.ticket
    var rejectionReason = opts.rejectionReason || 'Não especificado'
    var referenceId = opts.referenceId || ''

    var requesterEmail = ticket.getString('requester_email') || ''
    var requesterName = ticket.getString('requester_name') || 'Solicitante'
    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Chamado sem título'

    // --- Central de Alertas: configuração do alerta ---
    var cfg = null
    try {
      var rec = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "ticket_approval_rejected_notify"',
      )
      if (rec) {
        cfg = {
          enabled: rec.getBool('enabled'),
          template_layout: rec.getString('template_layout') || 'modern',
          primary_color: rec.getString('primary_color') || '#D97706',
          subject_template: rec.getString('subject_template') || '',
          header_title: rec.getString('header_title') || '',
          header_subtitle: rec.getString('header_subtitle') || '',
          body_template: rec.getString('body_template') || '',
          footer_text: rec.getString('footer_text') || '',
          show_button: rec.getBool('show_button'),
          button_label: rec.getString('button_label') || 'Acessar',
          button_url_template: rec.getString('button_url_template') || '',
        }
      }
    } catch (err) {
      console.error('[APPROVAL_DECIDE] falha ao ler email_alert_settings: ' + err.message)
      return
    }
    if (!cfg) return
    if (!cfg.enabled) {
      console.log(
        '[APPROVAL_DECIDE] e-mail de reprovação SUPRIMIDO — ticket_approval_rejected_notify desligado na Central',
      )
      return
    }

    var baseUrl = ''
    try {
      var host =
        $os.getenv('PUBLIC_URL') ||
        $os.getenv('APP_URL') ||
        $os.getenv('PB_INSTANCE_URL') ||
        $os.getenv('SITE_URL') ||
        ''
      if (host) baseUrl = host.replace(/\/+$/, '')
    } catch (_) {}
    var portalLink = baseUrl + '/portal'

    var data = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      solicitante: requesterName,
      cliente: requesterName,
      aprovador: opts.approverName || 'Aprovador',
      motivo: rejectionReason,
      link: portalLink,
    }

    function interp(template, dataObj) {
      if (!template) return ''
      var result = template
      var keys = Object.keys(dataObj)
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        var val = dataObj[k] == null ? '' : String(dataObj[k])
        var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
        result = result.replace(regex, val)
      }
      result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
      return result
    }

    function escHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    var rawSubject =
      cfg.subject_template ||
      cfg.default_subject_template ||
      'Chamado #{{chamado_numero}} reprovado pelo aprovador'
    var subject = interp(rawSubject, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var bodyHtml = interp(rawBody, data)
    var buttonUrl = interp(cfg.button_url_template || '{{link}}', data)
    var buttonLabel = interp(cfg.button_label || 'Acessar o Portal', data)
    var primaryColor = cfg.primary_color || '#D97706'
    var layout = cfg.template_layout || 'modern'
    var headerTitle = cfg.header_title || 'Lógos AITSM'
    var headerSubtitle = cfg.header_subtitle || 'Sistema Inteligente de Gestão de Serviços de TI'
    var footerText = cfg.footer_text || 'Lógos AITSM • Central de Serviços Inteligente'
    var buttonHtml = ''
    if (cfg.show_button && buttonUrl) {
      buttonHtml =
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
        '<tr><td align="center" style="border-radius: 6px; background-color: ' +
        primaryColor +
        ';">' +
        '<a href="' +
        escHtml(buttonUrl) +
        '" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; display: inline-block; font-weight: 600;">' +
        escHtml(buttonLabel) +
        '</a></td></tr></table>'
    }
    var htmlContent
    if (layout === 'minimal') {
      htmlContent =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f9fafb;color:#111827;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">' +
        '<tr><td style="padding:24px 32px;border-bottom:2px solid ' +
        primaryColor +
        ';"><span style="font-size:20px;font-weight:800;color:#111827;">' +
        escHtml(headerTitle) +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">' +
            escHtml(headerSubtitle) +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding:32px;line-height:1.6;font-size:15px;color:#374151;">' +
        bodyHtml +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding:20px 32px;background-color:#f9fafb;font-size:12px;color:#9ca3af;text-align:center;">' +
        escHtml(footerText) +
        '</td></tr></table></body></html>'
    } else {
      // modern (padrão) — barra grafite + letras âmbar (tema oficial)
      htmlContent =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
        '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.08);">' +
        '<tr><td style="padding:28px 36px;background-color:#17181C;border-bottom:4px solid ' +
        primaryColor +
        ';"><span style="font-size:22px;font-weight:900;color:#FCD34D;letter-spacing:0.5px;text-transform:uppercase;">' +
        escHtml(headerTitle) +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin:6px 0 0 0;font-size:13px;color:#e2e8f0;font-weight:400;">' +
            escHtml(headerSubtitle) +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding:36px;line-height:1.7;font-size:15px;color:#1e293b;">' +
        bodyHtml +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding:22px 36px;background-color:#f1f5f9;font-size:12px;color:#64748b;text-align:center;">' +
        escHtml(footerText) +
        '</td></tr></table></body></html>'
    }

    // ---- duplicidade + log + envio ----
    var recipient = String(requesterEmail || '')
      .trim()
      .toLowerCase()
    if (!recipient || recipient.indexOf('@') < 1) {
      console.error('[APPROVAL_DECIDE] e-mail de reprovação ABORTADO — solicitante sem e-mail')
      return
    }
    if (referenceId) {
      try {
        var dup = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "ticket_approval_rejected_notify" && reference_id = "' +
            String(referenceId).replace(/"/g, '\\"') +
            '" && recipient = "' +
            recipient.replace(/"/g, '\\"') +
            '"',
        )
        if (dup) {
          console.log('[APPROVAL_DECIDE] e-mail de reprovação já enviado antes — não reenvia')
          return
        }
      } catch (_) {}
    }

    try {
      var senderAddress = 'noreply@mail.goskip.dev'
      var senderName = 'Lógos AITSM'
      try {
        var s = $app.settings
        if (typeof s === 'function') s = s()
        if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
        if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
      } catch (_) {}

      var message = new MailerMessage({
        from: { address: senderAddress, name: senderName },
        to: [{ address: recipient }],
        subject: subject,
        html: htmlContent,
        text: interp(rawBody, data).replace(/<[^>]+>/g, ' '),
      })
      var client = $app.newMailClient()
      client.send(message)
      try {
        var logCol = $app.findCollectionByNameOrId('email_sent_logs')
        var log = new Record(logCol)
        log.set('alert_key', 'ticket_approval_rejected_notify')
        log.set('reference_id', String(referenceId || '').trim())
        log.set('recipient', recipient)
        log.set('sent_at', new Date().toISOString().replace('T', ' '))
        log.set('subject', subject || '')
        $app.save(log)
      } catch (errLog) {
        console.warn('[APPROVAL_DECIDE] falha ao salvar email_sent_logs: ' + errLog.message)
      }
      console.log(
        '[APPROVAL_DECIDE] e-mail de reprovação enviado via Skip Cloud | destinatário=' + recipient,
      )
    } catch (errSend) {
      console.error(
        '[APPROVAL_DECIDE] FALHA no envio Skip Cloud | destinatário=' +
          recipient +
          ' | motivo: ' +
          (errSend && errSend.message ? errSend.message : String(errSend)),
      )
    }
  }

  try {
    const approval = $app.findFirstRecordByData('approvals', 'token', token)
    if (approval.getString('status') !== 'Pendente') {
      return e.badRequestError('Approval already processed')
    }

    const now = new Date().toISOString()
    const isApproved = body.decision === 'approved'
    const comment =
      body.comment ||
      (isApproved ? 'Aprovado via interface do sistema' : 'Reprovado via interface do sistema')
    const rejectionReason = !isApproved ? body.reason || body.comment || 'Recusado sem detalhe' : ''

    approval.set('status', isApproved ? 'Aprovado' : 'Reprovado')
    approval.set('approver_comment', comment)
    if (rejectionReason) {
      approval.set('rejection_reason', rejectionReason)
    }
    if (e.auth) {
      approval.set('approver', e.auth.id)
    } else if (!approval.getString('approver')) {
      // Aprovação pública (portal sem login): resolve o aprovador pelo contato do token
      try {
        var contactOfTok = null
        try {
          contactOfTok = $app.findRecordById(
            'client_contacts',
            approval.getString('target_contact'),
          )
        } catch (_) {}
        if (contactOfTok && contactOfTok.getString('user')) {
          approval.set('approver', contactOfTok.getString('user'))
        }
      } catch (_) {}
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

    var approvalRole = approval.getString('approval_role') || 'general'
    var roleLabel =
      approvalRole === 'client'
        ? 'Cliente (Ponto Focal)'
        : approvalRole === 'internal'
          ? 'Aprovador Interno TI'
          : 'Aprovador'

    // Nome + id de usuário do aprovador (rastreabilidade no histórico)
    var approverName = roleLabel
    var approverUserId = e.auth ? e.auth.id : ''
    try {
      var approverRec = null
      try {
        approverRec = $app.findRecordById('users', approval.getString('approver'))
      } catch (_) {}
      if (!approverRec) {
        try {
          approverRec = $app.findRecordById('client_contacts', approval.getString('target_contact'))
        } catch (_) {}
      }
      if (approverRec) {
        var nm = (approverRec.getString('name') || '').trim()
        if (nm) approverName = nm
        var au = ''
        try {
          au = approverRec.getString('user') || ''
        } catch (_) {}
        if (au) approverUserId = au
      }
    } catch (_) {}
    if (!approverUserId) approverUserId = approval.getString('requester') || ''

    if (isApproved) {
      // Regra BASTA UM: a PRIMEIRA aprovação decide e libera o chamado imediatamente.
      // Retoma o SLA: fecha a pausa aberta (reason "Aguardando Aprovação"), soma o
      // tempo em sla_pause_total_minutes e prorroga o deadline proporcionalmente.
      var resumeMinutes = 0
      var resumeTotal = ticket.getInt('sla_pause_total_minutes') || 0
      if (ticket.getBool('sla_paused')) {
        var nowResume = new Date()
        var nowResumeIso = nowResume.toISOString()
        var openPauses = []
        try {
          openPauses = $app.findRecordsByFilter(
            'sla_pauses',
            'ticket = "' + ticketId + '" && resumed_at = ""',
            '-created',
            1,
            0,
          )
        } catch (_) {}
        if (openPauses.length > 0) {
          var pauseRec = openPauses[0]
          var pausedAtStr = pauseRec.getString('paused_at')
          if (pausedAtStr) {
            var pausedAt = new Date(pausedAtStr)
            var diffMs = nowResume.getTime() - pausedAt.getTime()
            resumeMinutes = Math.max(1, Math.round(diffMs / 60000))
          }
          pauseRec.set('resumed_at', nowResumeIso)
          pauseRec.set('resumed_by', approverUserId)
          pauseRec.set('duration_minutes', resumeMinutes)
          $app.save(pauseRec)
        }
        resumeTotal = (ticket.getInt('sla_pause_total_minutes') || 0) + resumeMinutes
        ticket.set('sla_pause_total_minutes', resumeTotal)
        ticket.set('sla_paused', false)
        var curDeadline = ticket.getString('sla_solution_deadline')
        if (curDeadline && resumeMinutes > 0) {
          var prevMs = new Date(curDeadline).getTime()
          if (!isNaN(prevMs)) {
            ticket.set(
              'sla_solution_deadline',
              new Date(prevMs + resumeMinutes * 60000).toISOString(),
            )
          }
        }
        var updDeadline = ticket.getString('sla_solution_deadline')
        var nowMs2 = nowResume.getTime()
        if (updDeadline && nowMs2 > new Date(updDeadline).getTime()) {
          ticket.set('sla_status', 'Violado')
        } else {
          ticket.set('sla_status', 'Dentro do Prazo')
        }
        ticket.set('status', 'Em Atendimento')
      } else {
        ticket.set('status', 'Novo')
      }
      ticket.set('approval_hold', false)
      $app.save(ticket)

      // Fecha as demais pendências do mesmo chamado como "Cancelado"
      var cancelledCount = 0
      try {
        var otherPending = $app.findRecordsByFilter(
          'approvals',
          'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
          '',
          50,
          0,
        )
        for (var op = 0; op < otherPending.length; op++) {
          otherPending[op].set('status', 'Cancelado')
          otherPending[op].set(
            'approver_comment',
            'Resolvida por outro aprovador — chamado liberado por ' + roleLabel,
          )
          otherPending[op].set('rejected_at', now)
          $app.save(otherPending[op])
          cancelledCount++
        }
      } catch (_) {}

      // Log de rastreabilidade da aprovação (com motivo/comentário do aprovador)
      var historyCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', ticketId)
      hist.set('user', approverUserId)
      hist.set(
        'action',
        'Aprovação autorizada por ' +
          approverName +
          ' (' +
          roleLabel +
          ')' +
          (comment ? ': "' + comment + '"' : '') +
          ' — Regra "basta um": primeiro aprovador libera o chamado. Chamado liberado para atendimento.' +
          (resumeMinutes > 0
            ? ' SLA retomado após pausa de ' +
              resumeMinutes +
              ' min (total pausado: ' +
              resumeTotal +
              ' min).'
            : '') +
          (cancelledCount > 0 ? ' Outras ' + cancelledCount + ' pendência(s) cancelada(s).' : ''),
      )
      hist.set('field', 'status')
      hist.set('old_value', oldTicketStatus)
      hist.set('new_value', ticket.getString('status'))
      $app.save(hist)
    } else {
      // Reprovação: encerra o chamado com status "Reprovado" e cancela as outras pendências
      try {
        var otherPendingRej = $app.findRecordsByFilter(
          'approvals',
          'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
          '',
          50,
          0,
        )
        for (var or = 0; or < otherPendingRej.length; or++) {
          otherPendingRej[or].set('status', 'Cancelado')
          otherPendingRej[or].set(
            'approver_comment',
            'Cancelado devido à reprovação por ' + roleLabel,
          )
          if (rejectionReason) otherPendingRej[or].set('rejection_reason', rejectionReason)
          otherPendingRej[or].set('rejected_at', now)
          $app.save(otherPendingRej[or])
        }
      } catch (_) {}

      ticket.set('status', 'Reprovado')
      ticket.set('approval_hold', false)
      $app.save(ticket)

      // Log de rastreabilidade da reprovação (com o motivo do aprovador)
      var historyColRej = $app.findCollectionByNameOrId('ticket_history')
      var histRej = new Record(historyColRej)
      histRej.set('ticket', ticketId)
      histRej.set('user', approverUserId)
      histRej.set(
        'action',
        'Aprovação reprovada por ' +
          approverName +
          ' (' +
          roleLabel +
          ') | Motivo: ' +
          (rejectionReason || comment || 'Não especificado') +
          '. Chamado encerrado por reprovação.',
      )
      histRej.set('field', 'status')
      histRej.set('old_value', oldTicketStatus)
      histRej.set('new_value', 'Reprovado')
      $app.save(histRej)

      // E-mail de reprovação ao solicitante (alerta ticket_approval_rejected_notify)
      sendRejectionEmail({
        ticket: ticket,
        approverName: approverName,
        rejectionReason: rejectionReason || comment || 'Não especificado',
        referenceId: ticketId + ':rejected',
      })
    }

    // Notificações in-app
    const notifsCol = $app.findCollectionByNameOrId('notifications')
    const requesterId = approval.getString('requester')
    const assignedId = ticket.getString('assigned_to')
    const msg =
      'Aprovação ' +
      (isApproved ? 'autorizada' : 'recusada') +
      ' por ' +
      approverName +
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
    return e.notFoundError('Approval not found: ' + err.message)
  }
})

// ============================================================================
// ROTA 2 — GET /backend/v1/approvals/act (botões do e-mail, decisão pública)
// Mesmo padrão: helpers 100% inline neste callback.
// ============================================================================
routerAdd('GET', '/backend/v1/approvals/act', (e) => {
  var token = e.request.url.query().get('token') || ''
  var action = (e.request.url.query().get('action') || '').toLowerCase().trim()
  var queryReason = e.request.url.query().get('reason') || ''

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
      ' - Lógos AITSM</title>\n' +
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
      '    <div class="footer">Lógos AITSM • Sistema de Gestão de Chamados e Aprovações</div>\n' +
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

    var now2 = new Date().toISOString()
    var isApprove = action === 'approve'
    var commentText = 'Decisão registrada diretamente via botão do e-mail institucional'
    var newApprovalStatus = isApprove ? 'Aprovado' : 'Reprovado'
    approval.set('status', newApprovalStatus)
    approval.set('approver_comment', commentText)
    if (!isApprove && queryReason) {
      approval.set('rejection_reason', queryReason)
    }
    if (isApprove) {
      approval.set('approved_at', now2)
    } else {
      approval.set('rejected_at', now2)
    }
    $app.save(approval)

    var oldTicketStatus = ticket ? ticket.getString('status') : 'Aguardando Aprovação'
    var role = approval.getString('approval_role') || 'general'
    var roleText =
      role === 'client'
        ? 'Cliente (Ponto Focal)'
        : role === 'internal'
          ? 'Aprovador Interno TI'
          : 'Aprovador'

    var approverName = roleText
    var approverUserId = ''
    try {
      var approverRec2 = null
      try {
        approverRec2 = $app.findRecordById('users', approval.getString('approver'))
      } catch (_) {}
      if (!approverRec2) {
        try {
          approverRec2 = $app.findRecordById(
            'client_contacts',
            approval.getString('target_contact'),
          )
        } catch (_) {}
      }
      if (approverRec2) {
        var nm2 = (approverRec2.getString('name') || '').trim()
        if (nm2) approverName = nm2
        var au2 = ''
        try {
          au2 = approverRec2.getString('user') || ''
        } catch (_) {}
        if (au2) approverUserId = au2
      }
    } catch (_) {}
    if (!approverUserId) approverUserId = approval.getString('requester') || ''

    var newTicketStatus = oldTicketStatus
    var resumeMinutes2 = 0

    if (ticket) {
      if (isApprove) {
        // Regra BASTA UM + retomada de SLA (padrão resume-sla)
        if (ticket.getBool('sla_paused')) {
          var nowResume2 = new Date()
          var nowResume2Iso = nowResume2.toISOString()
          var openPauses2 = []
          try {
            openPauses2 = $app.findRecordsByFilter(
              'sla_pauses',
              'ticket = "' + ticketId + '" && resumed_at = ""',
              '-created',
              1,
              0,
            )
          } catch (_) {}
          if (openPauses2.length > 0) {
            var pauseRec2 = openPauses2[0]
            var pausedAtStr2 = pauseRec2.getString('paused_at')
            if (pausedAtStr2) {
              var pausedAt2 = new Date(pausedAtStr2)
              var diffMs2 = nowResume2.getTime() - pausedAt2.getTime()
              resumeMinutes2 = Math.max(1, Math.round(diffMs2 / 60000))
            }
            pauseRec2.set('resumed_at', nowResume2Iso)
            pauseRec2.set('resumed_by', approverUserId)
            pauseRec2.set('duration_minutes', resumeMinutes2)
            $app.save(pauseRec2)
          }
          var resumeTotal2 = (ticket.getInt('sla_pause_total_minutes') || 0) + resumeMinutes2
          ticket.set('sla_pause_total_minutes', resumeTotal2)
          ticket.set('sla_paused', false)
          var curDl2 = ticket.getString('sla_solution_deadline')
          if (curDl2 && resumeMinutes2 > 0) {
            var prevMs2 = new Date(curDl2).getTime()
            if (!isNaN(prevMs2)) {
              ticket.set(
                'sla_solution_deadline',
                new Date(prevMs2 + resumeMinutes2 * 60000).toISOString(),
              )
            }
          }
          var updDl2 = ticket.getString('sla_solution_deadline')
          if (updDl2 && nowResume2.getTime() > new Date(updDl2).getTime()) {
            ticket.set('sla_status', 'Violado')
          } else {
            ticket.set('sla_status', 'Dentro do Prazo')
          }
          ticket.set('status', 'Em Atendimento')
        } else {
          ticket.set('status', 'Novo')
        }
        ticket.set('approval_hold', false)
        $app.save(ticket)

        try {
          var remain = $app.findRecordsByFilter(
            'approvals',
            'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
            '',
            50,
            0,
          )
          for (var rp = 0; rp < remain.length; rp++) {
            remain[rp].set('status', 'Cancelado')
            remain[rp].set(
              'approver_comment',
              'Resolvida por outro aprovador — chamado liberado por ' + roleText,
            )
            remain[rp].set('rejected_at', now2)
            $app.save(remain[rp])
          }
        } catch (_) {}
      } else {
        // Reprovação: encerra o chamado com status "Reprovado" e cancela as outras pendências
        newTicketStatus = 'Reprovado'
        try {
          var othersRej = $app.findRecordsByFilter(
            'approvals',
            'ticket = "' + ticketId + '" && id != "' + approval.id + '" && status = "Pendente"',
            '',
            50,
            0,
          )
          for (var or2 = 0; or2 < othersRej.length; or2++) {
            othersRej[or2].set('status', 'Cancelado')
            othersRej[or2].set('approver_comment', 'Cancelado devido à reprovação por ' + roleText)
            if (queryReason) othersRej[or2].set('rejection_reason', queryReason)
            othersRej[or2].set('rejected_at', now2)
            $app.save(othersRej[or2])
          }
        } catch (_) {}

        ticket.set('status', 'Reprovado')
        ticket.set('approval_hold', false)
        $app.save(ticket)
      }
    }

    // Log de rastreabilidade no ticket (com o motivo em caso de reprovação)
    try {
      var historyCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', ticketId)
      hist.set('user', approverUserId)
      hist.set(
        'action',
        isApprove
          ? 'Aprovação autorizada via e-mail por ' +
              approverName +
              ' (' +
              roleText +
              ')' +
              ' — Regra "basta um": primeiro aprovador libera o chamado. Liberado para fila de atendimento.' +
              (resumeMinutes2 > 0 ? ' SLA retomado (pausa de ' + resumeMinutes2 + ' min).' : '')
          : 'Aprovação reprovada via e-mail por ' +
              approverName +
              ' (' +
              roleText +
              ')' +
              (queryReason ? ' | Motivo: ' + queryReason : ' | Motivo: Não especificado') +
              ' — Chamado encerrado por reprovação.',
      )
      hist.set('field', 'status')
      hist.set('old_value', oldTicketStatus)
      hist.set('new_value', newTicketStatus)
      $app.save(hist)
    } catch (hErr) {
      $app.logger().warn('approvals/act: falha ao salvar ticket_history', 'err', hErr.message)
    }

    // E-mail de reprovação ao solicitante (alerta ticket_approval_rejected_notify)
    if (!isApprove && ticket) {
      var rejReason = queryReason || commentText
      var requesterEmail = ticket.getString('requester_email') || ''
      var requesterName = ticket.getString('requester_name') || 'Solicitante'

      var cfg = null
      try {
        var rec = $app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "ticket_approval_rejected_notify"',
        )
        if (rec) {
          cfg = {
            enabled: rec.getBool('enabled'),
            template_layout: rec.getString('template_layout') || 'modern',
            primary_color: rec.getString('primary_color') || '#D97706',
            subject_template: rec.getString('subject_template') || '',
            header_title: rec.getString('header_title') || '',
            header_subtitle: rec.getString('header_subtitle') || '',
            body_template: rec.getString('body_template') || '',
            footer_text: rec.getString('footer_text') || '',
            show_button: rec.getBool('show_button'),
            button_label: rec.getString('button_label') || 'Acessar',
            button_url_template: rec.getString('button_url_template') || '',
          }
        }
      } catch (errCfg) {
        console.error('[APPROVAL_ACT] falha ao ler email_alert_settings: ' + errCfg.message)
      }
      if (cfg && cfg.enabled) {
        var baseUrl2 = ''
        try {
          var host2 =
            $os.getenv('PUBLIC_URL') ||
            $os.getenv('APP_URL') ||
            $os.getenv('PB_INSTANCE_URL') ||
            $os.getenv('SITE_URL') ||
            ''
          if (host2) baseUrl2 = host2.replace(/\/+$/, '')
        } catch (_) {}
        var data2 = {
          chamado_numero: ticketNumber,
          numero: ticketNumber,
          titulo: ticketTitle,
          solicitante: requesterName,
          cliente: requesterName,
          aprovador: approverName,
          motivo: rejReason,
          link: baseUrl2 + '/portal',
        }
        function interp2(template, dataObj) {
          if (!template) return ''
          var result = template
          var keys2 = Object.keys(dataObj)
          for (var i2 = 0; i2 < keys2.length; i2++) {
            var k2 = keys2[i2]
            var val2 = dataObj[k2] == null ? '' : String(dataObj[k2])
            var regex2 = new RegExp('\\{\\{\\s*' + k2 + '\\s*\\}\\}', 'gi')
            result = result.replace(regex2, val2)
          }
          result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
          return result
        }
        function escHtml2(s) {
          return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
        }
        var recipient2 = String(requesterEmail || '')
          .trim()
          .toLowerCase()
        if (!recipient2 || recipient2.indexOf('@') < 1) {
          console.error('[APPROVAL_ACT] e-mail de reprovação ABORTADO — solicitante sem e-mail')
        } else {
          var alreadySent = false
          try {
            var dup2 = $app.findFirstRecordByFilter(
              'email_sent_logs',
              'alert_key = "ticket_approval_rejected_notify" && reference_id = "' +
                String(ticketId + ':rejected').replace(/"/g, '\\"') +
                '" && recipient = "' +
                recipient2.replace(/"/g, '\\"') +
                '"',
            )
            alreadySent = Boolean(dup2)
          } catch (_) {}
          if (alreadySent) {
            console.log('[APPROVAL_ACT] e-mail de reprovação já enviado antes — não reenvia')
          } else {
            var rawSubject2 =
              cfg.subject_template ||
              cfg.default_subject_template ||
              'Chamado #{{chamado_numero}} reprovado pelo aprovador'
            var subject2 = interp2(rawSubject2, data2)
            var rawBody2 = cfg.body_template || cfg.default_body_template || ''
            var bodyHtml2 = interp2(rawBody2, data2)
            var buttonUrl2 = interp2(cfg.button_url_template || '{{link}}', data2)
            var buttonLabel2 = interp2(cfg.button_label || 'Acessar o Portal', data2)
            var primaryColor2 = cfg.primary_color || '#D97706'
            var headerTitle2 = cfg.header_title || 'Lógos AITSM'
            var headerSubtitle2 =
              cfg.header_subtitle || 'Sistema Inteligente de Gestão de Serviços de TI'
            var footerText2 = cfg.footer_text || 'Lógos AITSM • Central de Serviços Inteligente'
            var buttonHtml2 = ''
            if (cfg.show_button && buttonUrl2) {
              buttonHtml2 =
                '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
                '<tr><td align="center" style="border-radius: 6px; background-color: ' +
                primaryColor2 +
                ';">' +
                '<a href="' +
                escHtml2(buttonUrl2) +
                '" target="_blank" style="font-size: 15px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; display: inline-block; font-weight: 600;">' +
                escHtml2(buttonLabel2) +
                '</a></td></tr></table>'
            }
            var htmlContent2 =
              '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
              '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;">' +
              '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.08);">' +
              '<tr><td style="padding:28px 36px;background-color:#17181C;border-bottom:4px solid ' +
              primaryColor2 +
              ';"><span style="font-size:22px;font-weight:900;color:#FCD34D;letter-spacing:0.5px;text-transform:uppercase;">' +
              escHtml2(headerTitle2) +
              '</span>' +
              (headerSubtitle2
                ? '<p style="margin:6px 0 0 0;font-size:13px;color:#e2e8f0;font-weight:400;">' +
                  escHtml2(headerSubtitle2) +
                  '</p>'
                : '') +
              '</td></tr>' +
              '<tr><td style="padding:36px;line-height:1.7;font-size:15px;color:#1e293b;">' +
              bodyHtml2 +
              buttonHtml2 +
              '</td></tr>' +
              '<tr><td style="padding:22px 36px;background-color:#f1f5f9;font-size:12px;color:#64748b;text-align:center;">' +
              escHtml2(footerText2) +
              '</td></tr></table></body></html>'
            try {
              var senderAddress2 = 'noreply@mail.goskip.dev'
              var senderName2 = 'Lógos AITSM'
              try {
                var s2 = $app.settings
                if (typeof s2 === 'function') s2 = s2()
                if (s2 && s2.meta && s2.meta.senderAddress) senderAddress2 = s2.meta.senderAddress
                if (s2 && s2.meta && s2.meta.senderName) senderName2 = s2.meta.senderName
              } catch (_) {}
              var message2 = new MailerMessage({
                from: { address: senderAddress2, name: senderName2 },
                to: [{ address: recipient2 }],
                subject: subject2,
                html: htmlContent2,
                text: interp2(rawBody2, data2).replace(/<[^>]+>/g, ' '),
              })
              var client2 = $app.newMailClient()
              client2.send(message2)
              try {
                var logCol2 = $app.findCollectionByNameOrId('email_sent_logs')
                var log2 = new Record(logCol2)
                log2.set('alert_key', 'ticket_approval_rejected_notify')
                log2.set('reference_id', String(ticketId + ':rejected').trim())
                log2.set('recipient', recipient2)
                log2.set('sent_at', new Date().toISOString().replace('T', ' '))
                log2.set('subject', subject2 || '')
                $app.save(log2)
              } catch (errLog2) {
                console.warn('[APPROVAL_ACT] falha ao salvar email_sent_logs: ' + errLog2.message)
              }
              console.log(
                '[APPROVAL_ACT] e-mail de reprovação enviado via Skip Cloud | destinatário=' +
                  recipient2,
              )
            } catch (errSend2) {
              console.error(
                '[APPROVAL_ACT] FALHA no envio Skip Cloud | destinatário=' +
                  recipient2 +
                  ' | motivo: ' +
                  (errSend2 && errSend2.message ? errSend2.message : String(errSend2)),
              )
            }
          }
        }
      } else if (cfg && !cfg.enabled) {
        console.log(
          '[APPROVAL_ACT] e-mail de reprovação SUPRIMIDO — ticket_approval_rejected_notify desligado na Central',
        )
      }
    }

    var successDetails =
      '<strong>Chamado:</strong> #' +
      ticketNumber +
      '<br>' +
      '<strong>Título:</strong> ' +
      ticketTitle +
      '<br>' +
      '<strong>Papel do Aprovador:</strong> ' +
      roleText +
      '<br>' +
      '<strong>Status do Chamado:</strong> ' +
      newTicketStatus +
      '<br>' +
      '<strong>Data do Registro:</strong> ' +
      new Date().toLocaleString('pt-BR')

    var successMsg = isApprove
      ? 'Aprovação registrada com sucesso! O chamado foi liberado para atendimento com status "Em Atendimento"/"Novo" (regra "basta um": a primeira aprovação decide).'
      : 'Você reprovou a solicitação. O chamado foi encerrado com o status "Reprovado" e o solicitante foi notificado por e-mail.'

    return renderResultHtml(
      isApprove ? 'Decisão Registrada com Sucesso' : 'Chamado Reprovado',
      true,
      successMsg,
      successDetails,
    )
  } catch (err) {
    return renderResultHtml(
      'Aprovação Não Encontrada',
      false,
      'Não foi possível localizar o registro desta aprovação ou o token expirado.',
      'Detalhes do erro: ' + err.message,
    )
  }
})
