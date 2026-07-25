cronAdd('operator_daily_aggregation', '0 2 * * *', () => {
  var now = new Date()
  var yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  var yStr = yesterday.toISOString().slice(0, 10)
  var yStart = yStr + ' 00:00:00.000Z'
  var yEnd = yStr + ' 23:59:59.000Z'

  var operators = $app.findRecordsByFilter('users', 'role = "tecnico" || role = "gestor"', '', 0, 0)
  var snapCol = $app.findCollectionByNameOrId('operator_daily_snapshots')

  for (var i = 0; i < operators.length; i++) {
    var op = operators[i]
    try {
      var tickets = $app.findRecordsByFilter(
        'tickets',
        'assigned_to = "' + op.id + '" && created >= "' + yStart + '" && created <= "' + yEnd + '"',
        '',
        0,
        0,
      )
      var resolved = $app.findRecordsByFilter(
        'tickets',
        'assigned_to = "' +
          op.id +
          '" && status = "Resolvido" && updated >= "' +
          yStart +
          '" && updated <= "' +
          yEnd +
          '"',
        '',
        0,
        0,
      )
      var violated = $app.findRecordsByFilter(
        'tickets',
        'assigned_to = "' + op.id + '" && sla_status = "Violado"',
        '',
        0,
        0,
      )
      var interactions = $app.findRecordsByFilter(
        'ticket_interactions',
        'author = "' + op.id + '" && created >= "' + yStart + '" && created <= "' + yEnd + '"',
        '',
        0,
        0,
      )
      var backlog = $app.findRecordsByFilter(
        'tickets',
        'assigned_to = "' +
          op.id +
          '" && status != "Encerrado" && status != "Cancelado" && status != "Resolvido"',
        '',
        0,
        0,
      )
      var reopens = $app.findRecordsByFilter(
        'tickets',
        'assigned_to = "' +
          op.id +
          '" && status = "Reaberto" && updated >= "' +
          yStart +
          '" && updated <= "' +
          yEnd +
          '"',
        '',
        0,
        0,
      )

      var totalHours = 0
      for (var j = 0; j < interactions.length; j++) {
        totalHours += (interactions[j].getInt('duration_minutes') || 0) / 60
      }

      try {
        $app.findFirstRecordByFilter(
          'operator_daily_snapshots',
          'operator = "' + op.id + '" && date = "' + yStr + '"',
        )
      } catch (_) {
        var snap = new Record(snapCol)
        snap.set('operator', op.id)
        snap.set('date', yStr)
        snap.set('tickets_attended', tickets.length)
        snap.set('tickets_resolved', resolved.length)
        snap.set('slas_met', tickets.length - violated.length)
        snap.set('slas_violated', violated.length)
        snap.set('hours_worked', totalHours)
        snap.set('reopens', reopens.length)
        snap.set('backlog', backlog.length)
        $app.save(snap)
      }
    } catch (err) {
      $app.logger().error('Error aggregating operator ' + op.id, 'error', err.message)
    }
  }
})
