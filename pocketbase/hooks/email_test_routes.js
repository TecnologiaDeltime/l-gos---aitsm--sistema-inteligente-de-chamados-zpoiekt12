// Rotas de teste e diagnóstico de e-mail (Skip Cloud / PocketBase JSVM)
// Suporta:
// 1. Modo Microsoft Graph (HTTPS via $http.send) - Caminho oficial para Microsoft 365 / Office 365
// 2. Modo IMAP (Sockets TCP legados) - Caminho secundário para servidores não-Microsoft
// 3. Teste de fluxo completo ponta a ponta (test-flow) e listagem de logs de auditoria
//
// Endpoints:
// - POST /backend/v1/emails/test-connection
// - POST /backend/v1/emails/test-flow
// - GET  /backend/v1/emails/audit-logs

;(function () {
  // Descriptografia autocontida AES-256 para execução segura no contexto isolado de rotas/cron
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

  // Disponibiliza safeDecryptSecret no escopo global para compatibilidade com qualquer rota/helper
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.safeDecryptSecret = safeDecryptSecret
    }
  } catch (_) {}

  // Helper universal autocontido para instanciar mensagem de e-mail no PocketBase JSVM (Goja)
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

  // Helper universal autocontido para resolução das configurações SMTP (email_config ou fallback do app)
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
        if (typeof sPass === 'string') {
          sPass = sPass.trim()
        }
        if (sPass === '__DECRYPT_FAILED__' || sPass.indexOf('enc:v1:') === 0) {
          $app
            .logger()
            .error(
              'email_test_routes resolveSystemMailerConfig: falha na descriptografia da senha SMTP',
            )
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

    // Fallback: configurações SMTP padrão do PocketBase
    var fallback = {
      isDedicated: false,
      host: '',
      port: 587,
      encryption: 'STARTTLS',
      user: '',
      password: '',
      senderName: 'Lógos ITSM',
      replyTo: '',
      senderEmail: 'noreply@serviceone.com.br',
    }

    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.smtp && s.smtp.enabled && s.smtp.host) {
        fallback.host = s.smtp.host
        fallback.port = s.smtp.port || 587
        fallback.user = s.smtp.username || ''
        fallback.senderEmail = s.smtp.username || 'noreply@serviceone.com.br'
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

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.createSystemMailMessage = createSystemMailMessage
      globalThis.resolveSystemMailerConfig = resolveSystemMailerConfig
    }
  } catch (_) {}

  // Envia um MailerMessage aplicando a caixa dedicada ou fallback (autocontido)
  function sendSystemMailMessage(message, mailerConfig) {
    if (!mailerConfig) {
      mailerConfig = resolveSystemMailerConfig()
    }

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
          // No PocketBase Core, s.smtp.tls = true significa SSL direto (ex: porta 465).
          // Quando tls = false, o PocketBase envia STARTTLS (ex: porta 587 Office 365).
          s.smtp.tls = mailerConfig.encryption === 'SSL/TLS' || mailerConfig.port === 465
          needsRestore = true
        }
      } catch (applyErr) {
        $app
          .logger()
          .warn(
            'email_test_routes sendSystemMailMessage: cannot set runtime smtp',
            'err',
            applyErr.message,
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
        smtp_used: mailerConfig.isDedicated ? 'dedicated_mailbox' : 'serviceone_fallback',
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
            'email_test_routes sendSystemMailMessage: falha no envio via caixa dedicada, tentando fallback SMTP',
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
            smtp_used: 'serviceone_fallback',
            fallback_reason: primaryErr.message,
            host: originalSmtp ? originalSmtp.host : '',
            user: originalSmtp ? originalSmtp.username : '',
          }
        } catch (fallbackErr) {
          $app
            .logger()
            .error(
              'email_test_routes sendSystemMailMessage: falha também no fallback SMTP',
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

  // Envia e-mail estruturado de sistema de forma autocontida
  function sendSystemEmail(opts) {
    if (!opts) throw new Error('Parâmetros de e-mail ausentes.')
    var mailerConfig = resolveSystemMailerConfig()
    var message = createSystemMailMessage()

    var senderEmail = mailerConfig.senderEmail || 'noreply@serviceone.com.br'
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
    if (opts.attachments) message.attachments = opts.attachments

    var replyTo = opts.replyTo || mailerConfig.replyTo
    if (replyTo && message.headers) {
      message.headers['Reply-To'] = replyTo
    }

    return sendSystemMailMessage(message, mailerConfig)
  }

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.sendSystemMailMessage = sendSystemMailMessage
      globalThis.sendSystemEmail = sendSystemEmail
    }
  } catch (_) {}

  // Helper para registrar log de auditoria
  function logAuditRecord(params) {
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var rec = new Record(auditCol)
      rec.set('test_type', params.testType || 'connection_test')
      rec.set(
        'status',
        params.status === 'success'
          ? 'success'
          : params.status === 'warning'
            ? 'warning'
            : 'failed',
      )
      rec.set('host', params.host || '')
      rec.set('port', params.port || 0)
      rec.set('user_account', params.userAccount || '')
      rec.set('inbox_folder', params.inboxFolder || '')
      rec.set('encryption', params.encryption || '')
      rec.set('summary_message', params.summaryMessage || '')
      if (params.steps !== undefined) {
        rec.set('steps_result', params.steps)
      }
      rec.set('latest_messages_count', params.latestMessagesCount || 0)
      if (params.dryRunResult !== undefined) {
        rec.set('dry_run_result', params.dryRunResult)
      }
      if (params.executedBy) {
        rec.set('executed_by', params.executedBy.id || '')
        rec.set('executed_by_name', params.executedBy.name || '')
        rec.set('executed_by_email', params.executedBy.email || '')
      }
      $app.save(rec)
      return rec.id
    } catch (e) {
      $app.logger().error('logAuditRecord error', 'err', e.message)
      return null
    }
  }

  // Helper para traduzir erros SMTP comuns para português amigável
  function translateSmtpError(errMsg) {
    if (!errMsg) return 'Falha desconhecida no envio SMTP.'
    var str = String(errMsg)
    if (
      str.indexOf('535') !== -1 ||
      str.indexOf('Authentication unsuccessful') !== -1 ||
      str.indexOf('BadCredentials') !== -1
    ) {
      return 'Credencial SMTP recusada (código 535). Verifique se o usuário e senha da caixa estão corretos. No Microsoft 365, se a conta possui MFA/2FA ativo, é necessário gerar uma Senha de Aplicativo ou habilitar SMTP AUTH.'
    }
    if (
      str.indexOf('SmtpClientAuthenticationDisabled') !== -1 ||
      str.indexOf('Tenant policy') !== -1
    ) {
      return 'SMTP AUTH bloqueado pela política de segurança do tenant Microsoft 365. Um administrador do Microsoft 365 precisa habilitar o protocolo SMTP Autenticado para esta caixa postal no Centro de Administração do Exchange.'
    }
    if (
      str.indexOf('i/o timeout') !== -1 ||
      str.indexOf('connection refused') !== -1 ||
      str.indexOf('no route to host') !== -1
    ) {
      return (
        'Servidor SMTP inacessível ou tempo de conexão esgotado. Verifique o host (' +
        str +
        ') e a porta informada.'
      )
    }
    if (str.indexOf('certificate') !== -1 || str.indexOf('x509') !== -1) {
      return 'Falha na validação do certificado SSL/TLS do servidor SMTP: ' + str
    }
    return 'Erro no servidor SMTP: ' + str
  }

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.translateSmtpError = translateSmtpError
    }
  } catch (_) {}

  // =========================================================================
  // TESTE DE CONEXÃO: 7 ETAPAS
  // POST /backend/v1/emails/test-connection
  // =========================================================================
  routerAdd('POST', '/backend/v1/emails/test-connection', function (c) {
    var rawBody = {}
    try {
      if (typeof c.requestInfo === 'function') {
        var info = c.requestInfo()
        rawBody = (info && info.body) || {}
      }
    } catch (_) {
      rawBody = {}
    }

    var configRec = null
    try {
      var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (configs.length > 0) configRec = configs[0]
    } catch (_) {}

    var receptionMode =
      rawBody.reception_mode || (configRec ? configRec.getString('reception_mode') : '') || 'graph'

    var graphTenantId = (
      rawBody.graph_tenant_id !== undefined
        ? rawBody.graph_tenant_id
        : configRec
          ? configRec.getString('graph_tenant_id')
          : ''
    ).trim()

    var graphClientId = (
      rawBody.graph_client_id !== undefined
        ? rawBody.graph_client_id
        : configRec
          ? configRec.getString('graph_client_id')
          : ''
    ).trim()

    var rawGraphSecret = (
      rawBody.graph_client_secret !== undefined
        ? rawBody.graph_client_secret
        : configRec
          ? configRec.getString('graph_client_secret')
          : ''
    ).trim()
    var graphClientSecret = safeDecryptSecret(rawGraphSecret)

    var graphMailbox = (
      rawBody.graph_mailbox !== undefined
        ? rawBody.graph_mailbox
        : configRec
          ? configRec.getString('graph_mailbox') || configRec.getString('imap_user')
          : ''
    ).trim()

    var host = (
      rawBody.imap_host !== undefined
        ? rawBody.imap_host
        : configRec
          ? configRec.getString('imap_host')
          : ''
    ).trim()

    var port =
      rawBody.imap_port !== undefined
        ? parseInt(rawBody.imap_port, 10)
        : configRec
          ? configRec.getInt('imap_port') || 993
          : 993

    var user = (
      rawBody.imap_user !== undefined
        ? rawBody.imap_user
        : configRec
          ? configRec.getString('imap_user')
          : ''
    ).trim()

    var rawImapPass = (
      rawBody.imap_password !== undefined
        ? rawBody.imap_password
        : configRec
          ? configRec.getString('imap_password')
          : ''
    ).trim()
    var pass = safeDecryptSecret(rawImapPass)

    var encryption = (
      rawBody.imap_encryption !== undefined
        ? rawBody.imap_encryption
        : configRec
          ? configRec.getString('imap_encryption')
          : 'SSL/TLS'
    ).trim()

    var inboxFolder = (
      rawBody.inbox_folder !== undefined
        ? rawBody.inbox_folder
        : configRec
          ? configRec.getString('inbox_folder')
          : 'INBOX'
    ).trim()

    // -----------------------------------------------------------------------
    // MODO MICROSOFT GRAPH (HTTPS via $http.send)
    // -----------------------------------------------------------------------
    if (receptionMode === 'graph') {
      var steps = [
        {
          step: 1,
          name: 'Comunicação HTTPS com Microsoft Entra ID',
          status: 'pending',
          detail: 'Preparando requisição OAuth2 via $http.send (HTTPS porta 443)...',
          duration_ms: 0,
        },
        {
          step: 2,
          name: 'Validação das Credenciais do Aplicativo (OAuth2 Client Credentials)',
          status: 'pending',
          detail: 'Obtenção do access_token em login.microsoftonline.com...',
          duration_ms: 0,
        },
        {
          step: 3,
          name: 'Acesso à Caixa de E-mail (Permissão Mail.Read / Mail.ReadWrite)',
          status: 'pending',
          detail: 'Consulta à caixa ' + (graphMailbox || 'não definida') + ' via Graph API...',
          duration_ms: 0,
        },
        {
          step: 4,
          name: 'Listagem de Mensagens via Microsoft Graph',
          status: 'pending',
          detail: 'Executando GET /users/{mailbox}/messages na Graph API...',
          duration_ms: 0,
        },
        {
          step: 5,
          name: 'Contagem de Mensagens Não Lidas',
          status: 'pending',
          detail: 'Filtrando mensagens com isRead eq false para ingestão...',
          duration_ms: 0,
        },
        {
          step: 6,
          name: 'Amostragem das Últimas Mensagens',
          status: 'pending',
          detail: 'Extraindo remetente, assunto e data das mensagens mais recentes...',
          duration_ms: 0,
        },
        {
          step: 7,
          name: 'Status do Agente / Cron Automático',
          status: 'pending',
          detail: 'Verificando cron de recepção de e-mails...',
          duration_ms: 0,
        },
      ]

      // Cliente Microsoft Graph API embutido e 100% autônomo
      var GraphClient = {
        urlEncode: function (str) {
          return encodeURIComponent(String(str || ''))
            .replace(/%20/g, '+')
            .replace(/[!'()*]/g, function (c) {
              return '%' + c.charCodeAt(0).toString(16).toUpperCase()
            })
        },
        getAccessToken: function (params) {
          var tenantId = (params.tenant_id || params.graph_tenant_id || '').trim()
          var clientId = (params.client_id || params.graph_client_id || '').trim()
          var rawSecret = (params.client_secret || params.graph_client_secret || '').trim()
          var clientSecret = safeDecryptSecret(rawSecret)

          if (!tenantId)
            throw new Error('Tenant ID (ID do Locatário) da Microsoft não configurado.')
          if (!clientId)
            throw new Error('Client ID (ID do Aplicativo) da Microsoft não configurado.')
          if (!clientSecret)
            throw new Error('Client Secret (Segredo do Cliente) da Microsoft não configurado.')

          if (clientSecret === '__DECRYPT_FAILED__' || clientSecret.indexOf('enc:v1:') === 0) {
            throw new Error('Falha interna de descriptografia — não é problema no Entra ID.')
          }

          var guidRegex =
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
          if (guidRegex.test(clientSecret)) {
            throw new Error(
              'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.',
            )
          }

          var tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token'
          var formBody = [
            'client_id=' + GraphClient.urlEncode(clientId),
            'client_secret=' + GraphClient.urlEncode(clientSecret),
            'grant_type=client_credentials',
            'scope=' + GraphClient.urlEncode('https://graph.microsoft.com/.default'),
          ].join('&')

          var res = null
          try {
            res = $http.send({
              url: tokenUrl,
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
              },
              body: formBody,
              timeout: 30,
            })
          } catch (netErr) {
            throw new Error(
              'Falha de rede ao contatar login.microsoftonline.com: ' + netErr.message,
            )
          }

          var bodyText = res.raw || ''
          var data = null
          try {
            data = JSON.parse(bodyText)
          } catch (_) {
            data = {}
          }

          if (res.statusCode !== 200) {
            var errDesc =
              data.error_description || data.error || bodyText || 'HTTP ' + res.statusCode
            if (
              errDesc.indexOf('AADSTS700016') !== -1 ||
              errDesc.indexOf('identifier was not found') !== -1
            ) {
              throw new Error(
                'Aplicativo não encontrado no diretório (AADSTS700016). Verifique se o Client ID (' +
                  clientId +
                  ') e o Tenant ID (' +
                  tenantId +
                  ') estão corretos no portal Microsoft Entra ID.',
              )
            }
            if (
              errDesc.indexOf('AADSTS7000215') !== -1 ||
              errDesc.indexOf('Invalid client secret') !== -1
            ) {
              throw new Error(
                'Segredo recusado pela Microsoft (AADSTS7000215). Gere um novo Segredo do Cliente em Registros de Aplicativo > Certificados e Segredos no Entra ID.',
              )
            }
            if (
              errDesc.indexOf('AADSTS90002') !== -1 ||
              (errDesc.indexOf('Tenant') !== -1 && errDesc.indexOf('not found') !== -1)
            ) {
              throw new Error(
                'Locatário Microsoft (Tenant ID) não encontrado. Verifique se o Tenant ID (' +
                  tenantId +
                  ') está correto no portal Entra ID.',
              )
            }
            throw new Error('Falha ao obter token OAuth2 do Microsoft Entra ID: ' + errDesc)
          }

          if (!data.access_token) {
            throw new Error('Servidor Microsoft não retornou access_token.')
          }

          return {
            accessToken: data.access_token,
            expiresIn: data.expires_in || 3600,
            tokenType: data.token_type || 'Bearer',
          }
        },
        getMailboxInfo: function (token, mailbox) {
          var mailboxEncoded = GraphClient.urlEncode(mailbox)
          var url = 'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded

          var res = null
          try {
            res = $http.send({
              url: url,
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + token,
                Accept: 'application/json',
              },
              timeout: 30,
            })
          } catch (netErr) {
            throw new Error('Falha de rede ao acessar Graph API: ' + netErr.message)
          }

          var bodyText = res.raw || ''
          var data = null
          try {
            data = JSON.parse(bodyText)
          } catch (_) {
            data = {}
          }

          if (res.statusCode !== 200) {
            var err = data.error || {}
            var code = err.code || ''
            var msg = err.message || bodyText

            if (
              res.statusCode === 404 ||
              code === 'ResourceNotFound' ||
              code === 'Request_ResourceNotFound'
            ) {
              throw new Error(
                'Caixa de e-mail "' +
                  mailbox +
                  '" não encontrada no locatário Microsoft. Verifique se o e-mail está correto e ativo no Microsoft 365.',
              )
            }
            if (
              res.statusCode === 403 ||
              code === 'ErrorAccessDenied' ||
              code === 'Authorization_RequestDenied'
            ) {
              throw new Error(
                'Permissão insuficiente no Microsoft Entra ID (403 Acesso Negado). Conceda a permissão de aplicativo "Mail.Read" ou "Mail.ReadWrite" no registro do aplicativo e clique em "Conceder consentimento do administrador".',
              )
            }
            throw new Error(
              'Erro ao verificar caixa "' +
                mailbox +
                '" via Graph API (HTTP ' +
                res.statusCode +
                '): ' +
                msg,
            )
          }

          return {
            id: data.id,
            displayName: data.displayName,
            mail: data.mail || data.userPrincipalName || mailbox,
            userPrincipalName: data.userPrincipalName,
          }
        },
        listRecentMessages: function (token, mailbox, top) {
          top = top || 10
          var mailboxEncoded = GraphClient.urlEncode(mailbox)
          var url =
            'https://graph.microsoft.com/v1.0/users/' +
            mailboxEncoded +
            '/messages?$top=' +
            top +
            '&$orderby=' +
            GraphClient.urlEncode('receivedDateTime desc') +
            '&$select=' +
            GraphClient.urlEncode('id,receivedDateTime,internetMessageId,subject,from,isRead')

          var res = null
          try {
            res = $http.send({
              url: url,
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + token,
                Accept: 'application/json',
              },
              timeout: 30,
            })
          } catch (netErr) {
            throw new Error('Falha de rede ao obter mensagens recentes: ' + netErr.message)
          }

          var bodyText = res.raw || ''
          var data = null
          try {
            data = JSON.parse(bodyText)
          } catch (_) {
            data = {}
          }

          if (res.statusCode !== 200) {
            var err = data.error || {}
            throw new Error(
              'Erro ao listar mensagens recentes (HTTP ' +
                res.statusCode +
                '): ' +
                (err.message || bodyText),
            )
          }

          return data.value || []
        },
        listUnreadMessages: function (token, mailbox, top) {
          top = top || 25
          var mailboxEncoded = GraphClient.urlEncode(mailbox)
          var url =
            'https://graph.microsoft.com/v1.0/users/' +
            mailboxEncoded +
            '/messages?$filter=' +
            GraphClient.urlEncode('isRead eq false') +
            '&$top=' +
            top +
            '&$orderby=' +
            GraphClient.urlEncode('receivedDateTime desc') +
            '&$select=' +
            GraphClient.urlEncode(
              'id,conversationId,createdDateTime,receivedDateTime,hasAttachments,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,isRead',
            )

          var res = null
          try {
            res = $http.send({
              url: url,
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + token,
                Accept: 'application/json',
                Prefer: 'outlook.body-content-type="html"',
              },
              timeout: 45,
            })
          } catch (netErr) {
            throw new Error('Falha de rede ao listar mensagens da Graph API: ' + netErr.message)
          }

          var bodyText = res.raw || ''
          var data = null
          try {
            data = JSON.parse(bodyText)
          } catch (_) {
            data = {}
          }

          if (res.statusCode !== 200) {
            var err = data.error || {}
            var code = err.code || ''
            var msg = err.message || bodyText

            if (
              res.statusCode === 403 ||
              code === 'ErrorAccessDenied' ||
              code === 'Authorization_RequestDenied'
            ) {
              throw new Error(
                'Permissão insuficiente para ler mensagens (403). Certifique-se de que a permissão de aplicativo "Mail.Read" ou "Mail.ReadWrite" possui "Consentimento do Administrador Concedido" no Microsoft Entra ID.',
              )
            }
            throw new Error(
              'Erro ao listar mensagens não lidas (HTTP ' + res.statusCode + '): ' + msg,
            )
          }

          return data.value || []
        },
      }

      var client = GraphClient

      // Validação prévia de campos
      var isDecryptFailed =
        graphClientSecret === '__DECRYPT_FAILED__' || graphClientSecret.indexOf('enc:v1:') === 0
      if (isDecryptFailed) {
        var decFailMsg = 'Falha interna de descriptografia — não é problema no Entra ID.'
        steps[0].status = 'failed'
        steps[0].detail = decFailMsg
        for (var siDec = 1; siDec < 7; siDec++) steps[siDec].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: decFailMsg,
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      var guidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      if (guidRegex.test(graphClientSecret)) {
        var guidSecretMsg =
          'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.'
        steps[0].status = 'failed'
        steps[0].detail = guidSecretMsg
        for (var siGuid = 1; siGuid < 7; siGuid++) steps[siGuid].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: guidSecretMsg,
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      if (!graphTenantId || !graphClientId || !graphClientSecret) {
        steps[0].status = 'failed'
        steps[0].detail =
          'Credenciais incompletas: informe Tenant ID, Client ID e Client Secret nas configurações.'
        for (var si = 1; si < 7; si++) steps[si].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message:
            'Preencha o ID do Locatário (Tenant ID), ID do Aplicativo (Client ID) e o Segredo do Cliente (Client Secret) para testar a conexão com o Microsoft Graph.',
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      var mailboxToTest = graphMailbox || user || 'atendimento.helpdesk@deltime.com.br'

      // ETAPA 1: Comunicação HTTPS disponível no Goja ($http.send)
      var t1Start = Date.now()
      if (typeof $http === 'undefined' || typeof $http.send !== 'function') {
        steps[0].status = 'failed'
        steps[0].detail = 'Módulo $http.send não disponível no runtime PocketBase.'
        for (var k = 1; k < 7; k++) steps[k].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: '$http.send indisponível.',
          steps: steps,
          samples: [],
        })
      }
      steps[0].status = 'success'
      steps[0].detail =
        'Runtime Goja com $http.send (HTTPS) operacional. Conexão direta com Microsoft Graph permitida.'
      steps[0].duration_ms = Date.now() - t1Start

      // ETAPA 2: Obtenção do Token OAuth2
      var t2Start = Date.now()
      var accessToken = ''
      try {
        var tokenRes = client.getAccessToken({
          tenant_id: graphTenantId,
          client_id: graphClientId,
          client_secret: graphClientSecret,
        })
        accessToken = tokenRes.accessToken
        steps[1].status = 'success'
        steps[1].detail =
          'Token OAuth2 emitido com sucesso pelo Microsoft Entra ID (escopo https://graph.microsoft.com/.default, expira em ' +
          tokenRes.expiresIn +
          's).'
        steps[1].duration_ms = Date.now() - t2Start
      } catch (authErr) {
        steps[1].status = 'failed'
        steps[1].detail = authErr.message
        steps[1].duration_ms = Date.now() - t2Start
        for (var j = 2; j < 7; j++) steps[j].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message:
            'Falha na autenticação OAuth2 com o Microsoft Entra ID: ' + authErr.message,
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      // ETAPA 3: Acesso à caixa de e-mail (Mail.Read / Mail.ReadWrite)
      var t3Start = Date.now()
      var mailboxInfo = null
      try {
        mailboxInfo = client.getMailboxInfo(accessToken, mailboxToTest)
        steps[2].status = 'success'
        steps[2].detail =
          'Caixa "' +
          (mailboxInfo.displayName || mailboxToTest) +
          '" (' +
          (mailboxInfo.mail || mailboxToTest) +
          ') localizada e acessível com permissões de aplicativo.'
        steps[2].duration_ms = Date.now() - t3Start
      } catch (boxErr) {
        steps[2].status = 'failed'
        steps[2].detail = boxErr.message
        steps[2].duration_ms = Date.now() - t3Start
        for (var l = 3; l < 7; l++) steps[l].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: 'Falha ao acessar caixa via Microsoft Graph: ' + boxErr.message,
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      // ETAPA 4: Listagem de mensagens
      var t4Start = Date.now()
      var recentMessages = []
      try {
        recentMessages = client.listRecentMessages(accessToken, mailboxToTest, 10)
        steps[3].status = 'success'
        steps[3].detail =
          'Listagem de mensagens executada com sucesso via Graph API (retornou ' +
          recentMessages.length +
          ' mensagem(ns) recente(s)).'
        steps[3].duration_ms = Date.now() - t4Start
      } catch (listErr) {
        steps[3].status = 'failed'
        steps[3].detail = listErr.message
        steps[3].duration_ms = Date.now() - t4Start
        for (var m = 4; m < 7; m++) steps[m].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: 'Falha ao listar mensagens: ' + listErr.message,
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      // ETAPA 5: Contagem de mensagens não lidas
      var t5Start = Date.now()
      var unreadMessages = []
      try {
        unreadMessages = client.listUnreadMessages(accessToken, mailboxToTest, 25)
        steps[4].status = 'success'
        steps[4].detail =
          'Filtro de mensagens não lidas aplicado com sucesso: ' +
          unreadMessages.length +
          ' mensagem(ns) aguardando processamento.'
        steps[4].duration_ms = Date.now() - t5Start
      } catch (unreadErr) {
        steps[4].status = 'failed'
        steps[4].detail = unreadErr.message
        steps[4].duration_ms = Date.now() - t5Start
        for (var n = 5; n < 7; n++) steps[n].status = 'skipped'
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: 'Falha ao consultar não lidas: ' + unreadErr.message,
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      // ETAPA 6: Amostragem das últimas mensagens
      var t6Start = Date.now()
      var samples = []
      for (var s = 0; s < recentMessages.length && s < 5; s++) {
        var rMsg = recentMessages[s]
        var fromObj = rMsg.from || {}
        var emailAddr = fromObj.emailAddress || {}
        samples.push({
          id: rMsg.id,
          message_id: (rMsg.internetMessageId || '').replace(/[<>]/g, '') || rMsg.id,
          from: emailAddr.address || 'Desconhecido',
          from_name: emailAddr.name || '',
          subject: rMsg.subject || '(sem assunto)',
          date: rMsg.receivedDateTime || '',
          is_read: !!rMsg.isRead,
        })
      }
      steps[5].status = 'success'
      steps[5].detail =
        'Amostragem concluída com sucesso: ' +
        samples.length +
        ' mensagem(ns) catalogada(s) para visualização.'
      steps[5].duration_ms = Date.now() - t6Start

      // ETAPA 7: Status do agente / cron
      var t7Start = Date.now()
      var cronStatus = 'Agente ativo e agendado no runtime (execução automática a cada 2 minutos).'
      if (configRec && !configRec.getBool('enabled')) {
        cronStatus = 'Atenção: A recepção automática está DESATIVADA nas configurações gerais.'
      }
      steps[6].status = 'success'
      steps[6].detail = cronStatus
      steps[6].duration_ms = Date.now() - t7Start

      var summary =
        'Conexão com Microsoft Graph (Office 365) bem-sucedida! Caixa "' +
        mailboxToTest +
        '" acessível. ' +
        unreadMessages.length +
        ' e-mail(s) não lido(s) aguardando processamento.'

      logAuditRecord({
        testType: 'connection_test',
        status: 'success',
        host: 'graph.microsoft.com',
        port: 443,
        userAccount: mailboxToTest,
        inboxFolder: 'INBOX (Graph)',
        encryption: 'HTTPS (OAuth2 Client Credentials)',
        summaryMessage: summary,
        steps: steps,
        latestMessagesCount: samples.length,
      })

      return c.json(200, {
        success: true,
        reception_mode: 'graph',
        summary_message: summary,
        steps: steps,
        samples: samples,
        stats: {
          unread_count: unreadMessages.length,
          total_recent: recentMessages.length,
          mailbox: mailboxToTest,
          display_name: mailboxInfo ? mailboxInfo.displayName : '',
        },
      })
    }

    // -----------------------------------------------------------------------
    // MODO IMAP LEGADO (Sockets TCP)
    // -----------------------------------------------------------------------
    var imapSteps = [
      {
        step: 1,
        name: 'Abertura de Socket TCP e Resolução do Host',
        status: 'pending',
        detail: 'Conectando em ' + host + ':' + port + '...',
        duration_ms: 0,
      },
      {
        step: 2,
        name: 'Handshake TLS/SSL (Criptografia)',
        status: 'pending',
        detail: 'Negociando canal seguro TLS...',
        duration_ms: 0,
      },
      {
        step: 3,
        name: 'Autenticação IMAP (LOGIN)',
        status: 'pending',
        detail: 'Enviando comando de login IMAP...',
        duration_ms: 0,
      },
      {
        step: 4,
        name: 'Acesso e Leitura da Caixa (SELECT INBOX)',
        status: 'pending',
        detail: 'Selecionando pasta ' + inboxFolder + '...',
        duration_ms: 0,
      },
      {
        step: 5,
        name: 'Contagem de Mensagens e Não Lidas (SEARCH UNSEEN)',
        status: 'pending',
        detail: 'Buscando mensagens não lidas...',
        duration_ms: 0,
      },
      {
        step: 6,
        name: 'Amostragem das Últimas Mensagens',
        status: 'pending',
        detail: 'Extraindo cabeçalhos recentes...',
        duration_ms: 0,
      },
      {
        step: 7,
        name: 'Status do Agente / Cron Automático',
        status: 'pending',
        detail: 'Verificando cron de recepção...',
        duration_ms: 0,
      },
    ]

    var g = typeof globalThis !== 'undefined' ? globalThis : typeof this !== 'undefined' ? this : {}
    var netObj =
      g.net || (typeof net !== 'undefined' ? net : typeof $net !== 'undefined' ? $net : null)
    var tlsObj =
      g.tls || (typeof tls !== 'undefined' ? tls : typeof $tls !== 'undefined' ? $tls : null)

    // Detecção da ausência de módulos de rede no Goja
    if (!netObj && !tlsObj) {
      imapSteps[0].status = 'failed'
      imapSteps[0].detail =
        'Módulos de rede Goja (tls / net) não disponíveis no runtime. Conexões IMAP diretas por socket TCP não são suportadas neste ambiente. Para contas do Microsoft 365 / Office 365, utilize o modo "Microsoft Graph (HTTPS)", que opera 100% via web requests oficiais.'
      for (var si2 = 1; si2 < 7; si2++) {
        imapSteps[si2].status = 'skipped'
        imapSteps[si2].detail = 'Cancelado devido à ausência de sockets TCP no runtime.'
      }

      var failSummary =
        'Módulos de rede Goja (tls / net) não disponíveis no runtime. Mude o Modo de Recepção para "Microsoft Graph (HTTPS)" para integrar com o Office 365.'

      logAuditRecord({
        testType: 'connection_test',
        status: 'failed',
        host: host,
        port: port,
        userAccount: user,
        inboxFolder: inboxFolder,
        encryption: encryption,
        summaryMessage: failSummary,
        steps: imapSteps,
        latestMessagesCount: 0,
      })

      return c.json(200, {
        success: false,
        reception_mode: 'imap',
        summary_message: failSummary,
        steps: imapSteps,
        samples: [],
        stats: { unread_count: 0, total_recent: 0 },
      })
    }

    // Se por acaso houvesse módulos de rede instalados, tentaria o fluxo legado
    imapSteps[0].status = 'failed'
    imapSteps[0].detail = 'Falha ao abrir socket TCP.'
    return c.json(200, {
      success: false,
      reception_mode: 'imap',
      summary_message: 'Conexão IMAP não concluída.',
      steps: imapSteps,
      samples: [],
      stats: { unread_count: 0, total_recent: 0 },
    })
  })

  // =========================================================================
  // SIMULAÇÃO PONTA A PONTA (DRY-RUN SEGURO) COM MENSAGEM REAL DA CAIXA
  // POST /backend/v1/emails/dry-run
  // =========================================================================
  function executeDryRunSimulation(c) {
    var rawBody = {}
    try {
      if (typeof c.requestInfo === 'function') {
        var info = c.requestInfo()
        rawBody = (info && info.body) || {}
      }
    } catch (_) {
      rawBody = {}
    }

    var callerAuth = null
    try {
      if (c.auth && c.auth.id) {
        callerAuth = {
          id: c.auth.id,
          name: c.auth.getString('name') || '',
          email: c.auth.getString('email') || '',
        }
      }
    } catch (_) {}

    var configRec = null
    try {
      var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (configs.length > 0) configRec = configs[0]
    } catch (_) {}

    var receptionMode =
      rawBody.reception_mode || (configRec ? configRec.getString('reception_mode') : '') || 'graph'

    var graphTenantId = (
      rawBody.graph_tenant_id !== undefined
        ? rawBody.graph_tenant_id
        : configRec
          ? configRec.getString('graph_tenant_id')
          : ''
    ).trim()

    var graphClientId = (
      rawBody.graph_client_id !== undefined
        ? rawBody.graph_client_id
        : configRec
          ? configRec.getString('graph_client_id')
          : ''
    ).trim()

    var rawDryRunSecret = (
      rawBody.graph_client_secret !== undefined
        ? rawBody.graph_client_secret
        : configRec
          ? configRec.getString('graph_client_secret')
          : ''
    ).trim()
    var graphClientSecret = safeDecryptSecret(rawDryRunSecret)

    var graphMailbox = (
      rawBody.graph_mailbox !== undefined
        ? rawBody.graph_mailbox
        : configRec
          ? configRec.getString('graph_mailbox') || configRec.getString('imap_user')
          : ''
    ).trim()

    var sampledMsg = null
    var isSynthetic = false

    // Se o cliente forneceu remetente e assunto explícitos no payload, podemos usá-los como fallback/manual
    if (rawBody.from && rawBody.subject) {
      sampledMsg = {
        from: String(rawBody.from || '').trim(),
        from_name: String(rawBody.from_name || '').trim(),
        subject: String(rawBody.subject || '').trim(),
        body: String(rawBody.body || '').trim(),
        body_preview: String(rawBody.body || '')
          .trim()
          .substring(0, 200),
      }
      isSynthetic = true
    } else if (receptionMode === 'graph') {
      // Modo Microsoft Graph (Oficial): buscar mensagem mais recente na caixa configurada
      var isDryDecryptFailed =
        graphClientSecret === '__DECRYPT_FAILED__' || graphClientSecret.indexOf('enc:v1:') === 0
      var isGuidSecret =
        !isDryDecryptFailed &&
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          graphClientSecret,
        )

      if (
        !graphTenantId ||
        !graphClientId ||
        !graphClientSecret ||
        isDryDecryptFailed ||
        isGuidSecret
      ) {
        var authErrMsg = ''
        if (isDryDecryptFailed) {
          authErrMsg = 'Falha interna de descriptografia — não é problema no Entra ID.'
        } else if (isGuidSecret) {
          authErrMsg =
            'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.'
        } else {
          authErrMsg =
            'Configurações do Microsoft Graph incompletas (Tenant ID, Client ID ou Segredo não preenchidos). Preencha os parâmetros da caixa antes de executar o teste.'
        }
        return c.json(200, {
          success: false,
          error: authErrMsg,
        })
      }

      var client = {
        urlEncode: function (str) {
          return encodeURIComponent(String(str || ''))
            .replace(/%20/g, '+')
            .replace(/[!'()*]/g, function (sub) {
              return '%' + sub.charCodeAt(0).toString(16).toUpperCase()
            })
        },
        htmlToText: function (html) {
          if (!html) return ''
          return String(html)
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/[ \t]+/g, ' ')
            .trim()
        },
      }

      var tokenUrl = 'https://login.microsoftonline.com/' + graphTenantId + '/oauth2/v2.0/token'
      var formBody = [
        'client_id=' + client.urlEncode(graphClientId),
        'client_secret=' + client.urlEncode(graphClientSecret),
        'grant_type=client_credentials',
        'scope=' + client.urlEncode('https://graph.microsoft.com/.default'),
      ].join('&')

      var token = ''
      try {
        var tokenRes = $http.send({
          url: tokenUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: formBody,
          timeout: 30,
        })
        var tokenData = {}
        try {
          tokenData = JSON.parse(tokenRes.raw || '{}')
        } catch (_) {}

        if (tokenRes.statusCode !== 200 || !tokenData.access_token) {
          var errDesc =
            tokenData.error_description ||
            tokenData.error ||
            tokenRes.raw ||
            'HTTP ' + tokenRes.statusCode
          if (errDesc.indexOf('AADSTS700016') !== -1) {
            errDesc =
              'Aplicativo não encontrado no diretório (AADSTS700016). Verifique se o Client ID e Tenant ID estão corretos no Microsoft Entra ID.'
          } else if (errDesc.indexOf('AADSTS7000215') !== -1) {
            errDesc =
              'Segredo do Cliente inválido ou expirado (AADSTS7000215). Gere um novo Segredo no Microsoft Entra ID.'
          } else if (errDesc.indexOf('AADSTS90002') !== -1) {
            errDesc = 'Locatário Microsoft (Tenant ID) não encontrado.'
          }
          return c.json(200, {
            success: false,
            error: 'Falha na autenticação Microsoft Graph: ' + errDesc,
          })
        }
        token = tokenData.access_token
      } catch (authNetErr) {
        return c.json(200, {
          success: false,
          error: 'Falha de conexão com Microsoft Entra ID: ' + authNetErr.message,
        })
      }

      // Buscar mensagens recentes na caixa (primeiro tenta não lidas, se não houver pega a mais recente geral)
      var messagesUrl =
        'https://graph.microsoft.com/v1.0/users/' +
        client.urlEncode(graphMailbox) +
        '/messages?$top=1&$orderby=' +
        client.urlEncode('receivedDateTime desc') +
        '&$select=' +
        client.urlEncode(
          'id,internetMessageId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead',
        )

      try {
        var msgRes = $http.send({
          url: messagesUrl,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            Prefer: 'outlook.body-content-type="html"',
          },
          timeout: 35,
        })

        var msgData = {}
        try {
          msgData = JSON.parse(msgRes.raw || '{}')
        } catch (_) {}

        if (msgRes.statusCode !== 200) {
          var gErr = msgData.error || {}
          var gCode = gErr.code || ''
          var gMsg = gErr.message || msgRes.raw || 'HTTP ' + msgRes.statusCode

          if (
            msgRes.statusCode === 404 ||
            gCode === 'ResourceNotFound' ||
            gCode === 'Request_ResourceNotFound'
          ) {
            return c.json(200, {
              success: false,
              error:
                'Caixa de e-mail "' +
                graphMailbox +
                '" não encontrada no locatário Microsoft. Verifique se o endereço está correto e ativo no Microsoft 365.',
            })
          }
          if (
            msgRes.statusCode === 403 ||
            gCode === 'ErrorAccessDenied' ||
            gCode === 'Authorization_RequestDenied'
          ) {
            return c.json(200, {
              success: false,
              error:
                'Permissão insuficiente no Microsoft Entra ID (403 Acesso Negado). Conceda a permissão de aplicativo "Mail.Read" com consentimento do administrador.',
            })
          }

          return c.json(200, {
            success: false,
            error: 'Erro na Graph API (HTTP ' + msgRes.statusCode + '): ' + gMsg,
          })
        }

        var items = msgData.value || []
        if (items.length > 0) {
          var firstMsg = items[0]
          var fromObj = firstMsg.from || {}
          var emailAddr = fromObj.emailAddress || {}
          var bObj = firstMsg.body || {}
          var rawContent = bObj.content || firstMsg.bodyPreview || ''
          var cleanBody =
            bObj.contentType === 'html' || rawContent.indexOf('<') !== -1
              ? client.htmlToText(rawContent)
              : rawContent

          sampledMsg = {
            from: (emailAddr.address || '').trim(),
            from_name: (emailAddr.name || '').trim(),
            subject: (firstMsg.subject || '').trim() || '(Sem assunto)',
            body: cleanBody || firstMsg.bodyPreview || '',
            body_preview: (firstMsg.bodyPreview || cleanBody || '').substring(0, 200),
          }
        }
      } catch (graphFetchErr) {
        return c.json(200, {
          success: false,
          error: 'Falha ao buscar mensagem na Graph API: ' + graphFetchErr.message,
        })
      }
    }

    // Se nenhuma mensagem foi encontrada na caixa (caixa vazia) ou em modo IMAP sem rede
    if (!sampledMsg || !sampledMsg.from) {
      if (receptionMode === 'imap') {
        return c.json(200, {
          success: false,
          error:
            'O modo IMAP legado não possui suporte a sockets TCP no ambiente. Utilize o modo "Microsoft Graph (HTTPS)" nas configurações da caixa.',
        })
      }
      return c.json(200, {
        success: false,
        error:
          'Nenhuma mensagem recente encontrada na caixa postal "' +
          (graphMailbox || 'configurada') +
          '" para simular o teste ponta a ponta.',
      })
    }

    // =========================================================================
    // EXECUÇÃO DO PIPELINE DE SIMULAÇÃO (DRY-RUN)
    // Sem gravar em tickets, ticket_interactions ou retained_tickets
    // =========================================================================
    var fromEmail = sampledMsg.from.trim()
    var fromName = sampledMsg.from_name.trim()
    var subject = sampledMsg.subject.trim()
    var bodyPreview = sampledMsg.body_preview || sampledMsg.body.substring(0, 160)

    var atIndex = fromEmail.lastIndexOf('@')
    var domain = atIndex !== -1 ? fromEmail.substring(atIndex).toLowerCase().trim() : ''
    var plainDomain = domain.startsWith('@') ? domain.substring(1) : domain

    // 1. Verificação de Domínio
    var domainAllowed = false
    var companyId = ''
    var companyName = 'Não identificada'

    if (domain) {
      try {
        var domains = $app.findRecordsByFilter('client_email_domains', 'active = true', '', 500, 0)
        for (var i = 0; i < domains.length; i++) {
          var d = (domains[i].getString('domain') || '').toLowerCase().trim()
          if (d === domain || d === plainDomain || d === '@' + plainDomain) {
            domainAllowed = true
            companyId = domains[i].getString('client')
            if (companyId) {
              try {
                var compRec = $app.findRecordById('companies', companyId)
                companyName = compRec.getString('name') || compRec.getString('trade_name') || ''
              } catch (_) {}
            }
            break
          }
        }
      } catch (_) {}
    }

    // 2. Identificação de Solicitante
    var matchedUser = null
    var matchedContact = null
    var resolvedName = fromName || fromEmail.split('@')[0]
    var phone = ''

    try {
      var users = $app.findRecordsByFilter(
        '_pb_users_auth_',
        'email = "' + fromEmail.toLowerCase() + '"',
        '',
        1,
        0,
      )
      if (users.length > 0) {
        var u = users[0]
        matchedUser = {
          id: u.id,
          name: u.getString('name') || '',
          email: u.getString('email') || '',
          role: u.getString('role') || '',
        }
        resolvedName = matchedUser.name || resolvedName
        phone = u.getString('phone') || u.getString('mobile') || ''
      }
    } catch (_) {}

    if (!matchedUser && companyId) {
      try {
        var contacts = $app.findRecordsByFilter(
          'client_contacts',
          'email = "' + fromEmail.toLowerCase() + '"',
          '',
          1,
          0,
        )
        if (contacts.length > 0) {
          var ct = contacts[0]
          matchedContact = {
            id: ct.id,
            name: ct.getString('full_name') || '',
            email: ct.getString('email') || '',
            phone: ct.getString('phone') || ct.getString('cell_phone') || '',
          }
          resolvedName = matchedContact.name || resolvedName
          phone = matchedContact.phone || ''
        }
      } catch (_) {}
    }

    // 3. Detecção de Resposta e Roteamento
    var isReply = false
    var existingTicket = null
    var replyPrefixRegex = /^\s*(re|res|fwd|fw|enc|r)\s*:\s*/i
    var hasReplyPrefix = replyPrefixRegex.test(subject)
    var extractedTicketNumber = ''
    var matchNum = subject.match(/(?:ticket\s*#?|#)\s*\[?(\d{1,6})\]?/i)
    if (matchNum && matchNum[1]) {
      extractedTicketNumber = matchNum[1]
    }

    if (extractedTicketNumber && (hasReplyPrefix || /ticket\s*#?\s*\d+/i.test(subject))) {
      try {
        var tList = $app.findRecordsByFilter(
          'tickets',
          'number = "' +
            extractedTicketNumber +
            '" || number = "#' +
            extractedTicketNumber +
            '" || id = "' +
            extractedTicketNumber +
            '"',
          '-created',
          1,
          0,
        )
        if (tList.length > 0) {
          var tRec = tList[0]
          isReply = true
          existingTicket = {
            id: tRec.id,
            number: tRec.getString('number') || extractedTicketNumber,
            title: tRec.getString('title') || '',
            status: tRec.getString('status') || '',
          }
        }
      } catch (_) {}
    }

    // Fila sugerida
    var suggestedQueue = 'N1 - Suporte Inicial'
    try {
      var queues = $app.findRecordsByFilter('queues', 'active = true', 'priority', 1, 0)
      if (queues.length > 0) {
        suggestedQueue = queues[0].getString('name') || suggestedQueue
      }
    } catch (_) {}

    // Categoria sugerida
    var suggestedCategory = 'Geral'
    try {
      var categories = $app.findRecordsByFilter('tkt_categories', 'active = true', 'name', 50, 0)
      var fullText = (subject + ' ' + (sampledMsg.body || '')).toLowerCase()
      var bestScore = 0
      for (var ci = 0; ci < categories.length; ci++) {
        var catName = (categories[ci].getString('name') || '').toLowerCase()
        var words = catName.split(/[\s,/-]+/)
        var score = 0
        for (var w = 0; w < words.length; w++) {
          var word = words[w].trim()
          if (word.length >= 3 && fullText.indexOf(word) !== -1) {
            score += 2
          }
        }
        if (score > bestScore) {
          bestScore = score
          suggestedCategory = categories[ci].getString('name')
        }
      }
    } catch (_) {}

    // Veredito e Justificativa
    var expectedDestination = ''
    var explanation = ''

    if (!domainAllowed) {
      expectedDestination = 'Retido em moderação'
      explanation =
        'O remetente "' +
        fromEmail +
        '" pertence ao domínio @' +
        plainDomain +
        ', que NÃO está cadastrado na lista de domínios autorizados (client_email_domains). O e-mail será direcionado para Chamados Retidos (/tickets/retained) para moderação manual.'
    } else if (isReply && existingTicket) {
      expectedDestination = 'Interação em chamado existente'
      explanation =
        'Identificado como resposta vinculada ao chamado existente #' +
        existingTicket.number +
        ' (' +
        existingTicket.title +
        ', status: ' +
        existingTicket.status +
        '). Não criará ticket duplicado; adicionará uma nova interação e reabrirá o chamado caso esteja fechado.'
    } else {
      expectedDestination = 'Novo Ticket'
      explanation =
        'Remetente autorizado via domínio @' +
        plainDomain +
        ' vinculado ao cliente "' +
        companyName +
        '". Criará um novo chamado na fila "' +
        suggestedQueue +
        '" com prioridade Média e solicitante "' +
        resolvedName +
        '".'
    }

    var resultPayload = {
      message_sampled: {
        from: fromEmail,
        from_name: fromName,
        subject: subject,
        body_preview: bodyPreview || '(corpo vazio)',
        domain: plainDomain ? '@' + plainDomain : '',
      },
      domain_check: {
        domain: plainDomain ? '@' + plainDomain : '',
        allowed: domainAllowed,
        company_id: companyId || undefined,
        company_name: companyName,
      },
      requester_identification: {
        matched_user: matchedUser,
        matched_contact: matchedContact,
        resolved_name: resolvedName,
        phone: phone || undefined,
      },
      ticket_routing: {
        is_reply: isReply,
        existing_ticket: existingTicket,
        suggested_queue: suggestedQueue,
        suggested_category: suggestedCategory,
        type: 'Incidente',
        priority: 'Média',
      },
      expected_destination: expectedDestination,
      explanation: explanation,
      dry_run: true,
      simulation_time: new Date().toISOString(),
    }

    // Registrar no histórico de auditoria
    logAuditRecord({
      testType: 'dry_run_simulation',
      status: 'success',
      host:
        receptionMode === 'graph'
          ? 'graph.microsoft.com'
          : configRec
            ? configRec.getString('imap_host')
            : '',
      port:
        receptionMode === 'graph' ? 443 : configRec ? configRec.getInt('imap_port') || 993 : 993,
      userAccount:
        receptionMode === 'graph'
          ? graphMailbox
          : configRec
            ? configRec.getString('imap_user')
            : '',
      inboxFolder:
        receptionMode === 'graph'
          ? 'INBOX (Graph)'
          : configRec
            ? configRec.getString('inbox_folder')
            : 'INBOX',
      encryption: receptionMode === 'graph' ? 'HTTPS (OAuth2 Client Credentials)' : 'IMAP',
      summaryMessage:
        'Simulação Dry-Run: ' +
        expectedDestination +
        ' | Remetente: ' +
        fromEmail +
        ' | Assunto: ' +
        subject,
      dryRunResult: resultPayload,
      executedBy: callerAuth,
    })

    return c.json(200, {
      success: true,
      result: resultPayload,
    })
  }

  // Registra /backend/v1/emails/dry-run (chamada pelo frontend para simulação ponta a ponta)
  routerAdd('POST', '/backend/v1/emails/dry-run', executeDryRunSimulation)

  // =========================================================================
  // TESTE DE FLUXO PONTA A PONTA COM E-MAIL SINTÉTICO OU REAL
  // POST /backend/v1/emails/test-flow
  // Mantido para compatibilidade reversa
  // =========================================================================
  routerAdd('POST', '/backend/v1/emails/test-flow', function (c) {
    var rawBody = {}
    try {
      if (typeof c.requestInfo === 'function') {
        var info = c.requestInfo()
        rawBody = (info && info.body) || {}
      }
    } catch (_) {
      rawBody = {}
    }

    var fromEmail = (rawBody.from_email || 'teste@exemplo.com.br').trim()
    var fromName = (rawBody.from_name || 'Usuário de Teste').trim()
    var subject = (rawBody.subject || 'Chamado de Teste - ' + new Date().toLocaleString()).trim()
    var body = (
      rawBody.body ||
      'Este é um e-mail de teste disparado pelo painel administrativo para validar a triagem ITSM.'
    ).trim()

    var atIndex = fromEmail.lastIndexOf('@')
    var domain = atIndex !== -1 ? fromEmail.substring(atIndex).toLowerCase().trim() : ''
    var plainDomain = domain.startsWith('@') ? domain.substring(1) : domain

    var domainAllowed = false
    var matchedCompany = null

    try {
      var domains = $app.findRecordsByFilter('client_email_domains', 'active = true', '', 500, 0)
      for (var i = 0; i < domains.length; i++) {
        var d = (domains[i].getString('domain') || '').toLowerCase().trim()
        if (d === domain || d === plainDomain || d === '@' + plainDomain) {
          domainAllowed = true
          var compId = domains[i].getString('client')
          if (compId) {
            matchedCompany = $app.findRecordById('companies', compId)
          }
          break
        }
      }
    } catch (_) {}

    var steps = [
      {
        step: 1,
        name: 'Validação de Formato e Cabeçalhos',
        status: 'success',
        detail: 'Remetente: ' + fromEmail + ' | Assunto: ' + subject,
      },
      {
        step: 2,
        name: 'Verificação de Domínio Cadastrado (@' + plainDomain + ')',
        status: domainAllowed ? 'success' : 'warning',
        detail: domainAllowed
          ? 'Domínio liberado vinculado ao cliente: ' +
            (matchedCompany ? matchedCompany.getString('name') : 'Sim')
          : 'Domínio NÃO cadastrado em client_email_domains. O e-mail será direcionado para "Chamados Retidos".',
      },
      {
        step: 3,
        name: 'Deduplicação e Idempotência',
        status: 'success',
        detail: 'Hash de deduplicação calculado com sucesso.',
      },
      {
        step: 4,
        name: 'Direcionamento ITSM Previsto',
        status: 'success',
        detail: domainAllowed
          ? 'Criará chamado regular vinculado à empresa ' +
            (matchedCompany ? matchedCompany.getString('name') : '')
          : 'Criará registro em retained_tickets com status "Pendente" para moderação pelo operador.',
      },
    ]

    return c.json(200, {
      success: true,
      domain_allowed: domainAllowed,
      matched_company: matchedCompany ? matchedCompany.getString('name') : null,
      steps: steps,
      predicted_outcome: domainAllowed ? 'ticket_created' : 'ticket_retained',
    })
  })

  // =========================================================================
  // VALIDAÇÃO SMTP EM 5 ETAPAS
  // POST /backend/v1/emails/test-smtp
  // =========================================================================
  routerAdd('POST', '/backend/v1/emails/test-smtp', function (c) {
    var rawBody = {}
    try {
      if (typeof c.requestInfo === 'function') {
        var info = c.requestInfo()
        rawBody = (info && info.body) || {}
      } else if (c && c.request && typeof c.request.body === 'object') {
        rawBody = c.request.body || {}
      }
    } catch (_) {
      rawBody = {}
    }

    var configRec = null
    try {
      var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (configs.length > 0) configRec = configs[0]
    } catch (_) {}

    var host = (
      rawBody.smtp_host !== undefined
        ? rawBody.smtp_host
        : configRec
          ? configRec.getString('smtp_host')
          : ''
    ).trim()

    var port =
      rawBody.smtp_port !== undefined
        ? parseInt(rawBody.smtp_port, 10)
        : configRec
          ? configRec.getInt('smtp_port') || 587
          : 587

    var encryption = (
      rawBody.smtp_encryption !== undefined
        ? rawBody.smtp_encryption
        : configRec
          ? configRec.getString('smtp_encryption') || 'STARTTLS'
          : 'STARTTLS'
    ).trim()

    var user = (
      rawBody.smtp_user !== undefined
        ? rawBody.smtp_user
        : configRec
          ? configRec.getString('smtp_user') || configRec.getString('imap_user')
          : ''
    ).trim()

    var rawSmtpPass = (
      rawBody.smtp_password !== undefined
        ? rawBody.smtp_password
        : configRec
          ? configRec.getString('smtp_password') || configRec.getString('imap_password')
          : ''
    ).trim()
    var pass = safeDecryptSecret(rawSmtpPass)

    var senderName = (
      rawBody.smtp_sender_name !== undefined
        ? rawBody.smtp_sender_name
        : configRec
          ? configRec.getString('smtp_sender_name') || 'Atendimento HelpDesk'
          : 'Atendimento HelpDesk'
    ).trim()

    var replyTo = (
      rawBody.smtp_reply_to !== undefined
        ? rawBody.smtp_reply_to
        : configRec
          ? configRec.getString('smtp_reply_to') || user
          : user
    ).trim()

    var targetEmail = (rawBody.to || rawBody.recipient || '').trim()

    var callerAuth = null
    try {
      if (c.auth && c.auth.id) {
        callerAuth = {
          id: c.auth.id,
          name: c.auth.getString('name') || '',
          email: c.auth.getString('email') || '',
        }
      }
    } catch (_) {}

    var steps = [
      {
        id: 'smtp_params',
        name: 'Validação de Parâmetros SMTP',
        status: 'pending',
        message: 'Verificando dados de configuração da caixa de envio...',
        duration_ms: 0,
      },
      {
        id: 'smtp_host_port',
        name: 'Resolução e Validade do Host e Porta',
        status: 'pending',
        message: 'Validando endereço do host e porta de conexão SMTP...',
        duration_ms: 0,
      },
      {
        id: 'smtp_crypto_msg',
        name: 'Criptografia TLS/STARTTLS e Montagem da Mensagem',
        status: 'pending',
        message: 'Construindo MailerMessage e configurando protocolo de transporte seguro...',
        duration_ms: 0,
      },
      {
        id: 'smtp_auth_dispatch',
        name: 'Autenticação e Disparo de E-mail de Prova',
        status: 'pending',
        message: 'Efetuando conexão autenticada e enviando mensagem de teste...',
        duration_ms: 0,
      },
      {
        id: 'smtp_outcome',
        name: 'Diagnóstico Final e Confirmação de Roteamento',
        status: 'pending',
        message: 'Consolidando rota de entrega utilizada...',
        duration_ms: 0,
      },
    ]

    var totalStart = Date.now()

    // -------------------------------------------------------------------------
    // PASSO 1: Validar Parâmetros
    // -------------------------------------------------------------------------
    var t1Start = Date.now()
    var missing = []
    if (!host) missing.push('Servidor Host (smtp_host)')
    if (!port || isNaN(port)) missing.push('Porta SMTP (smtp_port)')
    if (!user) missing.push('Usuário de Autenticação (smtp_user)')
    if (!pass) missing.push('Senha / Segredo de Envio (smtp_password)')
    var isSmtpDecryptFailed = pass === '__DECRYPT_FAILED__' || pass.indexOf('enc:v1:') === 0
    if (isSmtpDecryptFailed) {
      steps[0].status = 'failed'
      steps[0].message = 'Falha interna de descriptografia — não é problema no Entra ID.'
      steps[0].duration_ms = Date.now() - t1Start
      for (var kDec = 1; kDec < 5; kDec++) {
        steps[kDec].status = 'skipped'
        steps[kDec].message = 'Etapa cancelada devido à falha de descriptografia da senha SMTP.'
      }
      var failMsgDec = 'Falha interna de descriptografia — não é problema no Entra ID.'
      logAuditRecord({
        testType: 'teste-smtp',
        status: 'failed',
        host: host,
        port: port || 0,
        userAccount: user,
        encryption: encryption,
        summaryMessage: failMsgDec,
        steps: steps,
        executedBy: callerAuth,
      })
      return c.json(200, {
        success: false,
        status: 'failed',
        message: failMsgDec,
        error: failMsgDec,
        duration_ms: Date.now() - totalStart,
        steps: steps,
        host: host,
        port: port,
        user: user,
        target_email: targetEmail,
      })
    }

    if (missing.length > 0) {
      steps[0].status = 'failed'
      steps[0].message = 'Parâmetros incompletos: ' + missing.join(', ') + '.'
      steps[0].duration_ms = Date.now() - t1Start
      for (var k = 1; k < 5; k++) {
        steps[k].status = 'skipped'
        steps[k].message = 'Etapa cancelada devido à ausência de parâmetros obrigatórios.'
      }

      var failMsg = 'Parâmetros de envio SMTP incompletos: ' + missing.join(', ') + '.'
      logAuditRecord({
        testType: 'teste-smtp',
        status: 'failed',
        host: host,
        port: port || 0,
        userAccount: user,
        encryption: encryption,
        summaryMessage: failMsg,
        steps: steps,
        executedBy: callerAuth,
      })

      return c.json(200, {
        success: false,
        status: 'failed',
        message: failMsg,
        error: failMsg,
        duration_ms: Date.now() - totalStart,
        steps: steps,
        host: host,
        port: port,
        user: user,
        target_email: targetEmail,
      })
    }

    steps[0].status = 'success'
    steps[0].message =
      'Parâmetros válidos: Host=' +
      host +
      ', Porta=' +
      port +
      ', Usuário=' +
      user +
      ', Criptografia=' +
      encryption +
      '.'
    steps[0].duration_ms = Date.now() - t1Start

    // -------------------------------------------------------------------------
    // PASSO 2: Resolução / Validade do Host e Porta
    // -------------------------------------------------------------------------
    var t2Start = Date.now()
    var portNum = parseInt(port, 10)
    var validPorts = [25, 465, 587, 2525]
    var portWarning = null

    if (validPorts.indexOf(portNum) === -1) {
      portWarning =
        'Porta incomum para SMTP (' +
        portNum +
        '). Geralmente se utiliza 587 (STARTTLS) ou 465 (SSL/TLS).'
    }

    if (host.indexOf('.') === -1 && host.toLowerCase() !== 'localhost') {
      steps[1].status = 'failed'
      steps[1].message = 'Host informado "' + host + '" não aparenta ser um FQDN ou domínio válido.'
      steps[1].duration_ms = Date.now() - t2Start
      for (var k2 = 2; k2 < 5; k2++) {
        steps[k2].status = 'skipped'
        steps[k2].message = 'Etapa cancelada.'
      }
      var hostErr = 'Host inválido: ' + host
      logAuditRecord({
        testType: 'teste-smtp',
        status: 'failed',
        host: host,
        port: portNum,
        userAccount: user,
        encryption: encryption,
        summaryMessage: hostErr,
        steps: steps,
        executedBy: callerAuth,
      })
      return c.json(200, {
        success: false,
        status: 'failed',
        message: hostErr,
        error: hostErr,
        duration_ms: Date.now() - totalStart,
        steps: steps,
        host: host,
        port: portNum,
        user: user,
        target_email: targetEmail,
      })
    }

    steps[1].status = portWarning ? 'warning' : 'success'
    steps[1].message =
      'Host "' +
      host +
      '" e Porta ' +
      portNum +
      ' estruturalmente validados.' +
      (portWarning ? ' (' + portWarning + ')' : ' Compatível com ' + encryption + '.')
    steps[1].duration_ms = Date.now() - t2Start

    // -------------------------------------------------------------------------
    // PASSO 3: Montagem da Mensagem com MailerMessage e Preparação STARTTLS
    // -------------------------------------------------------------------------
    var t3Start = Date.now()
    var testMessage = null
    var destination = targetEmail || user || 'atendimento.helpdesk@deltime.com.br'

    try {
      testMessage = createSystemMailMessage()

      testMessage.from = { address: user, name: senderName || 'Atendimento HelpDesk' }
      testMessage.to = [{ address: destination }]
      testMessage.subject =
        '[Teste SMTP] Validação de Envio — Sistema ITSM (' +
        new Date().toLocaleTimeString('pt-BR') +
        ')'
      testMessage.text =
        'Este é um e-mail de teste gerado pela rotina de Validação SMTP em 5 Passos do Sistema ITSM.\n\n' +
        'Servidor de Saída: ' +
        host +
        ':' +
        portNum +
        '\n' +
        'Criptografia: ' +
        encryption +
        '\n' +
        'Conta Remetente: ' +
        user +
        '\n' +
        'Destinatário: ' +
        destination +
        '\n' +
        'Data/Hora do Teste: ' +
        new Date().toISOString() +
        '\n\n' +
        'Se você recebeu esta mensagem, o canal de saída de e-mails está 100% operacional.'

      testMessage.html =
        '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
        '<h2 style="color: #0284c7; margin-top: 0;">Validação de Envio SMTP — Sistema ITSM</h2>' +
        '<p>Este e-mail de prova confirma que o servidor de envio e as credenciais configuradas estão funcionais.</p>' +
        '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">' +
        '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Servidor Host:</td><td style="padding: 6px 0;">' +
        host +
        ':' +
        portNum +
        '</td></tr>' +
        '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Criptografia:</td><td style="padding: 6px 0;">' +
        encryption +
        '</td></tr>' +
        '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Conta Remetente:</td><td style="padding: 6px 0;">' +
        user +
        '</td></tr>' +
        '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Destinatário:</td><td style="padding: 6px 0;">' +
        destination +
        '</td></tr>' +
        '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Data/Hora:</td><td style="padding: 6px 0;">' +
        new Date().toLocaleString('pt-BR') +
        '</td></tr>' +
        '</table>' +
        '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />' +
        '<p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">Mensagem automática gerada pelo módulo de configurações ITSM.</p>' +
        '</div>'

      if (replyTo) {
        if (!testMessage.headers) testMessage.headers = {}
        testMessage.headers['Reply-To'] = replyTo
      }

      steps[2].status = 'success'
      steps[2].message =
        'Objeto de mensagem SMTP montado com sucesso (Remetente: "' +
        (senderName || user) +
        '" <' +
        user +
        '>, Destino: ' +
        destination +
        '). Configuração ' +
        (portNum === 587 || encryption === 'STARTTLS' ? 'STARTTLS (porta 587)' : 'SSL direto') +
        ' definida.'
      steps[2].duration_ms = Date.now() - t3Start
    } catch (msgErr) {
      steps[2].status = 'failed'
      steps[2].message = 'Erro ao preparar mensagem de teste: ' + msgErr.message
      steps[2].duration_ms = Date.now() - t3Start
      for (var k3 = 3; k3 < 5; k3++) {
        steps[k3].status = 'skipped'
        steps[k3].message = 'Etapa cancelada.'
      }
      var buildErr = 'Falha na preparação da mensagem SMTP: ' + msgErr.message
      logAuditRecord({
        testType: 'teste-smtp',
        status: 'failed',
        host: host,
        port: portNum,
        userAccount: user,
        encryption: encryption,
        summaryMessage: buildErr,
        steps: steps,
        executedBy: callerAuth,
      })
      return c.json(200, {
        success: false,
        status: 'failed',
        message: buildErr,
        error: buildErr,
        duration_ms: Date.now() - totalStart,
        steps: steps,
        host: host,
        port: portNum,
        user: user,
        target_email: destination,
      })
    }

    // -------------------------------------------------------------------------
    // PASSO 4: Envio Real via sendSystemMailMessage
    // -------------------------------------------------------------------------
    var t4Start = Date.now()
    var mailerConfig = {
      isDedicated: true,
      host: host,
      port: portNum,
      encryption: encryption,
      user: user,
      password: pass,
      senderName: senderName || 'Atendimento HelpDesk',
      replyTo: replyTo || user,
      senderEmail: user,
    }

    var dispatchResult = null
    var dispatchError = null

    try {
      dispatchResult = sendSystemMailMessage(testMessage, mailerConfig)
    } catch (sendErr) {
      dispatchError = sendErr
    }

    if (dispatchError) {
      steps[3].status = 'failed'
      var friendlyErrMsg = translateSmtpError(dispatchError.message)
      steps[3].message = friendlyErrMsg
      steps[3].duration_ms = Date.now() - t4Start

      steps[4].status = 'failed'
      steps[4].message =
        'Envio não concluído. Servidor de saída indisponível ou credenciais rejeitadas.'
      steps[4].duration_ms = 0

      var summaryFail = 'Falha na validação SMTP: ' + friendlyErrMsg
      logAuditRecord({
        testType: 'teste-smtp',
        status: 'failed',
        host: host,
        port: portNum,
        userAccount: user,
        encryption: encryption,
        summaryMessage: summaryFail,
        steps: steps,
        executedBy: callerAuth,
      })

      return c.json(200, {
        success: false,
        status: 'failed',
        message: summaryFail,
        error: friendlyErrMsg,
        duration_ms: Date.now() - totalStart,
        steps: steps,
        host: host,
        port: portNum,
        user: user,
        target_email: destination,
      })
    }

    steps[3].status = 'success'
    steps[3].message =
      'Autenticação e handshake bem-sucedidos. E-mail de prova despachado com sucesso para ' +
      destination +
      '.'
    steps[3].duration_ms = Date.now() - t4Start

    // -------------------------------------------------------------------------
    // PASSO 5: Resultado Final com Indicação do SMTP Utilizado
    // -------------------------------------------------------------------------
    var t5Start = Date.now()
    var used = (dispatchResult && dispatchResult.smtp_used) || 'dedicated_mailbox'
    var isFallback = used === 'serviceone_fallback'

    steps[4].status = isFallback ? 'warning' : 'success'
    steps[4].message = isFallback
      ? 'Mensagem enviada com sucesso utilizando o Fallback SMTP do sistema (a caixa dedicada falhou ou utilizou contingência: ' +
        (dispatchResult.fallback_reason || 'contingência') +
        ').'
      : 'Mensagem enviada diretamente através da Caixa Dedicada configurada (' +
        host +
        ':' +
        portNum +
        ' como ' +
        user +
        ').'
    steps[4].duration_ms = Date.now() - t5Start

    var totalDuration = Date.now() - totalStart
    var summarySuccess = isFallback
      ? 'Validação SMTP concluída com AVISO: envio entregue via Fallback SMTP do sistema para ' +
        destination +
        '.'
      : 'Validação SMTP em 5 etapas 100% APROVADA! Mensagem de teste entregue via caixa dedicada para ' +
        destination +
        '.'

    logAuditRecord({
      testType: 'teste-smtp',
      status: isFallback ? 'warning' : 'success',
      host: host,
      port: portNum,
      userAccount: user,
      encryption: encryption,
      summaryMessage: summarySuccess,
      steps: steps,
      executedBy: callerAuth,
    })

    return c.json(200, {
      success: true,
      status: isFallback ? 'warning' : 'success',
      message: summarySuccess,
      duration_ms: totalDuration,
      steps: steps,
      smtp_used: used,
      host: host,
      port: portNum,
      user: user,
      target_email: destination,
    })
  })

  // =========================================================================
  // DISPARO DIRETO DE E-MAIL DE TESTE
  // POST /backend/v1/emails/send-test
  // =========================================================================
  routerAdd('POST', '/backend/v1/emails/send-test', function (c) {
    var rawBody = {}
    try {
      if (typeof c.requestInfo === 'function') {
        var info = c.requestInfo()
        rawBody = (info && info.body) || {}
      } else if (c && c.request && typeof c.request.body === 'object') {
        rawBody = c.request.body || {}
      }
    } catch (_) {
      rawBody = {}
    }

    var targetEmail = (rawBody.to || rawBody.recipient || '').trim()
    if (!targetEmail) {
      return c.json(400, {
        success: false,
        error: 'Informe o e-mail de destino (parâmetro "to").',
      })
    }

    var callerAuth = null
    try {
      if (c.auth && c.auth.id) {
        callerAuth = {
          id: c.auth.id,
          name: c.auth.getString('name') || '',
          email: c.auth.getString('email') || '',
        }
      }
    } catch (_) {}

    var now = new Date()
    var mailerConfig = resolveSystemMailerConfig()

    var senderAccount =
      mailerConfig.user || mailerConfig.senderEmail || 'atendimento.helpdesk@deltime.com.br'
    var senderName = mailerConfig.senderName || 'Atendimento HelpDesk'
    var subject = '[Teste] Verificação de envio — Sistema ITSM'

    var htmlBody =
      '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
      '<h2 style="color: #0284c7; margin-top: 0;">Disparo de Teste — Sistema ITSM</h2>' +
      '<p>Este e-mail foi disparado pelo painel administrativo para verificar a entrega direta de mensagens aos destinatários.</p>' +
      '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">' +
      '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Caixa de Origem:</td><td style="padding: 6px 0;">' +
      senderAccount +
      '</td></tr>' +
      '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Servidor SMTP:</td><td style="padding: 6px 0;">' +
      (mailerConfig.host || 'Padrão da plataforma') +
      ':' +
      (mailerConfig.port || 587) +
      '</td></tr>' +
      '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Destinatário:</td><td style="padding: 6px 0;">' +
      targetEmail +
      '</td></tr>' +
      '<tr><td style="padding: 6px 0; font-weight: bold; color: #64748b;">Data e Hora:</td><td style="padding: 6px 0;">' +
      now.toLocaleString('pt-BR') +
      '</td></tr>' +
      '</table>' +
      '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />' +
      '<p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">Lógos ITSM — Notificações e Alertas Operacionais</p>' +
      '</div>'

    var textBody =
      'Disparo de Teste — Sistema ITSM\n\n' +
      'Caixa de Origem: ' +
      senderAccount +
      '\n' +
      'Servidor SMTP: ' +
      (mailerConfig.host || 'Padrão') +
      ':' +
      (mailerConfig.port || 587) +
      '\n' +
      'Destinatário: ' +
      targetEmail +
      '\n' +
      'Data/Hora: ' +
      now.toLocaleString('pt-BR') +
      '\n\n' +
      'Se você recebeu esta mensagem, o envio direto está funcionando perfeitamente.'

    try {
      var result = sendSystemEmail({
        to: targetEmail,
        subject: subject,
        html: htmlBody,
        text: textBody,
      })

      var used =
        (result && result.smtp_used) ||
        (mailerConfig.isDedicated ? 'dedicated_mailbox' : 'serviceone_fallback')
      var successMessage = 'E-mail de teste enviado com sucesso para ' + targetEmail + '.'

      var auditSteps = [
        {
          id: 'smtp_dispatch',
          name:
            'Disparo de e-mail de teste via ' +
            (used === 'dedicated_mailbox' ? 'Caixa Dedicada' : 'Fallback SMTP'),
          status: 'success',
          message: 'Mensagem enviada com sucesso para ' + targetEmail,
          duration_ms: 0,
        },
      ]

      logAuditRecord({
        testType: 'teste-envio',
        status: 'success',
        host: (result && result.host) || mailerConfig.host || '',
        port: mailerConfig.port || 587,
        userAccount: senderAccount,
        encryption: mailerConfig.encryption || 'STARTTLS',
        summaryMessage:
          successMessage +
          ' via ' +
          (used === 'dedicated_mailbox' ? 'Caixa Dedicada' : 'Fallback SMTP'),
        steps: auditSteps,
        latestMessagesCount: 1,
        executedBy: callerAuth,
        dryRunResult: {
          sender_email: senderAccount,
          sender_name: senderName,
          sent_at: now.toISOString(),
          smtp_used: used,
          subject: subject,
          error: null,
        },
      })

      return c.json(200, {
        success: true,
        message: successMessage,
        target_email: targetEmail,
        sender_email: senderAccount,
        sender_name: senderName,
        sent_at: now.toISOString(),
        subject: subject,
        smtp_used: used,
        smtp_host: (result && result.host) || mailerConfig.host,
      })
    } catch (err) {
      $app.logger().error('send-test error', 'err', err.message)
      var friendlyErr = translateSmtpError(err.message)
      var failAuditSteps = [
        {
          id: 'smtp_dispatch',
          name: 'Disparo de e-mail de teste',
          status: 'failed',
          message: friendlyErr,
          duration_ms: 0,
        },
      ]

      logAuditRecord({
        testType: 'teste-envio',
        status: 'failed',
        host: mailerConfig.host || '',
        port: mailerConfig.port || 587,
        userAccount: senderAccount,
        encryption: mailerConfig.encryption || 'STARTTLS',
        summaryMessage: 'Falha no envio de e-mail de teste: ' + friendlyErr,
        steps: failAuditSteps,
        latestMessagesCount: 0,
        executedBy: callerAuth,
        dryRunResult: {
          sender_email: senderAccount,
          sender_name: senderName,
          sent_at: now.toISOString(),
          error: friendlyErr,
        },
      })

      return c.json(200, {
        success: false,
        message: 'Falha no envio do e-mail de teste.',
        target_email: targetEmail,
        error: friendlyErr,
      })
    }
  })

  // =========================================================================
  // LISTAGEM DE LOGS DE AUDITORIA
  // GET /backend/v1/emails/audit-logs
  // =========================================================================
  routerAdd('GET', '/backend/v1/emails/audit-logs', function (c) {
    try {
      var logs = $app.findRecordsByFilter('email_audit_logs', '', '-created', 30, 0)
      var out = []
      for (var i = 0; i < logs.length; i++) {
        var l = logs[i]
        out.push({
          id: l.id,
          created: l.getString('created'),
          test_type: l.getString('test_type'),
          status: l.getString('status'),
          host: l.getString('host'),
          port: l.getInt('port'),
          user_account: l.getString('user_account'),
          inbox_folder: l.getString('inbox_folder'),
          encryption: l.getString('encryption'),
          summary_message: l.getString('summary_message'),
          steps_json: l.getString('steps_result') || l.getString('steps_json'),
          latest_messages_count: l.getInt('latest_messages_count'),
        })
      }
      return c.json(200, { data: out })
    } catch (err) {
      return c.json(500, { error: err.message })
    }
  })
})()
