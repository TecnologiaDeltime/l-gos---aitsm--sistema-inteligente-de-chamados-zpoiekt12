// Cron job: escala mudanças cujo prazo de votação expirou.
// Roda a cada 15 minutos.
cronAdd('change_voting_deadline', '*/15 * * * *', function () {
  var now = new Date()
  var nowIso = now.toISOString()

  // Mudanças pendentes cujo prazo expirou
  var pending = []
  try {
    pending = $app.findRecordsByFilter(
      'changes',
      'approval_status = "Pendente" && voting_deadline_at != "" && voting_deadline_at <= "' +
        nowIso +
        '"',
      'voting_deadline_at',
      0,
      0,
    )
  } catch (err) {
    $app.logger().error('change_voting_deadline: query failed', 'error', err.message)
    return
  }

  if (pending.length === 0) return

  var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
  var notifCol = $app.findCollectionByNameOrId('notifications')
  var frontendUrl = ($os.getenv('FRONTEND_URL') || '').replace(/\/$/, '')

  // admins/gestores (destinatários do escalonamento)
  var managers = []
  try {
    managers = $app.findRecordsByFilter('users', 'role = "admin" || role = "gestor"', 'name', 0, 0)
  } catch (err) {
    $app.logger().error('change_voting_deadline: managers query failed', 'error', err.message)
  }

  for (var i = 0; i < pending.length; i++) {
    var change = pending[i]
    var changeId = change.id
    var changeNumber = change.getString('number')
    var changeTitle = change.getString('title')
    var companyId = change.getString('company')

    // Determinar tipo do comitê
    var committeeType = 'Padrão'
    var changeTypeId = change.getString('change_type')
    if (changeTypeId) {
      try {
        var ct = $app.findRecordById('change_types', changeTypeId)
        if (ct.getString('name') === 'Mudança de Emergência') committeeType = 'Emergencial'
      } catch (_) {}
    }

    // Carregar comitê
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

    // Votos registrados
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

    var chairpersonId = committee ? committee.getString('chairperson') : ''
    var presidentVote = ''
    var approved = 0
    var refused = 0
    var revision = 0
    for (var v = 0; v < allApprovals.length; v++) {
      var st = allApprovals[v].getString('status')
      var appr = allApprovals[v].getString('approver')
      if (appr === chairpersonId && st !== 'Pendente') presidentVote = st
      if (st === 'Aprovado') approved++
      else if (st === 'Recusado') refused++
      else if (st === 'Solicitar Revisão') revision++
    }

    var escalate = false // true => escalar para admins/gestores
    var finalizeAs = '' // 'Aprovada' | 'Recusada' | 'Revisão' | ''

    if (committeeType === 'Emergencial') {
      if (presidentVote) {
        if (presidentVote === 'Aprovado') finalizeAs = 'Aprovada'
        else if (presidentVote === 'Recusado') finalizeAs = 'Recusada'
        else finalizeAs = 'Revisão'
      } else {
        escalate = true
      }
    } else {
      // Comitê Padrão: maioria simples (3 votos). Se não atingiu, escalar.
      if (approved >= 3) finalizeAs = 'Aprovada'
      else if (refused >= 3) finalizeAs = 'Recusada'
      else escalate = true
    }

    var reasonText = ''
    var escalationTs = nowIso

    if (finalizeAs === 'Aprovada' || finalizeAs === 'Recusada') {
      change.set('approval_status', finalizeAs === 'Aprovada' ? 'Aprovada' : 'Recusada')
      change.set('status', finalizeAs === 'Aprovada' ? 'Aprovada' : 'Recusada')
      if (chairpersonId) {
        change.set('approved_by', chairpersonId)
        change.set('approved_at', escalationTs)
      }
      reasonText =
        'Prazo expirado. Decisão finalizada automaticamente com o voto do presidente (' +
        presidentVote +
        ') do comitê Emergencial.'
      change.set('escalation_reason', reasonText)
      try {
        $app.save(change)
      } catch (err) {
        $app.logger().error('change_voting_deadline: save finalize failed', 'error', err.message)
      }
    } else if (finalizeAs === 'Revisão') {
      change.set('committee_decision', 'Solicitar Revisão')
      reasonText =
        'Prazo expirado. Presidente solicitou revisão — mudança aguarda revisão do solicitante.'
      change.set('escalation_reason', reasonText)
      try {
        $app.save(change)
      } catch (err) {
        $app.logger().error('change_voting_deadline: save revision failed', 'error', err.message)
      }
    } else if (escalate) {
      var voteSummary =
        'Votos registrados até a expiração: ' +
        approved +
        ' aprovado(s), ' +
        refused +
        ' recusado(s), ' +
        revision +
        ' revisão.'
      reasonText =
        'Escalonamento automático por expiração do prazo de votação. ' +
        voteSummary +
        ' A decisão foi repassada aos administradores/gestores da empresa.'
      change.set('escalation_reason', reasonText)
      try {
        $app.save(change)
      } catch (err) {
        $app.logger().error('change_voting_deadline: save escalate failed', 'error', err.message)
      }
    }

    // --- Log de auditoria ---
    try {
      var log = new Record(auditCol)
      log.set('change', changeId)
      log.set('user', chairpersonId || '')
      log.set('action', 'Escalonamento automático por expiração do prazo de votação')
      log.set('field', 'approval_status')
      log.set('old_value', 'Pendente')
      var logNewVal = 'Pendente'
      if (finalizeAs === 'Aprovada') logNewVal = 'Aprovada'
      else if (finalizeAs === 'Recusada') logNewVal = 'Recusada'
      else if (finalizeAs === 'Revisão') logNewVal = 'Revisão'
      else if (escalate) logNewVal = 'Escalonado para gestão'
      log.set('new_value', logNewVal)
      $app.save(log)
    } catch (err) {
      $app.logger().error('change_voting_deadline: audit log failed', 'error', err.message)
    }

    // --- Destinatários das notificações: admins/gestores + membros do comitê + solicitante ---
    var notifRecipients = [] // {id, name, email}
    var seenIds = {}
    for (var m = 0; m < managers.length; m++) {
      if (!seenIds[managers[m].id]) {
        seenIds[managers[m].id] = true
        notifRecipients.push({
          id: managers[m].id,
          name: managers[m].getString('name') || managers[m].getString('email'),
          email: managers[m].getString('email'),
        })
      }
    }
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
      for (var mi = 0; mi < memberIds.length; mi++) {
        var mid = memberIds[mi]
        var origin = memberTypeMap[mid] || 'user'
        if (origin === 'client_contact') {
          try {
            var cc = $app.findRecordById('client_contacts', mid)
            var linkedUser = cc.getString('user')
            if (linkedUser && !seenIds[linkedUser]) {
              seenIds[linkedUser] = true
              notifRecipients.push({
                id: linkedUser,
                name: cc.getString('full_name'),
                email: cc.getString('email'),
              })
            } else if (!linkedUser) {
              notifRecipients.push({
                id: 'cc:' + mid,
                name: cc.getString('full_name'),
                email: cc.getString('email'),
              })
            }
          } catch (_) {}
        } else {
          try {
            var u = $app.findRecordById('users', mid)
            if (!seenIds[u.id]) {
              seenIds[u.id] = true
              notifRecipients.push({
                id: u.id,
                name: u.getString('name') || u.getString('email'),
                email: u.getString('email'),
              })
            }
          } catch (_) {}
        }
      }
    }
    var requesterId = change.getString('requester')
    if (requesterId) {
      try {
        var reqUser = $app.findRecordById('users', requesterId)
        if (!seenIds[reqUser.id]) {
          seenIds[reqUser.id] = true
          notifRecipients.push({
            id: reqUser.id,
            name: reqUser.getString('name') || reqUser.getString('email'),
            email: reqUser.getString('email'),
          })
        }
      } catch (_) {}
    }

    // Texto descritivo do resultado
    var humanResult = ''
    if (finalizeAs === 'Aprovada')
      humanResult = 'Decisão finalizada como APROVADA com o voto do presidente.'
    else if (finalizeAs === 'Recusada')
      humanResult = 'Decisão finalizada como RECUSADA com o voto do presidente.'
    else if (finalizeAs === 'Revisão')
      humanResult = 'Presidente solicitou revisão — aguarde revisão do solicitante.'
    else if (escalate) humanResult = 'Escalonada para os administradores/gestores decidirem.'

    var notifTitle = 'Prazo de votação expirado - Mudança #' + changeNumber
    var notifMsg =
      'O prazo de votação da Mudança #' +
      changeNumber +
      ' - ' +
      changeTitle +
      ' expirou. ' +
      humanResult

    // Notificações in-app
    for (var n = 0; n < notifRecipients.length; n++) {
      var nr = notifRecipients[n]
      if (nr.id.indexOf('cc:') === 0) continue
      try {
        var notif = new Record(notifCol)
        notif.set('user', nr.id)
        notif.set('title', notifTitle)
        notif.set('message', notifMsg)
        notif.set('type', 'Sistema')
        notif.set('read', false)
        $app.save(notif)
      } catch (_) {}
    }

    // E-mails
    var link = frontendUrl + '/changes/' + changeId
    var subject = '[Comitê ' + committeeType + '] Prazo expirado - Mudança #' + changeNumber
    var bodyText =
      'Olá,\n\n' +
      'O prazo de votação da Mudança #' +
      changeNumber +
      ' - ' +
      changeTitle +
      ' expirou em ' +
      new Date(escalationTs).toLocaleString('pt-BR') +
      '.\n\n' +
      'Comitê: ' +
      committeeType +
      '\n' +
      'Resultado do escalonamento: ' +
      humanResult +
      '\n\n' +
      'Votos registrados até a expiração:\n' +
      '- Aprovados: ' +
      approved +
      '\n' +
      '- Recusados: ' +
      refused +
      '\n' +
      '- Solicitar Revisão: ' +
      revision +
      '\n\n' +
      'Link: ' +
      link

    for (var e = 0; e < notifRecipients.length; e++) {
      if (!notifRecipients[e].email) continue
      try {
        var message = new MailMessage()
        message.from = { address: 'noreply@serviceone.com.br', name: 'ServiceOne' }
        message.to = [{ address: notifRecipients[e].email }]
        message.subject = subject
        message.text = bodyText
        if (globalThis.sendSystemMailMessage) {
          globalThis.sendSystemMailMessage(message)
        } else {
          var mailClient = $app.newMailClient()
          mailClient.send(message)
        }
      } catch (err) {
        $app.logger().error('change_voting_deadline mail error', 'error', err.message)
      }
    }
  }

  $app.logger().info('change_voting_deadline: processed ' + pending.length + ' expired change(s)')
})
