onRecordAfterCreateSuccess((e) => {
  var change = e.record

  // Mudanças em Rascunho não acionam o fluxo de aprovação
  var currentStatus = change.getString('status')
  if (currentStatus === 'Rascunho') return e.next()

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
        var std = $app.findRecordById('changes', change.id)
        std.set('approval_status', 'Não Requerida')
        $app.save(std)
        return e.next()
      }
    } catch (_) {}
  }

  // Emergência -> comitê Emergencial; demais -> comitê Padrão
  var committeeType = changeTypeName === 'Mudança de Emergência' ? 'Emergencial' : 'Padrão'

  var requesterId = change.getString('requester')
  if (!requesterId && e.auth) requesterId = e.auth.id
  if (!requesterId) return e.next()

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
    if (Array.isArray(rawMt)) {
      // goja returns JSON as map-like; fallback below
    }
    if (typeof rawMt === 'string' && rawMt !== '') {
      try {
        memberTypeMap = JSON.parse(rawMt)
      } catch (_) {}
    }
    // goja may return object directly
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
            // contato sem usuário vinculado — armazenar como contato para notificação por e-mail
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
    if (memberUsers.length === 0) return e.next()
  }

  try {
    var approvalsCol = $app.findCollectionByNameOrId('change_approvals')
    var createdApprovals = []
    for (var k = 0; k < memberUsers.length; k++) {
      var m = memberUsers[k]
      if (m.id.indexOf('cc:') === 0) continue // não há usuário para registrar o voto
      try {
        var approval = new Record(approvalsCol)
        approval.set('change', change.id)
        approval.set('approver', m.id)
        approval.set('status', 'Pendente')
        $app.save(approval)
        createdApprovals.push(m)
      } catch (_) {}
    }

    var changeRec = $app.findRecordById('changes', change.id)
    changeRec.set('approval_status', 'Pendente')
    changeRec.set('status', 'Aguardando Aprovação')

    // Prazo de votação: agora + voting_deadline_hours do comitê (default 48h)
    var deadlineHours = 48
    if (committee) {
      var dh = committee.get('voting_deadline_hours')
      if (dh && !isNaN(dh) && dh > 0) deadlineHours = dh
    }
    var deadlineAt = new Date()
    deadlineAt.setHours(deadlineAt.getHours() + deadlineHours)
    changeRec.set('voting_deadline_at', deadlineAt.toISOString())
    $app.save(changeRec)

    var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
    var log = new Record(auditCol)
    log.set('change', change.id)
    log.set('user', requesterId)
    log.set('action', 'Aprovação solicitada ao comitê (' + committeeType + ')')
    log.set('field', 'status')
    log.set('old_value', currentStatus)
    log.set('new_value', 'Aguardando Aprovação')
    $app.save(log)

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
        if (deadlineAt) {
          notifMsg +=
            ' — prazo de votação até ' +
            deadlineAt.toLocaleString('pt-BR') +
            ' (' +
            deadlineHours +
            'h)'
        }
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
          (deadlineAt
            ? '\n\nPrazo de votação: ' +
              deadlineAt.toLocaleString('pt-BR') +
              ' (' +
              deadlineHours +
              'h)'
            : '')

        var message = new MailerMessage()
        message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne' }
        message.to = [{ address: dest.email }]
        message.subject = subject
        message.text = bodyText
        if (globalThis.sendSystemMailMessage) {
          globalThis.sendSystemMailMessage(message)
        } else {
          var mailClient = $app.newMailClient()
          mailClient.send(message)
        }
      } catch (err) {
        $app.logger().error('change_approval_check mail error', 'error', err.message)
      }
    }
  } catch (err) {
    $app.logger().error('change_approval_check error', 'error', err.message)
  }

  return e.next()
}, 'changes')
