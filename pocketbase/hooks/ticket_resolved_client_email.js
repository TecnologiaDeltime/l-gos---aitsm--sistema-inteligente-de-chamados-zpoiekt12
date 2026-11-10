// Gatilho imediato de e-mail na resolução/conclusão de chamado para o cliente
// Requisito:
// "E-mail de resolução do chamado — avisar o cliente quando o chamado for concluído,
// no mesmo template institucional (com logotipo, badge colorido verde de status,
// cartões de detalhes e rodapé). Coloque em configuração quais alertas e e-mails
// queremos que o cliente receba."
//
// Dispara após update do chamado quando o status muda para 'Resolvido'
// (ou 'Encerrado' direto sem ter passado por 'Resolvido').
// Evita e-mail duplicado caso transite de Resolvido para Encerrado.
// Autocontido, seguro e com registro de auditoria em email_audit_logs (tipo 'resolucao_chamado').

onRecordAfterUpdateSuccess((e) => {
  var ticket = e.record
  if (!ticket) return e.next()

  var original = ticket.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = ticket.getString('status')

  // Se o status não mudou, ignora
  if (oldStatus === newStatus) return e.next()

  // Não disparar para chamados cancelados
  if (newStatus === 'Cancelado') return e.next()

  // Dispara apenas quando vai para 'Resolvido' ou 'Encerrado' direto
  var isResolutionTarget = newStatus === 'Resolvido' || newStatus === 'Encerrado'
  if (!isResolutionTarget) return e.next()

  // Se já estava 'Resolvido' e foi para 'Encerrado', não duplica notificação ao cliente
  if (oldStatus === 'Resolvido' && newStatus === 'Encerrado') {
    return e.next()
  }

  // Verifica configuração de notificação do cliente (por empresa ou global)
  var companyId = ticket.getString('company')
  try {
    var settingsRec = null
    if (companyId) {
      try {
        settingsRec = $app.findFirstRecordByFilter(
          'client_notification_settings',
          'company = "' + companyId + '"',
        )
      } catch (_) {}
    }

    if (!settingsRec) {
      try {
        settingsRec = $app.findFirstRecordByFilter(
          'client_notification_settings',
          'scope = "global"',
        )
      } catch (_) {}
    }

    if (settingsRec && settingsRec.getBool('notify_ticket_resolved') === false) {
      $app
        .logger()
        .info(
          'ticket_resolved_client_email: notificação de resolução desativada nas configurações (chamado #' +
            ticket.getString('number') +
            ')',
        )
      return e.next()
    }
  } catch (_) {}

  try {
    var recipientEmail = (ticket.getString('requester_email') || '').trim()
    var requesterName = (ticket.getString('requester_name') || 'Cliente').trim()

    // Se não tiver requester_email direto, tenta buscar pelo usuário criador se houver
    if (!recipientEmail && e.auth && typeof e.auth.getString === 'function') {
      var authRole = e.auth.getString('role')
      if (authRole === 'cliente_solicitante' || authRole === 'cliente_gestor') {
        recipientEmail = (e.auth.getString('email') || '').trim()
        if (!requesterName || requesterName === 'Cliente') {
          requesterName = (e.auth.getString('name') || requesterName).trim()
        }
      }
    }

    // Coleta recipientes extras se notify_focal_points estiver ativo
    var extraRecipients = []
    if (settingsRec && settingsRec.getBool('notify_focal_points') === true && companyId) {
      try {
        var focalPoints = $app.findRecordsByFilter(
          'client_contacts',
          'client = "' + companyId + '" && is_focal_point = true',
          'full_name',
          50,
          0,
        )
        for (var f = 0; f < focalPoints.length; f++) {
          var fpEmail = (focalPoints[f].getString('email') || '').trim()
          if (fpEmail && fpEmail !== recipientEmail && extraRecipients.indexOf(fpEmail) === -1) {
            extraRecipients.push(fpEmail)
          }
        }
      } catch (_) {}
    }

    if (!recipientEmail && extraRecipients.length === 0) {
      $app
        .logger()
        .info(
          'ticket_resolved_client_email: chamado #' +
            ticket.getString('number') +
            ' sem e-mail do cliente informado; notificação por e-mail ignorada.',
        )
      return e.next()
    }

    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Chamado sem título'
    var ticketDescription = ticket.getString('description') || ''

    // Descrição limpa do problema
    var cleanDescription = ticketDescription
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleanDescription.length > 500) {
      cleanDescription = cleanDescription.substring(0, 497) + '...'
    }
    if (!cleanDescription) {
      cleanDescription = ticketTitle
    }

    // Solução aplicada
    var solutionText = (ticket.getString('solution') || '').trim()
    var cleanSolution = solutionText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleanSolution) {
      cleanSolution = 'Atendimento concluído com sucesso pela equipe técnica.'
    }

    // Data de abertura
    var createdRaw = ticket.getString('created')
    var createdDate = createdRaw ? new Date(createdRaw) : new Date()
    var createdFormatted =
      ('0' + createdDate.getDate()).slice(-2) +
      '/' +
      ('0' + (createdDate.getMonth() + 1)).slice(-2) +
      '/' +
      createdDate.getFullYear() +
      ' às ' +
      ('0' + createdDate.getHours()).slice(-2) +
      ':' +
      ('0' + createdDate.getMinutes()).slice(-2)

    // Data de resolução
    var resRaw = ticket.getString('resolution_date') || ticket.getString('updated')
    var resDate = resRaw ? new Date(resRaw) : new Date()
    var resFormatted =
      ('0' + resDate.getDate()).slice(-2) +
      '/' +
      ('0' + (resDate.getMonth() + 1)).slice(-2) +
      '/' +
      resDate.getFullYear() +
      ' às ' +
      ('0' + resDate.getHours()).slice(-2) +
      ':' +
      ('0' + resDate.getMinutes()).slice(-2)

    var priority = ticket.getString('priority') || 'Média'
    var type = ticket.getString('type') || 'Incidente'

    // Operador responsável
    var operatorName = 'Equipe Lógos'
    var assignedId = ticket.getString('assigned_to')
    if (assignedId) {
      try {
        var opUser = $app.findRecordById('users', assignedId)
        operatorName = opUser.getString('name') || operatorName
      } catch (_) {}
    } else if (e.auth && typeof e.auth.getString === 'function') {
      var authRole = e.auth.getString('role')
      if (
        authRole === 'admin' ||
        authRole === 'gestor' ||
        authRole === 'operador' ||
        authRole === 'tecnico'
      ) {
        operatorName = e.auth.getString('name') || operatorName
      }
    }

    // Nome da empresa
    var companyName = ''
    if (companyId) {
      try {
        var comp = $app.findRecordById('companies', companyId)
        companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
      } catch (_) {}
    }

    // Escape seguro de strings
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

    // Monta dados para template
    var resolvedTemplateData = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      solucao: cleanSolution,
      cliente: requesterName,
      solicitante: requesterName,
      operador: operatorName,
      data_abertura: createdFormatted,
      data_conclusao: resFormatted,
      status: newStatus,
      empresa: companyName,
      prioridade: priority,
      tipo: type,
      link:
        portalBaseUrl || frontendUrl
          ? (portalBaseUrl || frontendUrl) +
            '/portal?tab=tickets&openTicketId=' +
            encodeURIComponent(ticket.id)
          : '',
    }

    // Se a Central de Alertas estiver disponível, usamos o dispatcher com verificação de switch individual
    var centralFailureReason = ''
    if (typeof globalThis.sendSystemAlertEmail === 'function' && recipientEmail) {
      try {
        var resolvedAlertResult = globalThis.sendSystemAlertEmail({
          alert_key: 'ticket_resolved',
          reference_id: ticket.id + '_resolved',
          recipient: recipientEmail,
          subject: 'Chamado #' + ticketNumber + ' concluído: ' + ticketTitle,
          data: resolvedTemplateData,
        })

        if (resolvedAlertResult && resolvedAlertResult.sent) {
          $app
            .logger()
            .info(
              'ticket_resolved_client_email: notificação enviada via Central de Alertas para ' +
                recipientEmail +
                ' (chamado #' +
                ticketNumber +
                ')',
            )
          return e.next()
        } else if (
          resolvedAlertResult &&
          resolvedAlertResult.reason === 'alert_disabled_by_config'
        ) {
          $app
            .logger()
            .info(
              'ticket_resolved_client_email: envio suprimido pois o alerta ticket_resolved está DESLIGADO nas configurações.',
            )
          return e.next()
        } else if (resolvedAlertResult && resolvedAlertResult.reason === 'already_sent') {
          $app
            .logger()
            .info(
              'ticket_resolved_client_email: envio suprimido pois notificação de resolução já foi enviada anteriormente (anti-duplicidade).',
            )
          return e.next()
        } else {
          centralFailureReason = resolvedAlertResult ? resolvedAlertResult.reason : 'desconhecido'
          $app
            .logger()
            .warn(
              'ticket_resolved_client_email: Central de Alertas retornou status não-positivo, acionando fallback de envio.',
              'reason',
              centralFailureReason,
            )
        }
      } catch (centralErr) {
        centralFailureReason = 'exception: ' + centralErr.message
        $app
          .logger()
          .warn(
            'ticket_resolved_client_email: erro ao invocar sendSystemAlertEmail, acionando fallback.',
            'error',
            centralErr.message,
          )
      }
    }

    // Fallback seguro: lê a configuração do template da Central para NUNCA ignorar personalização
    var cfg =
      typeof globalThis.getEmailAlertConfig === 'function'
        ? globalThis.getEmailAlertConfig('ticket_resolved')
        : null

    var subject = ''
    var htmlBody = ''
    var textBody = ''

    if (cfg) {
      if (cfg.enabled === false) {
        $app
          .logger()
          .info(
            'ticket_resolved_client_email: fallback interrompido pois alerta ticket_resolved está desligado nas configurações.',
            'chamado',
            ticketNumber,
          )
        return e.next()
      }

      var rawSubject =
        cfg.subject_template ||
        cfg.default_subject_template ||
        'Chamado #' + ticketNumber + ' concluído: ' + ticketTitle

      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        subject = globalThis.interpolateEmailTemplate(rawSubject, resolvedTemplateData)
      } else {
        subject = rawSubject
      }

      if (typeof globalThis.buildEmailHtmlFromConfig === 'function') {
        htmlBody = globalThis.buildEmailHtmlFromConfig(cfg, resolvedTemplateData)
      }

      var rawBody = cfg.body_template || cfg.default_body_template || ''
      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        var interpolatedBody = globalThis.interpolateEmailTemplate(rawBody, resolvedTemplateData)
        textBody = interpolatedBody
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      } else {
        textBody = rawBody
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      $app
        .logger()
        .info(
          'ticket_resolved_client_email: fallback utilizando template configurado na Central de Alertas.',
          'alert_key',
          'ticket_resolved',
          'template_layout',
          cfg.template_layout || 'modern',
          'subject',
          subject,
          'central_failure_reason',
          centralFailureReason || 'none',
        )
    }

    if (!htmlBody) {
      var defaultSubject = 'Chamado #' + ticketNumber + ' concluído: ' + ticketTitle
      if (!subject) subject = defaultSubject

      // Montagem do bloco de conteúdo HTML
      var contentHtml =
        '<!-- SAUDAÇÃO -->\n' +
        '<p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 24px;">\n' +
        '  Olá, <strong>' +
        esc(requesterName) +
        '</strong>,\n' +
        '</p>\n' +
        '<p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 22px;">\n' +
        '  Temos uma ótima notícia! O seu chamado <strong>foi concluído com sucesso</strong> pela nossa equipe de suporte e está registrado como <strong>' +
        esc(newStatus) +
        '</strong>.\n' +
        '</p>\n' +
        '\n' +
        '<!-- CARD DE RESUMO DO CHAMADO RESOLVIDO -->\n' +
        '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">\n' +
        '  <tr>\n' +
        '    <td style="padding: 16px 20px;">\n' +
        '      <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; width: 50%; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Número do Chamado</div>\n' +
        '            <div style="font-size: 16px; font-weight: 800; color: #16a34a; margin-top: 2px;">#' +
        esc(ticketNumber) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; width: 50%; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Status</div>\n' +
        '            <div style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 2px;">' +
        esc(newStatus) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Data de Abertura</div>\n' +
        '            <div style="font-size: 13px; font-weight: 500; color: #334155; margin-top: 2px;">' +
        esc(createdFormatted) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Data de Conclusão</div>\n' +
        '            <div style="font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 2px;">' +
        esc(resFormatted) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Operador Responsável</div>\n' +
        '            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">' +
        esc(operatorName) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Tipo / Prioridade</div>\n' +
        '            <div style="font-size: 13px; font-weight: 500; color: #334155; margin-top: 2px;">' +
        esc(type) +
        ' • ' +
        esc(priority) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        (companyName
          ? '        <tr>\n' +
            '          <td colspan="2" style="padding-bottom: 10px; vertical-align: top;">\n' +
            '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Empresa</div>\n' +
            '            <div style="font-size: 13px; font-weight: 500; color: #334155; margin-top: 2px;">' +
            esc(companyName) +
            '</div>\n' +
            '          </td>\n' +
            '        </tr>\n'
          : '') +
        '        <tr>\n' +
        '          <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #cbd5e1; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Problema Informado</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">' +
        esc(ticketTitle) +
        '</div>\n' +
        '            <div style="font-size: 13px; color: #475569; line-height: 20px; background-color: #ffffff; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">' +
        esc(cleanDescription) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td colspan="2" style="padding-top: 12px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Solução Aplicada</div>\n' +
        '            <div style="font-size: 13px; color: #15803d; line-height: 20px; background-color: #f0fdf4; padding: 12px 14px; border-radius: 6px; border: 1px solid #bbf7d0; font-weight: 500;">' +
        esc(cleanSolution) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '      </table>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>\n' +
        '\n' +
        '<!-- AVISO DE SATISFAÇÃO / FEEDBACK -->\n' +
        '<div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">\n' +
        '  <p style="margin: 0; font-size: 13px; color: #166534; line-height: 20px;">\n' +
        '    <strong>Chamado Finalizado:</strong> Caso a solução apresentada não tenha atendido completamente sua solicitação ou você precise de suporte complementar, basta responder a este e-mail ou reabrir o chamado através do Portal do Cliente.\n' +
        '  </p>\n' +
        '</div>'

      var htmlBody = ''
      if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
        htmlBody = globalThis.itsmRenderBaseEmailTemplate({
          preheader: 'Seu chamado #' + ticketNumber + ' foi concluído pela nossa equipe técnica.',
          badgeText: 'Chamado Concluído',
          badgeColor: '#16a34a',
          title: 'Chamado Concluído com Sucesso',
          subtitle: 'Chamado #' + ticketNumber + ' — Resolução aplicada',
          contentHtml: contentHtml,
          footerNote:
            'Agradecemos a sua parceria. Para dúvidas ou novas solicitações, entre em contato através dos nossos canais de suporte ou portal do cliente.',
        })
      } else {
        htmlBody = '<div>' + contentHtml + '</div>'
      }

      var textBody =
        'Olá ' +
        requesterName +
        ',\n\n' +
        'Seu chamado #' +
        ticketNumber +
        ' foi concluído com sucesso pela nossa equipe de suporte.\n\n' +
        'Número do Chamado: #' +
        ticketNumber +
        '\n' +
        'Status: ' +
        newStatus +
        '\n' +
        'Problema informado: ' +
        ticketTitle +
        '\n' +
        'Data de Abertura: ' +
        createdFormatted +
        '\n' +
        'Data de Conclusão: ' +
        resFormatted +
        '\n' +
        'Operador Responsável: ' +
        operatorName +
        '\n\n' +
        'Solução Aplicada:\n' +
        cleanSolution +
        '\n\n' +
        'Caso precise de suporte adicional, entre em contato através do portal do cliente.\n\n' +
        '-- Lógos AITSM'
    }

    // Lista consolidada de destinatários (solicitante + contatos/focais extras se configurados)
    var allDestinations = []
    if (recipientEmail) allDestinations.push(recipientEmail)
    for (var ed = 0; ed < extraRecipients.length; ed++) {
      if (allDestinations.indexOf(extraRecipients[ed]) === -1) {
        allDestinations.push(extraRecipients[ed])
      }
    }

    for (var d = 0; d < allDestinations.length; d++) {
      var dest = allDestinations[d]
      try {
        if (typeof globalThis.itsmSendWithAudit === 'function') {
          globalThis.itsmSendWithAudit({
            testType: 'resolucao_chamado',
            to: dest,
            subject: subject,
            html: htmlBody,
            text: textBody,
            meta: {
              ticket_id: ticket.id,
              ticket_number: ticketNumber,
              requester_name: requesterName,
              resolved_at: resRaw,
              solution: cleanSolution,
              operator_name: operatorName,
            },
          })
        } else if (typeof globalThis.sendSystemEmail === 'function') {
          globalThis.sendSystemEmail({
            to: dest,
            subject: subject,
            html: htmlBody,
            text: textBody,
          })
        }
      } catch (sendErr) {
        $app
          .logger()
          .warn(
            'ticket_resolved_client_email: falha ao enviar para ' + dest,
            'err',
            sendErr.message,
          )
      }
    }

    $app
      .logger()
      .info(
        'ticket_resolved_client_email: notificação enviada para ' +
          allDestinations.join(', ') +
          ' (chamado #' +
          ticketNumber +
          ')',
      )
  } catch (err) {
    $app
      .logger()
      .error(
        'ticket_resolved_client_email: falha ao processar e-mail de resolução',
        'error',
        err.message,
      )
  }

  return e.next()
}, 'tickets')
