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

    var data = $apis.requestInfo(e).body || {}
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
