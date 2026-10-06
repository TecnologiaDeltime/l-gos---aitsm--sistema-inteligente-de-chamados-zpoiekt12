onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = record.getString('status')
  if (oldStatus === newStatus) return e.next()

  // Se passou para Resolvido e ainda não tem sla_solution_at, carimba o timestamp
  if (newStatus === 'Resolvido' && !record.getString('sla_solution_at')) {
    try {
      var nowIso = new Date().toISOString()
      record.set('sla_solution_at', nowIso)
      if (!record.getString('resolution_date')) {
        record.set('resolution_date', nowIso)
      }
      $app.save(record)
    } catch (_) {}
  }

  if (newStatus !== 'Resolvido' && newStatus !== 'Encerrado') return e.next()
  if (oldStatus === 'Resolvido' || oldStatus === 'Encerrado') return e.next()

  var contractId = record.getString('contract')
  if (!contractId) return e.next()

  var workHours = record.getInt('work_hours') || 0
  if (workHours <= 0) return e.next()

  try {
    var contract = $app.findRecordById('contracts', contractId)
    var contractType = contract.getString('type')
    var hourBasedTypes = ['Pacote Mensal', 'Pacote de Horas', 'Sustentação Mensal', 'Híbrido']
    if (hourBasedTypes.indexOf(contractType) === -1) return e.next()

    var currentHours = contract.getInt('monthly_hours') || 0
    var newHours = currentHours - workHours
    if (newHours < 0) newHours = 0
    contract.set('monthly_hours', newHours)
    $app.save(contract)
  } catch (err) {
    $app.logger().error('Error consuming contract hours', 'error', err.message)
  }

  return e.next()
}, 'tickets')
