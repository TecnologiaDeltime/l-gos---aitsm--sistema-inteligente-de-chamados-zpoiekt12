cronAdd('scheduled_report_sender', '0 2 * * *', function () {
  var now = new Date()
  var todayStr = now.toISOString().slice(0, 10)
  var todayStart = todayStr + ' 00:00:00.000Z'
  var todayEnd = todayStr + ' 23:59:59.999Z'

  var reports = []
  try {
    reports = $app.findRecordsByFilter(
      'scheduled_reports',
      'active = true && next_run >= "' + todayStart + '" && next_run <= "' + todayEnd + '"',
      '',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('scheduled_report_sender: query failed', 'error', err.message)
    return
  }
  if (reports.length === 0) return

  var prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  var prevStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString()
  var prevEnd = new Date(
    prevMonth.getFullYear(),
    prevMonth.getMonth() + 1,
    0,
    23,
    59,
    59,
  ).toISOString()
  var monthYear = prevMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function escCsv(val) {
    var s = String(val == null ? '' : val)
    if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  function strToBytes(str) {
    var bytes = []
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i)
      if (c < 128) {
        bytes.push(c)
      } else if (c < 2048) {
        bytes.push(192 | (c >> 6))
        bytes.push(128 | (c & 63))
      } else if (c < 55296 || c >= 57344) {
        bytes.push(224 | (c >> 12))
        bytes.push(128 | ((c >> 6) & 63))
        bytes.push(128 | (c & 63))
      } else {
        i++
        var c2 = str.charCodeAt(i)
        var cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff)
        bytes.push(240 | (cp >> 18))
        bytes.push(128 | ((cp >> 12) & 63))
        bytes.push(128 | ((cp >> 6) & 63))
        bytes.push(128 | (cp & 63))
      }
    }
    return bytes
  }

  function getReportTypes(record) {
    var raw = record.get('report_types')
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch (_) {
        return raw.split(',')
      }
    }
    return []
  }

  var tickets = []
  try {
    tickets = $app.findRecordsByFilter(
      'tickets',
      'created >= "' + prevStart + '" && created <= "' + prevEnd + '"',
      '',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('scheduled_report_sender: ticket query failed', 'error', err.message)
    return
  }

  var users = []
  try {
    users = $app.findRecordsByFilter('users', '', 'name', 0, 0)
  } catch (_) {}
  var userMap = {}
  for (var u = 0; u < users.length; u++) {
    userMap[users[u].id] = users[u].getString('name') || users[u].getString('email') || 'N/A'
  }

  var categories = []
  try {
    categories = $app.findRecordsByFilter('tkt_categories', '', '', 0, 0)
  } catch (_) {}
  var catMap = {}
  for (var ci = 0; ci < categories.length; ci++) {
    catMap[categories[ci].id] = categories[ci]
  }

  for (var i = 0; i < reports.length; i++) {
    var report = reports[i]
    var reportName = report.getString('name')
    var reportTypes = getReportTypes(report)
    var recipientEmails = report
      .getString('recipient_emails')
      .split(',')
      .map(function (s) {
        return s.trim()
      })
      .filter(function (s) {
        return s !== ''
      })
    var dayOfMonth = report.getInt('day_of_month')

    try {
      var csvParts = []

      if (reportTypes.indexOf('sla') >= 0) {
        var techGroups = {}
        for (var t = 0; t < tickets.length; t++) {
          var aTo = tickets[t].getString('assigned_to')
          if (!aTo) continue
          if (!techGroups[aTo]) techGroups[aTo] = []
          techGroups[aTo].push(tickets[t])
        }
        csvParts.push('=== RELATORIO DE SLA ===')
        csvParts.push(
          'Tecnico,Total,SLA Resposta Cumprido,SLA Resposta %,SLA Solucao Cumprido,SLA Solucao %',
        )
        var tIds = Object.keys(techGroups)
        for (var ti = 0; ti < tIds.length; ti++) {
          var tks = techGroups[tIds[ti]]
          var total = tks.length
          var rMet = 0,
            sMet = 0
          for (var tk = 0; tk < tks.length; tk++) {
            var tk_ = tks[tk]
            var rAt = tk_.getString('sla_response_at')
            var rDl = tk_.getString('sla_response_deadline')
            var ss = tk_.getString('sla_status')
            if (rAt && rDl) {
              if (new Date(rAt) <= new Date(rDl)) rMet++
            } else if (ss === 'Dentro do Prazo' || ss === 'Atenção' || ss === 'Atencao') rMet++
            var sAt = tk_.getString('sla_solution_at') || tk_.getString('resolution_date')
            var sDl = tk_.getString('sla_solution_deadline')
            if (sAt && sDl) {
              if (new Date(sAt) <= new Date(sDl)) sMet++
            } else if (ss === 'Dentro do Prazo' || ss === 'Atenção' || ss === 'Atencao') sMet++
          }
          var rPct = total > 0 ? ((rMet / total) * 100).toFixed(1) : '0.0'
          var sPct = total > 0 ? ((sMet / total) * 100).toFixed(1) : '0.0'
          csvParts.push(
            escCsv(userMap[tIds[ti]] || 'N/A') +
              ',' +
              total +
              ',' +
              rMet +
              ',' +
              rPct +
              '%,' +
              sMet +
              ',' +
              sPct +
              '%',
          )
        }
        csvParts.push('')
      }

      if (reportTypes.indexOf('atividades_recorrentes') >= 0) {
        var subGroups = {}
        for (var t2 = 0; t2 < tickets.length; t2++) {
          var subId = tickets[t2].getString('subcategory')
          if (!subId) {
            var catId = tickets[t2].getString('category')
            if (catId && catMap[catId] && catMap[catId].getString('parent')) subId = catId
          }
          if (!subId) continue
          if (!subGroups[subId]) subGroups[subId] = []
          subGroups[subId].push(tickets[t2])
        }
        csvParts.push('=== ATIVIDADES RECORRENTES ===')
        csvParts.push('Atividade Principal,Subatividade,Total')
        var sIds = Object.keys(subGroups)
        for (var si = 0; si < sIds.length; si++) {
          var cat = catMap[sIds[si]]
          var parent = cat && cat.getString('parent') ? catMap[cat.getString('parent')] : null
          var mainName = parent ? parent.getString('name') : cat ? cat.getString('name') : 'N/A'
          var subName = cat ? cat.getString('name') : 'N/A'
          csvParts.push(escCsv(mainName) + ',' + escCsv(subName) + ',' + subGroups[sIds[si]].length)
        }
        csvParts.push('')
      }

      var csvContent = csvParts.join('\n')
      var csvBytes = strToBytes('\ufeff' + csvContent)
      var subject = 'Relatorio Agendado - ' + reportName + ' - ' + monthYear
      var bodyText =
        'Segue em anexo o relatorio agendado "' +
        reportName +
        '" referente a ' +
        monthYear +
        '.\n\nO arquivo CSV esta anexo a este e-mail.'
      var filename = reportName.replace(/[^a-zA-Z0-9]/g, '_') + '.csv'

      for (var ei = 0; ei < recipientEmails.length; ei++) {
        var message = new MailMessage()
        message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne' }
        message.to = [{ address: recipientEmails[ei] }]
        message.subject = subject
        message.text = bodyText
        message.attachments = [{ filename: filename, content: csvBytes }]
        var client = $app.newMailClient()
        client.send(message)
      }

      var nextRun = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, 2, 0, 0)
      report.set('last_sent', now.toISOString())
      report.set('next_run', nextRun.toISOString())
      $app.save(report)

      $app
        .logger()
        .info(
          'scheduled_report_sender: sent report "' +
            reportName +
            '" to ' +
            recipientEmails.length +
            ' recipients',
        )
    } catch (err) {
      $app
        .logger()
        .error('scheduled_report_sender: failed for "' + reportName + '"', 'error', err.message)
    }
  }
})
