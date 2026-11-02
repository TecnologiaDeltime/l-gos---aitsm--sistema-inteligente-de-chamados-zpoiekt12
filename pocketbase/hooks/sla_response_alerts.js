// Cron: verifica tickets cujo SLA de Resposta está prestes a vencer (janela
// configurável em sla_alert_settings.minutes_before_expiry, padrão 60 min).
// Para cada ticket encontrado, dispara notificações:
//   - Popup no sistema: registro na coleção `notifications` (type=SLA),
//     entregue em tempo real ao frontend via WebSocket.
//   - E-mail: para o operador responsável (MailMessage).
//   - Voz: o frontend fala ao receber a notificação SLA (SpeechSynthesis).
// Respeita as configurações em `sla_alert_settings` (habilitado/desabilitado,
// canais, intervalo entre alertas por ticket).
//
// Executa a cada minuto e decide internamente, por ticket, se deve disparar
// com base no intervalo configurado (interval_minutes) — usando a última
// notificação SLA do ticket como marcador.
cronAdd('sla_response_alerts', '* * * * *', function () {
  // ---- Carrega configuração global ----
  var settings = null
  try {
    settings = $app.findFirstRecordByFilter('sla_alert_settings', 'scope = "global"', '', 0, 0)
  } catch (_) {}

  // Defaults caso não exista configuração salva.
  var enabled = true
  var popupEnabled = true
  var emailEnabled = true
  var voiceEnabled = true
  var minutesBefore = 60
  var intervalMinutes = 10

  if (settings) {
    enabled = settings.getBool('enabled')
    popupEnabled = settings.getBool('popup_enabled')
    emailEnabled = settings.getBool('email_enabled')
    voiceEnabled = settings.getBool('voice_enabled')
    minutesBefore = settings.getInt('minutes_before_expiry') || 60
    intervalMinutes = settings.getInt('interval_minutes') || 10
  }

  if (!enabled) return

  var now = new Date()
  var nowMs = now.getTime()
  var nowIso = now.toISOString()
  // Janela: disparar quando faltam <= minutesBefore minutos para o vencimento.
  var upperIso = new Date(nowMs + minutesBefore * 60000).toISOString()
  var intervalIso = new Date(nowMs - intervalMinutes * 60000).toISOString()

  // ---- Busca tickets abertos com SLA de Resposta na janela de vencimento ----
  var tickets = []
  try {
    tickets = $app.findRecordsByFilter(
      'tickets',
      'sla_response_deadline != "" && sla_response_deadline <= "' +
        upperIso +
        '" && sla_response_deadline > "' +
        nowIso +
        '" && sla_response_at = "" && sla_paused = false && status != "Resolvido" && status != "Encerrado" && status != "Cancelado"',
      'sla_response_deadline',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('sla_response_alerts: ticket query failed', 'error', err.message)
    return
  }

  if (tickets.length === 0) return

  var notifCol = $app.findCollectionByNameOrId('notifications')
  var sentCount = 0

  for (var i = 0; i < tickets.length; i++) {
    var ticket = tickets[i]
    var ticketId = ticket.id
    var ticketNumber = ticket.getString('number')
    var ticketTitle = ticket.getString('title')
    var assigneeId = ticket.getString('assigned_to')

    // Sem responsável atribuído: notifica admins/gestores.
    var recipients = []
    if (assigneeId) {
      try {
        var assignee = $app.findRecordById('users', assigneeId)
        recipients.push({
          id: assignee.id,
          name: assignee.getString('name') || assignee.getString('email'),
          email: assignee.getString('email') || '',
        })
      } catch (_) {}
    } else {
      try {
        var supervisors = $app.findRecordsByFilter(
          'users',
          'role = "admin" || role = "gestor"',
          'name',
          0,
          0,
        )
        for (var s = 0; s < supervisors.length; s++) {
          recipients.push({
            id: supervisors[s].id,
            name: supervisors[s].getString('name') || supervisors[s].getString('email'),
            email: supervisors[s].getString('email') || '',
          })
        }
      } catch (_) {}
    }

    if (recipients.length === 0) continue

    // Empresa (nome)
    var companyName = 'N/A'
    try {
      var company = $app.findRecordById('companies', ticket.getString('company'))
      companyName = company.getString('legal_name') || company.getString('name') || 'N/A'
    } catch (_) {}

    // Cliente (solicitante)
    var clientName = ticket.getString('requester_name') || 'N/A'

    // Tempo restante (minutos)
    var deadlineMs = new Date(ticket.getString('sla_response_deadline')).getTime()
    var remainingMin = Math.max(0, Math.round((deadlineMs - nowMs) / 60000))

    // ---- Throttle por ticket: pula se já notificado nos últimos intervalMinutes ----
    var alreadyAlerted = false
    try {
      $app.findFirstRecordByFilter(
        'notifications',
        'ticket = "' + ticketId + '" && type = "SLA" && created >= "' + intervalIso + '"',
        '',
        0,
        0,
      )
      alreadyAlerted = true
    } catch (_) {}
    if (alreadyAlerted) continue

    // ---- Popup no sistema: cria notificação para cada destinatário ----
    if (popupEnabled) {
      for (var r = 0; r < recipients.length; r++) {
        try {
          var notif = new Record(notifCol)
          notif.set('user', recipients[r].id)
          notif.set('ticket', ticketId)
          notif.set('title', '⚠️ SLA de Resposta prestes a vencer - Ticket #' + ticketNumber)
          notif.set(
            'message',
            'Ticket #' +
              ticketNumber +
              ' - ' +
              ticketTitle +
              ' | Empresa: ' +
              companyName +
              ' | Cliente: ' +
              clientName +
              ' | Tempo restante: ' +
              remainingMin +
              ' min',
          )
          notif.set('type', 'SLA')
          notif.set('read', false)
          $app.save(notif)
          sentCount++
        } catch (err) {
          $app
            .logger()
            .error(
              'sla_response_alerts: notification save failed for ticket ' + ticketNumber,
              'error',
              err.message,
            )
        }
      }
    } else {
      // Popup desabilitado: cria um registro de notificação "fantasma" apenas
      // para servir de marcador de throttle (assim o e-mail respeita o
      // intervalo mesmo sem popup). Usuário = primeiro destinatário.
      try {
        var marker = new Record(notifCol)
        marker.set('user', recipients[0].id)
        marker.set('ticket', ticketId)
        marker.set('title', 'SLA Resposta (marcador) - Ticket #' + ticketNumber)
        marker.set('message', 'marcador de intervalo')
        marker.set('type', 'SLA')
        marker.set('read', true)
        $app.save(marker)
      } catch (_) {}
    }

    // ---- E-mail para o(s) responsável(is) / operador(es) ----
    if (emailEnabled) {
      var subject =
        '⚠️ Alerta de SLA: Chamado #' +
        ticketNumber +
        ' prestes a vencer (' +
        remainingMin +
        ' min)'
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

      var deadlineFormatted = ''
      try {
        var dlDate = new Date(ticket.getString('sla_response_deadline'))
        deadlineFormatted =
          ('0' + dlDate.getDate()).slice(-2) +
          '/' +
          ('0' + (dlDate.getMonth() + 1)).slice(-2) +
          '/' +
          dlDate.getFullYear() +
          ' às ' +
          ('0' + dlDate.getHours()).slice(-2) +
          ':' +
          ('0' + dlDate.getMinutes()).slice(-2)
      } catch (_) {
        deadlineFormatted = remainingMin + ' min restantes'
      }

      var contentHtml =
        '<!-- AVISO CRÍTICO -->\n' +
        '<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">\n' +
        '  <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
        '    <tr>\n' +
        '      <td style="font-size: 20px; width: 30px; vertical-align: top;">⚠️</td>\n' +
        '      <td style="vertical-align: top;">\n' +
        '        <div style="font-size: 14px; font-weight: 700; color: #991b1b;">SLA de Primeiro Atendimento Prestes a Expirar</div>\n' +
        '        <div style="font-size: 13px; color: #b91c1c; margin-top: 3px; line-height: 18px;">Restam aproximadamente <strong>' +
        esc(remainingMin) +
        ' minutos</strong> para a expiração do prazo de resposta contratual.</div>\n' +
        '      </td>\n' +
        '    </tr>\n' +
        '  </table>\n' +
        '</div>\n' +
        '\n' +
        '<!-- DETALHES DO TICKET -->\n' +
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
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Prazo Limite (SLA)</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #dc2626; margin-top: 2px;">' +
        esc(deadlineFormatted) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Empresa / Cliente</div>\n' +
        '            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">' +
        esc(companyName) +
        ' • ' +
        esc(clientName) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Prioridade</div>\n' +
        '            <div style="font-size: 13px; font-weight: 700; color: #b45309; margin-top: 2px;">' +
        esc(ticket.getString('priority') || 'Média') +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td colspan="2" style="padding-top: 6px; border-top: 1px dashed #cbd5e1; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Assunto do Chamado</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">' +
        esc(ticketTitle) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '      </table>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'

      var htmlBody = ''
      if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
        htmlBody = globalThis.itsmRenderBaseEmailTemplate({
          preheader:
            'Alerta de SLA prestes a vencer para o chamado #' +
            ticketNumber +
            ' (' +
            remainingMin +
            ' min restantes)',
          badgeText: 'Alerta de SLA',
          badgeColor: '#dc2626',
          title: 'SLA de Resposta Prestes a Vencer',
          subtitle: 'Chamado #' + ticketNumber + ' requer atendimento imediato',
          contentHtml: contentHtml,
          footerNote:
            'Este é um alerta operacional gerado automaticamente para operadores e gestores de serviço ITSM.',
        })
      } else {
        htmlBody = '<div>' + contentHtml + '</div>'
      }

      var bodyText =
        'ALERTA OPERACIONAL DE SLA\n\n' +
        'O SLA de Resposta do chamado abaixo está prestes a vencer:\n\n' +
        'Chamado: #' +
        ticketNumber +
        '\n' +
        'Título: ' +
        ticketTitle +
        '\n' +
        'Empresa: ' +
        companyName +
        '\n' +
        'Solicitante: ' +
        clientName +
        '\n' +
        'Tempo Restante: ' +
        remainingMin +
        ' minutos\n' +
        'Prazo Limite: ' +
        deadlineFormatted +
        '\n\n' +
        'Acesse o sistema ITSM para responder ao chamado imediatamente.\n\n' +
        '-- Lógos ITSM'

      for (var m = 0; m < recipients.length; m++) {
        if (!recipients[m].email) continue
        try {
          if (typeof globalThis.itsmSendWithAudit === 'function') {
            globalThis.itsmSendWithAudit({
              testType: 'alerta_sla',
              to: recipients[m].email,
              subject: subject,
              html: htmlBody,
              text: bodyText,
              meta: {
                ticket_id: ticketId,
                ticket_number: ticketNumber,
                operator_id: recipients[m].id,
                operator_name: recipients[m].name,
                remaining_min: remainingMin,
                sla_type: 'response',
              },
            })
          } else if (typeof globalThis.sendSystemEmail === 'function') {
            globalThis.sendSystemEmail({
              to: recipients[m].email,
              subject: subject,
              html: htmlBody,
              text: bodyText,
            })
          }
        } catch (err) {
          $app
            .logger()
            .error(
              'sla_response_alerts: erro ao enviar e-mail para ' + recipients[m].email,
              'error',
              err.message,
            )
        }
      }
    }

    // Atualiza last_alert_at (apenas observabilidade).
    if (settings) {
      try {
        settings.set('last_alert_at', nowIso)
        $app.save(settings)
      } catch (_) {}
    }

    $app
      .logger()
      .info(
        'sla_response_alerts: alerted ticket #' +
          ticketNumber +
          ' (' +
          remainingMin +
          ' min restantes) - recipients: ' +
          recipients.length,
      )
  }

  $app
    .logger()
    .info(
      'sla_response_alerts: dispatched ' +
        sentCount +
        ' popup notification(s) for ' +
        tickets.length +
        ' ticket(s)',
    )
})
