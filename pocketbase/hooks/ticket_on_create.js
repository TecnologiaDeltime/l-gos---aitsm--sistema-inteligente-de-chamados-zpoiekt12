onRecordCreate((e) => {
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
