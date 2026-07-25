cronAdd('consumption_alerts_filial', '0 * * * *', () => {
  var periods = $app.findRecordsByFilter(
    'contract_periods',
    'status = "Ativo" && consumed_hours > 0 && contracted_hours > 0',
    '-created',
    0,
    0,
  )

  var notifCol = $app.findCollectionByNameOrId('notifications')

  for (var i = 0; i < periods.length; i++) {
    var period = periods[i]
    var consumed = period.getFloat('consumed_hours') || 0
    var contracted = period.getFloat('contracted_hours') || 0
    if (contracted <= 0) continue

    var pct = consumed / contracted
    var lastNotified = period.getFloat('last_notified_pct') || 0
    var contractId = period.getString('contract')

    var contract = null
    var companyName = 'N/A'
    var contractNumber = 'N/A'
    try {
      contract = $app.findRecordById('contracts', contractId)
      contractNumber = contract.getString('number')
      var company = $app.findRecordById('companies', contract.getString('company'))
      companyName = company.getString('trade_name') || company.getString('legal_name')
    } catch (_) {
      continue
    }

    var companyId = contract.getString('company')
    var notify80 = pct >= 0.8 && lastNotified < 0.8
    var notify100 = pct >= 1.0 && lastNotified < 1.0

    if (!notify80 && !notify100) continue

    var users = $app.findRecordsByFilter('users', 'company = "' + companyId + '"', '', 0, 0)
    var newPct = lastNotified

    if (notify80) {
      var title80 = 'Atenção: Consumo atingiu 80%'
      var msg80 =
        'O contrato ' +
        contractNumber +
        ' da empresa ' +
        companyName +
        ' já consumiu ' +
        consumed.toFixed(2) +
        'h dos ' +
        contracted.toFixed(2) +
        'h contratados.'
      for (var j = 0; j < users.length; j++) {
        var n80 = new Record(notifCol)
        n80.set('user', users[j].id)
        n80.set('title', title80)
        n80.set('message', msg80)
        n80.set('type', 'Sistema')
        n80.set('read', false)
        $app.save(n80)
      }
      newPct = 0.8
    }

    if (notify100) {
      var title100 = 'Aviso: Consumo atingiu 100%'
      var msg100 =
        'O contrato ' +
        contractNumber +
        ' da empresa ' +
        companyName +
        ' esgotou as horas contratadas (' +
        consumed.toFixed(2) +
        'h).'
      for (var k = 0; k < users.length; k++) {
        var n100 = new Record(notifCol)
        n100.set('user', users[k].id)
        n100.set('title', title100)
        n100.set('message', msg100)
        n100.set('type', 'Sistema')
        n100.set('read', false)
        $app.save(n100)
      }
      newPct = 1.0
    }

    period.set('last_notified_pct', newPct)
    $app.save(period)
  }
})
