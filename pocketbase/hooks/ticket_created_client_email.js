// Gatilho imediato de e-mail na abertura de chamado para o cliente
// Requisito 1:
// "Todo chamado aberto pelo cliente assim que ele bater no sistema deverá ser
// enviado um e-mail para o cliente informando que foi aberto um chamado mostrando
// o número do chamado o problema informado, hora de abertura, e uma mensagem
// informando que seu chamado está na fila de atendimento."
//
// Dispara após sucesso de criação de ticket (inclui abertos pelo portal,
// manualmente e pelo ciclo de leitura de e-mail via Microsoft Graph / IMAP).
// Autocontido, seguro e com registro de auditoria em email_audit_logs.

onRecordAfterCreateSuccess((e) => {
  var ticket = e.record
  if (!ticket) return e.next()

  try {
    var recipientEmail = (ticket.getString('requester_email') || '').trim()
    var requesterName = (ticket.getString('requester_name') || 'Cliente').trim()

    // Se o requester_email não estiver preenchido diretamente no chamado,
    // tenta obter pelo usuário autenticado criador
    if (!recipientEmail && e.auth && typeof e.auth.getString === 'function') {
      recipientEmail = (e.auth.getString('email') || '').trim()
      if (!requesterName || requesterName === 'Cliente') {
        requesterName = (e.auth.getString('name') || requesterName).trim()
      }
    }

    if (!recipientEmail) {
      $app
        .logger()
        .info(
          'ticket_created_client_email: chamado #' +
            ticket.getString('number') +
            ' sem e-mail do cliente informado; notificação por e-mail ignorada.',
        )
      return e.next()
    }

    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Chamado sem título'
    var ticketDescription = ticket.getString('description') || ''

    // Limpeza de texto da descrição (resumo de até 500 caracteres para visualização limpa)
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

    // Data/hora de abertura formatada no padrão brasileiro
    var createdRaw = ticket.getString('created')
    var createdDate = createdRaw ? new Date(createdRaw) : new Date()
    var dateFormatted =
      ('0' + createdDate.getDate()).slice(-2) +
      '/' +
      ('0' + (createdDate.getMonth() + 1)).slice(-2) +
      '/' +
      createdDate.getFullYear() +
      ' às ' +
      ('0' + createdDate.getHours()).slice(-2) +
      ':' +
      ('0' + createdDate.getMinutes()).slice(-2)

    var priority = ticket.getString('priority') || 'Média'
    var type = ticket.getString('type') || 'Incidente'

    // Nome da empresa do cliente
    var companyName = ''
    var companyId = ticket.getString('company')
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

    var subject = 'Chamado #' + ticketNumber + ' aberto com sucesso: ' + ticketTitle

    // Montagem do bloco de conteúdo HTML sintético e profissional
    var contentHtml =
      '<!-- SAUDAÇÃO -->\n' +
      '<p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 24px;">\n' +
      '  Olá, <strong>' +
      esc(requesterName) +
      '</strong>,\n' +
      '</p>\n' +
      '<p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 22px;">\n' +
      '  Confirmamos o recebimento da sua solicitação. Seu chamado foi registrado com sucesso e <strong>já está na fila de atendimento</strong> da nossa equipe técnica.\n' +
      '</p>\n' +
      '\n' +
      '<!-- CARD DE RESUMO DO CHAMADO -->\n' +
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
      '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Data e Hora de Abertura</div>\n' +
      '            <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">' +
      esc(dateFormatted) +
      '</div>\n' +
      '          </td>\n' +
      '        </tr>\n' +
      '        <tr>\n' +
      '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
      '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Tipo / Prioridade</div>\n' +
      '            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">' +
      esc(type) +
      ' • ' +
      esc(priority) +
      '</div>\n' +
      '          </td>\n' +
      '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
      '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Status Atual</div>\n' +
      '            <div style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 2px;">Na Fila de Atendimento</div>\n' +
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
      '          <td colspan="2" style="padding-top: 6px; border-top: 1px dashed #cbd5e1; vertical-align: top;">\n' +
      '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Problema Informado</div>\n' +
      '            <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">' +
      esc(ticketTitle) +
      '</div>\n' +
      '            <div style="font-size: 13px; color: #475569; line-height: 20px; background-color: #ffffff; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">' +
      esc(cleanDescription) +
      '</div>\n' +
      '          </td>\n' +
      '        </tr>\n' +
      '      </table>\n' +
      '    </td>\n' +
      '  </tr>\n' +
      '</table>\n' +
      '\n' +
      '<!-- AVISO DE ATENDIMENTO -->\n' +
      '<div style="background-color: #eff6ff; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">\n' +
      '  <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 20px;">\n' +
      '    <strong>Próximos passos:</strong> Seu chamado já está na fila de atendimento e um operador técnico entrará em contato em breve para dar início ao suporte.\n' +
      '  </p>\n' +
      '</div>'

    var htmlBody = ''
    if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
      htmlBody = globalThis.itsmRenderBaseEmailTemplate({
        preheader: 'Seu chamado #' + ticketNumber + ' foi aberto e está na fila de atendimento.',
        badgeText: 'Chamado Aberto',
        badgeColor: '#0284c7',
        title: 'Confirmação de Abertura de Chamado',
        subtitle: 'Chamado #' + ticketNumber + ' registrado no sistema ITSM',
        contentHtml: contentHtml,
        footerNote:
          'Para acompanhar o andamento ou enviar mais informações sobre este chamado, consulte o Portal do Cliente ou responda indicando o número #' +
          ticketNumber +
          '.',
      })
    } else {
      htmlBody = '<div>' + contentHtml + '</div>'
    }

    var textBody =
      'Olá ' +
      requesterName +
      ',\n\n' +
      'Seu chamado foi aberto com sucesso no sistema ServiceOne ITSM e já está na fila de atendimento.\n\n' +
      'Número do Chamado: #' +
      ticketNumber +
      '\n' +
      'Problema informado: ' +
      ticketTitle +
      '\n' +
      'Descrição: ' +
      cleanDescription +
      '\n' +
      'Data e Hora de Abertura: ' +
      dateFormatted +
      '\n' +
      'Prioridade: ' +
      priority +
      '\n\n' +
      'Um operador técnico entrará em contato em breve.\n\n' +
      '-- ServiceOne ITSM'

    if (typeof globalThis.itsmSendWithAudit === 'function') {
      globalThis.itsmSendWithAudit({
        testType: 'abertura_chamado',
        to: recipientEmail,
        subject: subject,
        html: htmlBody,
        text: textBody,
        meta: {
          ticket_id: ticket.id,
          ticket_number: ticketNumber,
          requester_name: requesterName,
          created_at: createdRaw,
        },
      })
    } else if (typeof globalThis.sendSystemEmail === 'function') {
      globalThis.sendSystemEmail({
        to: recipientEmail,
        subject: subject,
        html: htmlBody,
        text: textBody,
      })
    }

    $app
      .logger()
      .info(
        'ticket_created_client_email: notificação enviada para ' +
          recipientEmail +
          ' (chamado #' +
          ticketNumber +
          ')',
      )
  } catch (err) {
    $app
      .logger()
      .error(
        'ticket_created_client_email: falha ao processar e-mail de abertura',
        'error',
        err.message,
      )
  }

  return e.next()
}, 'tickets')
