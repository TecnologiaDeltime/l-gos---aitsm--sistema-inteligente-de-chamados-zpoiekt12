// Submete uma RDM existente em "Rascunho" para o fluxo de aprovação do comitê.
// Replica exatamente o fluxo de change_approval_check.js (criado em onCreate),
// mas disparado sob demanda via POST /backend/v1/changes/{id}/submit.
routerAdd(
  'POST',
  '/backend/v1/changes/{id}/submit',
  (e) => {
    var changeId = e.request.pathValue('id')
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')

    try {
      var change = $app.findRecordById('changes', changeId)
      var currentStatus = change.getString('status')

      // Só permite submeter RDMs em Rascunho
      if (currentStatus !== 'Rascunho') {
        return e.badRequestError('Apenas mudanças em Rascunho podem ser enviadas para aprovação.')
      }

      var changeTypeId = change.getString('change_type')
      var changeTypeName = ''
      if (changeTypeId) {
        try {
          var ct = $app.findRecordById('change_types', changeTypeId)
          changeTypeName = ct.getString('name') || ''
        } catch (_) {}
      }

      // Mudança Padrão pré-autorizada não requer comitê
      if (changeTypeName === 'Mudança Padrão') {
        try {
          var ct2 = $app.findRecordById('change_types', changeTypeId)
          if (ct2.getBool('is_standard') && !ct2.getBool('approval_required')) {
            change.set('approval_status', 'Não Requerida')
            change.set('status', 'Solicitada')
            $app.save(change)

            try {
              var auditCol0 = $app.findCollectionByNameOrId('change_audit_logs')
              var log0 = new Record(auditCol0)
              log0.set('change', change.id)
              log0.set('user', userId)
              log0.set('action', 'Mudança Padrão enviada (sem aprovação do comitê)')
              log0.set('field', 'status')
              log0.set('old_value', currentStatus)
              log0.set('new_value', 'Solicitada')
              $app.save(log0)
            } catch (_) {}

            return e.json(200, {
              success: true,
              status: 'Solicitada',
              approval_status: 'Não Requerida',
            })
          }
        } catch (_) {}
      }

      // Emergência -> comitê Emergencial; demais -> comitê Padrão
      var committeeType = changeTypeName === 'Mudança de Emergência' ? 'Emergencial' : 'Padrão'

      var requesterId = change.getString('requester')
      if (!requesterId) requesterId = userId
      if (!requesterId) return e.badRequestError('Sem solicitante definido')

      var companyId = change.getString('company')

      var committee = null
      if (companyId) {
        try {
          committee = $app.findFirstRecordByFilter(
            'change_committee',
            'company = "' +
              companyId +
              '" && committee_type = "' +
              committeeType +
              '" && active = true',
          )
        } catch (_) {
          committee = null
        }
      }

      // Coleta e-mails e nomes dos membros (users ou client_contacts)
      var memberUsers = [] // array de {id, name, email}
      var chairpersonId = ''
      if (committee) {
        chairpersonId = committee.getString('chairperson')
        var memberIds = []
        var rawMembers = committee.get('members')
        if (Array.isArray(rawMembers)) memberIds = rawMembers
        else if (typeof rawMembers === 'string' && rawMembers !== '') {
          try {
            var parsed = JSON.parse(rawMembers)
            if (Array.isArray(parsed)) memberIds = parsed
          } catch (_) {
            memberIds = rawMembers.split(',').map(function (s) {
              return s.trim()
            })
          }
        }

        var memberTypeMap = {}
        var rawMt = committee.get('member_type')
        if (typeof rawMt === 'string' && rawMt !== '') {
          try {
            memberTypeMap = JSON.parse(rawMt)
          } catch (_) {}
        }
        if (rawMt && typeof rawMt === 'object' && !Array.isArray(rawMt)) {
          memberTypeMap = rawMt
        }

        for (var i = 0; i < memberIds.length; i++) {
          var mid = memberIds[i]
          var origin = memberTypeMap[mid] || 'user'
          if (origin === 'client_contact') {
            try {
              var cc = $app.findRecordById('client_contacts', mid)
              var linkedUser = cc.getString('user')
              if (linkedUser) {
                memberUsers.push({
                  id: linkedUser,
                  name: cc.getString('full_name'),
                  email: cc.getString('email'),
                })
              } else {
                memberUsers.push({
                  id: 'cc:' + mid,
                  name: cc.getString('full_name'),
                  email: cc.getString('email'),
                })
              }
            } catch (_) {}
          } else {
            try {
              var u = $app.findRecordById('users', mid)
              memberUsers.push({
                id: u.id,
                name: u.getString('name') || u.getString('email'),
                email: u.getString('email'),
              })
            } catch (_) {}
          }
        }
      }

      // Fallback: sem comitê -> admins/gestores
      if (memberUsers.length === 0) {
        try {
          var approvers = $app.findRecordsByFilter(
            'users',
            'role = "admin" || role = "gestor"',
            '',
            10,
            0,
          )
          for (var a = 0; a < approvers.length; a++) {
            memberUsers.push({
              id: approvers[a].id,
              name: approvers[a].getString('name') || approvers[a].getString('email'),
              email: approvers[a].getString('email'),
            })
          }
        } catch (_) {}
        if (memberUsers.length === 0) {
          return e.badRequestError(
            'Não há comitê nem administradores/gestores para aprovar esta mudança.',
          )
        }
      }

      // Evitar registros duplicados caso já existam approvals pendentes
      var existingApprovals = []
      try {
        existingApprovals = $app.findRecordsByFilter(
          'change_approvals',
          'change = "' + change.id + '"',
          '',
          50,
          0,
        )
      } catch (_) {}
      var existingApproverIds = {}
      for (var ea = 0; ea < existingApprovals.length; ea++) {
        existingApproverIds[existingApprovals[ea].getString('approver')] = true
      }

      var approvalsCol = $app.findCollectionByNameOrId('change_approvals')
      for (var k = 0; k < memberUsers.length; k++) {
        var m = memberUsers[k]
        if (m.id.indexOf('cc:') === 0) continue
        if (existingApproverIds[m.id]) continue
        try {
          var approval = new Record(approvalsCol)
          approval.set('change', change.id)
          approval.set('approver', m.id)
          approval.set('status', 'Pendente')
          $app.save(approval)
        } catch (_) {}
      }

      // Prazo de votação: agora + voting_deadline_hours do comitê (default 48h)
      var deadlineHours = 48
      if (committee) {
        var dh = committee.get('voting_deadline_hours')
        if (dh && !isNaN(dh) && dh > 0) deadlineHours = dh
      }
      var deadlineAt = new Date()
      deadlineAt.setHours(deadlineAt.getHours() + deadlineHours)

      change.set('approval_status', 'Pendente')
      change.set('status', 'Solicitada')
      change.set('voting_deadline_at', deadlineAt.toISOString())
      $app.save(change)

      // Auditoria
      try {
        var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
        var log = new Record(auditCol)
        log.set('change', change.id)
        log.set('user', userId)
        log.set('action', 'Aprovação solicitada ao comitê (' + committeeType + ')')
        log.set('field', 'status')
        log.set('old_value', currentStatus)
        log.set('new_value', 'Solicitada')
        $app.save(log)
      } catch (_) {}

      // Notificações in-app
      var notifCol = $app.findCollectionByNameOrId('notifications')
      for (var n = 0; n < memberUsers.length; n++) {
        var mu = memberUsers[n]
        if (mu.id.indexOf('cc:') === 0) continue
        try {
          var notif = new Record(notifCol)
          notif.set('user', mu.id)
          notif.set('title', 'Nova mudança pendente de aprovação')
          var notifMsg =
            'Mudança #' + change.getString('number') + ' (' + committeeType + ') requer seu voto'
          notifMsg +=
            ' — prazo de votação até ' +
            deadlineAt.toLocaleString('pt-BR') +
            ' (' +
            deadlineHours +
            'h)'
          notif.set('message', notifMsg)
          notif.set('type', 'Aprovação')
          notif.set('read', false)
          $app.save(notif)
        } catch (_) {}
      }

      // E-mails
      var changeNumber = change.getString('number')
      var changeTitle = change.getString('title')
      var companyName = ''
      try {
        if (companyId) {
          var comp = $app.findRecordById('companies', companyId)
          companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
        }
      } catch (_) {}
      var requesterName = ''
      try {
        var reqUser = $app.findRecordById('users', requesterId)
        requesterName = reqUser.getString('name') || reqUser.getString('email')
      } catch (_) {}
      var frontendUrl = ($os.getenv('FRONTEND_URL') || '').replace(/\/$/, '')
      var link = frontendUrl + '/changes/' + change.id

      var subject = '[Comitê ' + committeeType + '] Voto solicitado - Mudança #' + changeNumber
      for (var eIdx = 0; eIdx < memberUsers.length; eIdx++) {
        var dest = memberUsers[eIdx]
        if (!dest.email) continue
        try {
          var bodyText =
            'Olá ' +
            (dest.name || '') +
            ',\n\n' +
            'Uma mudança requer seu voto no comitê ' +
            committeeType +
            '.\n\n' +
            'Título: ' +
            changeTitle +
            '\n' +
            'Solicitante: ' +
            (requesterName || '-') +
            '\n' +
            'Empresa: ' +
            (companyName || '-') +
            '\n' +
            'Link: ' +
            link +
            '\n\n' +
            'Por favor, acesse o sistema para registrar seu voto (Aprovar / Recusar / Solicitar Revisão).' +
            '\n\nPrazo de votação: ' +
            deadlineAt.toLocaleString('pt-BR') +
            ' (' +
            deadlineHours +
            'h)'

          var message = new MailerMessage()
          message.from = { address: 'noreply@logositsm.com.br', name: 'Lógos AITSM' }
          message.to = [{ address: dest.email }]
          message.subject = subject
          message.text = bodyText

          if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
            var esc =
              globalThis.itsmEscapeHtml ||
              function (s) {
                return s || ''
              }
            var contentHtml =
              '<p style="margin: 0 0 16px 0; font-size: 15px; color: #1E293B;">Olá <strong>' +
              esc(dest.name || 'Membro do Comitê') +
              '</strong>,</p>' +
              '<p style="margin: 0 0 16px 0; color: #475569;">Uma mudança requer seu voto no comitê <strong>' +
              esc(committeeType) +
              '</strong>.</p>' +
              '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 16px 0; font-size: 14px;">' +
              '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; width: 120px;">Mudança:</td><td style="padding: 10px 14px; color: #0F172A; font-weight: 600;">#' +
              esc(changeNumber) +
              ' - ' +
              esc(changeTitle) +
              '</td></tr>' +
              '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; border-top: 1px solid #E2E8F0;">Solicitante:</td><td style="padding: 10px 14px; color: #0F172A; border-top: 1px solid #E2E8F0;">' +
              esc(requesterName || '-') +
              '</td></tr>' +
              '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; border-top: 1px solid #E2E8F0;">Empresa:</td><td style="padding: 10px 14px; color: #0F172A; border-top: 1px solid #E2E8F0;">' +
              esc(companyName || '-') +
              '</td></tr>' +
              (deadlineAt
                ? '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; border-top: 1px solid #E2E8F0;">Prazo:</td><td style="padding: 10px 14px; color: #B45309; font-weight: bold; border-top: 1px solid #E2E8F0;">' +
                  esc(deadlineAt.toLocaleString('pt-BR')) +
                  ' (' +
                  deadlineHours +
                  'h)</td></tr>'
                : '') +
              '</table>' +
              '<p style="margin: 0; color: #475569; font-size: 13px;">Por favor, acesse o sistema para registrar seu voto (Aprovar / Recusar / Solicitar Revisão).</p>'

            var actionHtml =
              '<a href="' +
              esc(link) +
              '" style="display: inline-block; background-color: #D97706; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);">' +
              'Registrar Voto no Comitê' +
              '</a>'

            message.html = globalThis.itsmRenderBaseEmailTemplate({
              variant: 'brand',
              badgeText: 'Comitê ' + committeeType,
              title: 'Voto Solicitado: Mudança #' + changeNumber,
              subtitle: changeTitle,
              preheader: 'Avaliação solicitada para Mudança #' + changeNumber,
              contentHtml: contentHtml,
              actionHtml: actionHtml,
              footerNote: 'Notificação enviada pelo fluxo de Mudanças do Lógos AITSM.',
            })
          }

          if (globalThis.sendSystemMailMessage) {
            globalThis.sendSystemMailMessage(message)
          } else {
            var mailClient = $app.newMailClient()
            mailClient.send(message)
          }
        } catch (err) {
          $app.logger().error('change_submit_for_approval mail error', 'error', err.message)
        }
      }

      return e.json(200, {
        success: true,
        status: 'Solicitada',
        approval_status: 'Pendente',
        committee_type: committeeType,
      })
    } catch (err) {
      $app.logger().error('change_submit_for_approval error', 'error', err.message)
      return e.internalServerError(err.message)
    }
  },
  $apis.requireAuth(),
)
