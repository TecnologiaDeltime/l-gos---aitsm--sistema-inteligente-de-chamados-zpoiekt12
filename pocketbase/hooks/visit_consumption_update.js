onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = record.getString('status')
  if (oldStatus === newStatus) return e.next()
  if (newStatus !== 'Concluída') return e.next()

  var ticketId = record.getString('ticket')
  if (!ticketId) return e.next()

  var contractId = ''
  try {
    var ticket = $app.findRecordById('tickets', ticketId)
    contractId = ticket.getString('contract')
  } catch (_) {
    return e.next()
  }
  if (!contractId) return e.next()

  var contract
  try {
    contract = $app.findRecordById('contracts', contractId)
  } catch (_) {
    return e.next()
  }

  var serviceTime = record.getInt('service_time') || 0
  var travelTimeIn = record.getInt('travel_time_in') || 0
  var travelTimeOut = record.getInt('travel_time_out') || 0
  var waitingTime = record.getInt('waiting_time') || 0

  var travelConsumes = contract.getBool('travel_consumes_hours')
  var waitingConsumes = contract.getBool('waiting_consumes_hours')

  var totalMinutes = serviceTime
  if (travelConsumes) totalMinutes += travelTimeIn + travelTimeOut
  if (waitingConsumes) totalMinutes += waitingTime

  var totalHours = totalMinutes / 60
  if (totalHours <= 0) return e.next()

  try {
    var periods = $app.findRecordsByFilter(
      'contract_periods',
      'contract = "' + contractId + '" && status = "Ativo"',
      '-period_start',
      1,
      0,
    )
    if (periods.length > 0) {
      var period = periods[0]
      var consumed = period.getFloat('consumed_hours') || 0
      period.set('consumed_hours', consumed + totalHours)
      $app.save(period)
    }
  } catch (err) {
    $app.logger().error('Error updating visit consumption', 'error', err.message)
  }

  var kmCharged = contract.getBool('km_charged')
  var mileage = record.getFloat('calculated_mileage') || 0
  if (kmCharged && mileage > 0) {
    try {
      var rates = $app.findRecordsByFilter(
        'km_rates',
        'active = true && (contract = "' + contractId + '" || contract = "")',
        '-effective_date',
        1,
        0,
      )
      if (rates.length > 0) {
        var rate = rates[0]
        var ratePerKm = rate.getFloat('rate_per_km') || 0
        var reimbAmount = mileage * ratePerKm
        record.set('reimbursement_amount', reimbAmount)
        $app.saveNoValidate(record)
      }
    } catch (_) {}
  }

  return e.next()
}, 'technical_visits')
