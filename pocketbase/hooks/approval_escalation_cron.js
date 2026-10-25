cronAdd('approval_escalation_cron', '* * * * *', function () {
  var now = new Date()
  var nowIso = now.toISOString()

  // Busca aprovações sequenciais que estão Pendentes e cujo prazo de contingência expirou
  var expiredApprovals = []
  try {
    expiredApprovals = $app.findRecordsByFilter(
      'approvals',
      'status = "Pendente" && mode = "Sequencial" && escalation_deadline != "" && escalation_deadline <= "' +
        nowIso +
        '"',
      'created',
      50,
      0,
    )
  } catch (err) {
    $app.logger().error('approval_escalation_cron: query failed', 'error', err.message)
    return
  }

  if (expiredApprovals.length === 0) return

  var approvalsCol = $app.findCollectionByNameOrId('approvals')
  var historyCol = $app.findCollectionByNameOrId('ticket_history')
  var notifCol = $app.findCollectionByNameOrId('notifications')

  var backendBase = (
    $os.getenv('PB_INSTANCE_URL') ||
    $os.getenv('SITE_URL') ||
    'https://sistema-itsm-de-chamados-b1534.shrd03.internal.goskip.dev'
  ).replace(/\/$/, '')

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

  for (var i = 0; i < expiredApprovals.length; i++) {
    var curApp = expiredApprovals[i]
    var configId = curApp.getString('approval_config')
    var ticketId = curApp.getString('ticket')
    var currentStage = curApp.getInt('stage') || 1

    var configRec = null
    try {
      configRec = $app.findRecordById('approval_configs', configId)
    } catch (_) {}

    if (!configRec) {
      // Se não achar a config, apenas limpa a deadline para não rodar em loop
      curApp.set('escalation_deadline', '')
      $app.save(curApp)
      continue
    }

    var focalPointIds = configRec.getStringSlice ? configRec.getStringSlice('focal_points') : []
    var internalApproverIds = configRec.getStringSlice
      ? configRec.getStringSlice('internal_approvers')
      : []
    var timeoutMinutes = configRec.getInt('escalation_timeout_minutes') || 60

    // Monta a lista completa de aprovadores da sequência
    var candidateApprovers = []
    for (var fp = 0; fp < focalPointIds.length; fp++) {
      try {
        var contactRec = $app.findRecordById('client_contacts', focalPointIds[fp])
        var cEmail = contactRec.getString('email')
        if (cEmail) {
          candidateApprovers.push({
            type: 'contact',
            id: contactRec.id,
            name: contactRec.getString('full_name') || 'Ponto Focal',
            email: cEmail,
          })
        }
      } catch (_) {}
    }

    for (var ia = 0; ia < internalApproverIds.length; ia++) {
      try {
        var userRec = $app.findRecordById('users', internalApproverIds[ia])
        var uEmail = userRec.getString('email')
        if (uEmail) {
          candidateApprovers.push({
            type: 'user',
            id: userRec.id,
            name: userRec.getString('name') || 'Aprovador Interno',
            email: uEmail,
          })
        }
      } catch (_) {}
    }

    var nextStage = currentStage + 1
    var nextIndex = nextStage - 1 // 0-based

    var ticketRec = null
    try {
      ticketRec = $app.findRecordById('tickets', ticketId)
    } catch (_) {}

    var ticketNumber = ticketRec ? ticketRec.getString('number') : '-'
    var ticketTitle = ticketRec ? ticketRec.getString('title') : '-'
    var ticketDescription = ticketRec ? ticketRec.getString('description') : '-'

    // Se existe próximo aprovador na sequência (2º ou 3º nível)
    if (nextIndex < candidateApprovers.length) {
      var nextCand = candidateApprovers[nextIndex]

      // Expira a aprovação anterior por ausência
      curApp.set('status', 'Reprovado')
      curApp.set('approver_comment', 'Expirado por ausência de resposta (Contingência sequencial)')
      curApp.set('rejected_at', nowIso)
      curApp.set('escalation_deadline', '')
      $app.save(curApp)

      // Cria a nova aprovação para o próximo nível
      var newDeadline = new Date(now.getTime() + timeoutMinutes * 60000).toISOString()
      var newApp = new Record(approvalsCol)
      newApp.set('ticket', ticketId)
      newApp.set('requester', curApp.getString('requester'))
      if (nextCand.type === 'user') {
        newApp.set('approver', nextCand.id)
      } else {
        newApp.set('target_contact', nextCand.id)
      }
      newApp.set('target_email', nextCand.email)
      newApp.set('type', 'Outros')
      newApp.set(
        'justification',
        'Escalonamento de contingência para ' +
          nextStage +
          'º aprovador (o anterior não respondeu no prazo de ' +
          timeoutMinutes +
          ' min)',
      )
      newApp.set('status', 'Pendente')
      newApp.set('mode', 'Sequencial')
      newApp.set('stage', nextStage)
      newApp.set('approval_config', configId)
      newApp.set('escalation_deadline', newDeadline)
      var newToken = $security.randomString(32)
      newApp.set('token', newToken)
      $app.save(newApp)

      // Registra histórico no chamado
      try {
        var hist = new Record(historyCol)
        hist.set('ticket', ticketId)
        hist.set('user', curApp.getString('requester') || '')
        hist.set(
          'action',
          'Aprovação escalonada para contingência ' +
            nextStage +
            'º nível (' +
            nextCand.name +
            ') por ausência de resposta',
        )
        hist.set('field', 'status')
        hist.set('old_value', 'Aguardando Aprovação (Nível ' + currentStage + ')')
        hist.set('new_value', 'Aguardando Aprovação (Nível ' + nextStage + ')')
        $app.save(hist)
      } catch (hErr) {
        $app.logger().warn('approval_escalation_cron: history error', 'err', hErr.message)
      }

      // Envia o e-mail para o próximo aprovador com os botões
      var approveUrl =
        backendBase + '/backend/v1/approvals/act?token=' + newToken + '&action=approve'
      var rejectUrl = backendBase + '/backend/v1/approvals/act?token=' + newToken + '&action=reject'

      var modeNotice =
        'ESCALONAMENTO DE CONTINGÊNCIA: Você foi acionado como ' +
        nextStage +
        'º aprovador pois o responsável anterior não respondeu no prazo estipulado (' +
        timeoutMinutes +
        ' min). O chamado não pode ficar parado.'

      var contentHtml =
        '<div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">\n' +
        '  <div style="font-size: 14px; font-weight: 700; color: #854d0e;">Escalonamento de Contingência • ' +
        nextStage +
        'º Aprovador</div>\n' +
        '  <div style="font-size: 13px; color: #a16207; margin-top: 3px; line-height: 18px;">' +
        esc(modeNotice) +
        '</div>\n' +
        '</div>\n' +
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
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Aprovador Acionado</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px;">' +
        esc(nextCand.name) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #cbd5e1; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Assunto do Chamado</div>\n' +
        '            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">' +
        esc(ticketTitle) +
        '</div>\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Descrição</div>\n' +
        '            <div style="font-size: 13px; color: #334155; line-height: 20px; background-color: #ffffff; padding: 12px 14px; border-radius: 6px; border: 1px solid #e2e8f0; white-space: pre-wrap;">' +
        esc(ticketDescription) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '      </table>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'

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
        '</div>'

      var emailSubject =
        '[Escalonamento] Aprovação Necessária: Chamado #' + ticketNumber + ' - ' + ticketTitle

      var htmlEmail = ''
      if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
        htmlEmail = globalThis.itsmRenderBaseEmailTemplate({
          preheader: 'Escalonamento de contingência para o chamado #' + ticketNumber,
          badgeText: 'Escalonamento (Nível ' + nextStage + ')',
          badgeColor: '#f97316',
          title: 'Aprovação de Chamado por Contingência',
          subtitle: 'Chamado #' + ticketNumber + ' escalonado para você',
          contentHtml: contentHtml,
          actionHtml: actionButtonsHtml,
          footerNote:
            'Ação registrada diretamente via e-mail corporativo sem necessidade de login.',
        })
      } else {
        htmlEmail = '<div>' + contentHtml + actionButtonsHtml + '</div>'
      }

      try {
        if (typeof globalThis.itsmSendWithAudit === 'function') {
          globalThis.itsmSendWithAudit({
            testType: 'aprovacao_chamado',
            to: nextCand.email,
            subject: emailSubject,
            html: htmlEmail,
            text: 'Chamado #' + ticketNumber + ' escalonado para sua aprovação.',
            meta: {
              ticket_id: ticketId,
              ticket_number: ticketNumber,
              stage: nextStage,
              contingency: true,
            },
          })
        }
      } catch (emErr) {
        $app
          .logger()
          .error(
            'approval_escalation_cron: falha ao enviar email',
            'dest',
            nextCand.email,
            'err',
            emErr.message,
          )
      }

      $app
        .logger()
        .info(
          'approval_escalation_cron: ticket #' +
            ticketNumber +
            ' escalonado para nível ' +
            nextStage +
            ' (' +
            nextCand.name +
            ')',
        )
    } else {
      // Esgotou a sequência de contingência sem resposta
      curApp.set('escalation_deadline', '')
      $app.save(curApp)

      // Notifica administradores do sistema
      try {
        var admins = $app.findRecordsByFilter('users', 'role = "admin"', '', 10, 0)
        for (var a = 0; a < admins.length; a++) {
          var adminNotif = new Record(notifCol)
          adminNotif.set('user', admins[a].id)
          adminNotif.set('ticket', ticketId)
          adminNotif.set('title', 'Alerta: Aprovação Expirada')
          adminNotif.set(
            'message',
            'Todos os níveis de contingência do chamado #' +
              ticketNumber +
              ' expiraram sem decisão.',
          )
          adminNotif.set('type', 'Aprovação')
          adminNotif.set('read', false)
          $app.save(adminNotif)
        }
      } catch (_) {}
    }
  }
})
