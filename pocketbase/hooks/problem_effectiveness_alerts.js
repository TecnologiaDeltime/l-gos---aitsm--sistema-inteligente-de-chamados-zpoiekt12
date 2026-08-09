onRecordAfterUpdateSuccess(function (e) {
  var record = e.record
  var status = record.getString('status')
  var endDateStr = record.getString('effectiveness_end_date')
  if (!endDateStr) return e.next()

  if (status === 'Solução de Contorno Implantada') {
    try {
      var days = record.getInt('effectiveness_period_days') || 15
      var start = new Date()
      var end = new Date(start.getTime() + days * 86400000)
      var updated = $app.findRecordById('problems', record.id)
      updated.set('status', 'Em Análise de Efetividade')
      updated.set('effectiveness_start_date', start.toISOString())
      updated.set('effectiveness_end_date', end.toISOString())
      $app.save(updated)
    } catch (err) {
      $app.logger().error('problem effectiveness auto-start error', 'error', err.message)
    }
  }

  if (
    endDateStr &&
    (status === 'Em Análise de Efetividade' || status === 'Análise de Efetividade Pendente')
  ) {
    var endDate = new Date(endDateStr)
    var now = new Date()
    var diffDays = Math.ceil((endDate - now) / 86400000)
    var prbNumber = record.getString('number')
    var responsibleId = record.getString('responsible') || record.getString('requester')

    var alerts = [
      {
        days: 7,
        msg: 'Problema ' + prbNumber + ' entrará na etapa final da análise de efetividade.',
      },
      {
        days: 3,
        msg: 'Problema ' + prbNumber + ' possui avaliação de efetividade próxima do vencimento.',
      },
      {
        days: 0,
        msg: 'A avaliação de efetividade do problema ' + prbNumber + ' deve ser realizada hoje.',
      },
    ]

    alerts.forEach(function (a) {
      if (diffDays === a.days && responsibleId) {
        try {
          var notifCol = $app.findCollectionByNameOrId('notifications')
          var n = new Record(notifCol)
          n.set('user', responsibleId)
          n.set('title', 'Alerta de Efetividade')
          n.set('message', a.msg)
          n.set('type', 'Alerta')
          n.set('read', false)
          $app.save(n)
        } catch (_) {}
      }
    })

    if (diffDays <= 0 && status === 'Em Análise de Efetividade') {
      try {
        var updated2 = $app.findRecordById('problems', record.id)
        updated2.set('status', 'Análise de Efetividade Pendente')
        $app.save(updated2)
      } catch (_) {}
    }
  }

  return e.next()
}, 'problems')
