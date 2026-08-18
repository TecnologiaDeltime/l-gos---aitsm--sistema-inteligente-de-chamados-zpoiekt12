// Cron: alertas de chamados abertos sem atualização (interação) há mais de
// X horas (configurável em stale_ticket_alert_settings.hours_without_update,
// padrão 8h). Para cada ticket "sem movimento", dispara uma notificação
// in-app (notifications, type="StaleTicket") dirigida ao operador
// responsável (assigned_to). Se o ticket não tiver responsável, notifica
// admins/gestores.
//
// Throttle: o campo `last_stale_alert_at` do próprio ticket guarda a data do
// último disparo; o ticket só volta a ser alertado quando a janela de
// `hours_without_update` se completa novamente após a última interação.
//
// Executa a cada 15 minutos.
cronAdd('stale_ticket_alerts', '*/15 * * * *', function () {
  // ---- Carrega configuração global ----
  var settings = null
  try {
    settings = $app.findFirstRecordByFilter(
      'stale_ticket_alert_settings',
      'scope = "global"',
      '',
      0,
      0,
    )
  } catch (_) {}

  // Defaults caso não exista configuração salva.
  var enabled = true
  var popupEnabled = true
  var voiceEnabled = true
  var hoursWithoutUpdate = 8

  if (settings) {
    enabled = settings.getBool('enabled')
    popupEnabled = settings.getBool('popup_enabled')
    voiceEnabled = settings.getBool('voice_enabled')
    hoursWithoutUpdate = settings.getInt('hours_without_update') || 8
  }

  if (!enabled) return

  var now = new Date()
  var nowMs = now.getTime()
  var nowIso = now.toISOString()
  // Janela: ticket está "sem atualização" se a última interação (ou a
  // própria criação, se nunca houve interação) for anterior a este limite.
  var staleLimitMs = nowMs - hoursWithoutUpdate * 3600000
  var staleLimitIso = new Date(staleLimitMs).toISOString()

  // ---- Busca tickets abertos (não resolvidos/encerrados/cancelados) ----
  var tickets = []
  try {
    tickets = $app.findRecordsByFilter(
      'tickets',
      'status != "Resolvido" && status != "Encerrado" && status != "Cancelado"',
      'created',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('stale_ticket_alerts: ticket query failed', 'error', err.message)
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

    // ---- Determina a última atividade do ticket ----
    // A data de referência é a mais recente entre:
    //   - a última interação registrada (created)
    //   - o campo `updated` do ticket
    //   - o campo `created` do ticket
    var lastActivityIso = ticket.getString('updated') || ticket.getString('created') || ''

    try {
      var interactions = $app.findRecordsByFilter(
        'ticket_interactions',
        'ticket = "' + ticketId + '"',
        '-created',
        1,
        0,
      )
      if (interactions.length > 0) {
        var lastIntIso = interactions[0].getString('created') || ''
        if (lastIntIso && (!lastActivityIso || lastIntIso > lastActivityIso)) {
          lastActivityIso = lastIntIso
        }
      }
    } catch (_) {}

    if (!lastActivityIso) continue

    var lastActivityMs = new Date(lastActivityIso).getTime()
    if (isNaN(lastActivityMs)) continue

    // Ainda não atingiu a janela de "sem atualização".
    if (lastActivityMs > staleLimitMs) continue

    // ---- Throttle: não repetir alerta dentro da própria janela ----
    // Regra: só dispara se ainda não alertamos este ticket OU se o último
    // alerta ocorreu antes da última atividade (ou seja, houve uma nova
    // janela de inatividade desde o alerta anterior).
    var lastAlertIso = ticket.getString('last_stale_alert_at') || ''
    if (lastAlertIso) {
      var lastAlertMs = new Date(lastAlertIso).getTime()
      if (!isNaN(lastAlertMs) && lastAlertMs > lastActivityMs) {
        // Já alertamos depois da última atividade — aguardar nova interação.
        continue
      }
    }

    // ---- Destinatário: operador responsável; sem responsável, admins/gestores ----
    var recipients = []
    var assigneeId = ticket.getString('assigned_to')
    if (assigneeId) {
      try {
        var assignee = $app.findRecordById('users', assigneeId)
        recipients.push({
          id: assignee.id,
          name: assignee.getString('name') || assignee.getString('email'),
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
          })
        }
      } catch (_) {}
    }

    if (recipients.length === 0) continue

    // ---- Dados para exibição ----
    var companyName = 'N/A'
    try {
      var company = $app.findRecordById('companies', ticket.getString('company'))
      companyName = company.getString('legal_name') || company.getString('name') || 'N/A'
    } catch (_) {}

    var clientName = ticket.getString('requester_name') || 'N/A'

    // Há quanto tempo sem atualização (horas arredondadas p/ baixo, mín 1).
    var hoursStale = Math.max(1, Math.floor((nowMs - lastActivityMs) / 3600000))

    var title = '⏳ Chamado sem atualização - Ticket #' + ticketNumber
    var message =
      'Ticket #' +
      ticketNumber +
      ' - ' +
      ticketTitle +
      ' | Empresa: ' +
      companyName +
      ' | Cliente: ' +
      clientName +
      ' | Sem atualização há: ' +
      hoursStale +
      ' hora(s)'

    // ---- Popup no sistema (notificação por destinatário) ----
    if (popupEnabled) {
      for (var r = 0; r < recipients.length; r++) {
        try {
          var notif = new Record(notifCol)
          notif.set('user', recipients[r].id)
          notif.set('ticket', ticketId)
          notif.set('title', title)
          notif.set('message', message)
          notif.set('type', 'StaleTicket')
          notif.set('read', false)
          $app.save(notif)
          sentCount++
        } catch (err) {
          $app
            .logger()
            .error(
              'stale_ticket_alerts: notification save failed for ticket ' + ticketNumber,
              'error',
              err.message,
            )
        }
      }
    }

    // ---- Marca throttle no ticket (independente de popup) ----
    try {
      ticket.set('last_stale_alert_at', nowIso)
      $app.save(ticket)
    } catch (err) {
      $app
        .logger()
        .error(
          'stale_ticket_alerts: failed to set last_stale_alert_at for ticket ' + ticketNumber,
          'error',
          err.message,
        )
    }

    $app
      .logger()
      .info(
        'stale_ticket_alerts: alerted ticket #' +
          ticketNumber +
          ' (sem atualização há ' +
          hoursStale +
          'h) - recipients: ' +
          recipients.length +
          ' - voice: ' +
          (voiceEnabled ? 'on' : 'off'),
      )
  }

  // Observabilidade: atualiza last_alert_at na config.
  if (settings) {
    try {
      settings.set('last_alert_at', nowIso)
      $app.save(settings)
    } catch (_) {}
  }

  $app
    .logger()
    .info(
      'stale_ticket_alerts: dispatched ' + sentCount + ' popup notification(s) for stale tickets',
    )
})
