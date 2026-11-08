// pocketbase/hooks/ticket_auto_assign.js
// Agente de distribuição automática de chamados no Lógos AITSM
// Ordem de distribuição inteligente:
// 1. Operadores ATIVOS da fila (availability_status 'Disponível' se o campo existir)
// 2. Desempate por menor carga de chamados ativos (status != Encerrado/Cancelado/Resolvido)
// 3. Fallback: usuários internos ativos cujo campo `team` seja igual ao nome da fila
//    (corrige filas sem members cadastrados — ex.: "Suporte N2" x users.team)
// 4. Fallback: qualquer operador interno ativo da fila com menor carga
// NOTAS (bugs corrigidos):
// - A coleção `queues` NÃO possui campo `manager`: ler queue.getString('manager')
//   retornava vazio e, com members vazio, nenhum candidato era encontrado.
// - O campo `availability_status` NÃO existe em users (o correto é `active` bool);
//   o filtro antigo considerava todos disponíveis por padrão, mas o pool vinha vazio.
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

        // Fallback quando a fila não tem members: operadores internos ativos
        // cujo campo team corresponde ao nome da fila.
        if (!members || members.length === 0) {
          try {
            var teamFallback = $app.findRecordsByFilter(
              'users',
              'active = true && team = "' + queue.getString('name').replace(/"/g, '\\"') + '"',
              '-created',
              50,
              0,
            )
            var teamIds = []
            for (var tf = 0; tf < teamFallback.length; tf++) teamIds.push(teamFallback[tf].id)
            if (teamIds.length > 0) {
              $app
                .logger()
                .info(
                  'auto_assign: fila sem members, usando fallback por team',
                  'queue',
                  queue.getString('name'),
                  'found',
                  teamIds.length,
                )
            }
            members = teamIds
          } catch (tfErr) {
            $app.logger().warn('auto_assign: fallback por team falhou', 'error', tfErr.message)
          }
        }

        if (members && members.length > 0) {
          var availableMembers = []
          var otherMembers = []

          for (var i = 0; i < members.length; i++) {
            var memberId = members[i]
            try {
              var userRec = $app.findRecordById('users', memberId)
              if (userRec.getBool('active') === false) continue
              // O campo availability_status não existe em users; se um dia for
              // adicionado, é respeitado. Default: Disponível.
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

          var candidatePool = availableMembers.length > 0 ? availableMembers : otherMembers
          if (candidatePool.length === 0) candidatePool = members

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

        $app
          .logger()
          .info(
            'auto_assign: chamado atribuído na criação',
            'ticket',
            e.record.id,
            'operator',
            assignedUserId,
          )
        return e.next()
      }

      $app
        .logger()
        .warn(
          'auto_assign: nenhum candidato encontrado na criação',
          'ticket',
          e.record.id,
          'queue',
          queueId,
        )
      e.record.set('status', 'Aguardando Atribuição')
    }
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

          // Fallback por team quando a fila não tem members
          if (!mList || mList.length === 0) {
            try {
              var teamUsers = $app.findRecordsByFilter(
                'users',
                'active = true && team = "' + q.getString('name').replace(/"/g, '\\"') + '"',
                '-created',
                50,
                0,
              )
              mList = teamUsers.map(function (u) {
                return u.id
              })
            } catch (_) {}
          }

          if (mList && mList.length > 0) {
            var availList = []
            var othersList = []
            for (var m = 0; m < mList.length; m++) {
              try {
                var u = $app.findRecordById('users', mList[m])
                if (u.getBool('active') === false) continue
                var aStat = u.getString('availability_status') || 'Disponível'
                if (aStat === 'Disponível' || aStat === 'disponivel') {
                  availList.push(mList[m])
                } else {
                  othersList.push(mList[m])
                }
              } catch (_) {}
            }

            var pool = availList.length > 0 ? availList : othersList
            if (pool.length === 0) pool = mList
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

            opId = bestId || mList[0] || ''
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

          $app
            .logger()
            .info('auto_assign cron: chamado atribuído', 'ticket', tkt.id, 'operator', opId)
        } else {
          $app
            .logger()
            .warn('auto_assign cron: nenhum candidato para a fila', 'ticket', tkt.id, 'queue', qId)
        }
      }
    }
  } catch (cronErr) {
    $app.logger().error('ticket_auto_assign_cron error', 'error', cronErr.message)
  }
})

// 3. Endpoint para reavaliação imediata via API (botão "Executar agora")
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

            // Fallback por team quando a fila não tem members
            if (!mems || mems.length === 0) {
              try {
                var tfUsers = $app.findRecordsByFilter(
                  'users',
                  'active = true && team = "' +
                    queueRecord.getString('name').replace(/"/g, '\\"') +
                    '"',
                  '-created',
                  50,
                  0,
                )
                mems = tfUsers.map(function (u) {
                  return u.id
                })
              } catch (_) {}
            }

            if (mems && mems.length > 0) {
              var avails = []
              var others = []
              for (var mi = 0; mi < mems.length; mi++) {
                try {
                  var usr = $app.findRecordById('users', mems[mi])
                  if (usr.getBool('active') === false) continue
                  var st = usr.getString('availability_status') || 'Disponível'
                  if (st === 'Disponível' || st === 'disponivel') {
                    avails.push(mems[mi])
                  } else {
                    others.push(mems[mi])
                  }
                } catch (_) {}
              }

              var candidates = avails.length > 0 ? avails : others
              if (candidates.length === 0) candidates = mems
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

              targetOp = bestCandidate || mems[0] || ''
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
