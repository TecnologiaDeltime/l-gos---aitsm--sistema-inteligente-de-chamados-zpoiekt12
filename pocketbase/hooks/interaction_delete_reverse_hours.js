routerAdd(
  'DELETE',
  '/backend/v1/interactions/{id}/delete',
  (e) => {
    const interactionId = e.request.pathValue('id')
    if (!interactionId) return e.badRequestError('ID da interação é obrigatório')

    var interaction
    try {
      interaction = $app.findRecordById('ticket_interactions', interactionId)
    } catch (_) {
      return e.notFoundError('Interação não encontrada')
    }

    var hourType = interaction.getString('hour_type')
    var duration = interaction.getInt('duration_minutes') || 0
    var ticketId = interaction.getString('ticket')

    if (hourType === 'Contratada' && duration > 0 && ticketId) {
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
            var newConsumed = consumed - hoursToReverse
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

    return e.json(200, { success: true, id: interactionId })
  },
  $apis.requireAuth(),
)
