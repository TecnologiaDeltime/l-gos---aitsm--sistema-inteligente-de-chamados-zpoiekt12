routerAdd(
  'DELETE',
  '/backend/v1/interactions/{id}/delete',
  (e) => {
    const interactionId = e.request.pathValue('id')
    if (!interactionId) return e.badRequestError('ID da interação é obrigatório')

    // Guard server-side: somente admin ou perfil com o item
    // 'clients.admin_accompaniment_hours_edit' concedido pode excluir horas de acompanhamento
    var authRecord = e.auth
    if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
    var canDeleteAccompanimentHours = authRecord.getString('role') === 'admin'
    if (!canDeleteAccompanimentHours) {
      try {
        var profId = authRecord.getString('profile_id')
        if (profId) {
          var permRows = $app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profId +
              '" && module_key = "clients" && item_key = "admin_accompaniment_hours_edit" && granted = true',
            '',
            1,
            0,
          )
          canDeleteAccompanimentHours = permRows.length > 0
        }
      } catch (_) {}
    }
    if (!canDeleteAccompanimentHours) {
      return e.forbiddenError('Sem permissão para excluir horas de acompanhamento')
    }

    var interaction
    try {
      interaction = $app.findRecordById('ticket_interactions', interactionId)
    } catch (_) {
      return e.notFoundError('Interação não encontrada')
    }

    var hourType = interaction.getString('hour_type')
    var duration = interaction.getFloat('duration_minutes') || 0
    var origin = interaction.getString('origin')
    var ticketId = interaction.getString('ticket')

    // Regra de negócio: interações de 'Cronômetro' não foram debitadas da franquia.
    // Somente interações de acompanhamento (origin != 'Cronômetro') debitaram e devem ser estornadas da franquia.
    if (origin !== 'Cronômetro' && hourType === 'Contratada' && duration > 0 && ticketId) {
      try {
        var ticket = $app.findRecordById('tickets', ticketId)
        var contractId = ticket.getString('contract')
        if (contractId) {
          var periods = $app.findRecordsByFilter(
            'contract_periods',
            'contract = "' + contractId + '" && status = "Ativo"',
            '-period_start',
            1,
            0,
          )
          if (periods.length > 0) {
            var period = periods[0]
            var consumed = period.getFloat('consumed_hours') || 0
            var hoursToReverse = duration / 60
            var newConsumed = Number((consumed - hoursToReverse).toFixed(4))
            if (newConsumed < 0) newConsumed = 0
            period.set('consumed_hours', newConsumed)
            $app.save(period)

            var auditCol = $app.findCollectionByNameOrId('audit_logs')
            var audit = new Record(auditCol)
            audit.set('user', interaction.getString('author'))
            audit.set('action', 'Estorno de horas')
            audit.set('entity_type', 'contract_period')
            audit.set('entity_id', period.id)
            audit.set(
              'description',
              'Estorno de ' +
                hoursToReverse.toFixed(2) +
                'h via exclusão da interação ' +
                interaction.id,
            )
            audit.set('old_values', JSON.stringify({ consumed_hours: consumed }))
            audit.set('new_values', JSON.stringify({ consumed_hours: newConsumed }))
            $app.save(audit)
          }
        }

        // Subtrai de accompaniment_seconds no ticket
        try {
          var currentAcc = ticket.getInt('accompaniment_seconds') || 0
          var durationSec = Math.round(duration * 60)
          ticket.set('accompaniment_seconds', Math.max(0, currentAcc - durationSec))
          $app.save(ticket)
        } catch (_) {}
      } catch (err) {
        $app.logger().error('Error reversing hours on interaction delete', 'error', err.message)
      }
    }

    try {
      $app.delete(interaction)
    } catch (err) {
      $app.logger().error('Error deleting interaction', 'error', err.message)
      return e.json(500, { error: 'Erro ao excluir interação' })
    }

    // Rastreabilidade: interação interna com hour_type 'Interna' (não debita franquia,
    // ver on_interaction_consume.js) registrando a exclusão no histórico do chamado
    if (ticketId && origin !== 'Cronômetro') {
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
          'Horas de acompanhamento excluídas: ' + (duration / 60).toFixed(2) + 'h estornadas',
        )
        $app.save(trace)
      } catch (err) {
        $app.logger().error('Error recording hours deletion trace', 'error', err.message)
      }
    }

    return e.json(200, { success: true, id: interactionId })
  },
  $apis.requireAuth(),
)
