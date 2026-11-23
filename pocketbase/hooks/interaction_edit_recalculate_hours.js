routerAdd(
  'PUT',
  '/backend/v1/interactions/{id}/edit',
  (e) => {
    const interactionId = e.request.pathValue('id')
    if (!interactionId) return e.badRequestError('ID da interação é obrigatório')

    // Guard server-side: somente admin ou perfil com o item
    // 'clients.admin_accompaniment_hours_edit' concedido pode alterar horas de acompanhamento
    var authRecord = e.auth
    if (!authRecord) return e.forbiddenError('Autenticação obrigatória')
    var canEditAccompanimentHours = authRecord.getString('role') === 'admin'
    if (!canEditAccompanimentHours) {
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
          canEditAccompanimentHours = permRows.length > 0
        }
      } catch (_) {}
    }
    if (!canEditAccompanimentHours) {
      return e.forbiddenError('Sem permissão para alterar horas de acompanhamento')
    }

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

    // Retrocompetência (opcional): grava a data informada como created do log
    var newCompetencyDate = body.competency_date
    if (
      newCompetencyDate !== undefined &&
      newCompetencyDate !== null &&
      String(newCompetencyDate).trim() !== ''
    ) {
      newCompetencyDate = String(newCompetencyDate).trim()
      if (!/^\d{4}-\d{2}-\d{2}/.test(newCompetencyDate)) {
        return e.badRequestError('Data de competência inválida', {
          competency_date: 'Use o formato AAAA-MM-DD',
        })
      }
      newCompetencyDate = newCompetencyDate.substring(0, 10)
    } else {
      newCompetencyDate = ''
    }

    var interaction
    try {
      interaction = $app.findRecordById('ticket_interactions', interactionId)
    } catch (_) {
      return e.notFoundError('Interação não encontrada')
    }

    var oldCreated = interaction.getString('created')

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

    // Retrocompetência: created é autodate e não aceita set() no record API —
    // SQL direto (mesmo padrão da migration 0139). 12:00 UTC evita virar dia
    // anterior/posterior por fuso.
    if (newCompetencyDate) {
      try {
        $app
          .db()
          .newQuery('UPDATE ticket_interactions SET created = {:created} WHERE id = {:id}')
          .bind({ id: interaction.id, created: newCompetencyDate + ' 12:00:00.000Z' })
          .execute()
      } catch (err) {
        $app.logger().error('Error setting competency date', 'error', err.message)
      }
    }

    // Auditoria: quem editou, valores anterior e novo
    try {
      var auditCol = $app.findCollectionByNameOrId('audit_logs')
      var audit = new Record(auditCol)
      audit.set('user', authRecord.id)
      audit.set('action', 'Edição de horas de acompanhamento')
      audit.set('entity_type', 'ticket_interaction')
      audit.set('entity_id', interaction.id)
      audit.set(
        'description',
        'Edição de horas da interação ' +
          interaction.id +
          ' do chamado ' +
          ticketId +
          (newCompetencyDate ? ' com competência ' + newCompetencyDate : ''),
      )
      audit.set(
        'old_values',
        JSON.stringify({ duration_minutes: oldDuration, created: oldCreated }),
      )
      audit.set(
        'new_values',
        JSON.stringify({
          duration_minutes: effectiveNewDuration,
          created: newCompetencyDate || oldCreated,
        }),
      )
      $app.save(audit)
    } catch (err) {
      $app.logger().error('Error recording hours edit audit', 'error', err.message)
    }

    // Histórico do chamado: registro legível na aba Histórico da ficha
    if (ticketId) {
      try {
        var histCol = $app.findCollectionByNameOrId('ticket_history')
        var hist = new Record(histCol)
        hist.set('ticket', ticketId)
        hist.set('user', authRecord.id)
        hist.set('action', 'Edição de Horas de Acompanhamento')
        hist.set('field', 'duration_minutes')
        hist.set('old_value', (oldDuration / 60).toFixed(2) + 'h')
        hist.set(
          'new_value',
          (effectiveNewDuration / 60).toFixed(2) +
            'h' +
            (newCompetencyDate ? ' · competência ' + newCompetencyDate : ''),
        )
        $app.save(hist)
      } catch (err) {
        $app.logger().error('Error recording hours edit history', 'error', err.message)
      }
    }

    // Rastreabilidade: interação interna com hour_type 'Interna' (não debita franquia,
    // ver on_interaction_consume.js) registrando a correção no histórico do chamado
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
          'Horas de acompanhamento corrigidas: ' +
            (oldDuration / 60).toFixed(2) +
            'h → ' +
            (effectiveNewDuration / 60).toFixed(2) +
            'h',
        )
        $app.save(trace)
      } catch (err) {
        $app.logger().error('Error recording hours correction trace', 'error', err.message)
      }
    }

    return e.json(200, { success: true, record: interaction })
  },
  $apis.requireAuth(),
)
