onRecordAfterUpdateSuccess(function (e) {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var fieldsToCheck = [
    'status',
    'priority',
    'impact',
    'urgency',
    'responsible',
    'root_cause_identified',
    'is_known_error',
    'effectiveness_result',
    'effectiveness_start_date',
    'effectiveness_end_date',
    'reopened_count',
    'reopen_reason',
  ]

  fieldsToCheck.forEach(function (field) {
    var oldVal = original.getString(field)
    var newVal = record.getString(field)
    if (oldVal !== newVal) {
      try {
        var auditCol = $app.findCollectionByNameOrId('problem_audit_logs')
        var log = new Record(auditCol)
        log.set('problem', record.id)
        log.set('user', e.auth ? e.auth.id : record.getString('requester'))
        log.set('action', 'Alterou ' + field + ' de "' + oldVal + '" para "' + newVal + '"')
        log.set('field', field)
        log.set('old_value', oldVal)
        log.set('new_value', newVal)
        $app.save(log)
      } catch (err) {
        $app.logger().error('problem history logger error', 'error', err.message)
      }
    }
  })

  var oldStatus = original.getString('status')
  var newStatus = record.getString('status')
  if (oldStatus !== newStatus) {
    try {
      var tlCol = $app.findCollectionByNameOrId('problem_timeline')
      var stageMap = {
        Novo: 'Abertura',
        'Em Investigação': 'Investigação',
        'Causa Identificada': 'Causa identificada',
        'Solução de Contorno Planejada': 'Solução de contorno',
        'Solução de Contorno Implantada': 'Implantação',
        'Em Análise de Efetividade': 'Análise de efetividade',
        'Análise de Efetividade Pendente': 'Análise de efetividade',
        'Avaliação Realizada': 'Avaliação',
        Encerrado: 'Encerramento',
        Reaberto: 'Reabertura',
        'Plano de Solução Definitiva': 'Solução definitiva',
      }
      var tl = new Record(tlCol)
      tl.set('problem', record.id)
      tl.set('stage', stageMap[newStatus] || newStatus)
      tl.set('status', newStatus)
      tl.set('responsible', e.auth ? e.auth.id : record.getString('responsible'))
      tl.set('event_date', new Date().toISOString())
      $app.save(tl)
    } catch (err) {
      $app.logger().error('problem timeline update error', 'error', err.message)
    }
  }

  return e.next()
}, 'problems')
