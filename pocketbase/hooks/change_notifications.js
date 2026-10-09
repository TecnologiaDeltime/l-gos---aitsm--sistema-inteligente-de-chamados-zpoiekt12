onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = record.getString('status')

  if (oldStatus === newStatus) return e.next()

  var changeId = record.id
  var changeNumber = record.getString('number')
  var changeTitle = record.getString('title')
  var companyId = record.getString('company')

  // Determinar comitê (Emergencial se tipo Emergência, senão Padrão)
  var committeeType = 'Padrão'
  var changeTypeId = record.getString('change_type')
  if (changeTypeId) {
    try {
      var ct = $app.findRecordById('change_types', changeTypeId)
      if (ct.getString('name') === 'Mudança de Emergência') committeeType = 'Emergencial'
    } catch (_) {}
  }

  var committee = null
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

  // Coletar destinatários (membros do comitê + solicitante)
  var recipients = [] // {name, email}
  if (committee) {
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

    var seenEmails = {}
    for (var i = 0; i < memberIds.length; i++) {
      var mid = memberIds[i]
      var origin = memberTypeMap[mid] || 'user'
      var name = ''
      var email = ''
      if (origin === 'client_contact') {
        try {
          var cc = $app.findRecordById('client_contacts', mid)
          name = cc.getString('full_name')
          email = cc.getString('email')
        } catch (_) {}
      } else {
        try {
          var u = $app.findRecordById('users', mid)
          name = u.getString('name') || u.getString('email')
          email = u.getString('email')
        } catch (_) {}
      }
      if (email && !seenEmails[email]) {
        seenEmails[email] = true
        recipients.push({ name: name, email: email })
      }
    }
  }

  // Solicitante
  var requesterId = record.getString('requester')
  if (requesterId) {
    try {
      var reqUser = $app.findRecordById('users', requesterId)
      var reqEmail = reqUser.getString('email')
      var reqName = reqUser.getString('name') || reqEmail
      var alreadyIn = false
      for (var ck = 0; ck < recipients.length; ck++) {
        if (recipients[ck].email === reqEmail) {
          alreadyIn = true
          break
        }
      }
      if (!alreadyIn && reqEmail) {
        recipients.push({ name: reqName, email: reqEmail })
      }
    } catch (_) {}
  }

  if (recipients.length === 0) return e.next()

  var frontendUrl = ($os.getenv('FRONTEND_URL') || '').replace(/\/$/, '')
  var link = frontendUrl + '/changes/' + changeId
  var subject = ''
  var bodyText = ''

  if (newStatus === 'Aguardando Aprovação' && oldStatus === 'Rascunho') {
    // RDM enviada para aprovação a partir de rascunho — notificar membros com o prazo
    var deadlineStr = record.getString('voting_deadline_at')
    var deadlineLine = ''
    if (deadlineStr) {
      try {
        deadlineLine = '\nPrazo de votação: ' + new Date(deadlineStr).toLocaleString('pt-BR')
      } catch (_) {}
    }
    subject = '[Comitê] Mudança #' + changeNumber + ' enviada para aprovação'
    bodyText =
      'A mudança #' +
      changeNumber +
      ' - ' +
      changeTitle +
      ' foi enviada para aprovação do comitê.' +
      deadlineLine +
      '\n\nLink: ' +
      link
  } else if (newStatus === 'Em Execução') {
    subject = '[Comitê] Mudança #' + changeNumber + ' iniciou execução'
    bodyText =
      'A mudança #' +
      changeNumber +
      ' - ' +
      changeTitle +
      ' iniciou a execução.\n\n' +
      'Status anterior: ' +
      oldStatus +
      '\n' +
      'Link: ' +
      link
  } else if (newStatus === 'Concluída') {
    subject = '[Comitê] Mudança #' + changeNumber + ' concluída'
    var closureNotes = record.getString('closure_notes') || ''
    bodyText =
      'A mudança #' +
      changeNumber +
      ' - ' +
      changeTitle +
      ' foi concluída.\n\n' +
      'Resultado informado pelo executor:\n' +
      (closureNotes || '(sem notas de encerramento)') +
      '\n\n' +
      'Link: ' +
      link
  } else {
    return e.next()
  }

  for (var ei = 0; ei < recipients.length; ei++) {
    if (!recipients[ei].email) continue
    try {
      var message = new MailerMessage()
      message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne' }
      message.to = [{ address: recipients[ei].email }]
      message.subject = subject
      message.text = bodyText
      if (globalThis.sendSystemMailMessage) {
        globalThis.sendSystemMailMessage(message)
      } else {
        var mailClient = $app.newMailClient()
        mailClient.send(message)
      }
    } catch (err) {
      $app.logger().error('change_notifications mail error', 'error', err.message)
    }
  }

  return e.next()
}, 'changes')
