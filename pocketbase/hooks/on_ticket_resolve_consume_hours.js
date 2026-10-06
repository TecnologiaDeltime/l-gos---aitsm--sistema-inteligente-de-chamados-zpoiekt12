onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = record.getString('status')
  if (oldStatus === newStatus) return e.next()

  // Se passou para Resolvido e ainda não tem sla_solution_at, carimba o timestamp e encerra SLA
  if (newStatus === 'Resolvido' && !record.getString('sla_solution_at')) {
    try {
      var nowIso = new Date().toISOString()
      record.set('sla_solution_at', nowIso)
      if (!record.getString('resolution_date')) {
        record.set('resolution_date', nowIso)
      }
      // SLA Solução concluído definitivamente: calcula sla_status final
      var solDeadline = record.getString('sla_solution_deadline')
      if (solDeadline) {
        var dlTime = new Date(solDeadline).getTime()
        var finishTime = new Date(nowIso).getTime()
        if (finishTime <= dlTime) {
          record.set('sla_status', 'Dentro do Prazo')
        } else {
          record.set('sla_status', 'Violado')
        }
      }
      $app.save(record)
    } catch (_) {}
  }

  // Se o ticket foi REABERTO a partir de Resolvido/Encerrado:
  // limpa timestamps de encerramento de solução para retomar a contagem de SLA Solução
  if (newStatus === 'Reaberto' && (oldStatus === 'Resolvido' || oldStatus === 'Encerrado')) {
    try {
      record.set('sla_solution_at', '')
      record.set('resolution_date', '')
      record.set('closure_date', '')
      record.set('sla_paused', false)
      var currentReopen = record.getInt('reopen_count') || 0
      record.set('reopen_count', currentReopen + 1)

      // Recalcula o status do SLA com base no deadline de solução
      var reopenSolDeadline = record.getString('sla_solution_deadline')
      if (reopenSolDeadline) {
        var dlReopen = new Date(reopenSolDeadline).getTime()
        if (Date.now() > dlReopen) {
          record.set('sla_status', 'Violado')
        } else {
          record.set('sla_status', 'Dentro do Prazo')
        }
      } else {
        record.set('sla_status', 'Dentro do Prazo')
      }
      $app.save(record)

      // Registra no histórico do ticket a reabertura e retomada da contagem do SLA
      try {
        var reopenHistCol = $app.findCollectionByNameOrId('ticket_history')
        var reopenHist = new Record(reopenHistCol)
        reopenHist.set('ticket', record.id)
        reopenHist.set('user', e.auth ? e.auth.id : '')
        reopenHist.set('action', 'Reabertura de Chamado')
        reopenHist.set('field', 'status')
        reopenHist.set('old_value', oldStatus)
        reopenHist.set('new_value', 'Reaberto — SLA Solução retomou a contagem')
        $app.save(reopenHist)
      } catch (_) {}
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
