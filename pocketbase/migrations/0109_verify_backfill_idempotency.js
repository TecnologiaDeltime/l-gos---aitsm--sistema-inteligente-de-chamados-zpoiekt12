migrate(
  (app) => {
    // Migração 0109: Verificação e reforço idempotente do backfill da regra de horas
    // Reexecuta o mesmo cálculo idempotente para comprovar que reexecuções
    // NÃO duplicam saldos nem alteram valores previamente estabilizados.
    var hasInteractions = app.hasTable('ticket_interactions')
    var hasTickets = app.hasTable('tickets')
    var hasContractPeriods = app.hasTable('contract_periods')
    if (!hasInteractions || !hasTickets) return

    var ticketList = app.findRecordsByFilter('tickets', 'id != ""', '', 0, 0)
    for (var i = 0; i < ticketList.length; i++) {
      var t = ticketList[i]
      var tId = t.id

      var accInteractions = app.findRecordsByFilter(
        'ticket_interactions',
        'ticket = "' + tId + '" && origin != "Cronômetro"',
        '',
        0,
        0,
      )
      var totalAccMinutes = 0
      for (var a = 0; a < accInteractions.length; a++) {
        totalAccMinutes += accInteractions[a].getFloat('duration_minutes') || 0
      }
      var totalAccSeconds = Math.round(totalAccMinutes * 60)
      t.set('accompaniment_seconds', totalAccSeconds)

      var cronoInteractions = app.findRecordsByFilter(
        'ticket_interactions',
        'ticket = "' + tId + '" && origin = "Cronômetro"',
        '',
        0,
        0,
      )
      var totalCronoMinutes = 0
      for (var c = 0; c < cronoInteractions.length; c++) {
        totalCronoMinutes += cronoInteractions[c].getFloat('duration_minutes') || 0
      }
      var totalCronoSeconds = Math.round(totalCronoMinutes * 60)

      var currentWorkedSeconds = t.getInt('operator_worked_seconds') || 0
      var finalWorkedSeconds = Math.max(currentWorkedSeconds, totalCronoSeconds)

      t.set('operator_worked_seconds', finalWorkedSeconds)
      t.set('work_hours', Number((finalWorkedSeconds / 3600).toFixed(4)))
      app.save(t)
    }

    if (hasContractPeriods) {
      var periods = app.findRecordsByFilter('contract_periods', 'status = "Ativo"', '', 0, 0)
      for (var p = 0; p < periods.length; p++) {
        var period = periods[p]
        var contractId = period.getString('contract')
        if (!contractId) continue

        var contractTickets = app.findRecordsByFilter(
          'tickets',
          'contract = "' + contractId + '"',
          '',
          0,
          0,
        )

        var totalConsumedHours = 0
        for (var tk = 0; tk < contractTickets.length; tk++) {
          var tkId = contractTickets[tk].id
          var tkInteractions = app.findRecordsByFilter(
            'ticket_interactions',
            'ticket = "' +
              tkId +
              '" && hour_type = "Contratada" && origin != "Cronômetro" && duration_minutes > 0',
            '',
            0,
            0,
          )
          for (var ti = 0; ti < tkInteractions.length; ti++) {
            var durMin = tkInteractions[ti].getFloat('duration_minutes') || 0
            totalConsumedHours += durMin / 60
          }
        }

        var normalizedConsumed = Number(totalConsumedHours.toFixed(4))
        period.set('consumed_hours', normalizedConsumed)
        app.save(period)
      }
    }
  },
  (app) => {},
)
