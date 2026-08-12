onRecordCreate((e) => {
  var companyId = e.record.getString('company')
  if (companyId) {
    try {
      var company = $app.findRecordById('companies', companyId)
      var companyCode = company.getString('code') || 'SEM_COD'

      var existingTickets = $app.findRecordsByFilter(
        'tickets',
        'company = "' + companyId + '"',
        '-created',
        0,
        0,
      )

      var maxSeq = 0
      for (var i = 0; i < existingTickets.length; i++) {
        var num = existingTickets[i].getString('number')
        var match = num.match(/(\d+)\s*$/)
        if (match) {
          var seq = parseInt(match[1], 10)
          if (seq > maxSeq) maxSeq = seq
        }
      }

      var nextSeq = maxSeq + 1
      var seqStr = String(nextSeq)
      while (seqStr.length < 5) seqStr = '0' + seqStr
      e.record.set('number', companyCode + ' - ' + seqStr)
    } catch (err) {
      $app
        .logger()
        .error('ticket_on_create: failed to generate ticket number', 'error', err.message)
    }
  }

  var subCategoryId = e.record.getString('subcategory')
  if (!subCategoryId) return e.next()

  try {
    var subCat = $app.findRecordById('tkt_categories', subCategoryId)
    var parent = subCat.getString('parent')
    if (!parent) return e.next()

    var impact = subCat.getString('impact')
    var urgency = subCat.getString('urgency')
    var priority = subCat.getString('priority')
    var slaRespMin = subCat.getInt('sla_response_minutes') || 0
    var slaSolMin = subCat.getInt('sla_solution_minutes') || 0

    if (impact) e.record.set('impact', impact)
    if (urgency) e.record.set('urgency', urgency)
    if (priority) e.record.set('priority', priority)

    var now = new Date()
    if (slaRespMin > 0) {
      e.record.set(
        'sla_response_deadline',
        new Date(now.getTime() + slaRespMin * 60000).toISOString(),
      )
    }
    if (slaSolMin > 0) {
      e.record.set(
        'sla_solution_deadline',
        new Date(now.getTime() + slaSolMin * 60000).toISOString(),
      )
    }
  } catch (err) {
    $app.logger().error('ticket_on_create: failed to read subcategory', 'error', err.message)
  }

  return e.next()
}, 'tickets')
