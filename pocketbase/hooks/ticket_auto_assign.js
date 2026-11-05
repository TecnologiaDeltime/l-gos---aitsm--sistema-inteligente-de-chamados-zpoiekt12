// pocketbase/hooks/ticket_auto_assign.js
// Agente de distribuição automática de chamados no Lógos AITSM
// Ordem de distribuição inteligente:
// 1. Operador com availability_status 'Disponível' na fila
// 2. Desempate por menor carga de chamados ativos (status != Encerrado/Cancelado/Resolvido)
// 3. Ocioso (sem chamados ativos ou mais tempo sem novo chamado)
// 4. Fallback: Responsável / Líder da fila (queue.manager)
// IMPORTANTE: Toda lógica embutida inline nas callbacks (regra JSVM do PocketBase)

// 1. Hook ao criar chamado (se não tiver assigned_to)
onRecordCreate((e) => {
  if (e.record.getString('assigned_to')) return e.next()

  var queueId = e.record.getString('queue')

  try {
    var isEnabled = true
    try {
      var settingsRec = $app.findFirstRecordByFilter('system_settings', 'key = "global"', '', 0, 0)
      if (settingsRec && settingsRec.getBool('auto_assign_enabled') === false) {
        isEnabled = false
      }
    } catch (_) {}

    if (isEnabled && queueId) {
      var assignedUserId = ''
      try {
        var queue = $app.findRecordById('queues', queueId)
        var members = queue.get('members') || []
        var managerId = queue.getString('manager')

        if (!members || members.length === 0) {
          assignedUserId = managerId || ''
        } else {
          var availableMembers = []
          var otherMembers = []

          for (var i = 0; i < members.length; i++) {
            var memberId = members[i]
            try {
              var userRec = $app.findRecordById('users', memberId)
              var avail = userRec.getString('availability_status') || 'Disponível'
              if (avail === 'Disponível' || avail === 'disponivel') {
                availableMembers.push(memberId)
              } else {
                otherMembers.push(memberId)
              }
            } catch (_) {
              otherMembers.push(memberId)
            }
          }

          var candidatePool = availableMembers.length > 0 ? availableMembers : members
          var bestMemberId = ''
          var leastLoadCount = 999999

          for (var j = 0; j < candidatePool.length; j++) {
            var candId = candidatePool[j]
            var activeTickets = $app.findRecordsByFilter(
              'tickets',
              "assigned_to = '" +
                candId +
                "' && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
              '-created',
              1000,
              0,
            )
            var count = activeTickets.length
            if (count < leastLoadCount) {
              leastLoadCount = count
              bestMemberId = candId
            }
          }

          if (bestMemberId) {
            assignedUserId = bestMemberId
          } else if (managerId) {
            assignedUserId = managerId
          } else {
            assignedUserId = members[0] || ''
          }
        }
      } catch (findErr) {
        $app
          .logger()
          .error('auto_assign onRecordCreate find member error', 'error', findErr.message)
      }

      if (assignedUserId) {
        e.record.set('assigned_to', assignedUserId)
        e.record.set('status', 'Atribuído')

        try {
          var interCol = $app.findCollectionByNameOrId('ticket_interactions')
          var interRec = new Record(interCol)
          interRec.set('ticket', e.record.id)
          interRec.set('type', 'Interno')
          interRec.set('origin', 'Automático')
          interRec.set(
            'content',
            '🤖 Chamado distribuído automaticamente pelo Agente de Distribuição (critério: Disponibilidade / Menor Volume / Líder da Fila).',
          )
          $app.save(interRec)
        } catch (_) {}

        return e.next()
      }
    }

    e.record.set('status', 'Aguardando Atribuição')
  } catch (err) {
    $app.logger().error('ticket_auto_assign onRecordCreate failed', 'error', err.message)
    e.record.set('status', 'Aguardando Atribuição')
  }

  return e.next()
}, 'tickets')

// 2. Cron agendado reavaliando chamados sem operador
// Executado a cada minuto (* * * * *), avaliando o intervalo configurável (auto_assign_interval_minutes, default: 5 min)
cronAdd('ticket_auto_assign_cron', '* * * * *', () => {
  try {
    var isEnabled = true
    var intervalMinutes = 5
    try {
      var settingsRec = $app.findFirstRecordByFilter('system_settings', 'key = "global"', '', 0, 0)
      if (settingsRec) {
        if (settingsRec.getBool('auto_assign_enabled') === false) {
          isEnabled = false
        }
        var customInterval = settingsRec.getInt('auto_assign_interval_minutes')
        if (customInterval && customInterval >= 1) {
          intervalMinutes = customInterval
        }
      }
    } catch (_) {}

    if (!isEnabled) return

    // Throttle baseado no intervalo em minutos
    var currentMinute = new Date().getMinutes()
    if (intervalMinutes > 1 && currentMinute % intervalMinutes !== 0) {
      return
    }

    var unassignedTickets = $app.findRecordsByFilter(
      'tickets',
      "(assigned_to = '' || assigned_to = null) && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
      'created',
      50,
      0,
    )

    for (var k = 0; k < unassignedTickets.length; k++) {
      var tkt = unassignedTickets[k]
      var qId = tkt.getString('queue')
      if (qId) {
        var opId = ''
        try {
          var q = $app.findRecordById('queues', qId)
          var mList = q.get('members') || []
          var mManager = q.getString('manager')

          if (!mList || mList.length === 0) {
            opId = mManager || ''
          } else {
            var availList = []
            for (var m = 0; m < mList.length; m++) {
              try {
                var u = $app.findRecordById('users', mList[m])
                var aStat = u.getString('availability_status') || 'Disponível'
                if (aStat === 'Disponível' || aStat === 'disponivel') {
                  availList.push(mList[m])
                }
              } catch (_) {}
            }

            var pool = availList.length > 0 ? availList : mList
            var bestId = ''
            var minCount = 999999

            for (var p = 0; p < pool.length; p++) {
              var cand = pool[p]
              var actives = $app.findRecordsByFilter(
                'tickets',
                "assigned_to = '" +
                  cand +
                  "' && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
                '-created',
                1000,
                0,
              )
              if (actives.length < minCount) {
                minCount = actives.length
                bestId = cand
              }
            }

            opId = bestId || mManager || mList[0] || ''
          }
        } catch (_) {}

        if (opId) {
          tkt.set('assigned_to', opId)
          if (
            tkt.getString('status') === 'Aguardando Atribuição' ||
            tkt.getString('status') === 'Novo'
          ) {
            tkt.set('status', 'Atribuído')
          }
          $app.save(tkt)

          try {
            var iCol = $app.findCollectionByNameOrId('ticket_interactions')
            var iRec = new Record(iCol)
            iRec.set('ticket', tkt.id)
            iRec.set('type', 'Interno')
            iRec.set('origin', 'Automático')
            iRec.set(
              'content',
              '🤖 Chamado atribuído pela rotina periódica do Agente de Distribuição Automática.',
            )
            $app.save(iRec)
          } catch (_) {}
        }
      }
    }
  } catch (cronErr) {
    $app.logger().error('ticket_auto_assign_cron error', 'error', cronErr.message)
  }
})

// 3. Endpoint para reavaliação imediata via API
routerAdd(
  'POST',
  '/backend/v1/tickets/auto-assign/run',
  (e) => {
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var countAssigned = 0
    try {
      var unassigned = $app.findRecordsByFilter(
        'tickets',
        "(assigned_to = '' || assigned_to = null) && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
        'created',
        100,
        0,
      )

      for (var i = 0; i < unassigned.length; i++) {
        var t = unassigned[i]
        var qId = t.getString('queue')
        if (qId) {
          var targetOp = ''
          try {
            var queueRecord = $app.findRecordById('queues', qId)
            var mems = queueRecord.get('members') || []
            var mgr = queueRecord.getString('manager')

            if (mems && mems.length > 0) {
              var avails = []
              for (var mi = 0; mi < mems.length; mi++) {
                try {
                  var usr = $app.findRecordById('users', mems[mi])
                  var st = usr.getString('availability_status') || 'Disponível'
                  if (st === 'Disponível' || st === 'disponivel') {
                    avails.push(mems[mi])
                  }
                } catch (_) {}
              }

              var candidates = avails.length > 0 ? avails : mems
              var bestCandidate = ''
              var lowestLoad = 999999

              for (var ci = 0; ci < candidates.length; ci++) {
                var cId = candidates[ci]
                var actTickets = $app.findRecordsByFilter(
                  'tickets',
                  "assigned_to = '" +
                    cId +
                    "' && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
                  '-created',
                  1000,
                  0,
                )
                if (actTickets.length < lowestLoad) {
                  lowestLoad = actTickets.length
                  bestCandidate = cId
                }
              }

              targetOp = bestCandidate || mgr || mems[0] || ''
            } else {
              targetOp = mgr || ''
            }
          } catch (_) {}

          if (targetOp) {
            t.set('assigned_to', targetOp)
            if (
              t.getString('status') === 'Aguardando Atribuição' ||
              t.getString('status') === 'Novo'
            ) {
              t.set('status', 'Atribuído')
            }
            $app.save(t)
            countAssigned++
          }
        }
      }

      return e.json(200, {
        success: true,
        assigned_count: countAssigned,
        total_evaluated: unassigned.length,
      })
    } catch (err) {
      return e.json(500, { error: err.message })
    }
  },
  $apis.requireAuth(),
)
