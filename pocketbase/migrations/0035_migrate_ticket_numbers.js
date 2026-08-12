migrate(
  (app) => {
    var tickets = []
    try {
      tickets = app.findRecordsByFilter('tickets', '', 'created', 0, 0)
    } catch (err) {
      app.logger && app.logger().error('0035: failed to fetch tickets', 'error', err.message)
      return
    }

    var byCompany = {}
    for (var i = 0; i < tickets.length; i++) {
      var companyId = tickets[i].getString('company')
      if (!byCompany[companyId]) byCompany[companyId] = []
      byCompany[companyId].push(tickets[i])
    }

    var companyIds = Object.keys(byCompany)
    for (var c = 0; c < companyIds.length; c++) {
      var cid = companyIds[c]
      var companyCode = 'SEM_COD'
      try {
        var company = app.findRecordById('companies', cid)
        companyCode = company.getString('code') || 'SEM_COD'
      } catch (_) {}

      var companyTickets = byCompany[cid]
      for (var t = 0; t < companyTickets.length; t++) {
        var seq = t + 1
        var seqStr = String(seq)
        while (seqStr.length < 5) seqStr = '0' + seqStr
        var newNumber = companyCode + ' - ' + seqStr
        var ticketId = companyTickets[t].id

        app
          .db()
          .newQuery('UPDATE tickets SET number = {:num} WHERE id = {:id}')
          .bind({ num: newNumber, id: ticketId })
          .execute()
      }
    }
  },
  (app) => {},
)
