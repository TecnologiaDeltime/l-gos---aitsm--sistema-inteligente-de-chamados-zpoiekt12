// Cron: alertas de consumo de horas contratuais POR NÍVEL de atendimento.
//
// Roda a cada 5 minutos (*/5 * * * *) e, para cada contrato ativo, calcula o
// consumo por nível (Nível 1, Nível 2, Nível 3, Consultoria, Backoffice,
// Administrativo) somando as durações das interações dos tickets cuja fila
// pertence ao nível correspondente. Ao cruzar 80% / 90% / 100% (e ainda não
// tiver notificado aquele threshold para o par contrato+nível), dispara:
//   - Notificação in-app (notifications, type="Alerta")
//   - E-mail (MailMessage) para o mesmo conjunto + quality_team_emails
// Aos 100%, marca o contrato como "Expirado".
//
// É complementar ao hook `consumption_alerts.js` (que monitora o total do
// contract_periods) — aqui o foco é por nível. O throttle é guardado no campo
// `last_notified_level_pcts` da config (JSON: { "contractId_nivel1": 80 }).
cronAdd('level_consumption_alerts', '*/5 * * * *', function () {
  // ---- Níveis e campos de horas contratadas no contrato ----
  var LEVELS = [
    { key: 'nivel1', label: 'Nível 1', field: 'hours_level1' },
    { key: 'nivel2', label: 'Nível 2', field: 'hours_level2' },
    { key: 'nivel3', label: 'Nível 3', field: 'hours_level3' },
    { key: 'consultoria', label: 'Consultoria', field: 'hours_consultoria' },
    { key: 'backoffice', label: 'Backoffice', field: 'hours_backoffice' },
    { key: 'administrativo', label: 'Administrativo', field: 'hours_administrativo' },
  ]
  // Mapa label (valor do select queue.level) -> chave interna
  var LABEL_TO_KEY = {
    'Nível 1': 'nivel1',
    'Nível 2': 'nivel2',
    'Nível 3': 'nivel3',
    Consultoria: 'consultoria',
    Backoffice: 'backoffice',
    Administrativo: 'administrativo',
  }

  // ---- Carrega configs (global + por empresa) ----
  var configs = []
  try {
    configs = $app.findRecordsByFilter('consumption_alert_configs', 'id != ""', '-created', 0, 0)
  } catch (err) {
    $app.logger().error('level_consumption_alerts: config query failed', 'error', err.message)
    return
  }
  if (configs.length === 0) return

  // Indexa: por companyId (vazio = global)
  var configByCompany = {}
  var globalConfig = null
  for (var ci = 0; ci < configs.length; ci++) {
    var cfg = configs[ci]
    var cId = cfg.getString('company')
    if (cId === '') {
      if (!globalConfig) globalConfig = cfg
    } else {
      if (!configByCompany[cId]) configByCompany[cId] = cfg
    }
  }
  if (!globalConfig) {
    // Sem config global — usa a primeira disponível como fallback
    globalConfig = configs[0]
  }
  if (!globalConfig.getBool('enabled')) return

  // ---- Contratos ativos ----
  var contracts = []
  try {
    contracts = $app.findRecordsByFilter('contracts', 'status = "Ativo"', '-created', 0, 0)
  } catch (err) {
    $app.logger().error('level_consumption_alerts: contracts query failed', 'error', err.message)
    return
  }
  if (contracts.length === 0) return

  var notifCol = $app.findCollectionByNameOrId('notifications')
  var sentCount = 0

  for (var i = 0; i < contracts.length; i++) {
    var contract = contracts[i]
    var contractId = contract.id
    var contractNumber = contract.getString('number') || 'N/A'
    var companyId = contract.getString('company')

    // Resolved config: específica da empresa se existir, senão global.
    var config = configByCompany[companyId] || globalConfig

    // Thresholds habilitados nesta config
    var th80 = config.getBool('threshold_80_enabled')
    var th90 = config.getBool('threshold_90_enabled')
    var th100 = config.getBool('threshold_100_enabled')
    if (!th80 && !th90 && !th100) continue

    // Destinatários habilitados
    var notifyAdmins = config.getBool('notify_admins')
    var notifyFocalPoints = config.getBool('notify_focal_points')
    var notifyTicketResponsible = config.getBool('notify_ticket_responsible')
    var notifyQualityTeam = config.getBool('notify_quality_team')
    var notifyCompanyResponsible = config.getBool('notify_company_responsible')

    // Nome da empresa
    var companyName = 'N/A'
    try {
      var company = $app.findRecordById('companies', companyId)
      companyName =
        company.getString('trade_name') ||
        company.getString('legal_name') ||
        company.getString('name') ||
        'N/A'
    } catch (_) {}

    // Throttle state (JSON na config)
    var lastNotified = {}
    try {
      var raw = config.get('last_notified_level_pcts')
      if (raw) {
        var parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') lastNotified = parsed
      }
    } catch (_) {}
    var throttleChanged = false

    // ---- Para cada nível, calcula consumo ----
    for (var li = 0; li < LEVELS.length; li++) {
      var level = LEVELS[li]
      var contractedHours = contract.getFloat(level.field) || 0
      // Sem horas contratadas para este nível — não há o que alertar
      if (contractedHours <= 0) continue

      // Somar duration_minutes das interações dos tickets deste contrato cuja
      // fila tenha level = level.label.
      var consumedMinutes = 0
      try {
        // Busca tickets deste contrato
        var tickets = $app.findRecordsByFilter(
          'tickets',
          'contract = "' + contractId + '"',
          '',
          0,
          0,
        )
        for (var ti = 0; ti < tickets.length; ti++) {
          var queueId = tickets[ti].getString('queue')
          if (!queueId) continue
          // Verifica se a fila tem o nível correspondente
          var queueLevel = ''
          try {
            var queue = $app.findRecordById('queues', queueId)
            queueLevel = queue.getString('level')
          } catch (_) {}
          if (queueLevel !== level.label) continue
          // Soma durações das interações deste ticket
          var interactions = []
          try {
            interactions = $app.findRecordsByFilter(
              'ticket_interactions',
              'ticket = "' + tickets[ti].id + '"',
              '',
              0,
              0,
            )
          } catch (_) {}
          for (var ii = 0; ii < interactions.length; ii++) {
            consumedMinutes += interactions[ii].getFloat('duration_minutes') || 0
          }
        }
      } catch (err) {
        $app
          .logger()
          .error(
            'level_consumption_alerts: consumption calc failed contract ' +
              contractNumber +
              ' ' +
              level.label,
            'error',
            err.message,
          )
        continue
      }

      var consumedHours = consumedMinutes / 60
      var pct = (consumedHours / contractedHours) * 100
      var pctRounded = Math.round(pct)

      // Determina qual threshold disparar (respeita habilitados e throttle)
      var thresholdKey = contractId + '_' + level.key
      var alreadyNotified = lastNotified[thresholdKey] || 0

      var targetThreshold = 0
      if (pct >= 100 && th100 && alreadyNotified < 100) {
        targetThreshold = 100
      } else if (pct >= 90 && th90 && alreadyNotified < 90) {
        targetThreshold = 90
      } else if (pct >= 80 && th80 && alreadyNotified < 80) {
        targetThreshold = 80
      }
      if (targetThreshold === 0) continue

      // ---- Monta destinatários ----
      var recipientIds = {} // map para evitar duplicidade
      var recipientEmails = {} // map email -> true (para e-mail)

      // Administradores e gestores
      if (notifyAdmins) {
        try {
          var admins = $app.findRecordsByFilter(
            'users',
            'role = "admin" || role = "gestor"',
            '',
            0,
            0,
          )
          for (var a = 0; a < admins.length; a++) {
            recipientIds[admins[a].id] = true
            var aEmail = admins[a].getString('email')
            if (aEmail) recipientEmails[aEmail] = true
          }
        } catch (_) {}
      }

      // Responsável da empresa (cliente_gestor) da empresa do contrato
      if (notifyCompanyResponsible) {
        try {
          var companyUsers = $app.findRecordsByFilter(
            'users',
            'role = "cliente_gestor" && company = "' + companyId + '"',
            '',
            0,
            0,
          )
          for (var cu = 0; cu < companyUsers.length; cu++) {
            recipientIds[companyUsers[cu].id] = true
            var cuEmail = companyUsers[cu].getString('email')
            if (cuEmail) recipientEmails[cuEmail] = true
          }
        } catch (_) {}
      }

      // Pontos focais do cliente (client_contacts is_focal_point=true da empresa)
      if (notifyFocalPoints) {
        try {
          var focalPoints = $app.findRecordsByFilter(
            'client_contacts',
            'client = "' + companyId + '" && is_focal_point = true',
            '',
            0,
            0,
          )
          for (var fp = 0; fp < focalPoints.length; fp++) {
            var fpEmail = focalPoints[fp].getString('email')
            if (fpEmail) recipientEmails[fpEmail] = true
            // Se o ponto focal tem usuário vinculado, notifica in-app
            var fpUser = focalPoints[fp].getString('user')
            if (fpUser) recipientIds[fpUser] = true
          }
        } catch (_) {}
      }

      // Responsável do chamado (operador com interações neste contrato+nível)
      if (notifyTicketResponsible) {
        try {
          var cTickets = $app.findRecordsByFilter(
            'tickets',
            'contract = "' + contractId + '" && assigned_to != ""',
            '',
            0,
            0,
          )
          for (var ct = 0; ct < cTickets.length; ct++) {
            var qId = cTickets[ct].getString('queue')
            if (!qId) continue
            var qLevel2 = ''
            try {
              var q = $app.findRecordById('queues', qId)
              qLevel2 = q.getString('level')
            } catch (_) {}
            if (qLevel2 !== level.label) continue
            var assigneeId = cTickets[ct].getString('assigned_to')
            if (assigneeId) {
              recipientIds[assigneeId] = true
              try {
                var assignee = $app.findRecordById('users', assigneeId)
                var aEmail2 = assignee.getString('email')
                if (aEmail2) recipientEmails[aEmail2] = true
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // Equipe da qualidade (e-mails da config)
      if (notifyQualityTeam) {
        var qualityEmailsStr = config.getString('quality_team_emails') || ''
        if (qualityEmailsStr) {
          var parts = qualityEmailsStr.split(',')
          for (var pe = 0; pe < parts.length; pe++) {
            var em = parts[pe].trim()
            if (em) recipientEmails[em] = true
          }
        }
      }

      // ---- Mensagens ----
      var pctLabel = targetThreshold + '%'
      var subject =
        '⚠️ Alerta de Consumo ' + pctLabel + ' - Contrato ' + contractNumber + ' - ' + level.label
      var title = '⚠️ Alerta de Consumo ' + pctLabel + ' - ' + level.label
      var saldo = contractedHours - consumedHours
      var message =
        'Contrato ' +
        contractNumber +
        ' | Empresa: ' +
        companyName +
        ' | Nível: ' +
        level.label +
        ' | Contratadas: ' +
        contractedHours.toFixed(2) +
        'h' +
        ' | Consumidas: ' +
        consumedHours.toFixed(2) +
        'h' +
        ' | Saldo: ' +
        saldo.toFixed(2) +
        'h' +
        ' | Consumo: ' +
        pctRounded +
        '%'

      var bodyText =
        'Olá,\n\n' +
        'Alerta de consumo de horas contratuais por nível de atendimento:\n\n' +
        'Contrato: ' +
        contractNumber +
        '\n' +
        'Empresa: ' +
        companyName +
        '\n' +
        'Nível: ' +
        level.label +
        '\n' +
        'Horas contratadas: ' +
        contractedHours.toFixed(2) +
        'h\n' +
        'Horas consumidas: ' +
        consumedHours.toFixed(2) +
        'h\n' +
        'Saldo restante: ' +
        saldo.toFixed(2) +
        'h\n' +
        'Percentual de consumo: ' +
        pctRounded +
        '%\n\n' +
        'Acesse o sistema para maiores detalhes.\n\n' +
        '-- ServiceOne'

      // ---- Notificação in-app ----
      var userIds = Object.keys(recipientIds)
      for (var u = 0; u < userIds.length; u++) {
        try {
          var notif = new Record(notifCol)
          notif.set('user', userIds[u])
          notif.set('title', title)
          notif.set('message', message)
          notif.set('type', 'Alerta')
          notif.set('read', false)
          $app.save(notif)
          sentCount++
        } catch (err) {
          $app
            .logger()
            .error(
              'level_consumption_alerts: notif save failed contract ' +
                contractNumber +
                ' ' +
                level.label,
              'error',
              err.message,
            )
        }
      }

      // ---- E-mail ----
      var emailList = Object.keys(recipientEmails)
      for (var em2 = 0; em2 < emailList.length; em2++) {
        try {
          var mailMsg = new MailMessage()
          mailMsg.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne' }
          mailMsg.to = [{ address: emailList[em2] }]
          mailMsg.subject = subject
          mailMsg.text = bodyText
          var mailClient = $app.newMailClient()
          mailClient.send(mailMsg)
        } catch (err) {
          $app
            .logger()
            .error(
              'level_consumption_alerts: email send failed ' + emailList[em2],
              'error',
              err.message,
            )
        }
      }

      // ---- 100%: marca contrato como Expirado ----
      if (targetThreshold === 100) {
        try {
          contract.set('status', 'Expirado')
          $app.save(contract)
        } catch (err) {
          $app
            .logger()
            .error(
              'level_consumption_alerts: failed to expire contract ' + contractNumber,
              'error',
              err.message,
            )
        }
      }

      // ---- Atualiza throttle ----
      lastNotified[thresholdKey] = targetThreshold
      throttleChanged = true

      $app
        .logger()
        .info(
          'level_consumption_alerts: alerted contract ' +
            contractNumber +
            ' ' +
            level.label +
            ' @ ' +
            targetThreshold +
            '%',
        )
    }

    // Persiste throttle na config (uma vez por contrato, se mudou)
    if (throttleChanged) {
      try {
        config.set('last_notified_level_pcts', JSON.stringify(lastNotified))
        $app.save(config)
      } catch (err) {
        $app.logger().error('level_consumption_alerts: throttle save failed', 'error', err.message)
      }
    }
  }

  if (sentCount > 0) {
    $app.logger().info('level_consumption_alerts: dispatched ' + sentCount + ' notification(s)')
  }
})
