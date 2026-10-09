// pocketbase/hooks/monthly_client_report_cron.js
// Cron job diário para envio automático do relatório mensal por e-mail no padrão ABNT

cronAdd('monthly_client_report_cron', '0 6 * * *', function () {
  var now = new Date()
  var currentDay = now.getDate()

  // Mês anterior de referência (ex: no dia 5 de Maio de 2025, envia relatório de Abril/2025: "2025-04")
  var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  var prevYear = prevMonthDate.getFullYear()
  var prevMonthNum = prevMonthDate.getMonth() + 1
  var prevMonthKey =
    prevYear + '-' + (prevMonthNum < 10 ? '0' + prevMonthNum : String(prevMonthNum))

  var schedules = []
  try {
    schedules = $app.findRecordsByFilter(
      'monthly_report_schedules',
      'enabled = true && send_day = ' + currentDay,
      '',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('monthly_client_report_cron: query failed', 'error', err.message)
    return
  }

  if (!schedules || schedules.length === 0) return

  for (var i = 0; i < schedules.length; i++) {
    var sched = schedules[i]
    var companyId = sched.getString('company')
    var lastSentMonth = sched.getString('last_sent_month')

    // Idempotência: não reenvia se já enviou com sucesso para este mês de referência
    if (lastSentMonth === prevMonthKey) {
      $app
        .logger()
        .info(
          'monthly_client_report_cron: already sent for company ' +
            companyId +
            ' month ' +
            prevMonthKey,
        )
      continue
    }

    try {
      var company = null
      try {
        company = $app.findRecordById('companies', companyId)
      } catch (cErr) {
        $app
          .logger()
          .error(
            'monthly_client_report_cron: company not found ' + companyId,
            'error',
            cErr.message,
          )
        continue
      }

      var companyName =
        company.getString('trade_name') || company.getString('legal_name') || 'Cliente'

      // Destinatários: pontos focais e/ou manuais
      var recipients = []
      if (sched.getBool('use_focal_points')) {
        try {
          var contacts = $app.findRecordsByFilter(
            'client_contacts',
            'client = "' + companyId + '" && is_focal_point = true',
            '',
            0,
            0,
          )
          for (var c = 0; c < contacts.length; c++) {
            var email = contacts[c].getString('email').trim()
            if (email && recipients.indexOf(email) < 0) recipients.push(email)
          }
        } catch (_) {}
      }

      var rawManual = sched.getString('manual_recipients') || ''
      var manualList = rawManual
        .split(/[\n,;]+/)
        .map(function (s) {
          return s.trim()
        })
        .filter(function (s) {
          return s.length > 3 && s.indexOf('@') > 0
        })
      for (var m = 0; m < manualList.length; m++) {
        if (recipients.indexOf(manualList[m]) < 0) recipients.push(manualList[m])
      }

      if (recipients.length === 0) {
        try {
          var logsCol = $app.findCollectionByNameOrId('monthly_report_send_logs')
          var logRec = new Record(logsCol)
          logRec.set('company', companyId)
          logRec.set('report_month', prevMonthKey)
          logRec.set('recipients', 'Nenhum')
          logRec.set('status', 'falha')
          logRec.set('error_message', 'Nenhum destinatário configurado.')
          logRec.set('sent_at', new Date().toISOString())
          logRec.set('triggered_by', 'cron')
          $app.save(logRec)
        } catch (_) {}
        continue
      }

      var parts = prevMonthKey.split('-')
      var year = parseInt(parts[0], 10)
      var month = parseInt(parts[1], 10)
      var monthNames = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ]
      var monthLabel = monthNames[month - 1] + ' de ' + year
      var subject = 'Relatório Mensal de Serviços – ' + companyName + ' – ' + monthLabel

      var startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
      var nextMonthDate = new Date(Date.UTC(year, month, 1, 0, 0, 0))
      var endDate = new Date(nextMonthDate.getTime() - 1)
      var startIso = startDate.toISOString()
      var endIso = endDate.toISOString()

      // Tickets e interações
      var tickets = []
      try {
        tickets = $app.findRecordsByFilter(
          'tickets',
          'company = "' + companyId + '"',
          'created',
          0,
          0,
        )
      } catch (_) {}

      var ticketMap = {}
      var ticketIds = []
      for (var ti = 0; ti < tickets.length; ti++) {
        ticketMap[tickets[ti].id] = tickets[ti]
        ticketIds.push(tickets[ti].id)
      }

      var interactions = []
      if (ticketIds.length > 0) {
        var bSize = 50
        for (var bi = 0; bi < ticketIds.length; bi += bSize) {
          var bSlice = ticketIds.slice(bi, bi + bSize)
          var tFilter = bSlice
            .map(function (id) {
              return 'ticket = "' + id + '"'
            })
            .join(' || ')
          try {
            var inters = $app.findRecordsByFilter(
              'ticket_interactions',
              '(' + tFilter + ') && created >= "' + startIso + '" && created <= "' + endIso + '"',
              'created',
              0,
              0,
            )
            for (var ii = 0; ii < inters.length; ii++) {
              interactions.push(inters[ii])
            }
          } catch (_) {}
        }
      }

      var contracts = []
      try {
        contracts = $app.findRecordsByFilter(
          'contracts',
          'company = "' + companyId + '"',
          '-created',
          1,
          0,
        )
      } catch (_) {}
      var contract = contracts.length > 0 ? contracts[0] : null

      var depts = []
      try {
        depts = $app.findRecordsByFilter(
          'company_departments',
          'company = "' + companyId + '"',
          '',
          0,
          0,
        )
      } catch (_) {}
      var deptMap = {}
      for (var di = 0; di < depts.length; di++) {
        deptMap[depts[di].id] = depts[di].getString('name')
      }

      var categories = []
      try {
        categories = $app.findRecordsByFilter('tkt_categories', '', '', 0, 0)
      } catch (_) {}
      var catMap = {}
      for (var ci = 0; ci < categories.length; ci++) {
        catMap[categories[ci].id] = categories[ci]
      }

      var equipments = []
      try {
        equipments = $app.findRecordsByFilter(
          'equipments',
          'company = "' + companyId + '"',
          '-created',
          0,
          0,
        )
      } catch (_) {}

      var totalUsedMinutes = 0
      var sectorMinutes = {}
      var requesterMinutes = {}
      var activityMinutes = {}

      for (var k = 0; k < interactions.length; k++) {
        var inter = interactions[k]
        var min = inter.getInt('duration_minutes') || 0
        if (min <= 0) continue
        totalUsedMinutes += min

        var tkt = ticketMap[inter.getString('ticket')]
        if (!tkt) continue

        var deptId = tkt.getString('department') || 'sem_setor'
        var deptName = deptMap[deptId] || 'Geral / Sem setor'
        if (!sectorMinutes[deptName]) sectorMinutes[deptName] = { minutes: 0, tickets: {} }
        sectorMinutes[deptName].minutes += min
        sectorMinutes[deptName].tickets[tkt.id] = true

        var reqName =
          tkt.getString('requester_name') || tkt.getString('requester_email') || 'Não identificado'
        if (!requesterMinutes[reqName])
          requesterMinutes[reqName] = { minutes: 0, dept: deptName, tickets: {} }
        requesterMinutes[reqName].minutes += min
        requesterMinutes[reqName].tickets[tkt.id] = true

        var subCatId = tkt.getString('subcategory')
        var mainCatId = tkt.getString('category')
        var actName = 'Geral / Outros'
        var catLabel = 'Suporte'
        if (subCatId && catMap[subCatId]) {
          actName = catMap[subCatId].getString('name')
          catLabel =
            mainCatId && catMap[mainCatId] ? catMap[mainCatId].getString('name') : 'Subatividade'
        } else if (mainCatId && catMap[mainCatId]) {
          actName = catMap[mainCatId].getString('name')
          catLabel = 'Categoria'
        }
        if (!activityMinutes[actName])
          activityMinutes[actName] = { minutes: 0, catLabel: catLabel, tickets: {} }
        activityMinutes[actName].minutes += min
        activityMinutes[actName].tickets[tkt.id] = true
      }

      var totalUsedHours = Math.round((totalUsedMinutes / 60) * 10) / 10
      var totalContractedHours = 0
      if (contract) {
        totalContractedHours += contract.getInt('hours_level1') || 0
        totalContractedHours += contract.getInt('hours_level2') || 0
        totalContractedHours += contract.getInt('hours_level3') || 0
        totalContractedHours += contract.getInt('hours_consultoria') || 0
        totalContractedHours += contract.getInt('hours_backoffice') || 0
        totalContractedHours += contract.getInt('hours_administrativo') || 0
        if (totalContractedHours === 0) totalContractedHours = contract.getInt('monthly_hours') || 0
      }
      var balanceHours = Math.round((totalContractedHours - totalUsedHours) * 10) / 10
      var utilizationPct =
        totalContractedHours > 0 ? Math.round((totalUsedHours / totalContractedHours) * 100) : 0

      var enteredAssets = []
      var exitedAssets = []
      for (var ei = 0; ei < equipments.length; ei++) {
        var eq = equipments[ei]
        var eqCreated = eq.getString('created')
        var eqUpdated = eq.getString('updated')
        var eqStatus = eq.getString('status')
        if (eqCreated >= startIso && eqCreated <= endIso) enteredAssets.push(eq)
        if (
          ['Descartado', 'Inativo', 'Em Manutenção'].indexOf(eqStatus) >= 0 &&
          eqUpdated >= startIso &&
          eqUpdated <= endIso
        ) {
          exitedAssets.push(eq)
        }
      }

      var ticketsInPeriod = []
      for (var tIdx = 0; tIdx < tickets.length; tIdx++) {
        var cIso = tickets[tIdx].getString('created')
        if (cIso >= startIso && cIso <= endIso) ticketsInPeriod.push(tickets[tIdx])
      }

      // Monta HTML inline
      var sectorsArr = Object.keys(sectorMinutes)
        .map(function (k) {
          return {
            name: k,
            hours: Math.round((sectorMinutes[k].minutes / 60) * 10) / 10,
            tickets: Object.keys(sectorMinutes[k].tickets).length,
          }
        })
        .sort(function (a, b) {
          return b.hours - a.hours
        })

      var requestersArr = Object.keys(requesterMinutes)
        .map(function (k) {
          return {
            name: k,
            dept: requesterMinutes[k].dept,
            hours: Math.round((requesterMinutes[k].minutes / 60) * 10) / 10,
            tickets: Object.keys(requesterMinutes[k].tickets).length,
          }
        })
        .sort(function (a, b) {
          return b.hours - a.hours
        })
        .slice(0, 8)

      var activitiesArr = Object.keys(activityMinutes)
        .map(function (k) {
          return {
            name: k,
            catLabel: activityMinutes[k].catLabel,
            hours: Math.round((activityMinutes[k].minutes / 60) * 10) / 10,
            tickets: Object.keys(activityMinutes[k].tickets).length,
          }
        })
        .sort(function (a, b) {
          return b.tickets - a.tickets || b.hours - a.hours
        })
        .slice(0, 8)

      var topSector = sectorsArr.length > 0 ? sectorsArr[0] : null
      var topActivity = activitiesArr.length > 0 ? activitiesArr[0] : null

      var htmlContent =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Mensal</title>' +
        '<style>' +
        'body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.4; color: #111; background-color: #f7f9fa; margin: 0; padding: 20px; }' +
        '.container { max-width: 780px; margin: 0 auto; background: #fff; padding: 35px 40px; border: 1px solid #dcdfe4; }' +
        '.cover-header { text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-bottom: 25px; border-bottom: 2pt solid #000; padding-bottom: 10px; }' +
        '.cover-title { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 20px 0 10px 0; }' +
        '.cover-subtitle { text-align: center; font-size: 12pt; margin-bottom: 30px; color: #333; }' +
        'h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; border-bottom: 1.5pt solid #000; padding-bottom: 4px; margin-top: 25px; margin-bottom: 12px; }' +
        'p.abnt-p { text-align: justify; text-indent: 1.25cm; margin: 0 0 10px 0; font-size: 11pt; }' +
        '.caption { font-size: 9.5pt; font-weight: bold; margin: 10px 0 4px 0; color: #111; }' +
        '.source { font-size: 8.5pt; color: #555; margin-top: 3px; margin-bottom: 15px; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 10pt; }' +
        'th { border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 6px 8px; font-weight: bold; background: #f3f4f6; text-align: left; }' +
        'td { border-bottom: 0.5pt solid #d1d5db; padding: 5px 8px; }' +
        '.text-right { text-align: right; }' +
        '.text-center { text-align: center; }' +
        '.kpi-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 15px; border-radius: 4px; display: table; width: 100%; box-sizing: border-box; }' +
        '.kpi-item { display: table-cell; width: 25%; text-align: center; vertical-align: middle; border-right: 1px solid #e2e8f0; }' +
        '.kpi-item:last-child { border-right: none; }' +
        '.kpi-val { font-size: 14pt; font-weight: bold; color: #0f172a; }' +
        '.kpi-lbl { font-size: 8.5pt; color: #64748b; text-transform: uppercase; }' +
        'ul.abnt-recs { margin: 8px 0 16px 20px; padding: 0; font-size: 10pt; }' +
        'ul.abnt-recs li { margin-bottom: 6px; }' +
        '</style></head><body>' +
        '<div class="container">' +
        '<div class="cover-header">SERVICEONE GESTÃO DE TI E OPERAÇÕES</div>' +
        '<div class="cover-title">Relatório Mensal de Serviços</div>' +
        '<div class="cover-subtitle">Cliente: <strong>' +
        companyName +
        '</strong> &mdash; Período de Referência: <strong>' +
        monthLabel +
        '</strong></div>' +
        '<div class="kpi-box">' +
        '<div class="kpi-item"><div class="kpi-val">' +
        totalContractedHours.toFixed(1) +
        'h</div><div class="kpi-lbl">Contratadas</div></div>' +
        '<div class="kpi-item"><div class="kpi-val">' +
        totalUsedHours.toFixed(1) +
        'h</div><div class="kpi-lbl">Consumidas</div></div>' +
        '<div class="kpi-item"><div class="kpi-val">' +
        balanceHours.toFixed(1) +
        'h</div><div class="kpi-lbl">Saldo de Horas</div></div>' +
        '<div class="kpi-item"><div class="kpi-val">' +
        utilizationPct +
        '%</div><div class="kpi-lbl">Utilização</div></div>' +
        '</div>' +
        '<h2>1. Horas Consumidas por Acordo de Atendimento</h2>' +
        '<p class="abnt-p">O presente capítulo consolida o balanço das horas técnicas consumidas pela organização no mês de ' +
        monthLabel +
        ', discriminando o saldo em face da franquia contratada.</p>' +
        '<div class="caption">Quadro 1 &ndash; Balanço de horas e taxa de consumo</div>' +
        '<table><thead><tr><th>Indicador</th><th class="text-right">Horas</th><th class="text-right">Percentual</th></tr></thead>' +
        '<tbody>' +
        '<tr><td>Horas Contratadas (Franquia)</td><td class="text-right">' +
        totalContractedHours.toFixed(1) +
        'h</td><td class="text-right">100%</td></tr>' +
        '<tr><td>Horas Consumidas no Período</td><td class="text-right">' +
        totalUsedHours.toFixed(1) +
        'h</td><td class="text-right">' +
        utilizationPct +
        '%</td></tr>' +
        '<tr><td>Saldo Remanescente</td><td class="text-right">' +
        balanceHours.toFixed(1) +
        'h</td><td class="text-right">' +
        (100 - utilizationPct) +
        '%</td></tr>' +
        '</tbody></table>' +
        '<div class="source">Fonte: ServiceOne ITSM.</div>' +
        '<h2>2. Horas por Setor / Departamento</h2>' +
        '<p class="abnt-p">Distribuição das horas despendidas de acordo com os setores demandantes da organização.</p>' +
        '<div class="caption">Quadro 2 &ndash; Horas consumidas por departamento</div>' +
        '<table><thead><tr><th>Setor / Departamento</th><th class="text-center">Chamados</th><th class="text-right">Horas</th></tr></thead><tbody>'

      for (var s = 0; s < Math.min(sectorsArr.length, 6); s++) {
        htmlContent +=
          '<tr><td>' +
          sectorsArr[s].name +
          '</td><td class="text-center">' +
          sectorsArr[s].tickets +
          '</td><td class="text-right">' +
          sectorsArr[s].hours.toFixed(1) +
          'h</td></tr>'
      }
      if (sectorsArr.length === 0) {
        htmlContent +=
          '<tr><td colspan="3" class="text-center">Nenhum apontamento com setor identificado no período.</td></tr>'
      }

      htmlContent +=
        '</tbody></table><div class="source">Fonte: ServiceOne ITSM.</div>' +
        '<h2>3. Horas por Solicitante</h2>' +
        '<p class="abnt-p">Detalhamento dos colaboradores com maior volume de suporte técnico no mês.</p>' +
        '<div class="caption">Quadro 3 &ndash; Usuários com maior consumo técnico</div>' +
        '<table><thead><tr><th>Solicitante</th><th>Setor</th><th class="text-center">Chamados</th><th class="text-right">Horas</th></tr></thead><tbody>'

      for (var r = 0; r < requestersArr.length; r++) {
        htmlContent +=
          '<tr><td>' +
          requestersArr[r].name +
          '</td><td>' +
          requestersArr[r].dept +
          '</td><td class="text-center">' +
          requestersArr[r].tickets +
          '</td><td class="text-right">' +
          requestersArr[r].hours.toFixed(1) +
          'h</td></tr>'
      }
      if (requestersArr.length === 0) {
        htmlContent +=
          '<tr><td colspan="4" class="text-center">Nenhum chamado com solicitante identificado no período.</td></tr>'
      }

      htmlContent +=
        '</tbody></table><div class="source">Fonte: ServiceOne ITSM.</div>' +
        '<h2>4. Atividades Mais Requisitadas</h2>' +
        '<p class="abnt-p">Classificação das categorias de serviço mais acionadas no catálogo técnico.</p>' +
        '<div class="caption">Quadro 4 &ndash; Atividades de maior demanda</div>' +
        '<table><thead><tr><th>Atividade / Serviço</th><th>Tipo</th><th class="text-center">Ocorrências</th><th class="text-right">Horas</th></tr></thead><tbody>'

      for (var a = 0; a < activitiesArr.length; a++) {
        htmlContent +=
          '<tr><td>' +
          activitiesArr[a].name +
          '</td><td>' +
          activitiesArr[a].catLabel +
          '</td><td class="text-center">' +
          activitiesArr[a].tickets +
          '</td><td class="text-right">' +
          activitiesArr[a].hours.toFixed(1) +
          'h</td></tr>'
      }
      if (activitiesArr.length === 0) {
        htmlContent +=
          '<tr><td colspan="4" class="text-center">Sem registros de atividades no período.</td></tr>'
      }

      htmlContent +=
        '</tbody></table><div class="source">Fonte: Catálogo de Serviços ITSM.</div>' +
        '<h2>5. Estudo Técnico e Recomendações</h2>' +
        '<p class="abnt-p">No período de ' +
        monthLabel +
        ', a organização totalizou ' +
        totalUsedHours.toFixed(1) +
        ' horas técnicas em ' +
        ticketsInPeriod.length +
        ' atendimento(s).' +
        (topSector
          ? ' O setor de maior concentração técnica foi o "' +
            topSector.name +
            '" com ' +
            topSector.hours.toFixed(1) +
            'h consumidas.'
          : '') +
        (topActivity ? ' A demanda predominante envolveu "' + topActivity.name + '".' : '') +
        '</p>' +
        '<div class="caption">Recomendações Técnicas para o Próximo Ciclo:</div>' +
        '<ul class="abnt-recs">' +
        '<li>Assegurar a rotina de manutenções preventivas e varreduras nos computadores do setor ' +
        (topSector ? topSector.name : 'principal') +
        '.</li>' +
        '<li>Manter monitoramento contínuo dos ativos e das licenças vigentes.</li>' +
        '<li>Acompanhar a evolução das solicitações via portal para maior rastreabilidade e agilidade no cumprimento de SLA.</li>' +
        '</ul>' +
        '<h2>6. Movimentação de Ativos de TI</h2>' +
        '<p class="abnt-p">Visão sintética do inventário e das movimentações de hardware e equipamentos no período.</p>' +
        '<div class="caption">Quadro 5 &ndash; Resumo de ativos e movimentações</div>' +
        '<table><thead><tr><th>Movimentação</th><th class="text-center">Quantidade</th><th>Status</th></tr></thead><tbody>' +
        '<tr><td>Novos Ativos Incorporados no Mês</td><td class="text-center">' +
        enteredAssets.length +
        '</td><td>Ativo</td></tr>' +
        '<tr><td>Ativos Desativados / Em Manutenção / Baixa</td><td class="text-center">' +
        exitedAssets.length +
        '</td><td>Inativo / Manutenção</td></tr>' +
        '<tr><td>Total de Ativos Cadastrados no Escopo</td><td class="text-center">' +
        equipments.length +
        '</td><td>Inventariados</td></tr>' +
        '</tbody></table><div class="source">Fonte: Base de Ativos (CMDB).</div>' +
        '<p style="margin-top: 30px; font-size: 9pt; color: #666; text-align: center; border-top: 1pt solid #ccc; padding-top: 10px;">' +
        'Relatório gerado automaticamente pelo ServiceOne ITSM.' +
        '</p></div></body></html>'

      // Envia via mailClient ou serviço unificado do sistema
      var sendErrors = []

      for (var rIdx = 0; rIdx < recipients.length; rIdx++) {
        var targetEmail = recipients[rIdx]
        var message = new MailMessage()
        message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne - ITSM' }
        message.to = [{ address: targetEmail }]
        message.subject = subject
        message.html = htmlContent
        message.text =
          'Relatório Mensal de Serviços referente a ' +
          monthLabel +
          ' para ' +
          companyName +
          '.\nConsulte o e-mail em formato HTML para visualizar o documento completo no padrão ABNT.'

        try {
          if (globalThis.sendSystemMailMessage) {
            globalThis.sendSystemMailMessage(message)
          } else {
            var mailClient = $app.newMailClient()
            mailClient.send(message)
          }
        } catch (sendErr) {
          sendErrors.push(targetEmail + ': ' + sendErr.message)
        }
      }

      var isSuccess = sendErrors.length === 0
      var recipientsJoined = recipients.join(', ')

      if (isSuccess) {
        sched.set('last_sent_at', new Date().toISOString())
        sched.set('last_sent_month', prevMonthKey)
        try {
          $app.save(sched)
        } catch (_) {}
      }

      try {
        var logsCol2 = $app.findCollectionByNameOrId('monthly_report_send_logs')
        var logRec2 = new Record(logsCol2)
        logRec2.set('company', companyId)
        logRec2.set('report_month', prevMonthKey)
        logRec2.set('recipients', recipientsJoined)
        logRec2.set('status', isSuccess ? 'sucesso' : 'falha')
        logRec2.set('error_message', sendErrors.length > 0 ? sendErrors.join(' | ') : '')
        logRec2.set('sent_at', new Date().toISOString())
        logRec2.set('triggered_by', 'cron')
        $app.save(logRec2)
      } catch (_) {}

      $app
        .logger()
        .info(
          'monthly_client_report_cron: completed for company ' +
            companyId +
            ' with status: ' +
            (isSuccess ? 'sucesso' : 'falha'),
        )
    } catch (err) {
      $app
        .logger()
        .error('monthly_client_report_cron: failed for company ' + companyId, 'error', err.message)
    }
  }
})

// Endpoint para envio sob demanda / teste imediato pelo gestor
routerAdd(
  'POST',
  '/backend/v1/reports/monthly-client/send',
  function (e) {
    try {
      var body = e.requestInfo().body || {}
      var companyId = body.company_id || ''
      var monthKey = body.month_key || ''
      var extraEmails = body.extra_emails || []

      if (!companyId || !monthKey) {
        return e.json(400, { error: 'company_id e month_key são obrigatórios.' })
      }

      var company = null
      try {
        company = $app.findRecordById('companies', companyId)
      } catch (cErr) {
        return e.json(404, { error: 'Empresa não encontrada: ' + companyId })
      }

      var companyName =
        company.getString('trade_name') || company.getString('legal_name') || 'Cliente'

      // Busca configuração de agendamento se houver
      var sched = null
      try {
        var scheds = $app.findRecordsByFilter(
          'monthly_report_schedules',
          'company = "' + companyId + '"',
          '-created',
          1,
          0,
        )
        if (scheds && scheds.length > 0) sched = scheds[0]
      } catch (_) {}

      var recipients = []
      if (sched && sched.getBool('use_focal_points')) {
        try {
          var contacts = $app.findRecordsByFilter(
            'client_contacts',
            'client = "' + companyId + '" && is_focal_point = true',
            '',
            0,
            0,
          )
          for (var c = 0; c < contacts.length; c++) {
            var email = contacts[c].getString('email').trim()
            if (email && recipients.indexOf(email) < 0) recipients.push(email)
          }
        } catch (_) {}
      }

      if (sched) {
        var rawManual = sched.getString('manual_recipients') || ''
        var manualList = rawManual
          .split(/[\n,;]+/)
          .map(function (s) {
            return s.trim()
          })
          .filter(function (s) {
            return s.length > 3 && s.indexOf('@') > 0
          })
        for (var m = 0; m < manualList.length; m++) {
          if (recipients.indexOf(manualList[m]) < 0) recipients.push(manualList[m])
        }
      }

      if (Array.isArray(extraEmails)) {
        for (var ex = 0; ex < extraEmails.length; ex++) {
          var eEmail = String(extraEmails[ex] || '').trim()
          if (eEmail && recipients.indexOf(eEmail) < 0) recipients.push(eEmail)
        }
      }

      if (recipients.length === 0) {
        try {
          var logsCol = $app.findCollectionByNameOrId('monthly_report_send_logs')
          var logRec = new Record(logsCol)
          logRec.set('company', companyId)
          logRec.set('report_month', monthKey)
          logRec.set('recipients', 'Nenhum')
          logRec.set('status', 'falha')
          logRec.set('error_message', 'Nenhum e-mail de destinatário cadastrado ou selecionado.')
          logRec.set('sent_at', new Date().toISOString())
          logRec.set('triggered_by', 'manual')
          $app.save(logRec)
        } catch (_) {}
        return e.json(400, { error: 'Nenhum destinatário definido para envio do relatório.' })
      }

      var parts = monthKey.split('-')
      var year = parseInt(parts[0], 10)
      var month = parseInt(parts[1], 10)
      var monthNames = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
      ]
      var monthLabel = monthNames[month - 1] + ' de ' + year
      var subject = 'Relatório Mensal de Serviços – ' + companyName + ' – ' + monthLabel

      var startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
      var nextMonthDate = new Date(Date.UTC(year, month, 1, 0, 0, 0))
      var endDate = new Date(nextMonthDate.getTime() - 1)
      var startIso = startDate.toISOString()
      var endIso = endDate.toISOString()

      var tickets = []
      try {
        tickets = $app.findRecordsByFilter(
          'tickets',
          'company = "' + companyId + '"',
          'created',
          0,
          0,
        )
      } catch (_) {}

      var ticketMap = {}
      var ticketIds = []
      for (var ti = 0; ti < tickets.length; ti++) {
        ticketMap[tickets[ti].id] = tickets[ti]
        ticketIds.push(tickets[ti].id)
      }

      var interactions = []
      if (ticketIds.length > 0) {
        var bSize = 50
        for (var bi = 0; bi < ticketIds.length; bi += bSize) {
          var bSlice = ticketIds.slice(bi, bi + bSize)
          var tFilter = bSlice
            .map(function (id) {
              return 'ticket = "' + id + '"'
            })
            .join(' || ')
          try {
            var inters = $app.findRecordsByFilter(
              'ticket_interactions',
              '(' + tFilter + ') && created >= "' + startIso + '" && created <= "' + endIso + '"',
              'created',
              0,
              0,
            )
            for (var ii = 0; ii < inters.length; ii++) {
              interactions.push(inters[ii])
            }
          } catch (_) {}
        }
      }

      var contracts = []
      try {
        contracts = $app.findRecordsByFilter(
          'contracts',
          'company = "' + companyId + '"',
          '-created',
          1,
          0,
        )
      } catch (_) {}
      var contract = contracts.length > 0 ? contracts[0] : null

      var depts = []
      try {
        depts = $app.findRecordsByFilter(
          'company_departments',
          'company = "' + companyId + '"',
          '',
          0,
          0,
        )
      } catch (_) {}
      var deptMap = {}
      for (var di = 0; di < depts.length; di++) {
        deptMap[depts[di].id] = depts[di].getString('name')
      }

      var categories = []
      try {
        categories = $app.findRecordsByFilter('tkt_categories', '', '', 0, 0)
      } catch (_) {}
      var catMap = {}
      for (var ci = 0; ci < categories.length; ci++) {
        catMap[categories[ci].id] = categories[ci]
      }

      var equipments = []
      try {
        equipments = $app.findRecordsByFilter(
          'equipments',
          'company = "' + companyId + '"',
          '-created',
          0,
          0,
        )
      } catch (_) {}

      var totalUsedMinutes = 0
      var sectorMinutes = {}
      var requesterMinutes = {}
      var activityMinutes = {}

      for (var k = 0; k < interactions.length; k++) {
        var inter = interactions[k]
        var min = inter.getInt('duration_minutes') || 0
        if (min <= 0) continue
        totalUsedMinutes += min

        var tkt = ticketMap[inter.getString('ticket')]
        if (!tkt) continue

        var deptId = tkt.getString('department') || 'sem_setor'
        var deptName = deptMap[deptId] || 'Geral / Sem setor'
        if (!sectorMinutes[deptName]) sectorMinutes[deptName] = { minutes: 0, tickets: {} }
        sectorMinutes[deptName].minutes += min
        sectorMinutes[deptName].tickets[tkt.id] = true

        var reqName =
          tkt.getString('requester_name') || tkt.getString('requester_email') || 'Não identificado'
        if (!requesterMinutes[reqName])
          requesterMinutes[reqName] = { minutes: 0, dept: deptName, tickets: {} }
        requesterMinutes[reqName].minutes += min
        requesterMinutes[reqName].tickets[tkt.id] = true

        var subCatId = tkt.getString('subcategory')
        var mainCatId = tkt.getString('category')
        var actName = 'Geral / Outros'
        var catLabel = 'Suporte'
        if (subCatId && catMap[subCatId]) {
          actName = catMap[subCatId].getString('name')
          catLabel =
            mainCatId && catMap[mainCatId] ? catMap[mainCatId].getString('name') : 'Subatividade'
        } else if (mainCatId && catMap[mainCatId]) {
          actName = catMap[mainCatId].getString('name')
          catLabel = 'Categoria'
        }
        if (!activityMinutes[actName])
          activityMinutes[actName] = { minutes: 0, catLabel: catLabel, tickets: {} }
        activityMinutes[actName].minutes += min
        activityMinutes[actName].tickets[tkt.id] = true
      }

      var totalUsedHours = Math.round((totalUsedMinutes / 60) * 10) / 10
      var totalContractedHours = 0
      if (contract) {
        totalContractedHours += contract.getInt('hours_level1') || 0
        totalContractedHours += contract.getInt('hours_level2') || 0
        totalContractedHours += contract.getInt('hours_level3') || 0
        totalContractedHours += contract.getInt('hours_consultoria') || 0
        totalContractedHours += contract.getInt('hours_backoffice') || 0
        totalContractedHours += contract.getInt('hours_administrativo') || 0
        if (totalContractedHours === 0) totalContractedHours = contract.getInt('monthly_hours') || 0
      }
      var balanceHours = Math.round((totalContractedHours - totalUsedHours) * 10) / 10
      var utilizationPct =
        totalContractedHours > 0 ? Math.round((totalUsedHours / totalContractedHours) * 100) : 0

      var enteredAssets = []
      var exitedAssets = []
      for (var ei = 0; ei < equipments.length; ei++) {
        var eq = equipments[ei]
        var eqCreated = eq.getString('created')
        var eqUpdated = eq.getString('updated')
        var eqStatus = eq.getString('status')
        if (eqCreated >= startIso && eqCreated <= endIso) enteredAssets.push(eq)
        if (
          ['Descartado', 'Inativo', 'Em Manutenção'].indexOf(eqStatus) >= 0 &&
          eqUpdated >= startIso &&
          eqUpdated <= endIso
        ) {
          exitedAssets.push(eq)
        }
      }

      var ticketsInPeriod = []
      for (var tIdx = 0; tIdx < tickets.length; tIdx++) {
        var cIso = tickets[tIdx].getString('created')
        if (cIso >= startIso && cIso <= endIso) ticketsInPeriod.push(tickets[tIdx])
      }

      var sectorsArr = Object.keys(sectorMinutes)
        .map(function (k) {
          return {
            name: k,
            hours: Math.round((sectorMinutes[k].minutes / 60) * 10) / 10,
            tickets: Object.keys(sectorMinutes[k].tickets).length,
          }
        })
        .sort(function (a, b) {
          return b.hours - a.hours
        })

      var requestersArr = Object.keys(requesterMinutes)
        .map(function (k) {
          return {
            name: k,
            dept: requesterMinutes[k].dept,
            hours: Math.round((requesterMinutes[k].minutes / 60) * 10) / 10,
            tickets: Object.keys(requesterMinutes[k].tickets).length,
          }
        })
        .sort(function (a, b) {
          return b.hours - a.hours
        })
        .slice(0, 8)

      var activitiesArr = Object.keys(activityMinutes)
        .map(function (k) {
          return {
            name: k,
            catLabel: activityMinutes[k].catLabel,
            hours: Math.round((activityMinutes[k].minutes / 60) * 10) / 10,
            tickets: Object.keys(activityMinutes[k].tickets).length,
          }
        })
        .sort(function (a, b) {
          return b.tickets - a.tickets || b.hours - a.hours
        })
        .slice(0, 8)

      var topSector = sectorsArr.length > 0 ? sectorsArr[0] : null
      var topActivity = activitiesArr.length > 0 ? activitiesArr[0] : null

      var htmlContent =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Mensal</title>' +
        '<style>' +
        'body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.4; color: #111; background-color: #f7f9fa; margin: 0; padding: 20px; }' +
        '.container { max-width: 780px; margin: 0 auto; background: #fff; padding: 35px 40px; border: 1px solid #dcdfe4; }' +
        '.cover-header { text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-bottom: 25px; border-bottom: 2pt solid #000; padding-bottom: 10px; }' +
        '.cover-title { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 20px 0 10px 0; }' +
        '.cover-subtitle { text-align: center; font-size: 12pt; margin-bottom: 30px; color: #333; }' +
        'h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; border-bottom: 1.5pt solid #000; padding-bottom: 4px; margin-top: 25px; margin-bottom: 12px; }' +
        'p.abnt-p { text-align: justify; text-indent: 1.25cm; margin: 0 0 10px 0; font-size: 11pt; }' +
        '.caption { font-size: 9.5pt; font-weight: bold; margin: 10px 0 4px 0; color: #111; }' +
        '.source { font-size: 8.5pt; color: #555; margin-top: 3px; margin-bottom: 15px; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 10pt; }' +
        'th { border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; padding: 6px 8px; font-weight: bold; background: #f3f4f6; text-align: left; }' +
        'td { border-bottom: 0.5pt solid #d1d5db; padding: 5px 8px; }' +
        '.text-right { text-align: right; }' +
        '.text-center { text-align: center; }' +
        '.kpi-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 15px; border-radius: 4px; display: table; width: 100%; box-sizing: border-box; }' +
        '.kpi-item { display: table-cell; width: 25%; text-align: center; vertical-align: middle; border-right: 1px solid #e2e8f0; }' +
        '.kpi-item:last-child { border-right: none; }' +
        '.kpi-val { font-size: 14pt; font-weight: bold; color: #0f172a; }' +
        '.kpi-lbl { font-size: 8.5pt; color: #64748b; text-transform: uppercase; }' +
        'ul.abnt-recs { margin: 8px 0 16px 20px; padding: 0; font-size: 10pt; }' +
        'ul.abnt-recs li { margin-bottom: 6px; }' +
        '</style></head><body>' +
        '<div class="container">' +
        '<div class="cover-header">SERVICEONE GESTÃO DE TI E OPERAÇÕES</div>' +
        '<div class="cover-title">Relatório Mensal de Serviços</div>' +
        '<div class="cover-subtitle">Cliente: <strong>' +
        companyName +
        '</strong> &mdash; Período de Referência: <strong>' +
        monthLabel +
        '</strong></div>' +
        '<div class="kpi-box">' +
        '<div class="kpi-item"><div class="kpi-val">' +
        totalContractedHours.toFixed(1) +
        'h</div><div class="kpi-lbl">Contratadas</div></div>' +
        '<div class="kpi-item"><div class="kpi-val">' +
        totalUsedHours.toFixed(1) +
        'h</div><div class="kpi-lbl">Consumidas</div></div>' +
        '<div class="kpi-item"><div class="kpi-val">' +
        balanceHours.toFixed(1) +
        'h</div><div class="kpi-lbl">Saldo de Horas</div></div>' +
        '<div class="kpi-item"><div class="kpi-val">' +
        utilizationPct +
        '%</div><div class="kpi-lbl">Utilização</div></div>' +
        '</div>' +
        '<h2>1. Horas Consumidas por Acordo de Atendimento</h2>' +
        '<p class="abnt-p">O presente capítulo consolida o balanço das horas técnicas consumidas pela organização no mês de ' +
        monthLabel +
        ', discriminando o saldo em face da franquia contratada.</p>' +
        '<div class="caption">Quadro 1 &ndash; Balanço de horas e taxa de consumo</div>' +
        '<table><thead><tr><th>Indicador</th><th class="text-right">Horas</th><th class="text-right">Percentual</th></tr></thead>' +
        '<tbody>' +
        '<tr><td>Horas Contratadas (Franquia)</td><td class="text-right">' +
        totalContractedHours.toFixed(1) +
        'h</td><td class="text-right">100%</td></tr>' +
        '<tr><td>Horas Consumidas no Período</td><td class="text-right">' +
        totalUsedHours.toFixed(1) +
        'h</td><td class="text-right">' +
        utilizationPct +
        '%</td></tr>' +
        '<tr><td>Saldo Remanescente</td><td class="text-right">' +
        balanceHours.toFixed(1) +
        'h</td><td class="text-right">' +
        (100 - utilizationPct) +
        '%</td></tr>' +
        '</tbody></table>' +
        '<div class="source">Fonte: ServiceOne ITSM.</div>' +
        '<h2>2. Horas por Setor / Departamento</h2>' +
        '<p class="abnt-p">Distribuição das horas despendidas de acordo com os setores demandantes da organização.</p>' +
        '<div class="caption">Quadro 2 &ndash; Horas consumidas por departamento</div>' +
        '<table><thead><tr><th>Setor / Departamento</th><th class="text-center">Chamados</th><th class="text-right">Horas</th></tr></thead><tbody>'

      for (var s = 0; s < Math.min(sectorsArr.length, 6); s++) {
        htmlContent +=
          '<tr><td>' +
          sectorsArr[s].name +
          '</td><td class="text-center">' +
          sectorsArr[s].tickets +
          '</td><td class="text-right">' +
          sectorsArr[s].hours.toFixed(1) +
          'h</td></tr>'
      }
      if (sectorsArr.length === 0) {
        htmlContent +=
          '<tr><td colspan="3" class="text-center">Nenhum apontamento com setor identificado no período.</td></tr>'
      }

      htmlContent +=
        '</tbody></table><div class="source">Fonte: ServiceOne ITSM.</div>' +
        '<h2>3. Horas por Solicitante</h2>' +
        '<p class="abnt-p">Detalhamento dos colaboradores com maior volume de suporte técnico no mês.</p>' +
        '<div class="caption">Quadro 3 &ndash; Usuários com maior consumo técnico</div>' +
        '<table><thead><tr><th>Solicitante</th><th>Setor</th><th class="text-center">Chamados</th><th class="text-right">Horas</th></tr></thead><tbody>'

      for (var r = 0; r < requestersArr.length; r++) {
        htmlContent +=
          '<tr><td>' +
          requestersArr[r].name +
          '</td><td>' +
          requestersArr[r].dept +
          '</td><td class="text-center">' +
          requestersArr[r].tickets +
          '</td><td class="text-right">' +
          requestersArr[r].hours.toFixed(1) +
          'h</td></tr>'
      }
      if (requestersArr.length === 0) {
        htmlContent +=
          '<tr><td colspan="4" class="text-center">Nenhum chamado com solicitante identificado no período.</td></tr>'
      }

      htmlContent +=
        '</tbody></table><div class="source">Fonte: ServiceOne ITSM.</div>' +
        '<h2>4. Atividades Mais Requisitadas</h2>' +
        '<p class="abnt-p">Classificação das categorias de serviço mais acionadas no catálogo técnico.</p>' +
        '<div class="caption">Quadro 4 &ndash; Atividades de maior demanda</div>' +
        '<table><thead><tr><th>Atividade / Serviço</th><th>Tipo</th><th class="text-center">Ocorrências</th><th class="text-right">Horas</th></tr></thead><tbody>'

      for (var a = 0; a < activitiesArr.length; a++) {
        htmlContent +=
          '<tr><td>' +
          activitiesArr[a].name +
          '</td><td>' +
          activitiesArr[a].catLabel +
          '</td><td class="text-center">' +
          activitiesArr[a].tickets +
          '</td><td class="text-right">' +
          activitiesArr[a].hours.toFixed(1) +
          'h</td></tr>'
      }
      if (activitiesArr.length === 0) {
        htmlContent +=
          '<tr><td colspan="4" class="text-center">Sem registros de atividades no período.</td></tr>'
      }

      htmlContent +=
        '</tbody></table><div class="source">Fonte: Catálogo de Serviços ITSM.</div>' +
        '<h2>5. Estudo Técnico e Recomendações</h2>' +
        '<p class="abnt-p">No período de ' +
        monthLabel +
        ', a organização totalizou ' +
        totalUsedHours.toFixed(1) +
        ' horas técnicas em ' +
        ticketsInPeriod.length +
        ' atendimento(s).' +
        (topSector
          ? ' O setor de maior concentração técnica foi o "' +
            topSector.name +
            '" com ' +
            topSector.hours.toFixed(1) +
            'h consumidas.'
          : '') +
        (topActivity ? ' A demanda predominante envolveu "' + topActivity.name + '".' : '') +
        '</p>' +
        '<div class="caption">Recomendações Técnicas para o Próximo Ciclo:</div>' +
        '<ul class="abnt-recs">' +
        '<li>Assegurar a rotina de manutenções preventivas e varreduras nos computadores do setor ' +
        (topSector ? topSector.name : 'principal') +
        '.</li>' +
        '<li>Manter monitoramento contínuo dos ativos e das licenças vigentes.</li>' +
        '<li>Acompanhar a evolução das solicitações via portal para maior rastreabilidade e agilidade no cumprimento de SLA.</li>' +
        '</ul>' +
        '<h2>6. Movimentação de Ativos de TI</h2>' +
        '<p class="abnt-p">Visão sintética do inventário e das movimentações de hardware e equipamentos no período.</p>' +
        '<div class="caption">Quadro 5 &ndash; Resumo de ativos e movimentações</div>' +
        '<table><thead><tr><th>Movimentação</th><th class="text-center">Quantidade</th><th>Status</th></tr></thead><tbody>' +
        '<tr><td>Novos Ativos Incorporados no Mês</td><td class="text-center">' +
        enteredAssets.length +
        '</td><td>Ativo</td></tr>' +
        '<tr><td>Ativos Desativados / Em Manutenção / Baixa</td><td class="text-center">' +
        exitedAssets.length +
        '</td><td>Inativo / Manutenção</td></tr>' +
        '<tr><td>Total de Ativos Cadastrados no Escopo</td><td class="text-center">' +
        equipments.length +
        '</td><td>Inventariados</td></tr>' +
        '</tbody></table><div class="source">Fonte: Base de Ativos (CMDB).</div>' +
        '<p style="margin-top: 30px; font-size: 9pt; color: #666; text-align: center; border-top: 1pt solid #ccc; padding-top: 10px;">' +
        'Relatório gerado automaticamente pelo ServiceOne ITSM.' +
        '</p></div></body></html>'

      var sendErrors = []

      for (var rIdx = 0; rIdx < recipients.length; rIdx++) {
        var targetEmail = recipients[rIdx]
        var message = new MailMessage()
        message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne - ITSM' }
        message.to = [{ address: targetEmail }]
        message.subject = subject
        message.html = htmlContent
        message.text =
          'Relatório Mensal de Serviços referente a ' +
          monthLabel +
          ' para ' +
          companyName +
          '.\nConsulte o e-mail em formato HTML para visualizar o documento completo no padrão ABNT.'

        try {
          if (globalThis.sendSystemMailMessage) {
            globalThis.sendSystemMailMessage(message)
          } else {
            var mailClient = $app.newMailClient()
            mailClient.send(message)
          }
        } catch (sendErr) {
          sendErrors.push(targetEmail + ': ' + sendErr.message)
        }
      }

      var isSuccess = sendErrors.length === 0
      var recipientsJoined = recipients.join(', ')

      try {
        var logsCol3 = $app.findCollectionByNameOrId('monthly_report_send_logs')
        var logRec3 = new Record(logsCol3)
        logRec3.set('company', companyId)
        logRec3.set('report_month', monthKey)
        logRec3.set('recipients', recipientsJoined)
        logRec3.set('status', isSuccess ? 'sucesso' : 'falha')
        logRec3.set('error_message', sendErrors.length > 0 ? sendErrors.join(' | ') : '')
        logRec3.set('sent_at', new Date().toISOString())
        logRec3.set('triggered_by', 'manual')
        $app.save(logRec3)
      } catch (_) {}

      if (!isSuccess) {
        return e.json(500, { error: 'Falha no envio de e-mail para: ' + sendErrors.join(', ') })
      }

      return e.json(200, {
        success: true,
        company: companyName,
        month: monthKey,
        recipients: recipients,
      })
    } catch (err) {
      $app.logger().error('monthly_client_report send endpoint error', 'error', err.message)
      return e.json(500, { error: err.message || 'Erro ao processar envio do relatório.' })
    }
  },
  $apis.requireAuth(),
)
