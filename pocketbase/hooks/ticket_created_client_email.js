/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Notificação de Abertura de Chamado por E-mail (Lógos AITSM / Skip Cloud)
// ----------------------------------------------------------------------------
// Dispara o e-mail de abertura para o solicitante e participantes do chamado
// utilizando o template configurado na Central de Alertas (alert_key = 'ticket_created').
//
// Módulo 100% autocontido (resiliente ao escopo isolado do Goja JSVM no PocketBase).
// Funções de configuração, interpolação de template, anti-duplicidade e envio
// SMTP dedicadas são definidas internamente no callback onRecordAfterCreateSuccess.
// Sempre invoca e.next() para manter a cadeia de hooks e entregas em tempo real.
// ============================================================================

onRecordAfterCreateSuccess(function (e) {
  try {
    var ticket = e.record
    if (!ticket) return e.next()

    var ticketNumber = ticket.getString('number') || ticket.id
    console.log(
      '[Central de Alertas] ticket_created_client_email: processando chamado #' + ticketNumber,
    )

    // ==========================================================================
    // HELPERS AUTOCONTIDOS LOCAIS (escopo exclusivo deste hook)
    // ==========================================================================

    // 1. Descriptografia AES-256 local para credenciais de email_config
    function localSafeDecryptSecret(val) {
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
      } catch (_) {
        return ''
      }
    }

    // 2. Consulta configuração do alerta (email_alert_settings)
    function localGetEmailAlertConfig(alertKey) {
      if (!alertKey) return null
      try {
        var rec = $app.findFirstRecordByFilter(
          'email_alert_settings',
          'alert_key = "' + alertKey + '"',
        )
        if (!rec) return null
        return {
          id: rec.id,
          alert_key: rec.getString('alert_key'),
          name: rec.getString('name'),
          description: rec.getString('description'),
          category: rec.getString('category'),
          enabled: rec.getBool('enabled'),
          recipient_types: rec.getString('recipient_types'),
          template_layout: rec.getString('template_layout') || 'modern',
          primary_color: rec.getString('primary_color') || '#D97706',
          subject_template: rec.getString('subject_template') || '',
          header_title: rec.getString('header_title') || '',
          header_subtitle: rec.getString('header_subtitle') || '',
          body_template: rec.getString('body_template') || '',
          footer_text: rec.getString('footer_text') || '',
          show_button: rec.getBool('show_button'),
          button_label: rec.getString('button_label') || 'Acessar',
          button_url_template: rec.getString('button_url_template') || '',
          is_customized: rec.getBool('is_customized'),
          default_subject_template: rec.getString('default_subject_template') || '',
          default_body_template: rec.getString('default_body_template') || '',
        }
      } catch (err) {
        console.error(
          '[Central de Alertas] ticket_created localGetEmailAlertConfig: falha ao ler email_alert_settings | ' +
            (err && err.message ? err.message : String(err)),
        )
        return null
      }
    }

    // 3. Anti-duplicidade em email_sent_logs
    function localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient) {
      if (!alertKey || !referenceId || !recipient) return false
      try {
        var cleanRecipient = String(recipient).trim().toLowerCase()
        var rec = $app.findFirstRecordByFilter(
          'email_sent_logs',
          'alert_key = "' +
            alertKey +
            '" && reference_id = "' +
            referenceId +
            '" && recipient = "' +
            cleanRecipient +
            '"',
        )
        return Boolean(rec)
      } catch (_) {
        return false
      }
    }

    // 4. Registro de auditoria/anti-duplicidade em email_sent_logs
    function localRecordEmailSentLog(alertKey, referenceId, recipient, subject, meta) {
      if (!alertKey || !referenceId || !recipient) return
      try {
        var col = $app.findCollectionByNameOrId('email_sent_logs')
        var cleanRecipient = String(recipient).trim().toLowerCase()
        var log = new Record(col)
        log.set('alert_key', alertKey)
        log.set('reference_id', referenceId)
        log.set('recipient', cleanRecipient)
        log.set('sent_at', new DateTime())
        log.set('subject', subject || '')
        if (meta) log.set('meta', meta)
        $app.save(log)
      } catch (err) {
        console.warn(
          '[Central de Alertas] ticket_created localRecordEmailSentLog: falha ao salvar log | ' +
            (err && err.message ? err.message : String(err)),
        )
      }
    }

    // 5. Interpolação de variáveis {{chave}}
    function localInterpolateTemplate(template, data) {
      if (!template) return ''
      var normalizedData = {}
      if (data && typeof data === 'object') {
        var inKeys = Object.keys(data)
        for (var j = 0; j < inKeys.length; j++) {
          normalizedData[inKeys[j]] = data[inKeys[j]]
        }
      }

      if (normalizedData.chamado_numero && !normalizedData.numero) {
        normalizedData.numero = normalizedData.chamado_numero
      }
      if (normalizedData.numero && !normalizedData.chamado_numero) {
        normalizedData.chamado_numero = normalizedData.numero
      }
      if (normalizedData.cliente && !normalizedData.solicitante) {
        normalizedData.solicitante = normalizedData.cliente
      }
      if (normalizedData.solicitante && !normalizedData.cliente) {
        normalizedData.cliente = normalizedData.solicitante
      }
      if (normalizedData.responsavel && !normalizedData.operador) {
        normalizedData.operador = normalizedData.responsavel
      }
      if (normalizedData.operador && !normalizedData.responsavel) {
        normalizedData.responsavel = normalizedData.operador
      }
      if (normalizedData.data_abertura && !normalizedData.data_hora) {
        normalizedData.data_hora = normalizedData.data_abertura
      }
      if (normalizedData.data_hora && !normalizedData.data_abertura) {
        normalizedData.data_abertura = normalizedData.data_hora
      }

      var result = template
      var keys = Object.keys(normalizedData)
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        var val = normalizedData[k] == null ? '' : String(normalizedData[k])
        var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
        result = result.replace(regex, val)
      }

      // Limpa placeholders não preenchidos
      result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')
      return result
    }

    // 6. Construtor de HTML com layout corporativo/moderno/minimalista
    function localBuildEmailHtmlFromConfig(cfg, data) {
      var primaryColor = (cfg && cfg.primary_color) || '#D97706'
      var layout = (cfg && cfg.template_layout) || 'modern'
      var headerTitle = (cfg && cfg.header_title) || 'Lógos AITSM'
      var headerSubtitle =
        (cfg && cfg.header_subtitle) || 'Sistema Inteligente de Gestão de Serviços de TI'
      var footerText = (cfg && cfg.footer_text) || 'Lógos AITSM • Central de Serviços Inteligente'

      var bodyContent = localInterpolateTemplate((cfg && cfg.body_template) || '', data)
      var buttonLabel = localInterpolateTemplate((cfg && cfg.button_label) || 'Acessar', data)
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

      if (layout === 'corporate') {
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
            ? '<p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 400;">' +
              headerSubtitle +
              '</p>'
            : '') +
          '</td></tr>' +
          '<tr><td style="padding: 36px; line-height: 1.65; font-size: 15px; color: #1e293b;">' +
          bodyContent +
          buttonHtml +
          '</td></tr>' +
          '<tr><td style="padding: 24px 36px; background-color: #0f172a; color: #94a3b8; font-size: 12px; text-align: center; border-top: 1px solid #1e293b;">' +
          '<strong style="color: #cbd5e1;">' +
          headerTitle +
          '</strong> — Sistema de Gestão de Serviços de TI<br>' +
          '<span style="color: #64748b;">' +
          footerText +
          '</span>' +
          '</td></tr>' +
          '</table></body></html>'
        )
      }

      // Modern (padrão Lógos AITSM)
      return (
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
        '<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a;">' +
        '<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">' +
        '<tr><td style="padding: 28px 32px; background: linear-gradient(135deg, #17181C 0%, #22252a 100%); border-bottom: 3px solid ' +
        primaryColor +
        '; text-align: left;">' +
        '<span style="font-size: 22px; font-weight: 800; color: #FCD34D; letter-spacing: -0.3px;">' +
        headerTitle +
        '</span>' +
        (headerSubtitle
          ? '<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">' +
            headerSubtitle +
            '</p>'
          : '') +
        '</td></tr>' +
        '<tr><td style="padding: 32px; line-height: 1.65; font-size: 15px; color: #334155;">' +
        bodyContent +
        buttonHtml +
        '</td></tr>' +
        '<tr><td style="padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">' +
        footerText +
        '</td></tr>' +
        '</table></body></html>'
      )
    }

    // 7. Resolução de configuração de transporte SMTP (email_config dedicado ou fallback)
    function localResolveMailerConfig() {
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
          var sPass = localSafeDecryptSecret(rawSPass)
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
        senderName: 'Lógos AITSM',
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
        if (s && s.meta && s.meta.senderAddress) {
          fallback.senderEmail = s.meta.senderAddress
        }
        if (s && s.meta && s.meta.senderName) {
          fallback.senderName = s.meta.senderName
        }
      } catch (_) {}

      return fallback
    }

    // 8. Criação de objeto MailerMessage do PocketBase
    function localCreateMailMessage(initObj) {
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

    // 9. Envio local direto via $app.newMailClient() com fallback e aplicação de SMTP
    function localSendMailMessage(opts) {
      if (!opts) throw new Error('Parâmetros de e-mail ausentes.')
      var mailerConfig = localResolveMailerConfig()
      var message = localCreateMailMessage()

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

      // Configuração temporária de SMTP se caixa dedicada estiver disponível
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

            var resolvedPassword = localSafeDecryptSecret(mailerConfig.password)
            if (
              resolvedPassword === '__DECRYPT_FAILED__' ||
              resolvedPassword.indexOf('enc:v1:') === 0
            ) {
              resolvedPassword = mailerConfig.password
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
          console.warn(
            '[Central de Alertas] ticket_created: aviso ao aplicar smtp em runtime: ' +
              (applyErr && applyErr.message ? applyErr.message : String(applyErr)),
          )
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
        }
      } catch (primaryErr) {
        restoreSettings()
        needsRestore = false

        if (mailerConfig.isDedicated) {
          try {
            var fallbackClient = $app.newMailClient()
            fallbackClient.send(message)
            return {
              success: true,
              smtp_used: 'logos_fallback',
              fallback_reason: primaryErr.message,
            }
          } catch (fallbackErr) {
            throw new Error(
              'Falha no envio pela caixa dedicada (' +
                primaryErr.message +
                ') e no fallback padrão (' +
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

    // 10. Função principal autocontida de envio de alerta
    function localSendSystemAlertEmail(opts) {
      if (!opts) return { sent: false, reason: 'opts_missing' }
      var alertKey = opts.alert_key
      var referenceId = opts.reference_id || ''

      var rawRecipients = []
      if (Array.isArray(opts.recipients)) {
        rawRecipients = opts.recipients
      } else if (Array.isArray(opts.recipient)) {
        rawRecipients = opts.recipient
      } else if (opts.recipient) {
        rawRecipients = [opts.recipient]
      }

      var recipients = []
      var seenRecipients = {}
      for (var rIdx = 0; rIdx < rawRecipients.length; rIdx++) {
        var rClean = String(rawRecipients[rIdx] || '')
          .trim()
          .toLowerCase()
        if (rClean && rClean.indexOf('@') > 0 && !seenRecipients[rClean]) {
          seenRecipients[rClean] = true
          recipients.push(rClean)
        }
      }

      if (recipients.length === 0) {
        console.error(
          '[Central de Alertas] ticket_created: envio ABORTADO — nenhum destinatário válido | alert_key=' +
            String(alertKey || ''),
        )
        return { sent: false, reason: 'recipient_missing' }
      }

      var cfg = localGetEmailAlertConfig(alertKey)
      if (!cfg) {
        console.error(
          '[Central de Alertas] ticket_created: envio ABORTADO — configuração do alerta não encontrada | alert_key=' +
            String(alertKey || '') +
            ' | destinatários=' +
            recipients.join(', '),
        )
        return { sent: false, reason: 'alert_config_missing', alert_key: alertKey }
      }

      if (!cfg.enabled) {
        console.log(
          '[Central de Alertas] ticket_created: envio ABORTADO — alerta DESLIGADO nas configurações | alert_key=' +
            String(alertKey || '') +
            ' | destinatários=' +
            recipients.join(', '),
        )
        return { sent: false, reason: 'alert_disabled_by_config', alert_key: alertKey }
      }

      var data = opts.data || {}
      var rawSubject =
        cfg.subject_template ||
        cfg.default_subject_template ||
        opts.subject ||
        'Notificação Lógos AITSM'
      var subject = localInterpolateTemplate(rawSubject, data)

      if (!cfg.body_template && cfg.default_body_template) {
        cfg.body_template = cfg.default_body_template
      }

      var htmlContent = localBuildEmailHtmlFromConfig(cfg, data)
      var rawBody = cfg.body_template || cfg.default_body_template || ''
      var textFallback =
        opts.fallbackText || localInterpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

      var sentCount = 0
      var skippedDuplicates = 0
      var errors = []

      for (var i = 0; i < recipients.length; i++) {
        var recipient = recipients[i]

        if (referenceId && localHasEmailAlreadyBeenSent(alertKey, referenceId, recipient)) {
          skippedDuplicates++
          continue
        }

        try {
          localSendMailMessage({
            to: recipient,
            subject: subject,
            html: htmlContent,
            text: textFallback,
          })

          if (referenceId) {
            localRecordEmailSentLog(alertKey, referenceId, recipient, subject, {
              template_layout: cfg.template_layout,
              primary_color: cfg.primary_color,
            })
          }

          sentCount++
          console.log(
            '[Central de Alertas] ticket_created: enviado com sucesso | alert_key=' +
              alertKey +
              ' | destinatário=' +
              recipient +
              ' | assunto=' +
              subject,
          )
        } catch (err) {
          console.error(
            '[Central de Alertas] ticket_created: FALHA no envio | alert_key=' +
              String(alertKey || '') +
              ' | destinatário=' +
              recipient +
              ' | motivo: ' +
              (err && err.message ? err.message : String(err)),
          )
          errors.push({
            recipient: recipient,
            error: err && err.message ? err.message : String(err),
          })
        }
      }

      if (sentCount > 0) {
        return {
          sent: true,
          alert_key: alertKey,
          sent_count: sentCount,
          skipped_duplicates: skippedDuplicates,
          errors: errors.length > 0 ? errors : undefined,
        }
      } else if (skippedDuplicates > 0) {
        return {
          sent: false,
          reason: 'already_sent',
          alert_key: alertKey,
          reference_id: referenceId,
          skipped_duplicates: skippedDuplicates,
        }
      } else {
        return {
          sent: false,
          reason: 'send_failed',
          alert_key: alertKey,
          errors: errors,
        }
      }
    }

    // 11. Resolução de destinatários e formatação de datas
    function localResolveTicketClientRecipients(curTicket, auth) {
      var companyId = curTicket.getString('company')
      var primaryEmail = (curTicket.getString('requester_email') || '').trim()
      var primaryName = (curTicket.getString('requester_name') || '').trim()

      if (!primaryEmail && auth && typeof auth.getString === 'function') {
        primaryEmail = (auth.getString('email') || '').trim()
        if (!primaryName) primaryName = (auth.getString('name') || '').trim()
      }

      if (!primaryEmail && primaryName && companyId) {
        try {
          var safeName = primaryName.replace(/"/g, '\\"')
          var contactByName = $app.findFirstRecordByFilter(
            'client_contacts',
            'client = "' + companyId + '" && full_name ~ "' + safeName + '"',
          )
          if (contactByName && contactByName.getString('email')) {
            primaryEmail = contactByName.getString('email').trim()
          }
        } catch (_) {}
      }

      if (!primaryEmail && companyId) {
        try {
          var focal = $app.findFirstRecordByFilter(
            'client_contacts',
            'client = "' + companyId + '" && is_focal_point = true && email != ""',
          )
          if (focal && focal.getString('email')) {
            primaryEmail = focal.getString('email').trim()
            if (!primaryName) primaryName = focal.getString('full_name').trim()
          }
        } catch (_) {}
      }

      if (!primaryName) primaryName = 'Solicitante'

      var list = []
      var seen = {}
      function add(emailStr) {
        var clean = String(emailStr || '')
          .trim()
          .toLowerCase()
        if (clean && clean.indexOf('@') > 0 && !seen[clean]) {
          seen[clean] = true
          list.push(clean)
        }
      }
      if (primaryEmail) add(primaryEmail)

      try {
        var parts = curTicket.get('participants')
        if (Array.isArray(parts)) {
          for (var pIdx = 0; pIdx < parts.length; pIdx++) {
            var p = parts[pIdx]
            if (typeof p === 'string') {
              if (p.indexOf('@') > 0) {
                add(p)
              } else {
                try {
                  var u = $app.findRecordById('users', p)
                  if (u && u.getString('email')) add(u.getString('email'))
                } catch (_) {}
              }
            } else if (p && typeof p === 'object') {
              add(p.email || p.userEmail || p.address)
            }
          }
        }
      } catch (_) {}

      return { recipients: list, requesterName: primaryName, companyId: companyId }
    }

    function localGetTicketBaseUrl() {
      try {
        var host = $os.getenv('PUBLIC_URL') || $os.getenv('APP_URL') || ''
        if (host) return host.replace(/\/+$/, '')
      } catch (_) {}
      return ''
    }

    function localFormatTicketDate(raw) {
      var d = raw ? new Date(raw) : new Date()
      if (isNaN(d.getTime())) d = new Date()
      return (
        ('0' + d.getDate()).slice(-2) +
        '/' +
        ('0' + (d.getMonth() + 1)).slice(-2) +
        '/' +
        d.getFullYear() +
        ' às ' +
        ('0' + d.getHours()).slice(-2) +
        ':' +
        ('0' + d.getMinutes()).slice(-2)
      )
    }

    // ==========================================================================
    // EXECUÇÃO DO DISPARO
    // ==========================================================================
    console.log('[Central de Alertas] ticket_created: helpers locais OK')

    // Supressão herdada de client_notification_settings
    var companyId = ticket.getString('company')
    try {
      var clientSettingsRec = null
      if (companyId) {
        try {
          clientSettingsRec = $app.findFirstRecordByFilter(
            'client_notification_settings',
            'company = "' + companyId + '"',
          )
        } catch (_) {}
      }
      if (!clientSettingsRec) {
        try {
          clientSettingsRec = $app.findFirstRecordByFilter(
            'client_notification_settings',
            'scope = "global"',
          )
        } catch (_) {}
      }
      if (clientSettingsRec && clientSettingsRec.getBool('notify_ticket_created') === false) {
        console.warn(
          '[Central de Alertas] ticket_created: envio SUPRIMIDO por client_notification_settings | chamado #' +
            ticketNumber,
        )
        return e.next()
      }
    } catch (_) {}

    var resolved = localResolveTicketClientRecipients(ticket, e.auth)
    var recipientsList = resolved.recipients

    if (recipientsList.length === 0) {
      console.warn(
        '[Central de Alertas] ticket_created: envio SUPRIMIDO — nenhum destinatário encontrado | chamado #' +
          ticketNumber,
      )
      return e.next()
    }

    var ticketTitle = ticket.getString('title') || 'Chamado sem título'
    var cleanDescription = (ticket.getString('description') || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleanDescription.length > 500) {
      cleanDescription = cleanDescription.substring(0, 497) + '...'
    }
    if (!cleanDescription) cleanDescription = ticketTitle

    var companyName = ''
    if (resolved.companyId) {
      try {
        var comp = $app.findRecordById('companies', resolved.companyId)
        companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
      } catch (_) {}
    }

    var baseUrl = localGetTicketBaseUrl()
    var templateData = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      descricao: cleanDescription,
      cliente: resolved.requesterName,
      solicitante: resolved.requesterName,
      prioridade: ticket.getString('priority') || 'Média',
      tipo: ticket.getString('type') || 'Incidente',
      data_abertura: localFormatTicketDate(ticket.getString('created')),
      empresa: companyName,
      link: baseUrl ? baseUrl + '/portal/tickets/' + ticket.id : '',
    }

    var result = localSendSystemAlertEmail({
      alert_key: 'ticket_created',
      reference_id: ticket.id,
      recipients: recipientsList,
      subject: 'Chamado #' + ticketNumber + ' registrado com sucesso - ' + ticketTitle,
      data: templateData,
    })

    if (result && result.sent) {
      console.log(
        '[Central de Alertas] ticket_created: enviado com sucesso | chamado #' +
          ticketNumber +
          ' | destinatários=' +
          recipientsList.join(', '),
      )
    } else if (result && result.reason && result.reason !== 'already_sent') {
      console.error(
        '[Central de Alertas] ticket_created: envio não realizado | motivo=' +
          result.reason +
          ' | chamado #' +
          ticketNumber,
      )
    }
  } catch (err) {
    console.error(
      '[Central de Alertas] ticket_created: FALHA inesperada | chamado #' +
        (e.record ? e.record.getString('number') || e.record.id : 'desconhecido') +
        ' | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  } finally {
    return e.next()
  }
}, 'tickets')
