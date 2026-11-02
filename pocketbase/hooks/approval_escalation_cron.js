cronAdd('approval_escalation_cron', '* * * * *', function () {
  var now = new Date()
  var nowIso = now.toISOString()

  // Busca aprovações sequenciais que estão Pendentes e cujo prazo de contingência expirou
  var expiredApprovals = []
  try {
    expiredApprovals = $app.findRecordsByFilter(
      'approvals',
      'status = "Pendente" && mode = "Sequencial" && escalation_deadline != "" && escalation_deadline <= "' +
        nowIso +
        '"',
      'created',
      50,
      0,
    )
  } catch (err) {
    $app.logger().error('approval_escalation_cron: query failed', 'error', err.message)
    return
  }

  if (expiredApprovals.length === 0) return

  var approvalsCol = $app.findCollectionByNameOrId('approvals')
  var historyCol = $app.findCollectionByNameOrId('ticket_history')
  var notifCol = $app.findCollectionByNameOrId('notifications')

  var backendBase = (
    $os.getenv('PB_INSTANCE_URL') ||
    $os.getenv('SITE_URL') ||
    'https://sistema-itsm-de-chamados-b1534.shrd03.internal.goskip.dev'
  ).replace(/\/$/, '')

  // Descriptografia autocontida AES-256
  function safeDecryptSecret(val) {
    if (!val || typeof val !== 'string') return ''
    val = val.trim()
    var PREFIX = 'enc:v1:'
    if (val.indexOf(PREFIX) !== 0) return val
    if (typeof globalThis !== 'undefined' && typeof globalThis.itsmDecrypt === 'function') {
      try {
        var decGlobal = globalThis.itsmDecrypt(val)
        if (decGlobal && decGlobal.indexOf(PREFIX) !== 0) return decGlobal
      } catch (_) {}
    }
    try {
      var k = ''
      if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
        k = $os.getenv('ITSM_ENCRYPTION_KEY') || ''
      }
      if (!k && typeof $secrets !== 'undefined' && typeof $secrets.get === 'function') {
        k = $secrets.get('ITSM_ENCRYPTION_KEY') || ''
      }
      if (!k) {
        k = 'itsm_default_fallback_aes256_key_super_safe_2026'
      }
      var derivedKey = ''
      try {
        derivedKey = $security.sha256(k).substring(0, 32)
      } catch (_) {
        derivedKey = (k + '01234567890123456789012345678901').substring(0, 32)
      }
      var payload = val.substring(PREFIX.length)
      var dec = $security.decrypt(payload, derivedKey)
      return dec || ''
    } catch (err) {
      return '__DECRYPT_FAILED__'
    }
  }

  function createSystemMailMessage(initObj) {
    if (typeof MailerMessage !== 'undefined') {
      try {
        return initObj ? new MailerMessage(initObj) : new MailerMessage()
      } catch (_) {}
    }
    if (typeof MailMessage !== 'undefined') {
      try {
        return initObj ? new MailMessage(initObj) : new MailMessage()
      } catch (_) {}
    }
    var g = typeof globalThis !== 'undefined' ? globalThis : {}
    if (typeof g.MailerMessage !== 'undefined') {
      try {
        return initObj ? new g.MailerMessage(initObj) : new g.MailerMessage()
      } catch (_) {}
    }
    if (typeof g.MailMessage !== 'undefined') {
      try {
        return initObj ? new g.MailMessage(initObj) : new g.MailMessage()
      } catch (_) {}
    }
    return initObj || {}
  }

  function resolveSystemMailerConfig() {
    var dedicated = {
      isDedicated: false,
      host: '',
      port: 587,
      encryption: 'STARTTLS',
      user: '',
      password: '',
      senderName: 'Atendimento HelpDesk',
      replyTo: '',
      senderEmail: '',
    }
    try {
      var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (configs.length > 0) {
        var cfg = configs[0]
        var sHost = (cfg.getString('smtp_host') || '').trim()
        var sUser = (cfg.getString('smtp_user') || cfg.getString('imap_user') || '').trim()
        var rawSPass = (
          cfg.getString('smtp_password') ||
          cfg.getString('imap_password') ||
          ''
        ).trim()
        var sPass = safeDecryptSecret(rawSPass)
        if (typeof sPass === 'string') sPass = sPass.trim()
        if (sPass === '__DECRYPT_FAILED__' || sPass.indexOf('enc:v1:') === 0) sPass = ''
        var sPort = cfg.getInt('smtp_port') || 587
        var sEnc = (cfg.getString('smtp_encryption') || 'STARTTLS').trim()
        var sName = (cfg.getString('smtp_sender_name') || 'Atendimento HelpDesk').trim()
        var sReply = (cfg.getString('smtp_reply_to') || sUser).trim()
        if (sHost && sUser && sPass) {
          dedicated.isDedicated = true
          dedicated.host = sHost
          dedicated.port = sPort
          dedicated.encryption = sEnc
          dedicated.user = sUser
          dedicated.password = sPass
          dedicated.senderName = sName
          dedicated.replyTo = sReply
          dedicated.senderEmail = sUser
          return dedicated
        }
      }
    } catch (_) {}

    var fallback = {
      isDedicated: false,
      host: '',
      port: 587,
      encryption: 'STARTTLS',
      user: '',
      password: '',
      senderName: 'Lógos AITILSM',
      replyTo: '',
      senderEmail: 'noreply@logositsm.com.br',
    }
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.smtp && s.smtp.enabled && s.smtp.host) {
        fallback.host = s.smtp.host
        fallback.port = s.smtp.port || 587
        fallback.user = s.smtp.username || ''
        fallback.senderEmail = s.smtp.username || 'noreply@logositsm.com.br'
      }
      if (s && s.meta && s.meta.senderAddress) fallback.senderEmail = s.meta.senderAddress
      if (s && s.meta && s.meta.senderName) fallback.senderName = s.meta.senderName
    } catch (_) {}
    return fallback
  }

  function sendSystemMailMessage(message, mailerConfig) {
    if (!mailerConfig) mailerConfig = resolveSystemMailerConfig()
    var originalSmtp = null
    var needsRestore = false

    if (
      mailerConfig.isDedicated &&
      mailerConfig.host &&
      mailerConfig.user &&
      mailerConfig.password
    ) {
      try {
        var s = $app.settings
        if (typeof s === 'function') s = s()
        if (s && s.smtp) {
          originalSmtp = {
            enabled: s.smtp.enabled,
            host: s.smtp.host,
            port: s.smtp.port,
            username: s.smtp.username,
            password: s.smtp.password,
            tls: s.smtp.tls,
            authMethod: s.smtp.authMethod,
          }
          var resolvedPassword = safeDecryptSecret(mailerConfig.password)
          if (
            resolvedPassword === '__DECRYPT_FAILED__' ||
            resolvedPassword.indexOf('enc:v1:') === 0
          ) {
            throw new Error('Falha interna de descriptografia da senha SMTP — envio abortado.')
          }
          s.smtp.enabled = true
          s.smtp.host = mailerConfig.host
          s.smtp.port = mailerConfig.port
          s.smtp.username = mailerConfig.user
          s.smtp.password = resolvedPassword
          s.smtp.tls = mailerConfig.encryption === 'SSL/TLS' || mailerConfig.port === 465
          needsRestore = true
        }
      } catch (applyErr) {
        $app
          .logger()
          .warn('approval_escalation_cron: cannot set runtime smtp', 'err', applyErr.message)
      }
    }

    var restoreSettings = function () {
      if (needsRestore && originalSmtp) {
        try {
          var sRestore = $app.settings
          if (typeof sRestore === 'function') sRestore = sRestore()
          if (sRestore && sRestore.smtp) {
            sRestore.smtp.enabled = originalSmtp.enabled
            sRestore.smtp.host = originalSmtp.host
            sRestore.smtp.port = originalSmtp.port
            sRestore.smtp.username = originalSmtp.username
            sRestore.smtp.password = originalSmtp.password
            sRestore.smtp.tls = originalSmtp.tls
            sRestore.smtp.authMethod = originalSmtp.authMethod
          }
        } catch (_) {}
      }
    }

    try {
      var client = $app.newMailClient()
      client.send(message)
      return {
        success: true,
        smtp_used: mailerConfig.isDedicated ? 'dedicated_mailbox' : 'logos_fallback',
        host: mailerConfig.host,
        user: mailerConfig.user || mailerConfig.senderEmail,
      }
    } catch (primaryErr) {
      restoreSettings()
      needsRestore = false
      if (mailerConfig.isDedicated) {
        $app
          .logger()
          .warn(
            'approval_escalation_cron: falha no envio via caixa dedicada, tentando fallback SMTP',
            'err',
            primaryErr.message,
          )
        try {
          var fallbackClient = $app.newMailClient()
          fallbackClient.send(message)
          return {
            success: true,
            smtp_used: 'logos_fallback',
            fallback_reason: primaryErr.message,
            host: originalSmtp ? originalSmtp.host : '',
            user: originalSmtp ? originalSmtp.username : '',
          }
        } catch (fallbackErr) {
          $app
            .logger()
            .error(
              'approval_escalation_cron: falha também no fallback SMTP',
              'err',
              fallbackErr.message,
            )
          throw new Error(
            'Falha no envio pela caixa dedicada (' +
              primaryErr.message +
              ') e no fallback (' +
              fallbackErr.message +
              ')',
          )
        }
      }
      throw primaryErr
    } finally {
      restoreSettings()
    }
  }

  function sendSystemEmailDirect(opts) {
    if (!opts) throw new Error('Parâmetros de e-mail ausentes.')
    var mailerConfig = resolveSystemMailerConfig()
    var message = createSystemMailMessage()
    var senderEmail = mailerConfig.senderEmail || 'noreply@logositsm.com.br'
    var senderName = mailerConfig.senderName || 'Atendimento HelpDesk'

    if (opts.from && typeof opts.from === 'object') {
      senderEmail = opts.from.address || senderEmail
      senderName = opts.from.name || senderName
    } else if (typeof opts.from === 'string' && opts.from.trim()) {
      senderEmail = opts.from.trim()
    }

    if (mailerConfig.isDedicated && mailerConfig.user) {
      senderEmail = mailerConfig.user
      senderName = mailerConfig.senderName || senderName
    }

    message.from = { address: senderEmail, name: senderName }

    if (Array.isArray(opts.to)) {
      message.to = opts.to.map(function (dest) {
        if (typeof dest === 'string') return { address: dest.trim() }
        return dest
      })
    } else if (typeof opts.to === 'string') {
      message.to = [{ address: opts.to.trim() }]
    }

    message.subject = opts.subject || ''
    if (opts.text) message.text = opts.text
    if (opts.html) message.html = opts.html

    var replyTo = opts.replyTo || mailerConfig.replyTo
    if (replyTo && message.headers) {
      message.headers['Reply-To'] = replyTo
    }

    return sendSystemMailMessage(message, mailerConfig)
  }

  function logAuditEmail(params) {
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var rec = new Record(auditCol)
      rec.set('test_type', params.testType || 'aprovacao_chamado')
      rec.set('status', params.status === 'success' ? 'success' : 'failed')
      rec.set('host', params.host || '')
      rec.set('port', params.port || 587)
      rec.set('user_account', params.userAccount || '')
      rec.set('encryption', params.encryption || 'STARTTLS')
      rec.set('summary_message', params.summaryMessage || '')
      rec.set('latest_messages_count', 1)
      if (params.dryRunResult !== undefined) {
        rec.set('dry_run_result', params.dryRunResult)
      }
      $app.save(rec)
      return rec.id
    } catch (e) {
      $app.logger().error('approval_escalation_cron logAuditEmail error', 'err', e.message)
      return null
    }
  }

  var esc =
    typeof globalThis.itsmEscapeHtml === 'function'
      ? globalThis.itsmEscapeHtml
      : function (s) {
          if (s === null || s === undefined) return ''
          return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
        }

  function renderApprovalEmailTemplate(opts) {
    if (typeof globalThis.itsmRenderBaseEmailTemplate === 'function') {
      try {
        return globalThis.itsmRenderBaseEmailTemplate(opts)
      } catch (_) {}
    }
    opts = opts || {}
    var preheader = esc(opts.preheader || '')
    var badgeText = esc(opts.badgeText || 'Aprovação Pendente')
    var badgeColor = opts.badgeColor || '#eab308'
    var title = esc(opts.title || 'Solicitação de Aprovação de Chamado')
    var subtitle = esc(opts.subtitle || '')
    var contentHtml = opts.contentHtml || ''
    var actionHtml = opts.actionHtml || ''
    var footerNote = esc(
      opts.footerNote ||
        'Você pode interagir diretamente através dos botões deste e-mail sem precisar efetuar login no sistema.',
    )

    return (
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">\n' +
      '<head>\n' +
      '  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
      '  <title>' +
      title +
      '</title>\n' +
      '  <style type="text/css">\n' +
      '    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }\n' +
      '    table { border-collapse: collapse; }\n' +
      '    a { color: #0284c7; text-decoration: none; }\n' +
      '  </style>\n' +
      '</head>\n' +
      '<body style="margin: 0; padding: 0; background-color: #f1f5f9;">\n' +
      (preheader
        ? '  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; opacity: 0; overflow: hidden;">' +
          preheader +
          '</div>\n'
        : '') +
      '  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9;">\n' +
      '    <tr>\n' +
      '      <td align="center" style="padding: 30px 15px 40px 15px;">\n' +
      '        <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">\n' +
      '          <!-- CABEÇALHO INSTITUCIONAL COM LOGO -->\n' +
      '          <tr>\n' +
      '            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); background-color: #0f172a; padding: 26px 32px; border-bottom: 3px solid #0284c7;">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td valign="middle">\n' +
      '                    <table border="0" cellpadding="0" cellspacing="0">\n' +
      '                      <tr>\n' +
      '                        <td style="background-color: #0284c7; width: 40px; height: 40px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: bold; font-size: 20px; font-family: Arial, sans-serif;">\n' +
      '                          ⚡\n' +
      '                        </td>\n' +
      '                        <td style="padding-left: 14px; vertical-align: middle;">\n' +
      '                          <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 22px;">Lógos <span style="color: #fbbf24; font-weight: 600;">AITILSM</span></div>\n' +
      '                          <div style="font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px;">Gestão de Serviços de TI</div>\n' +
      '                        </td>\n' +
      '                      </tr>\n' +
      '                    </table>\n' +
      '                  </td>\n' +
      '                  <td align="right" valign="middle">\n' +
      '                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.12); color: #e2e8f0; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(255, 255, 255, 0.15);">' +
      badgeText +
      '</span>\n' +
      '                  </td>\n' +
      '                </tr>\n' +
      '              </table>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '          <!-- TÍTULO -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 28px 32px 12px 32px;">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td style="border-left: 4px solid ' +
      badgeColor +
      '; padding-left: 14px;">\n' +
      '                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 26px;">' +
      title +
      '</h1>\n' +
      (subtitle
        ? '                    <div style="margin-top: 4px; font-size: 13px; color: #64748b; line-height: 18px;">' +
          subtitle +
          '</div>\n'
        : '') +
      '                  </td>\n' +
      '                </tr>\n' +
      '              </table>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '          <!-- CONTEÚDO -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 12px 32px 28px 32px;">\n' +
      contentHtml +
      (actionHtml
        ? '              <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">\n' +
          actionHtml +
          '              </div>\n'
        : '') +
      '            </td>\n' +
      '          </tr>\n' +
      '          <!-- RODAPÉ -->\n' +
      '          <tr>\n' +
      '            <td style="background-color: #f8fafc; padding: 22px 32px; border-top: 1px solid #e2e8f0; text-align: center;">\n' +
      '              <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 16px;">' +
      footerNote +
      '</p>\n' +
      '              <p style="margin: 0; font-size: 11px; color: #94a3b8;">© ' +
      new Date().getFullYear() +
      ' Lógos AITILSM • Plataforma de Gestão de Incidentes e Requisições</p>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '        </table>\n' +
      '      </td>\n' +
      '    </tr>\n' +
      '  </table>\n' +
      '</body>\n' +
      '</html>'
    )
  }

  for (var i = 0; i < expiredApprovals.length; i++) {
    var curApp = expiredApprovals[i]
    var configId = curApp.getString('approval_config')
    var ticketId = curApp.getString('ticket')
    var currentStage = curApp.getInt('stage') || 1

    var configRec = null
    try {
      configRec = $app.findRecordById('approval_configs', configId)
    } catch (_) {}

    if (!configRec) {
      // Se não achar a config, apenas limpa a deadline para não rodar em loop
      curApp.set('escalation_deadline', '')
      $app.save(curApp)
      continue
    }

    var focalPointIds = configRec.getStringSlice ? configRec.getStringSlice('focal_points') : []
    var internalApproverIds = configRec.getStringSlice
      ? configRec.getStringSlice('internal_approvers')
      : []
    var timeoutMinutes = configRec.getInt('escalation_timeout_minutes') || 60

    // Monta a lista completa de aprovadores da sequência
    var candidateApprovers = []
    for (var fp = 0; fp < focalPointIds.length; fp++) {
      try {
        var contactRec = $app.findRecordById('client_contacts', focalPointIds[fp])
        var cEmail = contactRec.getString('email')
        if (cEmail) {
          candidateApprovers.push({
            type: 'contact',
            id: contactRec.id,
            name: contactRec.getString('full_name') || 'Ponto Focal',
            email: cEmail,
          })
        }
      } catch (_) {}
    }

    for (var ia = 0; ia < internalApproverIds.length; ia++) {
      try {
        var userRec = $app.findRecordById('users', internalApproverIds[ia])
        var uEmail = userRec.getString('email')
        if (uEmail) {
          candidateApprovers.push({
            type: 'user',
            id: userRec.id,
            name: userRec.getString('name') || 'Aprovador Interno',
            email: uEmail,
          })
        }
      } catch (_) {}
    }

    var nextStage = currentStage + 1
    var nextIndex = nextStage - 1 // 0-based

    var ticketRec = null
    try {
      ticketRec = $app.findRecordById('tickets', ticketId)
    } catch (_) {}

    var ticketNumber = ticketRec ? ticketRec.getString('number') : '-'
    var ticketTitle = ticketRec ? ticketRec.getString('title') : '-'
    var ticketDescription = ticketRec ? ticketRec.getString('description') : '-'

    // Se existe próximo aprovador na sequência (2º ou 3º nível)
    if (nextIndex < candidateApprovers.length) {
      var nextCand = candidateApprovers[nextIndex]

      // Expira a aprovação anterior por ausência
      curApp.set('status', 'Reprovado')
      curApp.set('approver_comment', 'Expirado por ausência de resposta (Contingência sequencial)')
      curApp.set('rejected_at', nowIso)
      curApp.set('escalation_deadline', '')
      $app.save(curApp)

      // Cria a nova aprovação para o próximo nível
      var newDeadline = new Date(now.getTime() + timeoutMinutes * 60000).toISOString()
      var newApp = new Record(approvalsCol)
      newApp.set('ticket', ticketId)
      newApp.set('requester', curApp.getString('requester'))
      if (nextCand.type === 'user') {
        newApp.set('approver', nextCand.id)
      } else {
        newApp.set('target_contact', nextCand.id)
      }
      newApp.set('target_email', nextCand.email)
      newApp.set('type', 'Outros')
      newApp.set(
        'justification',
        'Escalonamento de contingência para ' +
          nextStage +
          'º aprovador (o anterior não respondeu no prazo de ' +
          timeoutMinutes +
          ' min)',
      )
      newApp.set('status', 'Pendente')
      newApp.set('mode', 'Sequencial')
      newApp.set('stage', nextStage)
      newApp.set('approval_config', configId)
      newApp.set('escalation_deadline', newDeadline)
      var newToken = $security.randomString(32)
      newApp.set('token', newToken)
      $app.save(newApp)

      // Registra histórico no chamado
      try {
        var hist = new Record(historyCol)
        hist.set('ticket', ticketId)
        hist.set('user', curApp.getString('requester') || '')
        hist.set(
          'action',
          'Aprovação escalonada para contingência ' +
            nextStage +
            'º nível (' +
            nextCand.name +
            ') por ausência de resposta',
        )
        hist.set('field', 'status')
        hist.set('old_value', 'Aguardando Aprovação (Nível ' + currentStage + ')')
        hist.set('new_value', 'Aguardando Aprovação (Nível ' + nextStage + ')')
        $app.save(hist)
      } catch (hErr) {
        $app.logger().warn('approval_escalation_cron: history error', 'err', hErr.message)
      }

      // Envia o e-mail para o próximo aprovador com os botões
      var approveUrl =
        backendBase + '/backend/v1/approvals/act?token=' + newToken + '&action=approve'
      var rejectUrl = backendBase + '/backend/v1/approvals/act?token=' + newToken + '&action=reject'
      var webPortalUrl = backendBase + '/approval/' + newToken

      var modeNotice =
        'ESCALONAMENTO DE CONTINGÊNCIA: Você foi acionado como ' +
        nextStage +
        'º aprovador pois o responsável anterior não respondeu no prazo estipulado (' +
        timeoutMinutes +
        ' min). O chamado não pode ficar parado.'

      var contentHtml =
        '<div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">\n' +
        '  <div style="font-size: 14px; font-weight: 700; color: #854d0e;">Escalonamento de Contingência • ' +
        nextStage +
        'º Aprovador</div>\n' +
        '  <div style="font-size: 13px; color: #a16207; margin-top: 3px; line-height: 18px;">' +
        esc(modeNotice) +
        '</div>\n' +
        '</div>\n' +
        '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">\n' +
        '  <tr>\n' +
        '    <td style="padding: 16px 20px;">\n' +
        '      <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
        '        <tr>\n' +
        '          <td style="padding-bottom: 10px; width: 50%; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Número do Chamado</div>\n' +
        '            <div style="font-size: 16px; font-weight: 800; color: #0284c7; margin-top: 2px;">#' +
        esc(ticketNumber) +
        '</div>\n' +
        '          </td>\n' +
        '          <td style="padding-bottom: 10px; width: 50%; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">Aprovador Acionado</div>\n' +
        '            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 2px;">' +
        esc(nextCand.name) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '        <tr>\n' +
        '          <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #cbd5e1; vertical-align: top;">\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Assunto do Chamado</div>\n' +
        '            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">' +
        esc(ticketTitle) +
        '</div>\n' +
        '            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">Descrição</div>\n' +
        '            <div style="font-size: 13px; color: #334155; line-height: 20px; background-color: #ffffff; padding: 12px 14px; border-radius: 6px; border: 1px solid #e2e8f0; white-space: pre-wrap;">' +
        esc(ticketDescription) +
        '</div>\n' +
        '          </td>\n' +
        '        </tr>\n' +
        '      </table>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'

      var actionButtonsHtml =
        '<div style="text-align: center; margin: 10px 0 16px 0;">\n' +
        '  <p style="font-size: 13px; font-weight: 600; color: #334155; margin: 0 0 16px 0;">Clique em um dos botões abaixo para registrar sua decisão instantaneamente:</p>\n' +
        '  <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">\n' +
        '    <tr>\n' +
        '      <td align="center" style="padding-right: 12px;">\n' +
        '        <a href="' +
        approveUrl +
        '" target="_blank" style="background-color: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25); border: 1px solid #15803d;">\n' +
        '          ✓ Aprovar Chamado\n' +
        '        </a>\n' +
        '      </td>\n' +
        '      <td align="center" style="padding-left: 12px;">\n' +
        '        <a href="' +
        rejectUrl +
        '" target="_blank" style="background-color: #dc2626; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.25); border: 1px solid #b91c1c;">\n' +
        '          ✕ Reprovar Chamado\n' +
        '        </a>\n' +
        '      </td>\n' +
        '    </tr>\n' +
        '  </table>\n' +
        '  <div style="margin-top: 14px; font-size: 11px; color: #94a3b8;">Link seguro com token assinado e uso único. A ação será gravada na auditoria do chamado.</div>\n' +
        '  <div style="margin-top: 8px; font-size: 12px;"><a href="' +
        webPortalUrl +
        '" target="_blank" style="color: #0284c7; text-decoration: underline;">Prefere decidir pelo portal web? Clique aqui para ver todos os detalhes</a></div>\n' +
        '</div>'

      var emailSubject =
        '[Escalonamento] Aprovação Necessária: Chamado #' + ticketNumber + ' - ' + ticketTitle

      var htmlEmail = renderApprovalEmailTemplate({
        preheader: 'Escalonamento de contingência para o chamado #' + ticketNumber,
        badgeText: 'Escalonamento (Nível ' + nextStage + ')',
        badgeColor: '#f97316',
        title: 'Aprovação de Chamado por Contingência',
        subtitle: 'Chamado #' + ticketNumber + ' escalonado para você',
        contentHtml: contentHtml,
        actionHtml: actionButtonsHtml,
        footerNote: 'Ação registrada diretamente via e-mail corporativo sem necessidade de login.',
      })

      var textEmail =
        'ESCALONAMENTO DE CONTINGÊNCIA - APROVAÇÃO DE CHAMADO (NÍVEL ' +
        nextStage +
        ')\n\n' +
        'Chamado: #' +
        ticketNumber +
        '\n' +
        'Assunto: ' +
        ticketTitle +
        '\n' +
        'Descrição:\n' +
        ticketDescription +
        '\n\n' +
        'Para APROVAR acesse:\n' +
        approveUrl +
        '\n\n' +
        'Para REPROVAR acesse:\n' +
        rejectUrl +
        '\n\n' +
        'Ou visualize via portal web: ' +
        webPortalUrl +
        '\n\n' +
        '-- Lógos AITILSM'

      try {
        if (typeof globalThis.itsmSendWithAudit === 'function') {
          globalThis.itsmSendWithAudit({
            testType: 'aprovacao_chamado',
            to: nextCand.email,
            subject: emailSubject,
            html: htmlEmail,
            text: textEmail,
            meta: {
              ticket_id: ticketId,
              ticket_number: ticketNumber,
              stage: nextStage,
              contingency: true,
            },
          })
        } else {
          var directResult = sendSystemEmailDirect({
            to: nextCand.email,
            subject: emailSubject,
            html: htmlEmail,
            text: textEmail,
          })
          logAuditEmail({
            testType: 'aprovacao_chamado',
            status: 'success',
            host: directResult ? directResult.host : '',
            userAccount: directResult ? directResult.user : '',
            summaryMessage:
              'E-mail de escalonamento enviado para ' +
              nextCand.email +
              ' (Chamado #' +
              ticketNumber +
              ', nível ' +
              nextStage +
              ')',
          })
        }
      } catch (emErr) {
        $app
          .logger()
          .error(
            'approval_escalation_cron: falha ao enviar email',
            'dest',
            nextCand.email,
            'err',
            emErr.message,
          )
        logAuditEmail({
          testType: 'aprovacao_chamado',
          status: 'failed',
          summaryMessage:
            'Falha no envio de e-mail de escalonamento para ' +
            nextCand.email +
            ': ' +
            emErr.message,
        })
      }

      $app
        .logger()
        .info(
          'approval_escalation_cron: ticket #' +
            ticketNumber +
            ' escalonado para nível ' +
            nextStage +
            ' (' +
            nextCand.name +
            ')',
        )
    } else {
      // Esgotou a sequência de contingência sem resposta
      curApp.set('escalation_deadline', '')
      $app.save(curApp)

      // Notifica administradores do sistema
      try {
        var admins = $app.findRecordsByFilter('users', 'role = "admin"', '', 10, 0)
        for (var a = 0; a < admins.length; a++) {
          var adminNotif = new Record(notifCol)
          adminNotif.set('user', admins[a].id)
          adminNotif.set('ticket', ticketId)
          adminNotif.set('title', 'Alerta: Aprovação Expirada')
          adminNotif.set(
            'message',
            'Todos os níveis de contingência do chamado #' +
              ticketNumber +
              ' expiraram sem decisão.',
          )
          adminNotif.set('type', 'Aprovação')
          adminNotif.set('read', false)
          $app.save(adminNotif)
        }
      } catch (_) {}
    }
  }
})
