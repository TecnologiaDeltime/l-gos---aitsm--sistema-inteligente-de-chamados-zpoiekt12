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

    // Disparo de e-mail para os aprovadores com botões de ação (Aprovar / Reprovar)
    try {
      var approvalToken = approval.getString('token')
      var ticketNumber = ticket.getString('number') || ticket.id
      var ticketTitle = ticket.getString('title') || 'Sem título'
      var justification =
        approval.getString('justification') || 'Solicitação de aprovação de chamado'
      var approvalType = approval.getString('type') || 'Outros'

      var compName = ''
      try {
        var compRec = $app.findRecordById('companies', companyId)
        compName = compRec.getString('trade_name') || compRec.getString('legal_name') || ''
      } catch (_) {}

      var reqName = 'Solicitante'
      try {
        var reqRec = $app.findRecordById('users', requesterId)
        reqName = reqRec.getString('name') || reqRec.getString('email') || reqName
      } catch (_) {}

      // URLs do backend para ação direta com um clique sem sair do e-mail
      var backendBase = (
        $os.getenv('PB_INSTANCE_URL') ||
        $os.getenv('SITE_URL') ||
        'https://sistema-itsm-de-chamados-b1534.shrd03.internal.goskip.dev'
      ).replace(/\/$/, '')

      var approveUrl =
        backendBase + '/backend/v1/approvals/act?token=' + approvalToken + '&action=approve'
      var rejectUrl =
        backendBase + '/backend/v1/approvals/act?token=' + approvalToken + '&action=reject'

      var esc =
        typeof globalThis.itsmEscapeHtml === 'function'
          ? globalThis.itsmEscapeHtml
          : function (s) {
              return String(s || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
            }

      var contentHtml =
        '<!-- AVISO DE AÇÃO NECESSÁRIA -->\n' +
        '<div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">\n' +
        '  <div style="font-size: 14px; font-weight: 700; color: #854d0e;">Aprovação Solicitada</div>\n' +
        '  <div style="font-size: 13px; color: #a16207; margin-top: 3px; line-height: 18px;">Este chamado requer sua autorização como gestor/aprovador para dar início ao atendimento técnico.</div>\n' +
        '</div>\n' +
        '\n' +
        '<!-- DETALHES DA SOLICITAÇÃO -->\n' +
        '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">\n' +
        '  <tr>\n' +
        '    <td style="padding: 16px 20px;">\n' +
        '      <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; width: 50%; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Número do Chamado</div>\n' +
        '            <div style="font-size: 16px; font-weight: 800; color: #0284c7; margin-top: 2px;">#' +
        esc(ticketNumber) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; width: 50%; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Tipo de Aprovação</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px;">' +
        esc(approvalType) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Solicitante</div>\n' +
        '            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">' +
        esc(reqName) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Empresa / Cliente</div>\n' +
        '            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">' +
        esc(compName || '-') +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #cbd5e1; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Assunto do Chamado</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">' +
        esc(ticketTitle) +
        '</div>\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-top: 8px; margin-bottom: 4px;">Justificativa da Aprovação</div>\n' +
        '            <div style="font-size: 13px; color: #475569; line-height: 20px; background-color: #ffffff; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">' +
        esc(justification) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '      </table>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'

      // Botões interativos no próprio e-mail (Aprovar em Verde / Reprovar em Vermelho)
      var actionButtonsHtml =
        '<div style="text-align: center; margin: 10px 0 16px 0;">\n' +
        '  <p style="font-size: 13px; font-weight: 600; color: #334155; margin: 0 0 16px 0;">Clique em um dos botões abaixo para registrar sua decisão instantaneamente:</p>\n' +
        '  <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">\n' +
        '    <tr>\n' +
        '      <td align="center" style="padding-right: 12px;">\n' +
        '        <a href="' +
        approveUrl +
        '" target="_blank" style="background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25); border: 1px solid #15803d;">\n' +
        '          ✓ Aprovar Chamado\n' +
        '        </a>\n' +
        '      </td>\n' +
        '      <td align="center" style="padding-left: 12px;">\n' +
        '        <a href="' +
        rejectUrl +
        '" target="_blank" style="background-color: #dc2626; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.25); border: 1px solid #b91c1c;">\n' +
        '          ✕ Reprovar Chamado\n' +
        '        </a>\n' +
        '      </td>\n' +
        '    </tr>\n' +
        '  </table>\n' +
        '  <div style="margin-top: 14px; font-size: 11px; color: #94a3b8;">Link seguro com token assinado e uso único. A ação será gravada na auditoria do chamado.</div>\n' +
        '</div>'

      var emailSubject = 'Aprovação Necessária: Chamado #' + ticketNumber + ' - ' + ticketTitle

      var htmlEmail = ''
      if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
        htmlEmail = globalThis.itsmRenderBaseEmailTemplate({
          preheader:
            'Aprovação pendente para o chamado #' +
            ticketNumber +
            '. Clique para Aprovar ou Reprovar.',
          badgeText: 'Aprovação Pendente',
          badgeColor: '#eab308',
          title: 'Solicitação de Aprovação de Chamado',
          subtitle: 'Chamado #' + ticketNumber + ' aguarda sua decisão',
          contentHtml: contentHtml,
          actionHtml: actionButtonsHtml,
          footerNote:
            'Você pode interagir diretamente através dos botões deste e-mail sem precisar efetuar login no sistema.',
        })
      } else {
        htmlEmail = '<div>' + contentHtml + actionButtonsHtml + '</div>'
      }

      var textEmail =
        'SOLICITAÇÃO DE APROVAÇÃO DE CHAMADO\n\n' +
        'Chamado: #' +
        ticketNumber +
        '\n' +
        'Título: ' +
        ticketTitle +
        '\n' +
        'Solicitante: ' +
        reqName +
        '\n' +
        'Empresa: ' +
        (compName || '-') +
        '\n' +
        'Tipo: ' +
        approvalType +
        '\n' +
        'Justificativa: ' +
        justification +
        '\n\n' +
        'Para APROVAR acesse:\n' +
        approveUrl +
        '\n\n' +
        'Para REPROVAR acesse:\n' +
        rejectUrl +
        '\n\n' +
        '-- ServiceOne ITSM'

      var approvers = $app.findRecordsByFilter(
        'users',
        'role = "admin" || role = "gestor"',
        '',
        50,
        0,
      )

      for (var a = 0; a < approvers.length; a++) {
        var apEmail = approvers[a].getString('email')
        if (!apEmail) continue
        try {
          if (typeof globalThis.itsmSendWithAudit === 'function') {
            globalThis.itsmSendWithAudit({
              testType: 'aprovacao_chamado',
              to: apEmail,
              subject: emailSubject,
              html: htmlEmail,
              text: textEmail,
              meta: {
                ticket_id: ticket.id,
                ticket_number: ticketNumber,
                approval_id: approval.id,
                approval_token: approvalToken,
                approver_id: approvers[a].id,
                approver_name: approvers[a].getString('name'),
              },
            })
          } else if (typeof globalThis.sendSystemEmail === 'function') {
            globalThis.sendSystemEmail({
              to: apEmail,
              subject: emailSubject,
              html: htmlEmail,
              text: textEmail,
            })
          }
        } catch (mErr) {
          $app
            .logger()
            .error(
              'ticket_approval_check: falha ao enviar e-mail para ' + apEmail,
              'err',
              mErr.message,
            )
        }
      }
    } catch (mailFlowErr) {
      $app
        .logger()
        .error(
          'ticket_approval_check: falha no fluxo de e-mail de aprovação',
          'err',
          mailFlowErr.message,
        )
    }
  } catch (err) {
    $app.logger().error('ticket_approval_check: failed to create approval', 'error', err.message)
  }

  return e.next()
}, 'tickets')
