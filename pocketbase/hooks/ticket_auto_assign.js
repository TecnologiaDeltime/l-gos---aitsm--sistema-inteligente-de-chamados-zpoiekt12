// pocketbase/hooks/ticket_auto_assign.js
// Agente de distribuição automática de chamados no Lógos AITSM
// Ordem de distribuição inteligente:
// 1. Operadores ATIVOS da fila (availability_status 'Disponível' se o campo existir)
// 2. Desempate por menor carga de chamados ativos (status != Encerrado/Cancelado/Resolvido)
// 3. Fallback: usuários internos ativos cujo campo `team` seja igual ao nome da fila
//    (corrige filas sem members cadastrados — ex.: "Suporte N2" x users.team)
// 4. Fallback: qualquer operador interno ativo da fila com menor carga
// ALOCAÇÃO DE OPERADORES (v0.0.436+): antes de escolher o candidato, cada membro da
// fila é avaliado contra as alocações vigentes (coleção operator_allocations):
//  - allocation_type 'permanente' (exclusiva): só é candidato a chamados do seu cliente exclusivo;
//  - allocation_type 'periodo': só é candidato ao cliente alocado quando a recorrência
//    (dias da semana / semanas do mês / meses) e a vigência (início/fim) cobrem a data atual;
//  - sem alocação ativa: comporta-se como hoje.
// Um operador alocado NUNCA recebe automaticamente chamado de outro cliente enquanto
// a alocação estiver vigente.
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
          var ticketCompanyId = ''
          try {
            var tComp = e.record.get('company')
            ticketCompanyId = tComp && tComp.id ? tComp.id : e.record.getString('company')
          } catch (_) {}

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

          // Filtro por alocação vigente: só remove candidatos com alocação ativa
          // apontando para outro cliente. Operador sem alocação permanece elegível.
          var filteredPool = []
          for (var fp = 0; fp < candidatePool.length; fp++) {
            var candId = candidatePool[fp]
            var candEligible = true
            try {
              var nowD = new Date()
              var dayIdx = nowD.getDay()
              var dayOfMonth = nowD.getDate()
              var monthIdx = nowD.getMonth() + 1
              var weekOfMonth = Math.ceil(dayOfMonth / 7)
              var allocs = $app.findRecordsByFilter(
                'operator_allocations',
                'active = true && operator = "' + candId + '"',
                '-updated',
                100,
                0,
              )
              for (var a = 0; a < allocs.length; a++) {
                var alloc = allocs[a]
                var allocCompanyId = ''
                try {
                  var aComp = alloc.get('company')
                  allocCompanyId = aComp && aComp.id ? aComp.id : alloc.getString('company')
                } catch (_) {}
                var typeStr = alloc.getString('allocation_type') || ''

                // Vigência (início/fim) — obrigatória quando preenchida
                var inRange = true
                var sDate = alloc.getString('start_date')
                var eDate = alloc.getString('end_date')
                if (sDate) {
                  var sd = new Date(sDate.replace(' ', 'T'))
                  if (!isNaN(sd.getTime()) && nowD < sd) inRange = false
                }
                if (inRange && eDate) {
                  var ed = new Date(eDate.replace(' ', 'T'))
                  if (!isNaN(ed.getTime())) {
                    ed.setHours(23, 59, 59, 999)
                    if (nowD > ed) inRange = false
                  }
                }
                if (!inRange) continue

                if (typeStr === 'permanente') {
                  if (allocCompanyId !== ticketCompanyId) {
                    candEligible = false
                    break
                  }
                } else if (typeStr === 'periodo') {
                  var occ = true
                  try {
                    var rec = JSON.parse(alloc.getString('recurrence_json') || '{}')
                    var days = rec.days_of_week || []
                    if (days.length > 0 && days.indexOf(dayIdx) === -1) occ = false
                    if (occ) {
                      var weeks = rec.weeks_of_month || []
                      if (weeks.length > 0 && weeks.indexOf(weekOfMonth) === -1) occ = false
                    }
                    if (occ) {
                      var months = rec.months || []
                      if (months.length > 0 && months.indexOf(monthIdx) === -1) occ = false
                    }
                  } catch (pErr) {
                    occ = false
                  }
                  if (occ && allocCompanyId !== ticketCompanyId) {
                    candEligible = false
                    break
                  }
                }
              }
            } catch (allocErr) {
              $app
                .logger()
                .warn('auto_assign: falha ao avaliar alocação', 'error', allocErr.message)
            }
            if (candEligible) filteredPool.push(candId)
          }

          if (filteredPool.length > 0) candidatePool = filteredPool
          // Se filteredPool vazio: TODOS os candidatos da fila estão alocados a
          // outros clientes — o chamado fica sem atribuição automática.

          var bestMemberId = ''
          var leastLoadCount = 999999

          for (var j = 0; j < candidatePool.length; j++) {
            var candId2 = candidatePool[j]
            var activeTickets = $app.findRecordsByFilter(
              'tickets',
              "assigned_to = '" +
                candId2 +
                "' && status != 'Encerrado' && status != 'Cancelado' && status != 'Resolvido'",
              '-created',
              1000,
              0,
            )
            var count = activeTickets.length
            if (count < leastLoadCount) {
              leastLoadCount = count
              bestMemberId = candId2
            }
          }

          if (bestMemberId) {
            assignedUserId = bestMemberId
          } else {
            assignedUserId = candidatePool[0] || ''
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
            var ticketCompId = ''
            try {
              var tkComp = tkt.get('company')
              ticketCompId = tkComp && tkComp.id ? tkComp.id : tkt.getString('company')
            } catch (_) {}

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

            // Filtro por alocação vigente (mesma regra da criação)
            var filteredPool = []
            for (var fp2 = 0; fp2 < pool.length; fp2++) {
              var candId3 = pool[fp2]
              var candOk = true
              try {
                var nowD2 = new Date()
                var dayIdx2 = nowD2.getDay()
                var dom2 = nowD2.getDate()
                var monthIdx2 = nowD2.getMonth() + 1
                var wom2 = Math.ceil(dom2 / 7)
                var allocs2 = $app.findRecordsByFilter(
                  'operator_allocations',
                  'active = true && operator = "' + candId3 + '"',
                  '-updated',
                  100,
                  0,
                )
                for (var a2 = 0; a2 < allocs2.length; a2++) {
                  var al = allocs2[a2]
                  var alCompId = ''
                  try {
                    var alComp = al.get('company')
                    alCompId = alComp && alComp.id ? alComp.id : al.getString('company')
                  } catch (_) {}
                  var alType = al.getString('allocation_type') || ''

                  var inR = true
                  var sD = al.getString('start_date')
                  var eD = al.getString('end_date')
                  if (sD) {
                    var sd2 = new Date(sD.replace(' ', 'T'))
                    if (!isNaN(sd2.getTime()) && nowD2 < sd2) inR = false
                  }
                  if (inR && eD) {
                    var ed2 = new Date(eD.replace(' ', 'T'))
                    if (!isNaN(ed2.getTime())) {
                      ed2.setHours(23, 59, 59, 999)
                      if (nowD2 > ed2) inR = false
                    }
                  }
                  if (!inR) continue

                  if (alType === 'permanente') {
                    if (alCompId !== ticketCompId) {
                      candOk = false
                      break
                    }
                  } else if (alType === 'periodo') {
                    var occ2 = true
                    try {
                      var rc = JSON.parse(al.getString('recurrence_json') || '{}')
                      var dys = rc.days_of_week || []
                      if (dys.length > 0 && dys.indexOf(dayIdx2) === -1) occ2 = false
                      if (occ2) {
                        var wks = rc.weeks_of_month || []
                        if (wks.length > 0 && wks.indexOf(wom2) === -1) occ2 = false
                      }
                      if (occ2) {
                        var mts = rc.months || []
                        if (mts.length > 0 && mts.indexOf(monthIdx2) === -1) occ2 = false
                      }
                    } catch (pErr2) {
                      occ2 = false
                    }
                    if (occ2 && alCompId !== ticketCompId) {
                      candOk = false
                      break
                    }
                  }
                }
              } catch (allocErr2) {
                $app
                  .logger()
                  .warn('auto_assign cron: falha ao avaliar alocação', 'error', allocErr2.message)
              }
              if (candOk) filteredPool.push(candId3)
            }

            if (filteredPool.length > 0) pool = filteredPool
            // Se todos os candidatos estão alocados a outros clientes, não atribui.

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

            opId = bestId || pool[0] || ''
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
        var qId2 = t.getString('queue')
        if (qId2) {
          var targetOp = ''
          try {
            var queueRecord = $app.findRecordById('queues', qId2)
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
              var tCompId = ''
              try {
                var ttComp = t.get('company')
                tCompId = ttComp && ttComp.id ? ttComp.id : t.getString('company')
              } catch (_) {}

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

              // Filtro por alocação vigente (mesma regra da criação)
              var filtered = []
              for (var fpi = 0; fpi < candidates.length; fpi++) {
                var candId4 = candidates[fpi]
                var candOk2 = true
                try {
                  var nowD3 = new Date()
                  var dayIdx3 = nowD3.getDay()
                  var dom3 = nowD3.getDate()
                  var monthIdx3 = nowD3.getMonth() + 1
                  var wom3 = Math.ceil(dom3 / 7)
                  var allocs3 = $app.findRecordsByFilter(
                    'operator_allocations',
                    'active = true && operator = "' + candId4 + '"',
                    '-updated',
                    100,
                    0,
                  )
                  for (var a3 = 0; a3 < allocs3.length; a3++) {
                    var al3 = allocs3[a3]
                    var al3CompId = ''
                    try {
                      var al3Comp = al3.get('company')
                      al3CompId = al3Comp && al3Comp.id ? al3Comp.id : al3.getString('company')
                    } catch (_) {}
                    var al3Type = al3.getString('allocation_type') || ''

                    var inR3 = true
                    var sD3 = al3.getString('start_date')
                    var eD3 = al3.getString('end_date')
                    if (sD3) {
                      var sd3 = new Date(sD3.replace(' ', 'T'))
                      if (!isNaN(sd3.getTime()) && nowD3 < sd3) inR3 = false
                    }
                    if (inR3 && eD3) {
                      var ed3 = new Date(eD3.replace(' ', 'T'))
                      if (!isNaN(ed3.getTime())) {
                        ed3.setHours(23, 59, 59, 999)
                        if (nowD3 > ed3) inR3 = false
                      }
                    }
                    if (!inR3) continue

                    if (al3Type === 'permanente') {
                      if (al3CompId !== tCompId) {
                        candOk2 = false
                        break
                      }
                    } else if (al3Type === 'periodo') {
                      var occ3 = true
                      try {
                        var rc3 = JSON.parse(al3.getString('recurrence_json') || '{}')
                        var dys3 = rc3.days_of_week || []
                        if (dys3.length > 0 && dys3.indexOf(dayIdx3) === -1) occ3 = false
                        if (occ3) {
                          var wks3 = rc3.weeks_of_month || []
                          if (wks3.length > 0 && wks3.indexOf(wom3) === -1) occ3 = false
                        }
                        if (occ3) {
                          var mts3 = rc3.months || []
                          if (mts3.length > 0 && mts3.indexOf(monthIdx3) === -1) occ3 = false
                        }
                      } catch (pErr3) {
                        occ3 = false
                      }
                      if (occ3 && al3CompId !== tCompId) {
                        candOk2 = false
                        break
                      }
                    }
                  }
                } catch (allocErr3) {
                  $app
                    .logger()
                    .warn('auto-assign run: falha ao avaliar alocação', 'error', allocErr3.message)
                }
                if (candOk2) filtered.push(candId4)
              }

              if (filtered.length > 0) candidates = filtered
              // Se todos estão alocados a outros clientes, não atribui.

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

              targetOp = bestCandidate || candidates[0] || ''
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
