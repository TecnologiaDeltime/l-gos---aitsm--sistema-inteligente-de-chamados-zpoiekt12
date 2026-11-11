// Cron job: escala mudanças cujo prazo de votação expirou.
// Roda a cada 15 minutos.
//
// CORREÇÃO BUG 1:
// - Cada prazo expirado gera NO MÁXIMO 1 alerta por Mudança e por destinatário.
// - Marcação persistente imediata: `voting_deadline_notified_at` é gravado no início do processamento.
// - Anti-duplicidade estrita de e-mail: registro em `email_sent_logs` antes/durante cada envio.
// - Helpers autocontidos: no ambiente PocketBase JSVM Goja pool, funções globais podem não estar
//   disponíveis entre escopos. O hook inclui implementação autocontida completa com verificação
//   do switch `change_voting_deadline` em `email_alert_settings`, layout oficial e transporte Skip Cloud puro.
// - Eliminação de duplicação: agrupamento estrito de destinatários por e-mail normalizado
//   (evitando envio concorrente para a mesma pessoa que é admin, gestor e membro do comitê ao mesmo tempo).

cronAdd('change_voting_deadline', '*/15 * * * *', function () {
  var now = new Date()
  var nowIso = now.toISOString()

  // 1. Helpers autocontidos (escopo local protegido)
  function localGetEmailAlertConfig(alertKey) {
    if (!alertKey) return null
    try {
      var cleanKey = String(alertKey).trim().replace(/"/g, '\\"')
      var rec = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "' + cleanKey + '"',
      )
      if (!rec) return null
      return {
        id: rec.id,
        alert_key: rec.getString('alert_key'),
        enabled: rec.getBool('enabled'),
        recipient_types: rec.getString('recipient_types') || '',
        template_layout: rec.getString('template_layout') || 'corporate',
        primary_color: rec.getString('primary_color') || '#4B5563',
        subject_template: rec.getString('subject_template') || '',
        header_title: rec.getString('header_title') || '',
        header_subtitle: rec.getString('header_subtitle') || '',
        body_template: rec.getString('body_template') || '',
        footer_text: rec.getString('footer_text') || '',
        show_button: rec.getBool('show_button'),
        button_label: rec.getString('button_label') || 'Consultar RDM',
        button_url_template: rec.getString('button_url_template') || '',
        is_customized: rec.getBool('is_customized'),
        default_subject_template: rec.getString('default_subject_template') || '',
        default_body_template: rec.getString('default_body_template') || '',
      }
    } catch (err) {
      console.error(
        '[change_voting_deadline] localGetEmailAlertConfig error: ' +
          (err && err.message ? err.message : String(err)),
      )
      return null
    }
  }

  function localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient) {
    if (!alertKey || !referenceId || !recipient) return false
    try {
      var cleanAlertKey = String(alertKey).trim().replace(/"/g, '\\"')
      var cleanRefId = String(referenceId).trim().replace(/"/g, '\\"')
      var cleanRecipient = String(recipient).trim().toLowerCase().replace(/"/g, '\\"')

      var rec = null
      try {
        rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "' +
            cleanAlertKey +
            '" && reference_id = "' +
            cleanRefId +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
      } catch (_) {
        return false
      }

      if (rec) {
        console.log(
          '[change_voting_deadline] already_sent — envio pulado | alert_key=' +
            cleanAlertKey +
            ' | ref=' +
            cleanRefId +
            ' | recipient=' +
            cleanRecipient,
        )
        return true
      }
      return false
    } catch (err) {
      console.warn(
        '[change_voting_deadline] falha na verificação de duplicidade: ' +
          (err && err.message ? err.message : String(err)),
      )
      return false
    }
  }

  function localRecordEmailSentLog(alertKey, referenceId, recipient, subject, meta) {
    if (!alertKey || !referenceId || !recipient) return
    try {
      var col = $app.findCollectionByNameOrId('email_sent_logs')
      var cleanRecipient = String(recipient).trim().toLowerCase()
      var log = new Record(col)
      var nowFormatted = new Date().toISOString().replace('T', ' ')
      log.set('alert_key', String(alertKey).trim())
      log.set('reference_id', String(referenceId).trim())
      log.set('recipient', cleanRecipient)
      log.set('sent_at', nowFormatted)
      log.set('subject', subject || '')
      if (meta) log.set('meta', meta)
      $app.save(log)
    } catch (err) {
      console.warn(
        '[change_voting_deadline] falha ao salvar log em email_sent_logs: ' +
          (err && err.message ? err.message : String(err)),
      )
    }
  }

  function localInterpolateTemplate(template, data) {
    if (!template) return ''
    var normalizedData = {}
    if (data && typeof data === 'object') {
      var inKeys = Object.keys(data)
      for (var j = 0; j < inKeys.length; j++) {
        normalizedData[inKeys[j]] = data[inKeys[j]]
      }
    }

    var result = template
    var keys = Object.keys(normalizedData)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var val = normalizedData[k] == null ? '' : String(normalizedData[k])
      var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
      result = result.replace(regex, val)
    }

    result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
    return result
  }

  function localBuildEmailHtmlFromConfig(cfg, data) {
    var primaryColor = (cfg && cfg.primary_color) || '#4B5563'
    var layout = (cfg && cfg.template_layout) || 'corporate'
    var headerTitle = (cfg && cfg.header_title) || 'Lógos AITSM'
    var headerSubtitle = (cfg && cfg.header_subtitle) || 'Comitê de Mudanças - Notificação de Prazo'
    var footerText = (cfg && cfg.footer_text) || 'Lógos AITSM • Sistema de Gestão de Mudanças'

    var bodyContent = localInterpolateTemplate((cfg && cfg.body_template) || '', data)
    var buttonLabel = localInterpolateTemplate((cfg && cfg.button_label) || 'Consultar RDM', data)
    var buttonUrl = localInterpolateTemplate((cfg && cfg.button_url_template) || '', data)
    var showButton = Boolean(cfg && cfg.show_button && buttonUrl)

    var buttonHtml = ''
    if (showButton) {
      buttonHtml =
        '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">' +
        '<tr>' +
        '<td align="center" style="border-radius: 6px; background-color: ' +
        primaryColor +
        ';">' +
        '<a href="' +
        buttonUrl +
        '" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 6px; border: 1px solid ' +
        primaryColor +
        '; display: inline-block; font-weight: 600;">' +
        buttonLabel +
        '</a>' +
        '</td>' +
        '</tr>' +
        '</table>'
    }

    if (layout === 'minimal') {
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f9fafb; color: #111827;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">' +
        '<tr><td style="padding: 24px 32px; border-bottom: 2px solid ' +
        primaryColor +
        ';">' +
        '<span style="font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">' +
            headerSubtitle +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding: 32px; line-height: 1.6; font-size: 15px; color: #374151;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">' +
        footerText +
        '</td></tr>' +
        '</table></body></html>'
      )
    }

    // Layout Corporate (padrão de mudanças)
    return (
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
      '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #0f172a; color: #0f172a;">' +
      '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">' +
      '<tr><td style="padding: 28px 36px; background-color: #17181C; border-bottom: 4px solid ' +
      primaryColor +
      '; text-align: left;">' +
      '<span style="font-size: 22px; font-weight: 900; color: #FCD34D; letter-spacing: 0.5px; text-transform: uppercase;">' +
      headerTitle +
      '</span>' +
      (headerSubtitle
        ? '<p style="margin: 6px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 400;">' +
          headerSubtitle +
          '</p>'
        : '') +
      '</td></tr>' +
      '<tr><td style="padding: 36px; line-height: 1.7; font-size: 15px; color: #1e293b;">' +
      bodyContent +
      buttonHtml +
      '</td></tr>' +
      '<tr><td style="padding: 22px 36px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
      footerText +
      '</td></tr>' +
      '</table></body></html>'
    )
  }

  function localSendAlertEmail(opts) {
    if (!opts) return { sent: false, reason: 'opts_missing' }
    var alertKey = opts.alert_key || 'change_voting_deadline'
    var referenceId = opts.reference_id || ''
    var recipient = String(opts.recipient || '')
      .trim()
      .toLowerCase()

    if (!recipient || recipient.indexOf('@') <= 0) {
      return { sent: false, reason: 'invalid_recipient' }
    }

    // 1. Anti-duplicidade em email_sent_logs
    if (referenceId && localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient)) {
      return { sent: false, reason: 'already_sent' }
    }

    // 2. Configuração na Central de Alertas
    var cfg = localGetEmailAlertConfig(alertKey)
    if (!cfg) {
      console.log(
        '[change_voting_deadline] alerta não cadastrado em email_alert_settings — envio pulado | alert_key=' +
          alertKey,
      )
      return { sent: false, reason: 'alert_config_missing' }
    }

    if (!cfg.enabled) {
      console.log(
        '[change_voting_deadline] alerta DESLIGADO na Central de Alertas — envio suprimido | alert_key=' +
          alertKey +
          ' | recipient=' +
          recipient,
      )
      return { sent: false, reason: 'alert_disabled_by_config' }
    }

    var data = opts.data || {}
    var rawSubject =
      cfg.subject_template ||
      cfg.default_subject_template ||
      opts.subject ||
      '[Comitê] Prazo Expirado - Mudança'
    var subject = localInterpolateTemplate(rawSubject, data)

    if (!cfg.body_template && cfg.default_body_template) {
      cfg.body_template = cfg.default_body_template
    }

    var htmlContent = localBuildEmailHtmlFromConfig(cfg, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var textFallback =
      opts.fallbackText || localInterpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

    var senderAddress = 'noreply@logositsm.com.br'
    var senderName = 'Lógos AITSM'
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.meta && s.meta.senderAddress) senderAddress = s.meta.senderAddress
      if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
    } catch (_) {}

    try {
      var message = new MailerMessage({
        from: {
          address: senderAddress,
          name: senderName,
        },
        to: [{ address: recipient }],
        subject: subject,
        html: htmlContent,
        text: textFallback,
      })

      var client = $app.newMailClient()
      client.send(message)

      if (referenceId) {
        localRecordEmailSentLog(alertKey, referenceId, recipient, subject, {
          template_layout: cfg.template_layout,
          primary_color: cfg.primary_color,
          transport: 'skip_cloud',
        })
      }

      console.log(
        '[change_voting_deadline] enviado com sucesso via Skip Cloud | alert_key=' +
          alertKey +
          ' | recipient=' +
          recipient +
          ' | subject=' +
          subject,
      )
      return { sent: true }
    } catch (err) {
      var errDesc = err && err.message ? err.message : String(err)
      console.error(
        '[change_voting_deadline] FALHA no envio Skip Cloud | alert_key=' +
          alertKey +
          ' | recipient=' +
          recipient +
          ' | motivo: ' +
          errDesc,
      )
      return { sent: false, reason: 'send_failed', error: errDesc }
    }
  }

  // 2. Mudanças pendentes cujo prazo expirou e que ainda NÃO foram notificadas
  var pending = []
  try {
    pending = $app.findRecordsByFilter(
      'changes',
      'approval_status = "Pendente" && voting_deadline_at != "" && voting_deadline_at <= "' +
        nowIso +
        '" && (voting_deadline_notified_at = "" || voting_deadline_notified_at = null)',
      'voting_deadline_at',
      0,
      0,
    )
  } catch (err) {
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
    } catch (fallbackErr) {
      $app.logger().error('change_voting_deadline: query failed', 'error', fallbackErr.message)
      return
    }
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

    // Verificação de segurança: se já estiver marcado no registro, pular imediatamente
    var alreadyNotified = change.getString('voting_deadline_notified_at')
    if (alreadyNotified) {
      console.log(
        '[change_voting_deadline] mudança #' +
          changeNumber +
          ' já marcada com voting_deadline_notified_at=' +
          alreadyNotified +
          ' — pulando para evitar reenvio',
      )
      continue
    }

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

    // MARCAÇÃO ANTECIPADA: grava voting_deadline_notified_at no banco
    // ANTES de despachar e-mails, garantindo que mesmo se o envio for interrompido
    // a Mudança nunca seja processada duas vezes no ciclo de 15 min.
    change.set('voting_deadline_notified_at', escalationTs)

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
    // Eliminação de duplicação: agrupamento unificado por e-mail e por ID
    var notifRecipients = [] // {id, name, email}
    var seenEmails = {}
    var seenUserIds = {}

    function addRecipient(uid, name, email) {
      var cleanEmail = String(email || '')
        .trim()
        .toLowerCase()
      if (!cleanEmail || cleanEmail.indexOf('@') <= 0) return
      if (seenEmails[cleanEmail]) return
      seenEmails[cleanEmail] = true
      if (uid && !seenUserIds[uid]) {
        seenUserIds[uid] = true
      }
      notifRecipients.push({
        id: uid || '',
        name: name || cleanEmail,
        email: cleanEmail,
      })
    }

    for (var m = 0; m < managers.length; m++) {
      addRecipient(
        managers[m].id,
        managers[m].getString('name') || managers[m].getString('email'),
        managers[m].getString('email'),
      )
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
            addRecipient(
              linkedUser || 'cc:' + mid,
              cc.getString('full_name'),
              cc.getString('email'),
            )
          } catch (_) {}
        } else {
          try {
            var u = $app.findRecordById('users', mid)
            addRecipient(u.id, u.getString('name') || u.getString('email'), u.getString('email'))
          } catch (_) {}
        }
      }
    }

    var requesterId = change.getString('requester')
    if (requesterId) {
      try {
        var reqUser = $app.findRecordById('users', requesterId)
        addRecipient(
          reqUser.id,
          reqUser.getString('name') || reqUser.getString('email'),
          reqUser.getString('email'),
        )
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
      if (!nr.id || nr.id.indexOf('cc:') === 0) continue
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

    // E-mails via Skip Cloud puro com anti-duplicidade em email_sent_logs
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
      var recipientEmail = notifRecipients[e].email
      if (!recipientEmail) continue

      localSendAlertEmail({
        alert_key: 'change_voting_deadline',
        reference_id: changeId,
        recipient: recipientEmail,
        subject: subject,
        data: {
          mudanca_numero: changeNumber,
          titulo: changeTitle,
          comite_tipo: committeeType,
          data_expiracao: new Date(escalationTs).toLocaleString('pt-BR'),
          data_hora: new Date(escalationTs).toLocaleString('pt-BR'),
          resultado_escalonamento: humanResult,
          status: humanResult,
          resumo_votos:
            approved + ' aprovado(s), ' + refused + ' recusado(s), ' + revision + ' revisão',
          link: link,
          responsavel: notifRecipients[e].name || 'Membro do Comitê',
        },
        fallbackText: bodyText,
      })
    }
  }

  $app.logger().info('change_voting_deadline: processed ' + pending.length + ' expired change(s)')
})
