// Hook de ações para Chamados Retidos: Liberar ou Excluir com justificativa
// POST /backend/v1/retained-tickets/:id/release
routerAdd(
  'POST',
  '/backend/v1/retained-tickets/{id}/release',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var id = e.request.pathValue('id')
      var retained = $app.findRecordById('retained_tickets', id)
      if (!retained) return e.notFoundError('Registro retido não encontrado')

      var body = e.requestInfo().body || {}
      var notes = body.notes || 'Liberado manualmente pela moderação'
      var customCompanyId = body.company_id || ''

      var from = retained.getString('from_email')
      var fromName = retained.getString('from_name')
      var subject = retained.getString('subject')
      var cleanBody = retained.getString('body')
      var emailHtml = retained.getString('email_html')

      // 1. Tentar localizar usuário ou empresa
      var userCompanyId = customCompanyId
      var userUnitId = ''
      var userDeptId = ''
      var requesterName = fromName || from.split('@')[0]
      var requesterPhone = ''
      var contractId = ''

      try {
        var userRecords = $app.findRecordsByFilter(
          '_pb_users_auth_',
          'email = "' + from.toLowerCase() + '"',
          '',
          1,
          0,
        )
        if (userRecords.length > 0) {
          var matchedUser = userRecords[0]
          requesterName = matchedUser.getString('name') || requesterName
          requesterPhone = matchedUser.getString('phone') || matchedUser.getString('mobile') || ''
          if (!userCompanyId && matchedUser.getString('company')) {
            userCompanyId = matchedUser.getString('company')
          }
          userUnitId = matchedUser.getString('unit') || ''
        }
      } catch (_) {}

      if (userCompanyId) {
        try {
          var contractRecords = $app.findRecordsByFilter(
            'contracts',
            'company = "' + userCompanyId + '" && status = "Ativo"',
            '-created',
            1,
            0,
          )
          if (contractRecords.length > 0) {
            contractId = contractRecords[0].id
          }
        } catch (_) {}
      }

      // 2. Criar Ticket
      var ticketsCol = $app.findCollectionByNameOrId('tickets')
      var ticket = new Record(ticketsCol)
      ticket.set('title', subject)
      ticket.set('description', cleanBody)
      if (emailHtml) {
        ticket.set('email_html', emailHtml)
      }
      ticket.set('source', 'E-mail')
      ticket.set('status', 'Novo')
      ticket.set('type', 'Incidente')
      ticket.set('priority', 'Média')
      ticket.set('impact', 'Médio')
      ticket.set('urgency', 'Média')
      ticket.set('requester_name', requesterName)
      ticket.set('requester_email', from)
      if (requesterPhone) ticket.set('requester_phone', requesterPhone)
      if (userCompanyId) ticket.set('company', userCompanyId)
      if (userUnitId) ticket.set('unit', userUnitId)
      if (userDeptId) ticket.set('department', userDeptId)
      if (contractId) ticket.set('contract', contractId)

      $app.save(ticket)

      // 3. Atualizar registro retido
      retained.set('status', 'Liberado')
      retained.set('ticket', ticket.id)
      retained.set('reviewed_by', userId)
      retained.set('reviewed_at', new Date().toISOString())
      retained.set('review_notes', notes)
      $app.save(retained)

      return e.json(200, {
        success: true,
        message: 'Chamado liberado e criado com sucesso!',
        ticket_id: ticket.id,
        ticket_number: ticket.getString('number'),
      })
    } catch (err) {
      $app.logger().error('retained_release error', 'error', err.message)
      return e.json(500, { error: err.message || 'Erro ao liberar chamado retido' })
    }
  },
  $apis.requireAuth(),
)

// POST /backend/v1/retained-tickets/:id/dismiss
routerAdd(
  'POST',
  '/backend/v1/retained-tickets/{id}/dismiss',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : ''
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var id = e.request.pathValue('id')
      var retained = $app.findRecordById('retained_tickets', id)
      if (!retained) return e.notFoundError('Registro retido não encontrado')

      var body = e.requestInfo().body || {}
      var notes = body.notes || 'Descartado pela moderação'

      retained.set('status', 'Excluído')
      retained.set('reviewed_by', userId)
      retained.set('reviewed_at', new Date().toISOString())
      retained.set('review_notes', notes)
      $app.save(retained)

      return e.json(200, {
        success: true,
        message: 'Chamado retido descartado com sucesso.',
      })
    } catch (err) {
      $app.logger().error('retained_dismiss error', 'error', err.message)
      return e.json(500, { error: err.message || 'Erro ao descartar chamado retido' })
    }
  },
  $apis.requireAuth(),
)
