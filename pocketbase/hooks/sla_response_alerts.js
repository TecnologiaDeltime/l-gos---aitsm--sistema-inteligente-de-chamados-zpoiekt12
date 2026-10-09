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

    // ---- E-mail para o(s) responsável(is) ----
    if (emailEnabled) {
      var subject = '⚠️ SLA de Resposta prestes a vencer - Ticket #' + ticketNumber
      var bodyText =
        'Olá,\n\n' +
        'O SLA de Resposta do chamado abaixo está prestes a vencer:\n\n' +
        'Ticket: #' +
        ticketNumber +
        '\n' +
        'Título: ' +
        ticketTitle +
        '\n' +
        'Empresa: ' +
        companyName +
        '\n' +
        'Cliente: ' +
        clientName +
        '\n' +
        'Tempo restante: ' +
        remainingMin +
        ' minutos\n\n' +
        'Acesse o sistema para responder o chamado imediatamente.\n\n' +
        '-- Sistema ITSM'

      for (var m = 0; m < recipients.length; m++) {
        if (!recipients[m].email) continue
        try {
          var message = new MailMessage()
          message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne' }
          message.to = [{ address: recipients[m].email }]
          message.subject = subject
          message.text = bodyText
          if (globalThis.sendSystemMailMessage) {
            globalThis.sendSystemMailMessage(message)
          } else {
            var mailClient = $app.newMailClient()
            mailClient.send(message)
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
