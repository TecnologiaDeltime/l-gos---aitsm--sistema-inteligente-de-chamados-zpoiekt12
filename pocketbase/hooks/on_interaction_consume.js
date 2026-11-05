onRecordAfterCreateSuccess((e) => {
  var record = e.record

  // Regra de horas ITSM:
  // - Horas de acompanhamento (logs/interações manuais) são debitadas da franquia do cliente.
  // - Tempo registrado via play/pause (origin = 'Cronômetro') é de trabalho do operador e NÃO debita da franquia.
  var origin = record.getString('origin')
  if (origin === 'Cronômetro') return e.next()

  var hourType = record.getString('hour_type')
  if (hourType !== 'Contratada') return e.next()

  var duration = record.getFloat('duration_minutes') || 0
  if (duration <= 0) return e.next()

  var ticketId = record.getString('ticket')
  if (!ticketId) return e.next()

  try {
    var ticket = $app.findRecordById('tickets', ticketId)
    // Chamado interno NÃO consome franquia de horas de cliente
    if (ticket.getBool('is_internal')) return e.next()

    var contractId = ticket.getString('contract')
    if (!contractId) return e.next()

    var periods = $app.findRecordsByFilter(
      'contract_periods',
      'contract = "' + contractId + '" && status = "Ativo"',
      '-period_start',
      1,
      0,
    )
    if (periods.length === 0) return e.next()

    var period = periods[0]
    var consumed = period.getFloat('consumed_hours') || 0
    var hoursToAdd = duration / 60
    var newConsumed = Number((consumed + hoursToAdd).toFixed(4))
    period.set('consumed_hours', newConsumed)
    $app.save(period)

    // Sincroniza também o campo accompaniment_seconds no chamado caso ainda não esteja somado
    try {
      var durationSec = Math.round(duration * 60)
      var currentAcc = ticket.getInt('accompaniment_seconds') || 0
      ticket.set('accompaniment_seconds', currentAcc + durationSec)
      $app.save(ticket)
    } catch (_) {}

    var auditCol = $app.findCollectionByNameOrId('audit_logs')
    var audit = new Record(auditCol)
    audit.set('user', record.getString('author'))
    audit.set('action', 'Consumo de horas')
    audit.set('entity_type', 'contract_period')
    audit.set('entity_id', period.id)
    audit.set('description', 'Deducao de ' + hoursToAdd.toFixed(2) + 'h via interacao ' + record.id)
    audit.set('old_values', JSON.stringify({ consumed_hours: consumed }))
    audit.set('new_values', JSON.stringify({ consumed_hours: newConsumed }))
    $app.save(audit)
  } catch (err) {
    $app.logger().error('Error consuming contract hours on interaction', 'error', err.message)
  }

  return e.next()
}, 'ticket_interactions')
