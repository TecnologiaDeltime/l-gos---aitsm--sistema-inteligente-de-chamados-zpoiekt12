migrate(
  (app) => {
    // Migração 0108: Backfill idempotente da regra de horas ITSM
    // Regra:
    // 1. Horas de acompanhamento (logs/interações manuais com origin != 'Cronômetro' e hour_type = 'Contratada')
    //    devem ser debitadas da franquia do cliente (contract_periods.consumed_hours) e alimentar tickets.accompaniment_seconds.
    // 2. Tempo registrado via play/pause (origin = 'Cronômetro')
    //    deve ser acrescido nas horas de trabalho do operador (tickets.operator_worked_seconds e work_hours)
    //    e NÃO debita da franquia do cliente.
    // 3. Idempotente: recalcula os totais derivados a partir das fontes (ticket_interactions),
    //    garantindo que reaplicações produzam exatamente o mesmo estado sem duplicar.

    var hasInteractions = app.hasTable('ticket_interactions')
    var hasTickets = app.hasTable('tickets')
    var hasContractPeriods = app.hasTable('contract_periods')
    if (!hasInteractions || !hasTickets) return

    // 1. Recalcular tickets.accompaniment_seconds para cada ticket com base nas interações de acompanhamento
    // origin != 'Cronômetro' (Manual/Automático/etc)
    var ticketList = app.findRecordsByFilter('tickets', 'id != ""', '', 0, 0)
    for (var i = 0; i < ticketList.length; i++) {
      var t = ticketList[i]
      var tId = t.id

      // Acompanhamento: origin != 'Cronômetro'
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

      // Horas trabalhadas pelo operador: origin = 'Cronômetro'
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

      // Se o ticket já possuía operator_worked_seconds maior que a soma das interações cronômetro
      // (por exemplo, ciclos que fecharam direto no ticket ou foram persistidos sem log), preserva o maior valor
      var currentWorkedSeconds = t.getInt('operator_worked_seconds') || 0
      var finalWorkedSeconds = Math.max(currentWorkedSeconds, totalCronoSeconds)

      t.set('operator_worked_seconds', finalWorkedSeconds)
      t.set('work_hours', Number((finalWorkedSeconds / 3600).toFixed(4)))
      app.save(t)
    }

    // 2. Recalcular contract_periods.consumed_hours para cada período ativo
    // O consumo da franquia do cliente é formado estritamente pelas interações de acompanhamento
    // (hour_type = 'Contratada' && origin != 'Cronômetro' && duration_minutes > 0)
    if (hasContractPeriods) {
      var periods = app.findRecordsByFilter('contract_periods', 'status = "Ativo"', '', 0, 0)
      for (var p = 0; p < periods.length; p++) {
        var period = periods[p]
        var contractId = period.getString('contract')
        if (!contractId) continue

        // Localiza todos os tickets vinculados a este contrato
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

    // 3. Recalcular operator_daily_snapshots para que hours_worked reflita apenas horas de Cronômetro
    if (app.hasTable('operator_daily_snapshots')) {
      var snapshots = app.findRecordsByFilter('operator_daily_snapshots', 'id != ""', '', 0, 0)
      for (var s = 0; s < snapshots.length; s++) {
        var snap = snapshots[s]
        var opId = snap.getString('operator')
        var dateStr = snap.getString('date')
        if (!opId || !dateStr) continue

        var dayKey = dateStr.slice(0, 10)
        var dayStart = dayKey + ' 00:00:00.000Z'
        var dayEnd = dayKey + ' 23:59:59.000Z'

        var opCronoInteractions = app.findRecordsByFilter(
          'ticket_interactions',
          'author = "' +
            opId +
            '" && origin = "Cronômetro" && created >= "' +
            dayStart +
            '" && created <= "' +
            dayEnd +
            '"',
          '',
          0,
          0,
        )

        var opTotalHours = 0
        for (var oj = 0; oj < opCronoInteractions.length; oj++) {
          opTotalHours += (opCronoInteractions[oj].getFloat('duration_minutes') || 0) / 60
        }

        snap.set('hours_worked', Number(opTotalHours.toFixed(4)))
        app.save(snap)
      }
    }
  },
  (app) => {
    // Rollback no-op ou seguro: os campos permanecem e a lógica é idempotente
  },
)
