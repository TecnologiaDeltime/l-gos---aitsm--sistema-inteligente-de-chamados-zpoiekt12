routerAdd(
  'PUT',
  '/backend/v1/interactions/{id}/edit',
  (e) => {
    const interactionId = e.request.pathValue('id')
    if (!interactionId) return e.badRequestError('ID da interação é obrigatório')

    var body = e.requestInfo().body || {}

    var newContent = body.content
    if (newContent !== undefined && (typeof newContent !== 'string' || !newContent.trim())) {
      return e.badRequestError('Conteúdo não pode ser vazio', { content: 'Conteúdo é obrigatório' })
    }

    var newDuration = body.duration_minutes
    if (newDuration !== undefined) {
      newDuration = Number(newDuration)
      if (!Number.isFinite(newDuration) || newDuration < 0) {
        return e.badRequestError('Duração inválida', {
          duration_minutes: 'Duração deve ser um número não negativo',
        })
      }
      newDuration = Math.round(newDuration)
    }

    var validHourTypes = [
      'Contratada',
      'Excedente',
      'Projeto',
      'Interna',
      'Não Faturável',
      'Cortesia',
      'Deslocamento',
      'Plantão',
      'Gestão',
      'Treinamento',
    ]
    var newHourType = body.hour_type
    if (
      newHourType !== undefined &&
      newHourType !== null &&
      newHourType !== '' &&
      validHourTypes.indexOf(newHourType) === -1
    ) {
      return e.badRequestError('Tipo de hora inválido', { hour_type: 'Tipo de hora não permitido' })
    }

    var validBillingStatuses = ['Faturável', 'Não Faturável', 'Pendente']
    var newBillingStatus = body.billing_status
    if (
      newBillingStatus !== undefined &&
      newBillingStatus !== null &&
      newBillingStatus !== '' &&
      validBillingStatuses.indexOf(newBillingStatus) === -1
    ) {
      return e.badRequestError('Status de faturamento inválido', {
        billing_status: 'Status de faturamento não permitido',
      })
    }

    var interaction
    try {
      interaction = $app.findRecordById('ticket_interactions', interactionId)
    } catch (_) {
      return e.notFoundError('Interação não encontrada')
    }

    var oldDuration = interaction.getFloat('duration_minutes') || 0
    var oldHourType = interaction.getString('hour_type')
    var origin = interaction.getString('origin')
    var ticketId = interaction.getString('ticket')

    var contractId = ''
    var contractPeriod = null
    var ticket = null
    if (ticketId) {
      try {
        ticket = $app.findRecordById('tickets', ticketId)
        contractId = ticket.getString('contract')
        if (contractId) {
          var periods = $app.findRecordsByFilter(
            'contract_periods',
            'contract = "' + contractId + '" && status = "Ativo"',
            '-period_start',
            1,
            0,
          )
          if (periods.length > 0) {
            contractPeriod = periods[0]
          }
        }
      } catch (_) {}
    }

    var effectiveNewHourType =
      newHourType !== undefined && newHourType !== null && newHourType !== ''
        ? newHourType
        : oldHourType
    var effectiveNewDuration = newDuration !== undefined ? newDuration : oldDuration

    // Regra de negócio: interações de 'Cronômetro' pertencem exclusivamente às horas do operador.
    // Somente interações de acompanhamento (origin != 'Cronômetro') debitam da franquia e afetam accompaniment_seconds.
    if (origin !== 'Cronômetro' && contractPeriod) {
      var consumed = contractPeriod.getFloat('consumed_hours') || 0

      if (oldHourType === 'Contratada' && oldDuration > 0) {
        var hoursToReverse = oldDuration / 60
        consumed = consumed - hoursToReverse
        if (consumed < 0) consumed = 0
      }

      if (effectiveNewHourType === 'Contratada' && effectiveNewDuration > 0) {
        var hoursToAdd = effectiveNewDuration / 60
        consumed = consumed + hoursToAdd
      }

      contractPeriod.set('consumed_hours', Number(consumed.toFixed(4)))
      $app.save(contractPeriod)
    }

    // Ajusta accompaniment_seconds no ticket caso tenha sido alterada a duração
    if (
      origin !== 'Cronômetro' &&
      ticket &&
      newDuration !== undefined &&
      newDuration !== oldDuration
    ) {
      try {
        var currentAcc = ticket.getInt('accompaniment_seconds') || 0
        var diffSec = Math.round((effectiveNewDuration - oldDuration) * 60)
        var newAcc = Math.max(0, currentAcc + diffSec)
        ticket.set('accompaniment_seconds', newAcc)
        $app.save(ticket)
      } catch (_) {}
    }

    if (newContent !== undefined) interaction.set('content', newContent)
    if (newDuration !== undefined) interaction.set('duration_minutes', newDuration)
    if (newHourType !== undefined && newHourType !== null) interaction.set('hour_type', newHourType)
    if (newBillingStatus !== undefined && newBillingStatus !== null)
      interaction.set('billing_status', newBillingStatus)

    try {
      $app.save(interaction)
    } catch (err) {
      $app.logger().error('Error saving edited interaction', 'error', err.message)
      return e.json(500, { error: 'Erro ao salvar interação' })
    }

    return e.json(200, { success: true, record: interaction })
  },
  $apis.requireAuth(),
)
