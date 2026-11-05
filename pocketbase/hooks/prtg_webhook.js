/**
 * Webhook de Integração com a ferramenta de monitoramento PRTG Network Monitor.
 *
 * Rota pública autenticada por token via query param (?token=...):
 *   ANY /backend/v1/webhooks/prtg
 *
 * O PRTG dispara notificações HTTP com placeholders (%sensor, %device, %status, etc).
 */

routerAdd('ANY', '/backend/v1/webhooks/prtg', (e) => {
  // Helpers internos declarados estritamente dentro da callback
  const isStatusUp = function (statusRaw, message) {
    const s = (statusRaw || '').toLowerCase()
    const m = (message || '').toLowerCase()
    if (s === 'up' || s === 'ok' || s === 'good' || s === 'recuperado' || s === 'resolved') {
      return true
    }
    if (
      m.includes('ended') ||
      m.includes('up again') ||
      m.includes('back to normal') ||
      m.includes('normalizado')
    ) {
      return true
    }
    return false
  }

  const findOpenTicketForSensor = function (sensorKey, dedupHours) {
    if (!sensorKey) return null
    try {
      const closedFilter = "status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'"
      const cutoff = new Date(Date.now() - dedupHours * 3600 * 1000).toISOString()
      const safeKey = sensorKey.replace(/'/g, "\\'")
      const filter =
        "monitoring_sensor_id = '" +
        safeKey +
        "' && " +
        closedFilter +
        " && created >= '" +
        cutoff +
        "'"

      const list = $app.findRecordsByFilter('tickets', filter, '-created', 1, 0)
      if (list && list.length > 0) {
        return list[0]
      }
    } catch (err) {
      $app.logger().warn('PRTG: erro ao consultar chamado aberto do sensor', 'error', err.message)
    }
    return null
  }

  const createTicketInteraction = function (ticketId, content, type) {
    try {
      const interCol = $app.findCollectionByNameOrId('ticket_interactions')
      const inter = new Record(interCol)
      inter.set('ticket', ticketId)
      inter.set('content', content)
      inter.set('type', type || 'Público')
      inter.set('origin', 'Automático')

      let authorId = ''
      try {
        const adminUser = $app.findFirstRecordByFilter(
          'users',
          'role = "admin" || is_admin = true',
          '+created',
          0,
          0,
        )
        if (adminUser) authorId = adminUser.id
        else {
          const anyUser = $app.findFirstRecordByFilter('users', 'id != ""', '+created', 0, 0)
          if (anyUser) authorId = anyUser.id
        }
      } catch (_) {}

      if (authorId) {
        inter.set('author', authorId)
      }

      $app.save(inter)
    } catch (e) {
      $app.logger().warn('PRTG: erro ao criar ticket_interaction', 'error', e.message)
    }
  }

  const recordTicketHistory = function (ticketId, action, field, oldVal, newVal) {
    try {
      const histCol = $app.findCollectionByNameOrId('ticket_history')
      const hist = new Record(histCol)
      hist.set('ticket', ticketId)
      hist.set('action', action)
      if (field) hist.set('field', field)
      if (oldVal) hist.set('old_value', String(oldVal))
      if (newVal) hist.set('new_value', String(newVal))

      let authorId = ''
      try {
        const anyUser = $app.findFirstRecordByFilter('users', 'id != ""', '+created', 0, 0)
        if (anyUser) authorId = anyUser.id
      } catch (_) {}

      if (authorId) hist.set('user', authorId)
      $app.save(hist)
    } catch (_) {}
  }

  const notifyQueueOperators = function (queueId, ticketRecord) {
    if (!queueId) return
    try {
      const queue = $app.findRecordById('queues', queueId)
      const members = queue.get('members') || []
      const manager = queue.getString('manager')
      const recipients = []

      if (members && Array.isArray(members)) {
        for (let i = 0; i < members.length; i++) {
          const m = members[i]
          if (recipients.indexOf(m) === -1) recipients.push(m)
        }
      }
      if (manager && recipients.indexOf(manager) === -1) {
        recipients.push(manager)
      }

      const notifCol = $app.findCollectionByNameOrId('notifications')
      const tNumber = ticketRecord.getString('number')
      const tTitle = ticketRecord.getString('title')

      for (let j = 0; j < recipients.length; j++) {
        const uid = recipients[j]
        try {
          const n = new Record(notifCol)
          n.set('user', uid)
          n.set('ticket', ticketRecord.id)
          n.set('title', 'Alerta PRTG - Novo Chamado: #' + tNumber)
          n.set('message', tTitle)
          n.set('type', 'Atribuição')
          n.set('read', false)
          $app.save(n)
        } catch (_) {}
      }
    } catch (err) {
      $app.logger().warn('PRTG: falha ao notificar operadores da fila', 'error', err.message)
    }
  }

  const sendCriticalMonitoringEmail = function (ticketRecord, device, sensor, alertMsg, alertTime) {
    try {
      const qId = ticketRecord.getString('queue')
      if (!qId) return

      const queue = $app.findRecordById('queues', qId)
      const members = queue.get('members') || []
      const manager = queue.getString('manager')
      const emailRecipients = []

      const candidateIds = [...(Array.isArray(members) ? members : [])]
      if (manager && candidateIds.indexOf(manager) === -1) candidateIds.push(manager)

      for (let i = 0; i < candidateIds.length; i++) {
        const cid = candidateIds[i]
        try {
          const u = $app.findRecordById('users', cid)
          const email = (u.getString('email') || '').trim()
          if (email && emailRecipients.indexOf(email) === -1) {
            emailRecipients.push(email)
          }
        } catch (_) {}
      }

      if (emailRecipients.length === 0) return

      const tNumber = ticketRecord.getString('number')
      const subject = '[CRÍTICO PRTG] Alerta no Sensor #' + tNumber + ' - ' + (device || sensor)

      const contentHtml =
        '<div style="font-family: sans-serif; color: #1e293b; line-height: 1.5;">' +
        '  <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin-bottom: 16px; border-radius: 4px;">' +
        '    <strong style="color: #991b1b; font-size: 16px;">Alerta Crítico de Monitoramento (PRTG)</strong>' +
        '    <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 14px;">Um incidente crítico foi detectado e o chamado <strong>#' +
        tNumber +
        '</strong> foi gerado automaticamente.</p>' +
        '  </div>' +
        '  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">' +
        '    <tr><td style="padding: 6px 0; color: #64748b; width: 130px;">Dispositivo:</td><td style="font-weight: 600;">' +
        (device || 'N/A') +
        '</td></tr>' +
        '    <tr><td style="padding: 6px 0; color: #64748b;">Sensor:</td><td style="font-weight: 600;">' +
        (sensor || 'N/A') +
        '</td></tr>' +
        '    <tr><td style="padding: 6px 0; color: #64748b;">Mensagem:</td><td style="color: #dc2626; font-weight: 600;">' +
        (alertMsg || 'DOWN') +
        '</td></tr>' +
        '    <tr><td style="padding: 6px 0; color: #64748b;">Data/Hora:</td><td>' +
        alertTime +
        '</td></tr>' +
        '    <tr><td style="padding: 6px 0; color: #64748b;">Prioridade:</td><td><span style="background-color: #dc2626; color: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">Crítica</span></td></tr>' +
        '  </table>' +
        '  <p style="font-size: 13px; color: #475569;">Acesse o Lógos AITSM para iniciar o atendimento imediato deste incidente.</p>' +
        '</div>'

      let htmlBody = ''
      if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
        htmlBody = globalThis.itsmRenderBaseEmailTemplate({
          preheader: 'Alerta Crítico de Monitoramento PRTG - Chamado #' + tNumber,
          badgeText: 'Alerta Crítico',
          badgeColor: '#dc2626',
          title: 'Alerta de Monitoramento PRTG',
          subtitle: 'Incidente Crítico #' + tNumber + ' aberto automaticamente',
          contentHtml: contentHtml,
          footerNote: 'Mensagem gerada automaticamente pelo agente de monitoramento PRTG.',
        })
      } else {
        htmlBody = contentHtml
      }

      const textBody =
        'ALERTA CRÍTICO DE MONITORAMENTO (PRTG)\n\n' +
        'Chamado: #' +
        tNumber +
        '\n' +
        'Dispositivo: ' +
        device +
        '\n' +
        'Sensor: ' +
        sensor +
        '\n' +
        'Mensagem: ' +
        alertMsg +
        '\n' +
        'Data/Hora: ' +
        alertTime +
        '\n\n' +
        'Acesse o sistema Lógos AITSM para iniciar o atendimento imediato.'

      for (let k = 0; k < emailRecipients.length; k++) {
        const recipient = emailRecipients[k]
        if (typeof globalThis.sendSystemEmail === 'function') {
          globalThis.sendSystemEmail({
            to: recipient,
            subject: subject,
            html: htmlBody,
            text: textBody,
          })
        }
      }
    } catch (err) {
      $app.logger().warn('PRTG: falha ao enviar e-mail crítico', 'error', err.message)
    }
  }

  const triggerAutoAssignForTicket = function (ticketRecord) {
    const qId = ticketRecord.getString('queue')
    if (!qId) return

    const queueRecord = $app.findRecordById('queues', qId)
    const mems = queueRecord.get('members') || []
    const mgr = queueRecord.getString('manager')

    let targetOp = ''

    if (mems && mems.length > 0) {
      const avails = []
      for (let mi = 0; mi < mems.length; mi++) {
        try {
          const usr = $app.findRecordById('users', mems[mi])
          const st = usr.getString('availability_status') || 'Disponível'
          if (st === 'Disponível' || st === 'disponivel') {
            avails.push(mems[mi])
          }
        } catch (_) {}
      }

      const candidates = avails.length > 0 ? avails : mems
      let bestCandidate = ''
      let lowestLoad = 999999

      for (let ci = 0; ci < candidates.length; ci++) {
        const cId = candidates[ci]
        const actTickets = $app.findRecordsByFilter(
          'tickets',
          "assigned_to = '" +
            cId +
            "' && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
          '-created',
          1000,
          0,
        )
        if (actTickets.length < lowestLoad) {
          lowestLoad = actTickets.length
          bestCandidate = cId
        }
      }

      targetOp = bestCandidate || mgr || mems[0] || ''
    } else {
      targetOp = mgr || ''
    }

    if (targetOp) {
      ticketRecord.set('assigned_to', targetOp)
      if (ticketRecord.getString('status') === 'Novo') {
        ticketRecord.set('status', 'Atribuído')
      }
      $app.save(ticketRecord)
      recordTicketHistory(
        ticketRecord.id,
        'Atribuição Automática (Agente Distribuição)',
        'assigned_to',
        '',
        targetOp,
      )
      $app.logger().info('Chamado PRTG auto-atribuído com sucesso', 'operatorId', targetOp)
    }
  }

  try {
    // 1. Carregar configurações do sistema
    let sysSettings = null
    try {
      sysSettings = $app.findFirstRecordByFilter('system_settings', 'key = "global"', '', 0, 0)
    } catch (_) {}

    if (!sysSettings) {
      return e.json(503, {
        ok: false,
        error: 'system_settings não inicializado',
      })
    }

    const prtgEnabled = sysSettings.get('prtg_enabled')
    if (prtgEnabled === false) {
      return e.json(200, {
        ok: false,
        message: 'Integração PRTG desativada nas configurações.',
      })
    }

    // 2. Validar token
    const expectedToken = (sysSettings.getString('prtg_webhook_token') || '').trim()
    const queryToken = (e.request.url.query().get('token') || '').trim()
    const headerToken = (e.request.header.get('X-PRTG-Token') || '').trim()
    const providedToken = queryToken || headerToken

    if (!expectedToken || !providedToken || expectedToken !== providedToken) {
      return e.json(401, {
        ok: false,
        error: 'Token de autenticação PRTG inválido ou ausente.',
      })
    }

    // 3. Extrair dados do payload (aceita Query params, Form data e Body JSON)
    const payload = {}

    const query = e.request.url.query()
    for (let k of query.keys()) {
      payload[k.toLowerCase()] = query.get(k)
    }

    if (e.request.method === 'POST') {
      try {
        const body = e.requestInfo().body
        if (body && typeof body === 'object') {
          for (let k in body) {
            payload[k.toLowerCase()] = body[k]
          }
        }
      } catch (_) {}
    }

    const sensorName = String(payload.sensor || payload.sensorname || payload.name || '').trim()
    const sensorId = String(payload.sensorid || payload.objid || payload.id || '').trim()
    const deviceName = String(payload.device || payload.devicename || payload.host || '').trim()
    const statusRaw = String(payload.status || payload.state || '').trim()
    const message = String(payload.message || payload.msg || payload.lastmessage || '').trim()
    const lastValue = String(payload.lastvalue || payload.value || '').trim()
    const datetime = String(
      payload.datetime || payload.date || payload.time || new Date().toISOString(),
    ).trim()
    const groupName = String(payload.group || '').trim()

    const sensorKey = sensorId || deviceName + '::' + sensorName || 'PRTG_UNKNOWN_SENSOR'
    const isUp = isStatusUp(statusRaw, message)

    $app
      .logger()
      .info('PRTG Webhook recebido', 'sensorKey', sensorKey, 'status', statusRaw, 'isUp', isUp)

    const defaultPriority = sysSettings.getString('prtg_default_priority') || 'Média'
    const defaultQueueId = sysSettings.getString('prtg_default_queue')
    const defaultActivityId = sysSettings.getString('prtg_default_activity')
    const defaultCompanyId = sysSettings.getString('prtg_default_company')
    const dedupHours = sysSettings.getInt('prtg_dedup_hours') || 4
    const autoResolve = sysSettings.get('prtg_auto_resolve_on_up') !== false

    let mappingRules = []
    try {
      const rawRules = sysSettings.get('prtg_mapping_rules')
      if (Array.isArray(rawRules)) {
        mappingRules = rawRules
      } else if (typeof rawRules === 'string' && rawRules.trim()) {
        mappingRules = JSON.parse(rawRules)
      }
    } catch (_) {}

    let targetCompanyId = defaultCompanyId || ''
    let targetQueueId = defaultQueueId || ''
    let targetActivityId = defaultActivityId || ''

    const searchText = (
      deviceName +
      ' ' +
      sensorName +
      ' ' +
      groupName +
      ' ' +
      message
    ).toLowerCase()
    for (let r of mappingRules) {
      if (r && r.matchText && searchText.includes(String(r.matchText).toLowerCase())) {
        if (r.companyId) targetCompanyId = r.companyId
        if (r.queueId) targetQueueId = r.queueId
        if (r.activityId) targetActivityId = r.activityId
        break
      }
    }

    if (!targetCompanyId) {
      try {
        const firstComp = $app.findFirstRecordByFilter('companies', 'id != ""', '+name', 0, 0)
        if (firstComp) targetCompanyId = firstComp.id
      } catch (_) {}
    }

    const openTicket = findOpenTicketForSensor(sensorKey, dedupHours)

    // 4. Cenário RECUPERAÇÃO (UP)
    if (isUp) {
      if (openTicket) {
        createTicketInteraction(
          openTicket.id,
          'Sensor PRTG Recuperado: ' +
            (sensorName || deviceName) +
            '\n\n' +
            'Status atual: UP / OK\n' +
            (message ? 'Mensagem: ' + message + '\n' : '') +
            (lastValue ? 'Último valor: ' + lastValue + '\n' : '') +
            'Data/Hora: ' +
            datetime,
          'Público',
        )

        if (autoResolve) {
          const nowStr = new Date().toISOString()
          openTicket.set('status', 'Resolvido')
          if (!openTicket.getString('solution')) {
            openTicket.set(
              'solution',
              'Sensor de monitoramento normalizado automaticamente pelo PRTG (' + datetime + ').',
            )
          }
          if (!openTicket.getString('sla_solution_at')) {
            openTicket.set('sla_solution_at', nowStr)
          }
          $app.save(openTicket)

          recordTicketHistory(
            openTicket.id,
            'Resolvido Automaticamente (PRTG)',
            'status',
            'Em Andamento',
            'Resolvido',
          )

          $app
            .logger()
            .info(
              'Chamado PRTG resolvido automaticamente',
              'ticketNumber',
              openTicket.getString('number'),
            )

          return e.json(200, {
            ok: true,
            action: 'ticket_resolved',
            ticket_id: openTicket.id,
            ticket_number: openTicket.getString('number'),
            sensor: sensorKey,
            message: 'Chamado resolvido com sucesso após normalização do sensor.',
          })
        }

        return e.json(200, {
          ok: true,
          action: 'interaction_added',
          ticket_id: openTicket.id,
          ticket_number: openTicket.getString('number'),
          sensor: sensorKey,
          message: 'Interação de recuperação registrada no chamado existente.',
        })
      } else {
        return e.json(200, {
          ok: true,
          action: 'none',
          sensor: sensorKey,
          message:
            'Notificação de recuperação recebida, porém não havia chamado aberto ativo para este sensor.',
        })
      }
    }

    // 5. Cenário ALERTA / DOWN / ERRO
    if (openTicket) {
      createTicketInteraction(
        openTicket.id,
        'Alerta repetido do monitoramento PRTG: ' +
          (sensorName || deviceName) +
          '\n\n' +
          'Status: ' +
          (statusRaw || 'DOWN / Erro') +
          '\n' +
          (message ? 'Mensagem: ' + message + '\n' : '') +
          (lastValue ? 'Último valor: ' + lastValue + '\n' : '') +
          'Data/Hora: ' +
          datetime,
        'Público',
      )

      $app
        .logger()
        .info(
          'Alerta PRTG repetido, adicionada interação',
          'ticketNumber',
          openTicket.getString('number'),
        )

      return e.json(200, {
        ok: true,
        action: 'interaction_added',
        ticket_id: openTicket.id,
        ticket_number: openTicket.getString('number'),
        sensor: sensorKey,
        message: 'Alerta repetido: nova interação registrada no chamado já em aberto.',
      })
    }

    // Criar NOVO chamado automático
    const ticketsCol = $app.findCollectionByNameOrId('tickets')
    const newTicket = new Record(ticketsCol)

    const titlePrefix =
      '[PRTG] ' + (deviceName ? deviceName + ' - ' : '') + (sensorName || 'Alerta de Monitoramento')
    const ticketTitle =
      titlePrefix.length > 150 ? titlePrefix.substring(0, 147) + '...' : titlePrefix

    const fullDescription =
      'Alerta automático gerado pela ferramenta de monitoramento PRTG Network Monitor.\n\n' +
      '• Dispositivo: ' +
      (deviceName || 'Não informado') +
      '\n' +
      '• Sensor: ' +
      (sensorName || 'Não informado') +
      ' (ID: ' +
      sensorId +
      ')\n' +
      '• Grupo: ' +
      (groupName || 'Não informado') +
      '\n' +
      '• Status: ' +
      (statusRaw || 'DOWN') +
      '\n' +
      '• Mensagem do Alerta: ' +
      (message || 'Sem mensagem adicional') +
      '\n' +
      '• Último Valor: ' +
      (lastValue || 'N/A') +
      '\n' +
      '• Data e Hora do Alerta: ' +
      datetime +
      '\n'

    newTicket.set('title', ticketTitle)
    newTicket.set('description', fullDescription)
    newTicket.set('source', 'PRTG')
    newTicket.set('monitoring_source', 'PRTG')
    newTicket.set('monitoring_sensor_id', sensorKey)
    newTicket.set('monitoring_device', deviceName)
    newTicket.set('status', 'Novo')
    newTicket.set('priority', defaultPriority)
    newTicket.set('type', 'Incidente')
    newTicket.set('requester_name', 'Monitoramento PRTG')
    newTicket.set('requester_email', 'prtg-alerts@monitoramento.local')

    if (targetCompanyId) newTicket.set('company', targetCompanyId)
    if (targetQueueId) newTicket.set('queue', targetQueueId)
    if (targetActivityId) newTicket.set('category', targetActivityId)

    $app.save(newTicket)

    const createdNumber = newTicket.getString('number')
    $app
      .logger()
      .info(
        'Novo chamado PRTG aberto com sucesso',
        'ticketId',
        newTicket.id,
        'number',
        createdNumber,
      )

    recordTicketHistory(newTicket.id, 'Abertura Automática (PRTG)', 'status', '', 'Novo')

    notifyQueueOperators(targetQueueId, newTicket)

    if (defaultPriority === 'Crítica') {
      sendCriticalMonitoringEmail(newTicket, deviceName, sensorName, message, datetime)
    }

    try {
      triggerAutoAssignForTicket(newTicket)
    } catch (eAssign) {
      $app.logger().warn('PRTG: falha ao auto-atribuir chamado', 'error', eAssign.message)
    }

    return e.json(200, {
      ok: true,
      action: 'ticket_created',
      ticket_id: newTicket.id,
      ticket_number: createdNumber,
      sensor: sensorKey,
      message: 'Chamado aberto automaticamente pelo alerta do PRTG.',
    })
  } catch (err) {
    $app.logger().error('PRTG Webhook erro geral', 'error', err.message)
    return e.json(200, {
      ok: false,
      error: 'Erro no processamento do webhook PRTG: ' + err.message,
    })
  }
})
