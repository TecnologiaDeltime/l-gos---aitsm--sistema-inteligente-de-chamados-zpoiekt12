onRecordCreateRequest((e) => {
  var body = e.requestInfo().body || {}
  var companyId = body.company || ''
  if (!companyId) return e.next()

  try {
    var blocking = $app.findFirstRecordByFilter(
      'blocking_records',
      'client = "' + companyId + '" && active = true',
    )
  } catch (_) {
    return e.next()
  }

  var blockType = blocking.getString('block_type')
  var allowCritical = blocking.getBool('allow_critical')
  var priority = body.priority || ''

  if (allowCritical && priority === 'P1') return e.next()

  var source = body.source || 'Portal'
  var shouldBlock = false

  if (blockType === 'Bloquear Todos Canais') {
    shouldBlock = true
  } else if (blockType === 'Bloquear Abertura Portal' && source === 'Portal') {
    shouldBlock = true
  } else if (blockType === 'Bloquear Abertura Email' && source === 'E-mail') {
    shouldBlock = true
  } else if (blockType === 'Bloquear Abertura API' && source === 'API') {
    shouldBlock = true
  } else if (blockType === 'Permitir Somente Críticos' && priority !== 'P1') {
    shouldBlock = true
  }

  if (shouldBlock) {
    try {
      var attemptsCol = $app.findCollectionByNameOrId('blocked_attempts')
      var attempt = new Record(attemptsCol)
      attempt.set('client', companyId)
      attempt.set('requester_email', body.requester_email || '')
      attempt.set('channel', source === 'E-mail' ? 'Email' : 'Portal')
      attempt.set('blocked', true)
      attempt.set('notes', blocking.getString('message') || 'Tentativa bloqueada')
      $app.save(attempt)

      var auditCol = $app.findCollectionByNameOrId('audit_logs')
      var audit = new Record(auditCol)
      audit.set('user', e.auth ? e.auth.id : '')
      audit.set('action', 'Tentativa de abertura bloqueada')
      audit.set('entity_type', 'company')
      audit.set('entity_id', companyId)
      audit.set('description', 'Cliente bloqueado tentou abrir chamado via ' + source)
      $app.save(audit)
    } catch (err) {
      $app.logger().error('Error logging blocked attempt', 'error', err.message)
    }

    var msg =
      blocking.getString('message') ||
      'Atendimento temporariamente suspenso. Entre em contato com o suporte.'
    return e.badRequestError(msg)
  }

  if (source === 'E-mail') {
    try {
      var domains = $app.findRecordsByFilter(
        'client_email_domains',
        'client = "' + companyId + '" && active = true',
        '',
        0,
        0,
      )
      if (domains.length > 0) {
        var reqEmail = body.requester_email || ''
        var emailDomain = ''
        var atIdx = reqEmail.lastIndexOf('@')
        if (atIdx >= 0) {
          emailDomain = reqEmail.substring(atIdx + 1).toLowerCase()
        }
        var domainAllowed = false
        for (var di = 0; di < domains.length; di++) {
          var dVal = domains[di].getString('domain').toLowerCase()
          if (dVal.startsWith('@')) dVal = dVal.substring(1)
          if (dVal === emailDomain) {
            domainAllowed = true
            break
          }
        }
        if (!domainAllowed) {
          try {
            var attCol = $app.findCollectionByNameOrId('blocked_attempts')
            var attRec = new Record(attCol)
            attRec.set('client', companyId)
            attRec.set('requester_email', reqEmail)
            attRec.set('channel', 'Email')
            attRec.set('blocked', true)
            attRec.set('notes', 'Domínio não autorizado: ' + emailDomain)
            $app.save(attRec)
          } catch (logErr) {
            $app.logger().error('Error logging domain blocked attempt', 'error', logErr.message)
          }
          return e.badRequestError(
            'Domínio de e-mail não autorizado para abertura de chamados para este cliente.',
          )
        }
      }
    } catch (domErr) {
      // client_email_domains collection might not exist yet
    }
  }

  return e.next()
}, 'tickets')
