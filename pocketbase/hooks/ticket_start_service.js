routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/start',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var ticket = $app.findRecordById('tickets', id)

    var existingStart = ticket.getString('sla_response_start')
    if (existingStart) {
      return e.json(400, { error: 'Atendimento já iniciado' })
    }

    var now = new Date().toISOString()
    ticket.set('sla_response_start', now)
    if (!ticket.getString('sla_response_at')) {
      ticket.set('sla_response_at', now)
    }

    var currentStatus = ticket.getString('status')
    if (currentStatus !== 'Em Atendimento') {
      ticket.set('status', 'Em Atendimento')
    }

    // Iniciar automaticamente o ciclo de trabalho do operador se ainda não houver ciclo aberto
    if (!ticket.getString('operator_cycle_start')) {
      ticket.set('operator_cycle_start', now)
      ticket.set('operator_cycle_user', userId)
    }

    $app.save(ticket)

    try {
      var historyCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(historyCol)
      hist.set('ticket', id)
      hist.set('user', userId)
      hist.set('action', 'Iniciar Atendimento')
      hist.set('field', 'sla_response_start')
      hist.set('old_value', '')
      hist.set('new_value', 'Atendimento iniciado — SLA Resposta congelado em ' + now)
      $app.save(hist)
    } catch (hErr) {
      $app.logger().error('ticket_start_service: history logging failed', 'error', hErr.message)
    }

    return e.json(200, {
      success: true,
      sla_response_start: now,
      sla_response_at: ticket.getString('sla_response_at'),
      status: ticket.getString('status'),
      sla_status: ticket.getString('sla_status'),
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/pause-sla',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var data = e.requestInfo().body || {}
    var reason = data.reason ? String(data.reason).trim() : ''
    var justification = data.justification ? String(data.justification).trim() : ''

    if (!reason) {
      return e.json(400, { error: 'Motivo é obrigatório' })
    }
    if (!justification || justification.length < 5) {
      return e.json(400, { error: 'Justificativa deve ter no mínimo 5 caracteres' })
    }

    var ticket = $app.findRecordById('tickets', id)
    if (ticket.getBool('sla_paused')) {
      return e.json(400, { error: 'SLA já está pausado' })
    }

    var nowIso = new Date().toISOString()

    // 1. Gravar registro em sla_pauses
    var pauseCol = $app.findCollectionByNameOrId('sla_pauses')
    var pauseRec = new Record(pauseCol)
    pauseRec.set('ticket', id)
    pauseRec.set('reason', reason)
    pauseRec.set('justification', justification)
    pauseRec.set('paused_by', userId)
    pauseRec.set('paused_at', nowIso)
    $app.save(pauseRec)

    // 2. Mapear status derivado do motivo
    var statusByReason = {
      'Aguardando Cliente': 'Aguardando Cliente',
      'Aguardando Aprovação': 'Aguardando Aprovação',
      'Aguardando Terceiro': 'Aguardando Terceiro',
      'Aguardando Fornecedor': 'Aguardando Terceiro',
      'Aguardando Peça': 'Aguardando Terceiro',
      'Aguardando Janela de Manutenção': 'Agendado',
      'Chamado Agendado': 'Agendado',
      'Cliente Indisponível': 'Aguardando Cliente',
    }
    var newStatus = statusByReason[reason] || 'Aguardando Cliente'

    // Fechar ciclo de trabalho do operador em andamento ao pausar SLA
    var cycleStartStr = ticket.getString('operator_cycle_start')
    if (cycleStartStr) {
      try {
        var cycleStartTime = new Date(cycleStartStr).getTime()
        var nowTime = new Date(nowIso).getTime()
        if (!isNaN(cycleStartTime) && nowTime >= cycleStartTime) {
          var elapsedSec = Math.max(1, Math.round((nowTime - cycleStartTime) / 1000))
          var currentWorkedSec = ticket.getInt('operator_worked_seconds') || 0
          var newWorkedSec = currentWorkedSec + elapsedSec
          ticket.set('operator_worked_seconds', newWorkedSec)
          ticket.set('work_hours', Number((newWorkedSec / 3600).toFixed(4)))

          // Formatar tempo decorrido do ciclo
          var ch = Math.floor(elapsedSec / 3600)
          var cm = Math.floor((elapsedSec % 3600) / 60)
          var cs = elapsedSec % 60
          var cycleTimeFormatted =
            String(ch).padStart(2, '0') +
            ':' +
            String(cm).padStart(2, '0') +
            ':' +
            String(cs).padStart(2, '0')

          // Criar registro de interação/log de ciclo
          var cycleUser = ticket.getString('operator_cycle_user') || userId
          try {
            var interCol = $app.findCollectionByNameOrId('ticket_interactions')
            var interRec = new Record(interCol)
            interRec.set('ticket', id)
            interRec.set('author', cycleUser)
            interRec.set('type', 'Interno')
            interRec.set(
              'content',
              'Ciclo de atendimento encerrado por pausa de SLA (' +
                cycleTimeFormatted +
                ' - ' +
                elapsedSec +
                's). Tempo salvo em Horas Trabalhadas.',
            )
            interRec.set('origin', 'Cronômetro')
            interRec.set('duration_minutes', Math.round((elapsedSec / 60) * 100) / 100)
            interRec.set('hour_type', 'Contratada')
            interRec.set('billing_status', 'Faturável')
            $app.save(interRec)
          } catch (iErr) {
            $app.logger().error('pause-sla: cycle interaction error', 'error', iErr.message)
          }
        }
      } catch (cErr) {
        $app.logger().error('pause-sla: cycle calculation error', 'error', cErr.message)
      }
      ticket.set('operator_cycle_start', '')
      ticket.set('operator_cycle_user', '')
    }

    ticket.set('sla_paused', true)
    ticket.set('sla_status', 'Pausado')
    ticket.set('status', newStatus)
    $app.save(ticket)

    // 3. Registrar auditoria em ticket_history
    try {
      var histCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(histCol)
      hist.set('ticket', id)
      hist.set('user', userId)
      hist.set('action', 'Pausar SLA')
      hist.set('field', 'sla_paused')
      hist.set('old_value', 'Em contagem')
      hist.set('new_value', 'Pausado — Motivo: ' + reason + ' | Justificativa: ' + justification)
      $app.save(hist)
    } catch (hErr) {
      $app.logger().error('ticket_start_service: pause history failed', 'error', hErr.message)
    }

    return e.json(200, {
      success: true,
      sla_paused: true,
      sla_status: 'Pausado',
      status: ticket.getString('status'),
      pause_id: pauseRec.id,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/resume-sla',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var ticket = $app.findRecordById('tickets', id)
    if (!ticket.getBool('sla_paused')) {
      return e.json(400, { error: 'SLA não está pausado' })
    }

    var now = new Date()
    var nowIso = now.toISOString()

    // 1. Encontrar a última pausa aberta (sem resumed_at)
    var openPauses = $app.findRecordsByFilter(
      'sla_pauses',
      'ticket = "' + id + '" && resumed_at = ""',
      '-created',
      1,
      0,
    )

    var durationMinutes = 0
    var pauseReason = ''
    if (openPauses.length > 0) {
      var pauseRec = openPauses[0]
      pauseReason = pauseRec.getString('reason')
      var pausedAtStr = pauseRec.getString('paused_at')
      if (pausedAtStr) {
        var pausedAt = new Date(pausedAtStr)
        var diffMs = now.getTime() - pausedAt.getTime()
        durationMinutes = Math.max(1, Math.round(diffMs / 60000))
      }
      pauseRec.set('resumed_at', nowIso)
      pauseRec.set('resumed_by', userId)
      pauseRec.set('duration_minutes', durationMinutes)
      $app.save(pauseRec)
    }

    // 2. Atualizar totais no ticket e estender proporcionalmente o prazo de solução
    var currentPauseTotal = ticket.getInt('sla_pause_total_minutes') || 0
    var newPauseTotal = currentPauseTotal + durationMinutes
    ticket.set('sla_pause_total_minutes', newPauseTotal)
    ticket.set('sla_paused', false)

    // Extensão proporcional do prazo de solução (sla_solution_deadline)
    var currentSolDeadline = ticket.getString('sla_solution_deadline')
    if (currentSolDeadline && durationMinutes > 0) {
      var prevDeadlineMs = new Date(currentSolDeadline).getTime()
      if (!isNaN(prevDeadlineMs)) {
        var newDeadlineIso = new Date(prevDeadlineMs + durationMinutes * 60000).toISOString()
        ticket.set('sla_solution_deadline', newDeadlineIso)
      }
    }

    // Status do ticket volta para "Em Atendimento"
    ticket.set('status', 'Em Atendimento')

    // Determinar sla_status de acordo com o novo prazo
    var updatedDeadline = ticket.getString('sla_solution_deadline')
    if (updatedDeadline) {
      var dlMs = new Date(updatedDeadline).getTime()
      if (now.getTime() > dlMs) {
        ticket.set('sla_status', 'Violado')
      } else {
        ticket.set('sla_status', 'Dentro do Prazo')
      }
    } else {
      ticket.set('sla_status', 'Dentro do Prazo')
    }

    $app.save(ticket)

    // 3. Registrar auditoria em ticket_history
    try {
      var histCol2 = $app.findCollectionByNameOrId('ticket_history')
      var hist2 = new Record(histCol2)
      hist2.set('ticket', id)
      hist2.set('user', userId)
      hist2.set('action', 'Retomar SLA')
      hist2.set('field', 'sla_paused')
      hist2.set('old_value', 'Pausado' + (pauseReason ? ' (' + pauseReason + ')' : ''))
      hist2.set(
        'new_value',
        'Retomado — Pausa de ' +
          durationMinutes +
          ' min somada ao total (' +
          newPauseTotal +
          ' min acumulados). Prazo de solução prorrogado proporcionalmente.',
      )
      $app.save(hist2)
    } catch (hErr2) {
      $app.logger().error('ticket_start_service: resume history failed', 'error', hErr2.message)
    }

    return e.json(200, {
      success: true,
      sla_paused: false,
      sla_status: ticket.getString('sla_status'),
      status: ticket.getString('status'),
      duration_minutes: durationMinutes,
      sla_pause_total_minutes: newPauseTotal,
      sla_solution_deadline: ticket.getString('sla_solution_deadline'),
    })
  },
  $apis.requireAuth(),
)

// Endpoint para iniciar ciclo de trabalho do operador (Play)
routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/start-work-cycle',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var ticket = $app.findRecordById('tickets', id)
    var status = ticket.getString('status')
    if (status === 'Resolvido' || status === 'Encerrado' || status === 'Cancelado') {
      return e.json(400, { error: 'Não é possível iniciar ciclo em chamado finalizado' })
    }

    var existingCycleStart = ticket.getString('operator_cycle_start')
    if (existingCycleStart) {
      return e.json(200, {
        success: true,
        message: 'Ciclo já em andamento',
        operator_cycle_start: existingCycleStart,
        operator_cycle_user: ticket.getString('operator_cycle_user'),
        operator_worked_seconds: ticket.getInt('operator_worked_seconds') || 0,
      })
    }

    var now = new Date().toISOString()
    ticket.set('operator_cycle_start', now)
    ticket.set('operator_cycle_user', userId)

    // Se o atendimento geral ainda não tinha sido iniciado, carimba também
    if (!ticket.getString('sla_response_start')) {
      ticket.set('sla_response_start', now)
      if (!ticket.getString('sla_response_at')) {
        ticket.set('sla_response_at', now)
      }
    }

    // Se o status for Novo ou Em Triagem ou Atribuído, passa para Em Atendimento
    if (status !== 'Em Atendimento' && !ticket.getBool('sla_paused')) {
      ticket.set('status', 'Em Atendimento')
    }

    $app.save(ticket)

    // Log de auditoria
    try {
      var histCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(histCol)
      hist.set('ticket', id)
      hist.set('user', userId)
      hist.set('action', 'Início de Ciclo de Atendimento')
      hist.set('field', 'operator_cycle_start')
      hist.set('old_value', '')
      hist.set('new_value', 'Ciclo iniciado em ' + now)
      $app.save(hist)
    } catch (_) {}

    return e.json(200, {
      success: true,
      operator_cycle_start: now,
      operator_cycle_user: userId,
      operator_worked_seconds: ticket.getInt('operator_worked_seconds') || 0,
      work_hours: ticket.getFloat('work_hours') || 0,
      status: ticket.getString('status'),
    })
  },
  $apis.requireAuth(),
)

// Endpoint para parar/encerrar ciclo de trabalho do operador manualmente
routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/stop-work-cycle',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var ticket = $app.findRecordById('tickets', id)
    var cycleStartStr = ticket.getString('operator_cycle_start')
    if (!cycleStartStr) {
      return e.json(200, {
        success: true,
        message: 'Nenhum ciclo ativo para encerrar',
        operator_worked_seconds: ticket.getInt('operator_worked_seconds') || 0,
      })
    }

    var now = new Date()
    var nowIso = now.toISOString()
    var cycleStartTime = new Date(cycleStartStr).getTime()
    var elapsedSec = Math.max(1, Math.round((now.getTime() - cycleStartTime) / 1000))

    var currentWorkedSec = ticket.getInt('operator_worked_seconds') || 0
    var newWorkedSec = currentWorkedSec + elapsedSec
    ticket.set('operator_worked_seconds', newWorkedSec)
    ticket.set('work_hours', Number((newWorkedSec / 3600).toFixed(4)))
    ticket.set('operator_cycle_start', '')
    ticket.set('operator_cycle_user', '')

    $app.save(ticket)

    var ch = Math.floor(elapsedSec / 3600)
    var cm = Math.floor((elapsedSec % 3600) / 60)
    var cs = elapsedSec % 60
    var cycleTimeFormatted =
      String(ch).padStart(2, '0') +
      ':' +
      String(cm).padStart(2, '0') +
      ':' +
      String(cs).padStart(2, '0')

    // Salva interação/log com o tempo gasto
    try {
      var interCol = $app.findCollectionByNameOrId('ticket_interactions')
      var interRec = new Record(interCol)
      interRec.set('ticket', id)
      interRec.set('author', userId)
      interRec.set('type', 'Interno')
      interRec.set(
        'content',
        'Ciclo de atendimento encerrado (' +
          cycleTimeFormatted +
          ' - ' +
          elapsedSec +
          's). Tempo salvo em Horas Trabalhadas.',
      )
      interRec.set('origin', 'Cronômetro')
      interRec.set('duration_minutes', Math.round((elapsedSec / 60) * 100) / 100)
      interRec.set('hour_type', 'Contratada')
      interRec.set('billing_status', 'Faturável')
      $app.save(interRec)
    } catch (_) {}

    return e.json(200, {
      success: true,
      elapsed_seconds: elapsedSec,
      operator_worked_seconds: newWorkedSec,
      work_hours: ticket.getFloat('work_hours') || 0,
    })
  },
  $apis.requireAuth(),
)

// Endpoint para registrar Horas de Acompanhamento
routerAdd(
  'POST',
  '/backend/v1/tickets/{id}/accompaniment',
  (e) => {
    var id = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    var data = e.requestInfo().body || {}
    var logContent = data.content ? String(data.content).trim() : ''
    var durationMinutes = Number(data.duration_minutes) || 0
    var durationSeconds = Number(data.duration_seconds) || Math.round(durationMinutes * 60)
    var hourType = data.hour_type ? String(data.hour_type) : 'Contratada'
    var billingStatus = data.billing_status ? String(data.billing_status) : 'Faturável'
    var isInternal = data.is_internal !== false // padrão interno se omitido, respeita boolean

    if (!logContent) {
      return e.json(400, { error: 'O relato / log de acompanhamento é obrigatório' })
    }
    if (durationSeconds <= 0) {
      return e.json(400, { error: 'Tempo gasto de acompanhamento inválido' })
    }

    var ticket = $app.findRecordById('tickets', id)

    // Formata tempo gasto em HH:MM:SS
    var ah = Math.floor(durationSeconds / 3600)
    var am = Math.floor((durationSeconds % 3600) / 60)
    var as = durationSeconds % 60
    var formattedAccTime =
      String(ah).padStart(2, '0') +
      ':' +
      String(am).padStart(2, '0') +
      ':' +
      String(as).padStart(2, '0')

    // Atualiza contadores no ticket
    var currentAccSec = ticket.getInt('accompaniment_seconds') || 0
    var newAccSec = currentAccSec + durationSeconds
    ticket.set('accompaniment_seconds', newAccSec)

    var currentWorkedSec = ticket.getInt('operator_worked_seconds') || 0
    var newWorkedSec = currentWorkedSec + durationSeconds
    ticket.set('operator_worked_seconds', newWorkedSec)
    ticket.set('work_hours', Number((newWorkedSec / 3600).toFixed(4)))
    $app.save(ticket)

    // Texto com a log exatamente como está, contendo o tempo gasto explícito
    var fullContent =
      logContent +
      '\n\n[Acompanhamento registrado: ' +
      formattedAccTime +
      ' (' +
      Math.round(durationSeconds / 60) +
      ' min)]'

    var interCol = $app.findCollectionByNameOrId('ticket_interactions')
    var interRec = new Record(interCol)
    interRec.set('ticket', id)
    interRec.set('author', userId)
    interRec.set('type', isInternal ? 'Interno' : 'Público')
    interRec.set('content', fullContent)
    interRec.set('origin', 'Manual')
    interRec.set('duration_minutes', Math.round((durationSeconds / 60) * 100) / 100)
    interRec.set('hour_type', hourType)
    interRec.set('billing_status', billingStatus)
    $app.save(interRec)

    // Histórico de auditoria
    try {
      var histCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(histCol)
      hist.set('ticket', id)
      hist.set('user', userId)
      hist.set('action', 'Horas de Acompanhamento')
      hist.set('field', 'accompaniment_seconds')
      hist.set('old_value', String(currentAccSec) + 's')
      hist.set(
        'new_value',
        '+' +
          formattedAccTime +
          ' somado em Acompanhamento e Horas Trabalhadas. Total: ' +
          newAccSec +
          's',
      )
      $app.save(hist)
    } catch (_) {}

    return e.json(200, {
      success: true,
      accompaniment_seconds: newAccSec,
      operator_worked_seconds: newWorkedSec,
      work_hours: ticket.getFloat('work_hours') || 0,
      interaction_id: interRec.id,
    })
  },
  $apis.requireAuth(),
)
