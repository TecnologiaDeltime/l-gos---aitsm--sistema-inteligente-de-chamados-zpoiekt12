// Helper unificado para resolução e envio de e-mails do sistema ITSM
// Regra de precedência:
// 1. Configuração SMTP dedicada da caixa de e-mail (email_config: smtp_host, smtp_port, smtp_user, smtp_password, smtp_sender_name, smtp_reply_to)
// 2. Fallback: Configuração global SMTP do sistema ($app.settings().smtp)
//
// Disponibiliza as funções globais:
// - resolveSystemMailerConfig()
// - sendSystemEmail(options)
// - sendSystemMailMessage(message)

;(function () {
  // Descriptografia autocontida AES-256 para execução segura no runtime do mailer
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

  // Retorna as configurações resolvidas de envio
  globalThis.resolveSystemMailerConfig = function () {
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
        if (typeof sPass === 'string') {
          sPass = sPass.trim()
        }
        if (sPass === '__DECRYPT_FAILED__' || sPass.indexOf('enc:v1:') === 0) {
          $app
            .logger()
            .error('resolveSystemMailerConfig: falha interna de descriptografia da senha SMTP')
          sPass = ''
        }
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

    // Fallback: SMTP padrão do PocketBase
    var fallback = {
      isDedicated: false,
      host: '',
      port: 587,
      encryption: 'STARTTLS',
      user: '',
      password: '',
      senderName: 'Lógos ITSM',
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

  // Helper universal para instanciar mensagem de e-mail no PocketBase JSVM (Goja)
  function createMailMessageInstance(initObj) {
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
    // Fallback: se nenhuma classe nativa existir, retorna objeto estruturado padrão
    return initObj || {}
  }
  globalThis.createSystemMailMessage = createMailMessageInstance

  // Envia e-mail aplicando as credenciais da caixa dedicada sobre o cliente SMTP
  // Options: { from, to, subject, text, html, attachments, replyTo }
  globalThis.sendSystemEmail = function (opts) {
    if (!opts) throw new Error('Parâmetros de e-mail ausentes.')
    var mailerConfig = globalThis.resolveSystemMailerConfig()

    var message = createMailMessageInstance()

    // Remetente
    var senderEmail = mailerConfig.senderEmail || 'noreply@logositsm.com.br'
    var senderName = mailerConfig.senderName || 'Atendimento HelpDesk'

    if (opts.from && typeof opts.from === 'object') {
      senderEmail = opts.from.address || senderEmail
      senderName = opts.from.name || senderName
    } else if (typeof opts.from === 'string' && opts.from.trim()) {
      senderEmail = opts.from.trim()
    }

    // Se estiver usando a caixa dedicada, o remetente canônico DEVE ser o usuário da caixa
    if (mailerConfig.isDedicated && mailerConfig.user) {
      senderEmail = mailerConfig.user
      senderName = mailerConfig.senderName || senderName
    }

    message.from = { address: senderEmail, name: senderName }

    // Destinatários
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
    if (opts.attachments) message.attachments = opts.attachments

    // Reply-To
    var replyTo = opts.replyTo || mailerConfig.replyTo
    if (replyTo && message.headers) {
      message.headers['Reply-To'] = replyTo
    }

    return globalThis.sendSystemMailMessage(message, mailerConfig)
  }

  // Envia um MailerMessage aplicando a caixa dedicada ou fallback
  globalThis.sendSystemMailMessage = function (message, mailerConfig) {
    if (!mailerConfig) {
      mailerConfig = globalThis.resolveSystemMailerConfig()
    }

    // Se dedicated SMTP estiver ativo, aplicamos as credenciais temporariamente
    // nas settings em memória do app para a chamada newMailClient().
    // PocketBase $app.newMailClient() consulta $app.settings().smtp
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

          // Garantir que a senha está descriptografada antes de atribuir ao transporte
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
          // No PocketBase Core, s.smtp.tls = true significa SSL direto (ex: porta 465).
          // Quando tls = false, o PocketBase envia STARTTLS (ex: porta 587 Office 365).
          s.smtp.tls = mailerConfig.encryption === 'SSL/TLS' || mailerConfig.port === 465
          needsRestore = true
        }
      } catch (applyErr) {
        $app
          .logger()
          .warn('sendSystemMailMessage: cannot set runtime smtp', 'err', applyErr.message)
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
      // Se a caixa dedicada falhar, restaura as configurações originais e tenta o fallback SMTP
      restoreSettings()
      needsRestore = false

      if (mailerConfig.isDedicated) {
        $app
          .logger()
          .warn(
            'sendSystemMailMessage: falha no envio via caixa dedicada, tentando fallback SMTP',
            'host',
            mailerConfig.host,
            'user',
            mailerConfig.user,
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
              'sendSystemMailMessage: falha também no fallback SMTP',
              'err',
              fallbackErr.message,
            )
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
})()
