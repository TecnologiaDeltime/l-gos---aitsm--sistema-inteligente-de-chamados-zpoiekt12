routerAdd(
  'POST',
  '/backend/v1/changes/{id}/approve',
  (e) => {
    var changeId = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    var decision = body.decision // 'Aprovado' | 'Recusado' | 'Solicitar Revisão'
    var comment = body.comment || ''
    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('auth required')
    if (decision !== 'Aprovado' && decision !== 'Recusado' && decision !== 'Solicitar Revisão') {
      return e.badRequestError('decision must be Aprovado, Recusado or Solicitar Revisão')
    }

    try {
      var approvals = $app.findRecordsByFilter(
        'change_approvals',
        'change = "' + changeId + '" && approver = "' + userId + '" && status = "Pendente"',
        '',
        10,
        0,
      )
      if (approvals.length === 0) return e.notFoundError('No pending approval found')

      var change = $app.findRecordById('changes', changeId)
      // Verificar se o prazo de votação já expirou ANTES de registrar o voto
      var deadlineStr = change.getString('voting_deadline_at')
      if (deadlineStr) {
        var deadlineTime = new Date(deadlineStr).getTime()
        if (!isNaN(deadlineTime) && deadlineTime > 0 && new Date().getTime() > deadlineTime) {
          return e.badRequestError('O prazo de votação expirou. Esta mudança foi escalonada.')
        }
      }

      approvals.forEach(function (a) {
        a.set('status', decision)
        a.set('vote_type', decision)
        a.set('decision', comment)
        a.set('decided_at', new Date().toISOString())
        $app.save(a)
      })

      var oldStatus = change.getString('status')
      var oldApprovalStatus = change.getString('approval_status')
      var companyId = change.getString('company')

      // Identificar o comitê
      var committee = null
      var committeeType = 'Padrão'
      var changeTypeId = change.getString('change_type')
      var changeTypeName = ''
      if (changeTypeId) {
        try {
          var ct = $app.findRecordById('change_types', changeTypeId)
          changeTypeName = ct.getString('name') || ''
        } catch (_) {}
      }
      committeeType = changeTypeName === 'Mudança de Emergência' ? 'Emergencial' : 'Padrão'

      if (companyId) {
        try {
          committee = $app.findFirstRecordByFilter(
            'change_committee',
            'company = "' + companyId + '" && committee_type = "' + committeeType + '"',
          )
        } catch (_) {
          committee = null
        }
      }

      var chairpersonId = committee ? committee.getString('chairperson') : ''
      var isPresident = chairpersonId === userId

      var finalResult = '' // '', 'Aprovada', 'Recusada', 'Revisão'

      if (committeeType === 'Emergencial') {
        // Presidente -> decisão imediata
        if (isPresident) {
          if (decision === 'Aprovado') finalResult = 'Aprovada'
          else if (decision === 'Recusado') finalResult = 'Recusada'
          else finalResult = 'Revisão'
        }
      } else {
        // Comitê Padrão: contar votos
        var allApprovals = []
        try {
          allApprovals = $app.findRecordsByFilter(
            'change_approvals',
            'change = "' + changeId + '"',
            '',
            50,
            0,
          )
        } catch (_) {}

        var approved = 0
        var refused = 0
        var revision = 0
        for (var i = 0; i < allApprovals.length; i++) {
          var st = allApprovals[i].getString('status')
          if (st === 'Aprovado') approved++
          else if (st === 'Recusado') refused++
          else if (st === 'Solicitar Revisão') revision++
        }

        if (approved >= 3) finalResult = 'Aprovada'
        else if (refused >= 3) finalResult = 'Recusada'
        else if (revision > 0) {
          // notificar solicitante mas não finaliza
          finalResult = 'Revisão'
        }
      }

      // Aplicar resultado
      if (finalResult === 'Aprovada') {
        change.set('approval_status', 'Aprovada')
        change.set('status', 'Aprovada')
        change.set('approved_by', userId)
        change.set('approved_at', new Date().toISOString())
      } else if (finalResult === 'Recusada') {
        change.set('approval_status', 'Recusada')
        change.set('status', 'Recusada')
      } else if (finalResult === 'Revisão') {
        change.set('committee_decision', 'Solicitar Revisão')
      }
      $app.save(change)

      // Auditoria
      var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
      var log = new Record(auditCol)
      log.set('change', changeId)
      log.set('user', userId)
      log.set(
        'action',
        'Voto registrado: ' +
          decision +
          (finalResult === 'Aprovada'
            ? ' (Mudança APROVADA)'
            : finalResult === 'Recusada'
              ? ' (Mudança RECUSADA)'
              : ''),
      )
      log.set('field', 'approval_status')
      log.set('old_value', oldApprovalStatus)
      log.set('new_value', finalResult || 'Pendente')
      $app.save(log)

      // Notificar solicitante (e outros membros) do resultado
      var requesterId = change.getString('requester')
      var notifCol = $app.findCollectionByNameOrId('notifications')

      if (finalResult === 'Revisão' && requesterId) {
        try {
          var notif = new Record(notifCol)
          notif.set('user', requesterId)
          notif.set('title', 'Revisão solicitada na mudança')
          notif.set(
            'message',
            'Um membro do comitê solicitou revisão da Mudança #' + change.getString('number'),
          )
          notif.set('type', 'Aprovação')
          notif.set('read', false)
          $app.save(notif)
        } catch (_) {}
      } else if (requesterId) {
        try {
          var notif2 = new Record(notifCol)
          notif2.set('user', requesterId)
          notif2.set('title', 'Decisão de Mudança')
          notif2.set(
            'message',
            'Mudança #' +
              change.getString('number') +
              ' foi ' +
              (finalResult === 'Aprovada' ? 'aprovada' : 'recusada'),
          )
          notif2.set('type', 'Aprovação')
          notif2.set('read', false)
          $app.save(notif2)
        } catch (_) {}
      }

      // E-mail de resultado para membros + solicitante
      if (finalResult === 'Aprovada' || finalResult === 'Recusada') {
        var recipients = [] // {name, email}
        var memberIds = []
        if (committee) {
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

          for (var mi = 0; mi < memberIds.length; mi++) {
            var mid = memberIds[mi]
            var origin = memberTypeMap[mid] || 'user'
            if (origin === 'client_contact') {
              try {
                var cc = $app.findRecordById('client_contacts', mid)
                recipients.push({
                  name: cc.getString('full_name'),
                  email: cc.getString('email'),
                  vote: '',
                })
              } catch (_) {}
            } else {
              try {
                var u = $app.findRecordById('users', mid)
                recipients.push({
                  name: u.getString('name') || u.getString('email'),
                  email: u.getString('email'),
                  vote: '',
                })
              } catch (_) {}
            }
          }
        }

        // Anexar voto de cada membro
        var allA = []
        try {
          allA = $app.findRecordsByFilter(
            'change_approvals',
            'change = "' + changeId + '"',
            '',
            50,
            0,
          )
        } catch (_) {}
        var voteMap = {}
        for (var vi = 0; vi < allA.length; vi++) {
          voteMap[allA[vi].getString('approver')] = allA[vi].getString('status')
        }
        for (var ri = 0; ri < recipients.length; ri++) {
          if (recipients[ri].id === undefined) {
            // manter; para users o id é o email?? não — use name/email
          }
        }
        // refazer vote lookup por id
        for (var rj = 0; rj < recipients.length; rj++) {
          // recipients não tem id; precisamos correlacionar via email
        }

        // Solicitante
        if (requesterId) {
          try {
            var reqUser = $app.findRecordById('users', requesterId)
            var alreadyIn = false
            for (var ck = 0; ck < recipients.length; ck++) {
              if (recipients[ck].email === reqUser.getString('email')) {
                alreadyIn = true
                break
              }
            }
            if (!alreadyIn) {
              recipients.push({
                name: reqUser.getString('name') || reqUser.getString('email'),
                email: reqUser.getString('email'),
              })
            }
          } catch (_) {}
        }

        // Montar lista de votos (apenas usuários registrados)
        var voteLines = []
        var voterUsers = []
        if (committee) {
          for (var vui = 0; vui < memberIds.length; vui++) {
            var vmid = memberIds[vui]
            var vorigin = memberTypeMap[vmid] || 'user'
            var voterIdForLookup = vmid
            if (vorigin === 'client_contact') {
              try {
                var cc2 = $app.findRecordById('client_contacts', vmid)
                var lu = cc2.getString('user')
                if (lu) voterIdForLookup = lu
                else voterIdForLookup = ''
              } catch (_) {
                voterIdForLookup = ''
              }
            }
            var vname = ''
            var vemail = ''
            if (vorigin === 'client_contact') {
              try {
                var cc3 = $app.findRecordById('client_contacts', vmid)
                vname = cc3.getString('full_name')
                vemail = cc3.getString('email')
              } catch (_) {}
            } else {
              try {
                var uu = $app.findRecordById('users', vmid)
                vname = uu.getString('name') || uu.getString('email')
                vemail = uu.getString('email')
              } catch (_) {}
            }
            var vvote = voterIdForLookup ? voteMap[voterIdForLookup] || 'Pendente' : 'Pendente'
            voteLines.push('- ' + vname + ': ' + vvote)
          }
        }

        var changeNumber = change.getString('number')
        var changeTitle = change.getString('title')
        var companyName = ''
        try {
          if (companyId) {
            var comp = $app.findRecordById('companies', companyId)
            companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
          }
        } catch (_) {}
        var frontendUrl = ($os.getenv('FRONTEND_URL') || '').replace(/\/$/, '')
        var link = frontendUrl + '/changes/' + change.id
        var resultText = finalResult === 'Aprovada' ? 'APROVADA' : 'RECUSADA'

        var subject =
          '[Comitê ' + committeeType + '] Resultado: Mudança #' + changeNumber + ' ' + resultText
        var bodyText =
          'A mudança #' +
          changeNumber +
          ' foi ' +
          resultText +
          ' pelo comitê ' +
          committeeType +
          '.\n\n' +
          'Título: ' +
          changeTitle +
          '\n' +
          'Empresa: ' +
          (companyName || '-') +
          '\n\n' +
          'Votos dos membros:\n' +
          voteLines.join('\n') +
          '\n\nLink: ' +
          link

        var isApproved = finalResult === 'Aprovada'
        for (var ei = 0; ei < recipients.length; ei++) {
          if (!recipients[ei].email) continue
          try {
            var message = new MailerMessage()
            message.from = { address: 'noreply@logositsm.com.br', name: 'Lógos AITSM' }
            message.to = [{ address: recipients[ei].email }]
            message.subject = subject
            message.text = bodyText

            if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
              var esc =
                globalThis.itsmEscapeHtml ||
                function (s) {
                  return s || ''
                }
              var statusColor = isApproved ? '#16A34A' : '#DC2626'
              var statusBg = isApproved ? '#DCFCE7' : '#FEE2E2'

              var votesHtml =
                '<ul style="margin: 8px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px;">'
              for (var vi = 0; vi < voteLines.length; vi++) {
                votesHtml += '<li style="margin-bottom: 4px;">' + esc(voteLines[vi]) + '</li>'
              }
              votesHtml += '</ul>'

              var contentHtml =
                '<p style="margin: 0 0 16px 0; font-size: 15px; color: #1E293B;">A Mudança <strong>#' +
                esc(changeNumber) +
                '</strong> teve sua votação concluída pelo Comitê <strong>' +
                esc(committeeType) +
                '</strong>.</p>' +
                '<div style="background-color: ' +
                statusBg +
                '; border-left: 4px solid ' +
                statusColor +
                '; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">' +
                '  <div style="font-size: 13px; color: #64748B; text-transform: uppercase; font-weight: 700;">Resultado Final:</div>' +
                '  <div style="font-size: 18px; font-weight: 800; color: ' +
                statusColor +
                '; margin-top: 2px;">' +
                esc(resultText) +
                '</div>' +
                '</div>' +
                '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 16px 0; font-size: 14px;">' +
                '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; width: 120px;">Título:</td><td style="padding: 10px 14px; color: #0F172A; font-weight: 600;">' +
                esc(changeTitle) +
                '</td></tr>' +
                '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; border-top: 1px solid #E2E8F0;">Empresa:</td><td style="padding: 10px 14px; color: #0F172A; border-top: 1px solid #E2E8F0;">' +
                esc(companyName || '-') +
                '</td></tr>' +
                '  <tr><td style="padding: 10px 14px; font-weight: bold; color: #64748B; border-top: 1px solid #E2E8F0; vertical-align: top;">Votos:</td><td style="padding: 10px 14px; color: #0F172A; border-top: 1px solid #E2E8F0;">' +
                votesHtml +
                '</td></tr>' +
                '</table>'

              var actionHtml =
                '<a href="' +
                esc(link) +
                '" style="display: inline-block; background-color: #D97706; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);">' +
                'Visualizar Mudança #' +
                esc(changeNumber) +
                '</a>'

              message.html = globalThis.itsmRenderBaseEmailTemplate({
                variant: isApproved ? 'brand' : 'critical',
                badgeText: 'Resultado Comitê ' + committeeType,
                title: 'Mudança #' + changeNumber + ': ' + resultText,
                subtitle: changeTitle,
                preheader: 'Resultado da deliberação: Mudança #' + changeNumber + ' ' + resultText,
                contentHtml: contentHtml,
                actionHtml: actionHtml,
                footerNote: 'Deliberação oficial do Comitê de Mudanças Lógos AITSM.',
              })
            }

            if (globalThis.sendSystemMailMessage) {
              globalThis.sendSystemMailMessage(message)
            } else {
              var mailClient = $app.newMailClient()
              mailClient.send(message)
            }
          } catch (err) {
            $app.logger().error('change_approval_decide mail error', 'error', err.message)
          }
        }
      }

      return e.json(200, {
        success: true,
        vote: decision,
        result: finalResult || 'Pendente',
        status: change.getString('status'),
      })
    } catch (err) {
      return e.internalServerError(err.message)
    }
  },
  $apis.requireAuth(),
)
