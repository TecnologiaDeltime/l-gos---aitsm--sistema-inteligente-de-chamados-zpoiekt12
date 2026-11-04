// Hook & Cron: Agente Inteligente de Consumo Médio de Horas dos Clientes
//
// Regras de negócio atendidas:
// 1. CÁLCULO DO CONSUMO MÉDIO: para cada empresa (cliente), aprende o consumo médio
//    mensal com base no histórico de horas debitadas da franquia (logs/acompanhamento,
//    origem ≠ Cronômetro) dos últimos N meses com dados (padrão: 3 a 6 meses).
// 2. AVALIAÇÃO PERIÓDICA: Cron diário (0 7 * * *) e rota manual (/api/custom/consumption-agent/evaluate).
//    Calcula o consumo do período corrente (mês atual acumulado).
//    - Consumo Elevado: desvio percentual > deviation_high_pct (padrão: +30%)
//    - Consumo Muito Abaixo: desvio percentual < -deviation_low_pct (padrão: -30%)
// 3. NOTIFICAÇÃO: notifica in-app (notifications, type="Alerta") e por e-mail institucional
//    (template Lógos AITILSM via itsmRenderBaseEmailTemplate / mailer_service)
//    todos os usuários ativos cujo perfil seja "Qualidade" ou "Gestor" (inclui admin/gestor/qualidade).
//    - Consumo Elevado → tom VERMELHO (crítico)
//    - Consumo Muito Abaixo → tom AMARELO (atenção)
// 4. ANTI-RUÍDO: não renotifica o mesmo desvio repetidamente no mesmo ciclo mensal
//    (ex.: chave "YYYY-MM:high" ou "YYYY-MM:low"). Só renotifica se o status mudar.

;(function () {
  var CRON_NAME = 'client_consumption_agent_evaluator'

  function pad(n) {
    return n < 10 ? '0' + n : '' + n
  }

  function getMonthKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1)
  }

  // Identifica destinatários com perfil Qualidade e Gestor (e Admin)
  function resolveQualityAndManagerRecipients() {
    var recipients = {
      users: [],
      emails: [],
      ids: {},
    }

    try {
      // 1. Busca perfis cujo nome contenha 'qualidade' ou 'gestor' ou 'admin'
      var allProfiles = $app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var targetProfileIds = {}
      for (var p = 0; p < allProfiles.length; p++) {
        var pName = (allProfiles[p].getString('name') || '').toLowerCase()
        if (
          pName.indexOf('qualidade') !== -1 ||
          pName.indexOf('gestor') !== -1 ||
          pName.indexOf('admin') !== -1
        ) {
          targetProfileIds[allProfiles[p].id] = allProfiles[p].getString('name')
        }
      }

      // 2. Busca usuários ativos com esses profile_id OU com role admin/gestor
      var activeUsers = $app.findRecordsByFilter('users', 'active = true', '', 0, 0)
      for (var u = 0; u < activeUsers.length; u++) {
        var user = activeUsers[u]
        var profId = user.getString('profile_id')
        var uRole = (user.getString('role') || '').toLowerCase()
        var matchesProfile = profId && targetProfileIds[profId]
        var matchesRole = uRole === 'admin' || uRole === 'gestor'

        if (matchesProfile || matchesRole) {
          var uId = user.id
          if (!recipients.ids[uId]) {
            recipients.ids[uId] = true
            recipients.users.push(user)
            var email = (user.getString('email') || '').trim()
            if (email && recipients.emails.indexOf(email) === -1) {
              recipients.emails.push(email)
            }
          }
        }
      }
    } catch (err) {
      $app
        .logger()
        .error('client_consumption_agent: erro ao resolver destinatários', 'error', err.message)
    }

    return recipients
  }

  // Calcula horas consumidas de uma empresa em um dado mês
  // Considera logs de chamados onde origin != 'Cronômetro' e hour_type = 'Contratada'
  function getCompanyConsumedHoursInMonth(companyId, year, monthZeroBased) {
    var start = new Date(year, monthZeroBased, 1, 0, 0, 0)
    var end = new Date(year, monthZeroBased + 1, 0, 23, 59, 59)

    var startIso =
      start.getFullYear() +
      '-' +
      pad(start.getMonth() + 1) +
      '-' +
      pad(start.getDate()) +
      ' 00:00:00.000Z'
    var endIso =
      end.getFullYear() +
      '-' +
      pad(end.getMonth() + 1) +
      '-' +
      pad(end.getDate()) +
      ' 23:59:59.999Z'

    var totalMinutes = 0

    try {
      // 1. Busca tickets da empresa
      var tickets = $app.findRecordsByFilter('tickets', 'company = "' + companyId + '"', '', 0, 0)
      if (tickets.length === 0) return 0

      for (var t = 0; t < tickets.length; t++) {
        var ticketId = tickets[t].id
        var interactions = $app.findRecordsByFilter(
          'ticket_interactions',
          'ticket = "' +
            ticketId +
            '" && origin != "Cronômetro" && hour_type = "Contratada" && created >= "' +
            startIso +
            '" && created <= "' +
            endIso +
            '"',
          '',
          0,
          0,
        )
        for (var i = 0; i < interactions.length; i++) {
          totalMinutes += interactions[i].getFloat('duration_minutes') || 0
        }
      }
    } catch (err) {
      $app
        .logger()
        .error(
          'client_consumption_agent: erro ao calcular consumo mensal empresa ' + companyId,
          'error',
          err.message,
        )
    }

    return Number((totalMinutes / 60).toFixed(2))
  }

  // Aprende o consumo médio da empresa nos últimos N meses (padrão 3 a 6)
  function learnCompanyAverage(companyId, windowMonths) {
    if (!windowMonths || windowMonths < 1) windowMonths = 3
    var now = new Date()
    var currentYear = now.getFullYear()
    var currentMonth = now.getMonth()

    var history = []
    var totalHours = 0
    var countWithData = 0

    // Olha para os N meses ANTERIORES ao corrente
    for (var m = windowMonths; m >= 1; m--) {
      var d = new Date(currentYear, currentMonth - m, 1)
      var y = d.getFullYear()
      var mon = d.getMonth()
      var mKey = getMonthKey(d)
      var consumed = getCompanyConsumedHoursInMonth(companyId, y, mon)

      history.push({
        monthKey: mKey,
        year: y,
        month: mon + 1,
        consumedHours: consumed,
      })

      if (consumed > 0) {
        totalHours += consumed
        countWithData++
      }
    }

    var avgHours = countWithData > 0 ? Number((totalHours / countWithData).toFixed(2)) : 0
    var firstMonth = history.length > 0 ? history[0].monthKey : ''
    var lastMonth = history.length > 0 ? history[history.length - 1].monthKey : ''
    var referencePeriod =
      firstMonth && lastMonth ? firstMonth + ' até ' + lastMonth : 'Sem histórico'

    return {
      history: history,
      averageHours: avgHours,
      averageSeconds: Math.round(avgHours * 3600),
      referencePeriod: referencePeriod,
      monthsCount: countWithData,
    }
  }

  // Executa o agente para uma empresa (ou todas)
  function evaluateConsumptionAgent(options) {
    options = options || {}
    var targetCompanyId = options.companyId || ''
    var forceAlert = options.forceAlert === true

    var companies = []
    if (targetCompanyId) {
      try {
        var single = $app.findRecordById('companies', targetCompanyId)
        companies = [single]
      } catch (_) {}
    } else {
      companies = $app.findRecordsByFilter('companies', 'status = "Ativo"', 'trade_name', 0, 0)
    }

    var results = []
    var recipients = resolveQualityAndManagerRecipients()
    var now = new Date()
    var currentMonthKey = getMonthKey(now)
    var agentCol = $app.findCollectionByNameOrId('client_consumption_agents')
    var notifCol = $app.findCollectionByNameOrId('notifications')

    for (var c = 0; c < companies.length; c++) {
      var comp = companies[c]
      var compId = comp.id
      var compName = comp.getString('trade_name') || comp.getString('legal_name') || compId

      // Busca ou cria o registro de configuração do agente
      var agentRecord = null
      try {
        var existing = $app.findRecordsByFilter(
          'client_consumption_agents',
          'company = "' + compId + '"',
          '',
          1,
          0,
        )
        if (existing.length > 0) {
          agentRecord = existing[0]
        }
      } catch (_) {}

      var enabled = true
      var deviationHighPct = 30
      var deviationLowPct = 30
      var windowMonths = 3

      if (agentRecord) {
        // Se explicitamente desativado para esse cliente, respeita
        if (agentRecord.getBool('enabled') === false) {
          results.push({
            companyId: compId,
            companyName: compName,
            status: 'disabled',
            message: 'Monitoramento desativado para este cliente',
          })
          continue
        }
        deviationHighPct = agentRecord.getInt('deviation_high_pct') || 30
        deviationLowPct = agentRecord.getInt('deviation_low_pct') || 30
        windowMonths = agentRecord.getInt('learning_window_months') || 3
      } else {
        // Cria registro inicial com defaults sensatos
        agentRecord = new Record(agentCol)
        agentRecord.set('company', compId)
        agentRecord.set('enabled', true)
        agentRecord.set('deviation_high_pct', 30)
        agentRecord.set('deviation_low_pct', 30)
        agentRecord.set('learning_window_months', 3)
      }

      // 1. APRENDE / ATUALIZA CONSUMO MÉDIO
      var learning = learnCompanyAverage(compId, windowMonths)
      agentRecord.set('learned_average_hours', learning.averageHours)
      agentRecord.set('learned_average_seconds', learning.averageSeconds)
      agentRecord.set('learned_reference_period', learning.referencePeriod)
      agentRecord.set('learned_history_json', JSON.stringify(learning.history))

      // 2. AVALIA PERÍODO CORRENTE (mês atual)
      var currentConsumed = getCompanyConsumedHoursInMonth(
        compId,
        now.getFullYear(),
        now.getMonth(),
      )
      agentRecord.set('current_period_consumed_hours', currentConsumed)
      agentRecord.set('last_evaluation_at', now.toISOString())

      var status = 'normal'
      var deviationPct = 0

      if (learning.averageHours <= 0) {
        status = 'no_data'
        agentRecord.set('current_status', status)
        agentRecord.set('current_period_deviation_pct', 0)
        $app.save(agentRecord)

        results.push({
          companyId: compId,
          companyName: compName,
          status: status,
          currentConsumed: currentConsumed,
          averageHours: learning.averageHours,
          deviationPct: 0,
        })
        continue
      }

      deviationPct = Number(
        (((currentConsumed - learning.averageHours) / learning.averageHours) * 100).toFixed(1),
      )
      agentRecord.set('current_period_deviation_pct', deviationPct)

      if (deviationPct >= deviationHighPct) {
        status = 'high'
      } else if (deviationPct <= -deviationLowPct) {
        status = 'low'
      } else {
        status = 'normal'
      }

      agentRecord.set('current_status', status)

      // 3. DISPARO DE NOTIFICAÇÃO (com anti-ruído)
      var alertKey = currentMonthKey + ':' + status
      var lastAlertKey = agentRecord.getString('last_alerted_key') || ''
      var shouldNotify = false

      if (status === 'high' || status === 'low') {
        if (forceAlert || alertKey !== lastAlertKey) {
          shouldNotify = true
        }
      }

      if (shouldNotify) {
        var isHigh = status === 'high'
        var alertTitle = isHigh
          ? 'Alerta de Consumo Elevado: ' + compName
          : 'Alerta de Consumo Muito Abaixo: ' + compName

        var deviationFormatted = (deviationPct > 0 ? '+' : '') + deviationPct + '%'
        var alertMsg = isHigh
          ? 'O cliente ' +
            compName +
            ' registrou consumo elevado de ' +
            currentConsumed.toFixed(1) +
            'h no mês atual (' +
            deviationFormatted +
            ' vs média histórica de ' +
            learning.averageHours.toFixed(1) +
            'h). Verifique o ritmo de atendimentos.'
          : 'O cliente ' +
            compName +
            ' registrou consumo muito abaixo do padrão: ' +
            currentConsumed.toFixed(1) +
            'h no mês atual (' +
            deviationFormatted +
            ' vs média histórica de ' +
            learning.averageHours.toFixed(1) +
            'h). Verifique possível retenção ou subutilização.'

        // A. Notificação in-app para cada usuário de Qualidade/Gestor
        for (var u = 0; u < recipients.users.length; u++) {
          try {
            var n = new Record(notifCol)
            n.set('user', recipients.users[u].id)
            n.set('title', alertTitle)
            n.set('message', alertMsg)
            n.set('type', 'Alerta')
            n.set('read', false)
            $app.save(n)
          } catch (nErr) {
            $app
              .logger()
              .error(
                'client_consumption_agent: erro ao salvar notificação in-app',
                'error',
                nErr.message,
              )
          }
        }

        // B. E-mail institucional formatado com paleta de severidade
        if (recipients.emails.length > 0) {
          try {
            var emailSeverity = isHigh ? 'critical' : 'warning' // critical => tom vermelho, warning => tom amarelo
            var badgeText = isHigh
              ? 'CONSUMO ELEVADO (+ ' + deviationPct + '%)'
              : 'CONSUMO MUITO ABAIXO (' + deviationPct + '%)'

            var emailContentHtml =
              '<div style="font-family: Arial, sans-serif; color: #1E293B; line-height: 1.6;">' +
              '  <p style="font-size: 15px; margin-bottom: 16px;">' +
              '    O Agente Inteligente de Consumo detectou um desvio significativo no volume de horas debitadas da franquia do cliente <strong>' +
              compName +
              '</strong>.' +
              '  </p>' +
              '  <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">' +
              '    <tr>' +
              '      <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">Cliente:</td>' +
              '      <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: bold; color: #0F172A;">' +
              compName +
              '</td>' +
              '    </tr>' +
              '    <tr>' +
              '      <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">Consumo Período Atual:</td>' +
              '      <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: bold; color: ' +
              (isHigh ? '#DC2626' : '#CA8A04') +
              ';">' +
              currentConsumed.toFixed(2) +
              ' horas</td>' +
              '    </tr>' +
              '    <tr>' +
              '      <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">Média Histórica Aprendida:</td>' +
              '      <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: bold; color: #0F172A;">' +
              learning.averageHours.toFixed(2) +
              ' horas/mês (' +
              learning.referencePeriod +
              ')</td>' +
              '    </tr>' +
              '    <tr>' +
              '      <td style="padding: 10px 14px; font-size: 13px; color: #64748B;">Desvio Calculado:</td>' +
              '      <td style="padding: 10px 14px; font-size: 14px; font-weight: bold; color: ' +
              (isHigh ? '#DC2626' : '#CA8A04') +
              ';">' +
              deviationFormatted +
              ' (Limite tolerado: ±' +
              (isHigh ? deviationHighPct : deviationLowPct) +
              '%)</td>' +
              '    </tr>' +
              '  </table>' +
              '  <p style="font-size: 13px; color: #475569; margin-top: 14px;">' +
              '    Esta notificação foi enviada automaticamente para gestores de contrato e equipe de qualidade do sistema Lógos AITILSM.' +
              '  </p>' +
              '</div>'

            var renderedHtml = emailContentHtml
            if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
              renderedHtml = globalThis.itsmRenderBaseEmailTemplate({
                severity: emailSeverity,
                badgeText: badgeText,
                title: alertTitle,
                subtitle: 'Monitoramento Preditivo de Horas e Franquia',
                contentHtml: emailContentHtml,
                actionHtml:
                  '<a href="/contracts/consumption" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: bold; color: #FFFFFF; background-color: ' +
                  (isHigh ? '#DC2626' : '#D97706') +
                  '; text-decoration: none; border-radius: 6px;">Acessar Painel de Consumo</a>',
                footerNote: 'Lógos AITILSM — Agente de Inteligência de Consumo de Clientes',
              })
            }

            if (typeof globalThis.sendSystemEmail === 'function') {
              globalThis.sendSystemEmail({
                to: recipients.emails,
                subject: alertTitle,
                html: renderedHtml,
                text: alertMsg,
              })
            }
          } catch (mErr) {
            $app
              .logger()
              .error(
                'client_consumption_agent: erro ao enviar e-mail de alerta',
                'error',
                mErr.message,
              )
          }
        }

        agentRecord.set('last_alerted_key', alertKey)
        agentRecord.set('last_alerted_at', now.toISOString())
      }

      $app.save(agentRecord)

      results.push({
        companyId: compId,
        companyName: compName,
        status: status,
        currentConsumed: currentConsumed,
        averageHours: learning.averageHours,
        deviationPct: deviationPct,
        notified: shouldNotify,
      })
    }

    return results
  }

  // Registra Cron Diário (executa toda manhã às 07:00 UTC)
  try {
    cronAdd(CRON_NAME, '0 7 * * *', function () {
      $app.logger().info('client_consumption_agent: iniciando avaliação diária de consumo')
      try {
        var r = evaluateConsumptionAgent()
        $app
          .logger()
          .info('client_consumption_agent: avaliação concluída para ' + r.length + ' cliente(s)')
      } catch (err) {
        $app.logger().error('client_consumption_agent: falha no cron', 'error', err.message)
      }
    })
  } catch (cErr) {
    $app
      .logger()
      .error('client_consumption_agent: erro ao registrar cron job', 'error', cErr.message)
  }

  // Rota HTTP sob demanda para disparar avaliação ou forçar recálculo por cliente
  routerAdd('POST', '/backend/v1/custom/consumption-agent/evaluate', function (c) {
    try {
      var authRecord = c.auth
      if (!authRecord) {
        return c.json(401, { error: 'Não autenticado' })
      }

      var body = {}
      try {
        body = c.requestInfo().body || {}
      } catch (_) {}

      var companyId = body.companyId || ''
      var forceAlert = body.forceAlert === true

      var results = evaluateConsumptionAgent({
        companyId: companyId,
        forceAlert: forceAlert,
      })

      return c.json(200, {
        success: true,
        evaluatedCount: results.length,
        results: results,
      })
    } catch (err) {
      return c.json(500, { error: err.message })
    }
  })

  // Exporta no globalThis para reaproveitamento se necessário
  globalThis.itsmEvaluateConsumptionAgent = evaluateConsumptionAgent
})()
