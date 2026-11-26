routerAdd(
  'PUT',
  '/backend/v1/tickets/{id}/worked-hours/edit',
  (e) => {
    const ticketId = e.request.pathValue('id')
    if (!ticketId) return e.badRequestError('ID do chamado é obrigatório')

    // Guard server-side (dupla barreira): somente admin ou perfil com o item
    // 'clients.admin_accompaniment_hours_edit' concedido pode alterar horas trabalhadas
    var authRecord = e.auth
    if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
    var canEditWorkedHours = authRecord.getString('role') === 'admin'
    if (!canEditWorkedHours) {
      try {
        var profId = authRecord.getString('profile_id')
        if (profId) {
          // Item registrado no módulo 'tickets' (registry atual); 'clients' é o
          // módulo legado já concedido em perfis antigos — aceitamos qualquer um.
          var permRows = $app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profId +
              '" && item_key = "admin_accompaniment_hours_edit" && granted = true && (module_key = "tickets" || module_key = "clients")',
            '',
            1,
            0,
          )
          canEditWorkedHours = permRows.length > 0
        }
      } catch (_) {}
    }
    if (!canEditWorkedHours) {
      return e.forbiddenError('Sem permissão para alterar horas trabalhadas')
    }

    var body = e.requestInfo().body || {}

    var newDescription = body.description
    if (
      newDescription !== undefined &&
      (typeof newDescription !== 'string' || !newDescription.trim())
    ) {
      return e.badRequestError('Descrição não pode ser vazia', {
        description: 'Descrição é obrigatória',
      })
    }

    var newWorkedSeconds = body.worked_seconds
    if (newWorkedSeconds === undefined || newWorkedSeconds === null) {
      return e.badRequestError('Horas trabalhadas são obrigatórias', {
        worked_seconds: 'Informe o tempo corrigido',
      })
    }
    newWorkedSeconds = Number(newWorkedSeconds)
    if (!Number.isFinite(newWorkedSeconds) || newWorkedSeconds < 0) {
      return e.badRequestError('Horas trabalhadas inválidas', {
        worked_seconds: 'O tempo deve ser um número não negativo',
      })
    }
    newWorkedSeconds = Math.round(newWorkedSeconds)

    var ticket
    try {
      ticket = $app.findRecordById('tickets', ticketId)
    } catch (_) {
      return e.notFoundError('Chamado não encontrado')
    }

    var oldWorkedSec = ticket.getInt('operator_worked_seconds') || 0

    // Se o ciclo está em andamento (operator_cycle_start preenchido), o acumulado
    // ainda não inclui o segmento atual: o valor correto é (agora − início).
    var liveWorkedSec = oldWorkedSec
    var cycleStart = ticket.getString('operator_cycle_start')
    if (cycleStart) {
      try {
        var startMs = Date.parse(cycleStart)
        if (!Number.isNaN(startMs)) {
          var paused = false
          try {
            var openPauses = $app.findRecordsByFilter(
              'operator_work_cycle_pauses',
              'ticket = "' + ticketId + '" && resumed_at = ""',
              '',
              1,
              0,
            )
            paused = openPauses.length > 0
          } catch (_) {}
          if (!paused) {
            liveWorkedSec = oldWorkedSec + Math.max(0, Math.floor((Date.now() - startMs) / 1000))
          }
        }
      } catch (_) {}
    }

    if (newWorkedSeconds === liveWorkedSec) {
      return e.json(200, {
        success: true,
        operator_worked_seconds: oldWorkedSec,
        work_hours: ticket.getFloat('work_hours') || 0,
        unchanged: true,
      })
    }

    // Ajusta operator_worked_seconds/work_hours. Como o ticket tem autodate
    // updated, save() via record API é seguro aqui (não há created a preservar).
    var adjustedSec = Math.max(0, newWorkedSeconds - (liveWorkedSec - oldWorkedSec))
    ticket.set('operator_worked_seconds', adjustedSec)
    ticket.set('work_hours', Number((adjustedSec / 3600).toFixed(4)))
    try {
      $app.save(ticket)
    } catch (err) {
      $app.logger().error('Error saving corrected worked hours', 'error', err.message)
      return e.json(500, { error: 'Erro ao salvar horas trabalhadas' })
    }

    // Auditoria: quem editou, valores anterior e novo
    try {
      var auditCol = $app.findCollectionByNameOrId('audit_logs')
      var audit = new Record(auditCol)
      audit.set('user', authRecord.id)
      audit.set('action', 'Edição de horas trabalhadas')
      audit.set('entity_type', 'ticket')
      audit.set('entity_id', ticketId)
      audit.set(
        'description',
        'Edição das horas trabalhadas do chamado ' + ticketId + ' via Apuração de Horas',
      )
      audit.set('old_values', JSON.stringify({ operator_worked_seconds: oldWorkedSec }))
      audit.set('new_values', JSON.stringify({ operator_worked_seconds: adjustedSec }))
      $app.save(audit)
    } catch (err) {
      $app.logger().error('Error recording worked hours edit audit', 'error', err.message)
    }

    // Histórico do chamado: registro legível na aba Histórico da ficha
    try {
      var histCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(histCol)
      hist.set('ticket', ticketId)
      hist.set('user', authRecord.id)
      hist.set('action', 'Edição de Horas Trabalhadas')
      hist.set('field', 'operator_worked_seconds')
      hist.set('old_value', (oldWorkedSec / 3600).toFixed(2) + 'h')
      hist.set('new_value', (adjustedSec / 3600).toFixed(2) + 'h')
      $app.save(hist)
    } catch (err) {
      $app.logger().error('Error recording worked hours edit history', 'error', err.message)
    }

    // Rastreabilidade: interação interna com hour_type 'Interna' (não debita
    // franquia, ver on_interaction_consume.js) registrando a correção
    try {
      var traceCol = $app.findCollectionByNameOrId('ticket_interactions')
      var trace = new Record(traceCol)
      trace.set('ticket', ticketId)
      trace.set('author', authRecord.id)
      trace.set('type', 'Interno')
      trace.set('hour_type', 'Interna')
      trace.set('origin', 'Automático')
      trace.set('billing_status', 'Não Faturável')
      trace.set(
        'content',
        'Horas trabalhadas corrigidas: ' +
          (oldWorkedSec / 3600).toFixed(2) +
          'h → ' +
          (adjustedSec / 3600).toFixed(2) +
          'h' +
          (newDescription ? ' — ' + newDescription.trim() : ''),
      )
      $app.save(trace)
    } catch (err) {
      $app.logger().error('Error recording worked hours correction trace', 'error', err.message)
    }

    return e.json(200, {
      success: true,
      operator_worked_seconds: adjustedSec,
      work_hours: Number((adjustedSec / 3600).toFixed(4)),
    })
  },
  $apis.requireAuth(),
)
