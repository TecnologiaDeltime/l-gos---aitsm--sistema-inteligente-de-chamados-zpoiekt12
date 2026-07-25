onRecordAfterCreateSuccess((e) => {
  var contract = e.record
  var monthlyHours = contract.getFloat('monthly_hours') || 0
  var startDate = contract.getString('start_date')

  try {
    var periodsCol = $app.findCollectionByNameOrId('contract_periods')
    var period = new Record(periodsCol)
    period.set('contract', contract.id)
    period.set('period_start', startDate || new Date().toISOString().slice(0, 10))
    period.set('contracted_hours', monthlyHours)
    period.set('consumed_hours', 0)
    period.set('status', 'Ativo')
    period.set('cycle_number', 1)
    $app.save(period)
  } catch (err) {
    $app.logger().error('Error creating contract period', 'error', err.message)
  }

  return e.next()
}, 'contracts')
