// Cron job no backend PocketBase executado a cada 5 minutos
// Verifica se existem chamados retidos pendentes aguardando análise
// e dispara notificação para administradores e gestores.
cronAdd('retained_tickets_check', '*/5 * * * *', function () {
  try {
    // 1. Busca todos os chamados retidos que ainda estão pendentes
    var pendingRecords = []
    try {
      pendingRecords = $app.findRecordsByFilter(
        'retained_tickets',
        'status = "Pendente"',
        '-created',
        500,
        0,
      )
    } catch (err) {
      $app.logger().error('retained_tickets_cron: query failed', 'error', err.message)
      return
    }

    if (!pendingRecords || pendingRecords.length === 0) {
      return
    }

    var totalPending = pendingRecords.length

    // 2. Verifica se há chamados ainda não notificados
    var unnotifiedCount = 0
    var unnotifiedRecords = []
    for (var i = 0; i < pendingRecords.length; i++) {
      var rec = pendingRecords[i]
      if (!rec.getBool('retention_notified')) {
        unnotifiedCount++
        unnotifiedRecords.push(rec)
      }
    }

    // Se todos já foram notificados neste lote, não envia novos alertas para não spammar a cada ciclo
    if (unnotifiedCount === 0) {
      return
    }

    // 3. Localizar destinatários: administradores e gestores do sistema
    var recipients = []
    try {
      var users = $app.findRecordsByFilter(
        'users',
        'active = true && (role = "admin" || role = "gestor")',
        'name',
        100,
        0,
      )
      for (var u = 0; u < users.length; u++) {
        recipients.push({
          id: users[u].id,
          name: users[u].getString('name') || users[u].getString('email'),
        })
      }
    } catch (uErr) {
      $app.logger().error('retained_tickets_cron: find users failed', 'error', uErr.message)
    }

    if (recipients.length === 0) {
      return
    }

    // 4. Montar mensagens de alerta
    var title =
      totalPending === 1
        ? '⚠️ 1 chamado retido aguardando análise'
        : '⚠️ ' + totalPending + ' chamados retidos aguardando análise'

    var message =
      totalPending === 1
        ? 'Existe 1 chamado retido por domínio não autorizado aguardando liberação ou descarte.'
        : 'Existem ' +
          totalPending +
          ' chamados retidos por domínio não autorizado aguardando liberação ou descarte.'

    var notifCol = $app.findCollectionByNameOrId('notifications')
    var sentCount = 0

    for (var r = 0; r < recipients.length; r++) {
      try {
        var notif = new Record(notifCol)
        notif.set('user', recipients[r].id)
        notif.set('title', title)
        notif.set('message', message)
        notif.set('type', 'RetainedTicket')
        notif.set('read', false)
        $app.save(notif)
        sentCount++
      } catch (err) {
        $app
          .logger()
          .error(
            'retained_tickets_cron: failed to save notification for ' + recipients[r].id,
            'error',
            err.message,
          )
      }
    }

    // 5. Marcar os registros retidos como notificados para evitar spam no próximo ciclo
    for (var j = 0; j < unnotifiedRecords.length; j++) {
      try {
        var unnotified = unnotifiedRecords[j]
        unnotified.set('retention_notified', true)
        $app.save(unnotified)
      } catch (markErr) {
        $app
          .logger()
          .error(
            'retained_tickets_cron: failed to mark retention_notified',
            'error',
            markErr.message,
          )
      }
    }

    $app
      .logger()
      .info(
        'retained_tickets_cron: dispatched ' +
          sentCount +
          ' notification(s) for ' +
          totalPending +
          ' pending retained tickets (' +
          unnotifiedCount +
          ' newly notified)',
      )
  } catch (globalErr) {
    $app.logger().error('retained_tickets_cron: unhandled error', 'error', globalErr.message)
  }
})
