cronAdd('contract_renewal_check', '0 8 * * *', () => {
  var contracts = $app.findRecordsByFilter('contracts', 'status = "Ativo"', '-created', 0, 0)
  var admins = $app.findRecordsByFilter('users', 'role = "admin" || role = "gestor"', '', 0, 0)
  var now = new Date()
  var thresholds = [30, 15, 7, 1]
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  var todayStr = todayStart.toISOString().slice(0, 10) + ' 00:00:00.000Z'
  var title = 'Renovação de Contrato Próxima'

  for (var ci = 0; ci < contracts.length; ci++) {
    var contract = contracts[ci]
    var endDateStr = contract.getString('end_date')
    if (!endDateStr) continue

    var endDate = new Date(endDateStr + 'T23:59:59')
    var diffMs = endDate.getTime() - now.getTime()
    var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (thresholds.indexOf(diffDays) === -1) continue

    var companyName = 'N/A'
    try {
      var company = $app.findRecordById('companies', contract.getString('company'))
      companyName = company.getString('legal_name')
    } catch (_) {}

    var contractNumber = contract.getString('number')
    var message =
      'O contrato ' +
      contractNumber +
      ' da empresa ' +
      companyName +
      ' vence em ' +
      diffDays +
      ' dias (data: ' +
      endDate.toLocaleDateString('pt-BR') +
      '). Acesse o contrato para renovação.'

    for (var ai = 0; ai < admins.length; ai++) {
      var admin = admins[ai]
      var alreadyExists = false
      try {
        $app.findFirstRecordByFilter(
          'notifications',
          'user = "' +
            admin.id +
            '" && title = "' +
            title +
            '" && message ~ "' +
            contractNumber +
            '" && created >= "' +
            todayStr +
            '"',
        )
        alreadyExists = true
      } catch (_) {}

      if (alreadyExists) continue

      try {
        var notifsCol = $app.findCollectionByNameOrId('notifications')
        var notif = new Record(notifsCol)
        notif.set('user', admin.id)
        notif.set('title', title)
        notif.set('message', message)
        notif.set('type', 'Sistema')
        notif.set('read', false)
        $app.save(notif)
      } catch (err) {
        $app.logger().error('Error creating contract renewal notification', 'error', err.message)
      }
    }
  }
})
