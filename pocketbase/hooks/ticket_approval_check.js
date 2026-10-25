onRecordAfterCreateSuccess((e) => {
  var ticket = e.record
  var companyId = ticket.getString('company')
  if (!companyId) return e.next()

  var categoryId = ticket.getString('category')
  var subcategoryId = ticket.getString('subcategory')

  var configs = []
  try {
    configs = $app.findRecordsByFilter('approval_configs', 'active = true', '-created', 100, 0)
  } catch (err) {
    return e.next()
  }

  if (!configs || configs.length === 0) return e.next()

  // Procura a regra mais específica para a atividade/subatividade ou categoria do ticket e que contemple o cliente
  var matchingConfig = null
  for (var i = 0; i < configs.length; i++) {
    var cfg = configs[i]
    var clients = cfg.getStringSlice ? cfg.getStringSlice('clients') : []
    // Se a regra define clientes específicos, deve conter o cliente do chamado
    if (clients && clients.length > 0) {
      var clientMatched = false
      for (var c = 0; c < clients.length; c++) {
        if (clients[c] === companyId) {
          clientMatched = true
          break
        }
      }
      if (!clientMatched) continue
    }

    var activityId = cfg.getString('activity')
    // Se a regra tem atividade vinculada, compara com subcategoria ou categoria
    if (activityId) {
      if (activityId === subcategoryId || activityId === categoryId) {
        matchingConfig = cfg
        break
      }
    } else {
      // Regra genérica sem atividade específica como fallback se não achar uma exata
      if (!matchingConfig) {
        matchingConfig = cfg
      }
    }
  }

  if (!matchingConfig) return e.next()

  // Evita duplicar se já houver aprovação pendente para o chamado
  try {
    $app.findFirstRecordByFilter('approvals', 'ticket = "' + ticket.id + '" && status = "Pendente"')
    return e.next()
  } catch (_) {}

  var assignedTo = ticket.getString('assigned_to')
  var requesterId = assignedTo || ''
  if (!requesterId && e.auth) {
    requesterId = e.auth.id
  }
  if (!requesterId) {
    // Se não houver requesterId, tenta achar um admin como criador/requester padrão
    try {
      var firstAdmin = $app.findFirstRecordByFilter('users', 'role = "admin"')
      requesterId = firstAdmin.id
    } catch (_) {}
  }
  if (!requesterId) return e.next()

  try {
    var mode = matchingConfig.getString('mode') || 'Individual'
    var timeoutMinutes = matchingConfig.getInt('escalation_timeout_minutes') || 60
    var focalPointIds = matchingConfig.getStringSlice
      ? matchingConfig.getStringSlice('focal_points')
      : []
    var internalApproverIds = matchingConfig.getStringSlice
      ? matchingConfig.getStringSlice('internal_approvers')
      : []

    // Coleta a lista ordenada de candidatos a aprovadores
    // Formato dos candidatos: { type: 'contact' | 'user', id: string, name: string, email: string }
    var candidateApprovers = []

    // 1. Pontos focais do cliente
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

    // 2. Aprovadores internos do sistema (Gestão, Administrador, Helpdesk/Operador)
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

    // Fallback: se nenhum aprovador for cadastrado na regra, busca gestores/admins do sistema
    if (candidateApprovers.length === 0) {
      try {
        var fallbackUsers = $app.findRecordsByFilter(
          'users',
          'role = "admin" || role = "gestor"',
          '',
          10,
          0,
        )
        for (var fu = 0; fu < fallbackUsers.length; fu++) {
          var fbEmail = fallbackUsers[fu].getString('email')
          if (fbEmail) {
            candidateApprovers.push({
              type: 'user',
              id: fallbackUsers[fu].id,
              name: fallbackUsers[fu].getString('name') || 'Gestor Responsável',
              email: fbEmail,
            })
          }
        }
      } catch (_) {}
    }

    if (candidateApprovers.length === 0) return e.next()

    // Atualiza status do chamado para 'Aguardando Aprovação'
    var ticketRecord = $app.findRecordById('tickets', ticket.id)
    var oldStatus = ticketRecord.getString('status')
    ticketRecord.set('status', 'Aguardando Aprovação')
    $app.save(ticketRecord)

    // Registra histórico
    var historyCol = $app.findCollectionByNameOrId('ticket_history')
    var hist = new Record(historyCol)
    hist.set('ticket', ticket.id)
    hist.set('user', requesterId)
    hist.set('action', 'Aprovação solicitada (' + mode + ')')
    hist.set('field', 'status')
    hist.set('old_value', oldStatus)
    hist.set('new_value', 'Aguardando Aprovação')
    $app.save(hist)

    var approvalsCol = $app.findCollectionByNameOrId('approvals')
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

    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Sem título'
    var ticketDescription = ticket.getString('description') || 'Sem descrição fornecida'

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

    var now = new Date()

    // Helper interno para disparar o e-mail de aprovação para um destinatário
    function sendApprovalEmail(token, targetName, targetEmail, stageIndex, modeLabel) {
      var approveUrl = backendBase + '/backend/v1/approvals/act?token=' + token + '&action=approve'
      var rejectUrl = backendBase + '/backend/v1/approvals/act?token=' + token + '&action=reject'

      var modeNotice = ''
      if (modeLabel === 'Sequencial') {
        modeNotice =
          'Você é o aprovador responsável (Nível ' +
          (stageIndex + 1) +
          '). Se você não responder no prazo de contingência (' +
          timeoutMinutes +
          ' min), a solicitação escalará automaticamente para o próximo responsável.'
      } else if (modeLabel === 'Paralela') {
        modeNotice =
          'Modo Paralelo: todos os aprovadores receberam esta solicitação simultaneamente. A primeira resposta encerra a aprovação.'
      } else {
        modeNotice =
          'Modo Individual: sua autorização dará início imediato ao atendimento do chamado.'
      }

      var contentHtml =
        '<!-- AVISO DE AÇÃO NECESSÁRIA -->\n' +
        '<div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">\n' +
        '  <div style="font-size: 14px; font-weight: 700; color: #854d0e;">Aprovação Solicitada • Modo ' +
        esc(modeLabel) +
        '</div>\n' +
        '  <div style="font-size: 13px; color: #a16207; margin-top: 3px; line-height: 18px;">' +
        esc(modeNotice) +
        '</div>\n' +
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
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Aprovador Destinado</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px;">' +
        esc(targetName) +
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
        '            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">' +
        esc(ticketTitle) +
        '</div>\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Descrição do Problema / Solicitação</div>\n' +
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
          badgeText: 'Aprovação Pendente (' + modeLabel + ')',
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
        'SOLICITAÇÃO DE APROVAÇÃO DE CHAMADO (' +
        modeLabel +
        ')\n\n' +
        'Chamado: #' +
        ticketNumber +
        '\n' +
        'Assunto: ' +
        ticketTitle +
        '\n' +
        'Descrição:\n' +
        ticketDescription +
        '\n\n' +
        'Solicitante: ' +
        reqName +
        '\n' +
        'Empresa: ' +
        (compName || '-') +
        '\n\n' +
        'Para APROVAR acesse:\n' +
        approveUrl +
        '\n\n' +
        'Para REPROVAR acesse:\n' +
        rejectUrl +
        '\n\n' +
        '-- ServiceOne ITSM'

      try {
        if (typeof globalThis.itsmSendWithAudit === 'function') {
          globalThis.itsmSendWithAudit({
            testType: 'aprovacao_chamado',
            to: targetEmail,
            subject: emailSubject,
            html: htmlEmail,
            text: textEmail,
            meta: {
              ticket_id: ticket.id,
              ticket_number: ticketNumber,
              target_name: targetName,
              mode: modeLabel,
              stage: stageIndex + 1,
            },
          })
        } else if (typeof globalThis.sendSystemEmail === 'function') {
          globalThis.sendSystemEmail({
            to: targetEmail,
            subject: emailSubject,
            html: htmlEmail,
            text: textEmail,
          })
        }
      } catch (mErr) {
        $app
          .logger()
          .error(
            'ticket_approval_check: falha ao enviar email para ' + targetEmail,
            'err',
            mErr.message,
          )
      }
    }

    if (mode === 'Paralela') {
      // Modo Paralelo: cria uma aprovação para cada aprovador e envia todos os e-mails juntos
      for (var p = 0; p < candidateApprovers.length; p++) {
        var candP = candidateApprovers[p]
        var appRecP = new Record(approvalsCol)
        appRecP.set('ticket', ticket.id)
        appRecP.set('requester', requesterId)
        if (candP.type === 'user') {
          appRecP.set('approver', candP.id)
        } else {
          appRecP.set('target_contact', candP.id)
        }
        appRecP.set('target_email', candP.email)
        appRecP.set('type', 'Outros')
        appRecP.set('justification', 'Aprovação de chamado pela atividade selecionada')
        appRecP.set('status', 'Pendente')
        appRecP.set('mode', 'Paralela')
        appRecP.set('stage', 1)
        appRecP.set('approval_config', matchingConfig.id)
        appRecP.set('token', $security.randomString(32))
        $app.save(appRecP)

        sendApprovalEmail(appRecP.getString('token'), candP.name, candP.email, 0, 'Paralela')
      }
    } else if (mode === 'Sequencial') {
      // Modo Sequencial: 1º entra agora com prazo; 2º e 3º entram se o 1º não aprovar em tempo
      var firstCand = candidateApprovers[0]
      var escalationDeadline = new Date(now.getTime() + timeoutMinutes * 60000).toISOString()

      var appRecSeq = new Record(approvalsCol)
      appRecSeq.set('ticket', ticket.id)
      appRecSeq.set('requester', requesterId)
      if (firstCand.type === 'user') {
        appRecSeq.set('approver', firstCand.id)
      } else {
        appRecSeq.set('target_contact', firstCand.id)
      }
      appRecSeq.set('target_email', firstCand.email)
      appRecSeq.set('type', 'Outros')
      appRecSeq.set('justification', 'Aprovação sequencial (1º Aprovador Principal)')
      appRecSeq.set('status', 'Pendente')
      appRecSeq.set('mode', 'Sequencial')
      appRecSeq.set('stage', 1)
      appRecSeq.set('approval_config', matchingConfig.id)
      appRecSeq.set('escalation_deadline', escalationDeadline)
      appRecSeq.set('token', $security.randomString(32))
      $app.save(appRecSeq)

      sendApprovalEmail(
        appRecSeq.getString('token'),
        firstCand.name,
        firstCand.email,
        0,
        'Sequencial',
      )
    } else {
      // Modo Individual: um único aprovador (o primeiro da lista)
      var singleCand = candidateApprovers[0]
      var appRecInd = new Record(approvalsCol)
      appRecInd.set('ticket', ticket.id)
      appRecInd.set('requester', requesterId)
      if (singleCand.type === 'user') {
        appRecInd.set('approver', singleCand.id)
      } else {
        appRecInd.set('target_contact', singleCand.id)
      }
      appRecInd.set('target_email', singleCand.email)
      appRecInd.set('type', 'Outros')
      appRecInd.set('justification', 'Aprovação individual de chamado')
      appRecInd.set('status', 'Pendente')
      appRecInd.set('mode', 'Individual')
      appRecInd.set('stage', 1)
      appRecInd.set('approval_config', matchingConfig.id)
      appRecInd.set('token', $security.randomString(32))
      $app.save(appRecInd)

      sendApprovalEmail(
        appRecInd.getString('token'),
        singleCand.name,
        singleCand.email,
        0,
        'Individual',
      )
    }

    // Notificações in-app
    try {
      var notifCol = $app.findCollectionByNameOrId('notifications')
      var gestores = $app.findRecordsByFilter(
        'users',
        'role = "admin" || role = "gestor"',
        '',
        20,
        0,
      )
      for (var j = 0; j < gestores.length; j++) {
        var notif = new Record(notifCol)
        notif.set('user', gestores[j].id)
        notif.set('ticket', ticket.id)
        notif.set('title', 'Nova aprovação pendente (' + mode + ')')
        notif.set('message', 'Chamado #' + ticketNumber + ' entrou em aprovação')
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
