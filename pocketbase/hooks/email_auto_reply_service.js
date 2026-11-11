// Serviço autocontido de Respostas Automáticas de E-mail (Skip Cloud / PocketBase JSVM)
// Compatível com Goja / PocketBase v0.36
//
// Funcionalidades:
// 1. Resposta de recebimento automático com número do chamado criado via ingestão (IMAP / Graph / Webhook)
// 2. Resposta de ausência (fora do expediente / recesso) configurável
// 3. Renderização no template institucional com logotipo configurado em design_settings
// 4. Mecanismo anti-loop estrito (cabeçalhos Auto-Submitted, Precedence, remetentes no-reply/mailer-daemon, thread dedupe)
// 5. Envio 100% não bloqueante (async try/catch - nunca falha a criação de chamados)
// 6. Registro de auditoria em email_audit_logs com test_type = 'resposta_automatica'
// 7. Endpoint de preview HTML autenticado: POST /backend/v1/emails/auto-replies/preview

;(function () {
  // Descriptografia autocontida padrão do projeto
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

  // Escape seguro de caracteres HTML
  function escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // Instanciador autocontido de MailerMessage
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

  // Resolução de configuração SMTP autocontida
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
        if (sPass === '__DECRYPT_FAILED__' || sPass.indexOf('enc:v1:') === 0) {
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

  // Envio SMTP autocontido
  function sendSystemMailMessage(message, mailerConfig) {
    if (!message) throw new Error('sendSystemMailMessage: message obrigatória')

    // Assegura remetente padrão Skip Cloud
    var senderEmail = 'noreply@mail.goskip.dev'
    var senderName = 'Lógos AITSM'
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.meta && s.meta.senderAddress) senderEmail = s.meta.senderAddress
      if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
    } catch (_) {}

    if (!message.from || !message.from.address) {
      message.from = {
        address: senderEmail,
        name: senderName,
      }
    }

    var client = $app.newMailClient()
    client.send(message)

    return {
      success: true,
      transport: 'skip_cloud',
      user: message.from.address,
    }
  }

  // Obtém o URL do logotipo configurado no sistema (design_settings)
  function getSystemLogoUrl() {
    try {
      var ds = $app.findRecordsByFilter('design_settings', 'scope = "global"', '-created', 1, 0)
      if (ds.length > 0) {
        var rec = ds[0]
        var logoFilename = rec.getString('report_logo') || rec.getString('logo') || ''
        if (logoFilename) {
          // Constrói URL pública do arquivo PocketBase
          // /api/files/design_settings/:id/:filename
          var baseUrl = ''
          if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
            baseUrl = $os.getenv('VITE_POCKETBASE_URL') || ''
          }
          if (!baseUrl) {
            baseUrl = 'https://sistema-itsm-de-chamados-b1534.shrd03.internal.goskip.dev'
          }
          baseUrl = baseUrl.replace(/\/+$/, '')
          return baseUrl + '/api/files/' + rec.collection().id + '/' + rec.id + '/' + logoFilename
        }
      }
    } catch (_) {}
    return ''
  }

  // Template HTML institucional com suporte ao logotipo do sistema
  function renderInstitutionalTemplate(opts) {
    opts = opts || {}
    var preheader = escapeHtml(opts.preheader || '')
    var badgeText = escapeHtml(opts.badgeText || 'Lógos AITSM')
    var badgeColor = opts.badgeColor || '#d97706' // Âmbar padrão ITSM
    var title = escapeHtml(opts.title || '')
    var subtitle = escapeHtml(opts.subtitle || '')
    var contentHtml = opts.contentHtml || ''
    var footerNote = escapeHtml(
      opts.footerNote ||
        'Esta é uma confirmação automática de recebimento gerada pelo sistema ITSM.',
    )
    var logoUrl = opts.logoUrl || getSystemLogoUrl()

    var brandHeaderHtml = ''
    if (logoUrl) {
      brandHeaderHtml =
        '<table border="0" cellpadding="0" cellspacing="0">\n' +
        '  <tr>\n' +
        '    <td style="vertical-align: middle;">\n' +
        '      <img src="' +
        escapeHtml(logoUrl) +
        '" alt="Logo" style="max-height: 40px; max-width: 180px; display: block; border: 0;" />\n' +
        '    </td>\n' +
        '    <td style="padding-left: 14px; vertical-align: middle; border-left: 1px solid rgba(255,255,255,0.2); margin-left: 14px;">\n' +
        '      <div style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; line-height: 18px;">Lógos <span style="color: #fbbf24; font-weight: 600;">AITSM</span></div>\n' +
        '      <div style="font-size: 10px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px;">Gestão de Serviços de TI</div>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'
    } else {
      brandHeaderHtml =
        '<table border="0" cellpadding="0" cellspacing="0">\n' +
        '  <tr>\n' +
        '    <td style="background-color: ' +
        badgeColor +
        '; width: 38px; height: 38px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: bold; font-size: 18px; font-family: Arial, sans-serif;">\n' +
        '      ⚡\n' +
        '    </td>\n' +
        '    <td style="padding-left: 12px; vertical-align: middle;">\n' +
        '      <div style="font-size: 19px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 20px;">Lógos <span style="color: #fbbf24; font-weight: 600;">AITSM</span></div>\n' +
        '      <div style="font-size: 10px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px;">Gestão de Serviços de TI</div>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'
    }

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
      '    a { color: #d97706; text-decoration: none; }\n' +
      '  </style>\n' +
      '</head>\n' +
      '<body style="margin: 0; padding: 0; background-color: #f1f5f9;">\n' +
      (preheader
        ? '  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; opacity: 0; overflow: hidden;">' +
          preheader +
          '</div>\n'
        : '') +
      '  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">\n' +
      '    <tr>\n' +
      '      <td align="center" style="padding: 26px 12px 36px 12px;">\n' +
      '        <table border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">\n' +
      '          <!-- CABEÇALHO COM IDENTIDADE VISUAL E LOGOTIPO -->\n' +
      '          <tr>\n' +
      '            <td style="background: linear-gradient(135deg, #17181c 0%, #262930 100%); background-color: #17181c; padding: 22px 28px; border-bottom: 3px solid ' +
      badgeColor +
      ';">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td valign="middle">\n' +
      brandHeaderHtml +
      '                  </td>\n' +
      '                  <td align="right" valign="middle">\n' +
      '                    <span style="display: inline-block; background-color: rgba(255,255,255,0.12); color: #fef3c7; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(251,191,36,0.3);">' +
      badgeText +
      '</span>\n' +
      '                  </td>\n' +
      '                </tr>\n' +
      '              </table>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '          <!-- TÍTULO -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 24px 28px 12px 28px;">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td style="border-left: 4px solid ' +
      badgeColor +
      '; padding-left: 12px;">\n' +
      '                    <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 24px;">' +
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
      '          <!-- CONTEÚDO PRINCIPAL -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 10px 28px 24px 28px;">\n' +
      contentHtml +
      '            </td>\n' +
      '          </tr>\n' +
      '          <!-- RODAPÉ -->\n' +
      '          <tr>\n' +
      '            <td style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; text-align: center;">\n' +
      '              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; line-height: 16px;">' +
      footerNote +
      '</p>\n' +
      '              <p style="margin: 0; font-size: 10.5px; color: #94a3b8;">© ' +
      new Date().getFullYear() +
      ' Lógos AITSM • Plataforma de Gestão de Incidentes e Requisições</p>\n' +
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

  // Interpolação de variáveis no texto
  function replaceVariables(templateText, vars) {
    if (!templateText) return ''
    vars = vars || {}
    var numero = vars.numero !== undefined && vars.numero !== null ? String(vars.numero) : ''
    var assunto = vars.assunto !== undefined && vars.assunto !== null ? String(vars.assunto) : ''
    var solicitante =
      vars.solicitante !== undefined && vars.solicitante !== null
        ? String(vars.solicitante)
        : 'Cliente'
    var empresa =
      vars.empresa !== undefined && vars.empresa !== null ? String(vars.empresa) : 'Cliente'
    var data = vars.data !== undefined && vars.data !== null ? String(vars.data) : ''
    var prioridade =
      vars.prioridade !== undefined && vars.prioridade !== null ? String(vars.prioridade) : ''
    var atividade =
      vars.atividade !== undefined && vars.atividade !== null ? String(vars.atividade) : ''
    var prazo = vars.prazo !== undefined && vars.prazo !== null ? String(vars.prazo) : ''
    var operador =
      vars.operador !== undefined && vars.operador !== null && String(vars.operador).trim() !== ''
        ? String(vars.operador)
        : 'Ainda sem atribuição'
    var status = vars.status !== undefined && vars.status !== null ? String(vars.status) : ''

    var res = String(templateText)
    res = res.replace(/\{\{\s*numero\s*\}\}/gi, numero)
    res = res.replace(/\{\{\s*assunto\s*\}\}/gi, assunto)
    res = res.replace(/\{\{\s*solicitante\s*\}\}/gi, solicitante)
    res = res.replace(/\{\{\s*empresa\s*\}\}/gi, empresa)
    res = res.replace(/\{\{\s*data\s*\}\}/gi, data)
    res = res.replace(/\{\{\s*prioridade\s*\}\}/gi, prioridade)
    res = res.replace(/\{\{\s*atividade\s*\}\}/gi, atividade)
    res = res.replace(/\{\{\s*prazo\s*\}\}/gi, prazo)
    res = res.replace(/\{\{\s*operador\s*\}\}/gi, operador)
    res = res.replace(/\{\{\s*status\s*\}\}/gi, status)
    return res
  }

  // Converte texto puro com quebras de linha em parágrafos e itens HTML estruturados
  function textToStyledHtml(text) {
    if (!text) return ''
    var lines = text.split(/\r?\n/)
    var htmlParts = []
    var inList = false

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim()
      if (!line) {
        if (inList) {
          htmlParts.push('</ul>')
          inList = false
        }
        continue
      }

      // Detecta marcador de lista (• ou - ou *)
      if (/^[•\-\*]\s+/.test(line)) {
        if (!inList) {
          htmlParts.push(
            '<ul style="margin: 12px 0 16px 0; padding-left: 20px; color: #334155; font-size: 13.5px; line-height: 22px;">',
          )
          inList = true
        }
        var itemContent = line.replace(/^[•\-\*]\s+/, '')
        // Destaca rótulos (ex: "Número do Chamado:")
        itemContent = itemContent.replace(/^([^:]+:)/, '<strong>$1</strong>')
        htmlParts.push('<li style="margin-bottom: 4px;">' + itemContent + '</li>')
        continue
      }

      if (inList) {
        htmlParts.push('</ul>')
        inList = false
      }

      htmlParts.push(
        '<p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 22px;">' +
          escapeHtml(line) +
          '</p>',
      )
    }

    if (inList) {
      htmlParts.push('</ul>')
    }

    return htmlParts.join('\n')
  }

  // Grava auditoria em email_audit_logs de forma segura
  function recordAutoReplyAudit(params) {
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var rec = new Record(auditCol)
      rec.set('test_type', 'resposta_automatica')
      rec.set('status', params.success ? 'success' : 'failed')
      rec.set('host', params.host || '')
      rec.set('port', params.port || 587)
      rec.set('user_account', params.userAccount || '')
      rec.set('encryption', params.encryption || 'STARTTLS')

      var summary =
        (params.success
          ? 'Resposta automática enviada para '
          : 'Falha na resposta automática para ') +
        params.recipient +
        ' (Chamado #' +
        params.ticketNumber +
        '): ' +
        params.subject +
        (params.error ? ' - ' + params.error : '')
      rec.set('summary_message', summary)

      rec.set('steps_result', [
        {
          step: 1,
          name: 'Verificação Anti-Loop e Regras',
          status: 'success',
          detail: 'Mensagem e remetente validados contra loop.',
          duration_ms: 0,
        },
        {
          step: 2,
          name: 'Envio de Resposta Automática (' + (params.replyType || 'recebimento') + ')',
          status: params.success ? 'success' : 'failed',
          detail: params.success ? 'Entregue com sucesso ao transporte SMTP.' : params.error,
          duration_ms: 0,
        },
      ])

      rec.set('latest_messages_count', 1)
      rec.set('dry_run_result', {
        recipient: params.recipient,
        subject: params.subject,
        ticket_number: params.ticketNumber,
        reply_type: params.replyType,
        error: params.error || null,
      })

      $app.save(rec)
    } catch (err) {
      $app.logger().warn('recordAutoReplyAudit: erro ao gravar log', 'err', err.message)
    }
  }

  // Validador anti-loop estrito
  // Retorna { allow: boolean, reason: string }
  function evaluateAntiLoop(msgContext) {
    if (!msgContext) return { allow: true }

    var from = (msgContext.from || msgContext.from_email || '').toLowerCase().trim()
    var subject = (msgContext.subject || '').toLowerCase()

    // 1. Remetentes de sistema / robôs / bounce
    var blockedSenders = [
      'mailer-daemon@',
      'postmaster@',
      'noreply@',
      'no-reply@',
      'donotreply@',
      'do-not-reply@',
      'bounce@',
      'bounces@',
      'notifications@',
      'notification@',
      'alert@',
      'alerts@',
    ]
    for (var s = 0; s < blockedSenders.length; s++) {
      if (from.indexOf(blockedSenders[s]) !== -1) {
        return {
          allow: false,
          reason: 'Remetente de sistema / bounce bloqueado por anti-loop (' + from + ')',
        }
      }
    }

    // 2. Não responder ao próprio e-mail configurado da caixa de correio do sistema
    try {
      var mailerConfig = resolveSystemMailerConfig()
      var sysEmail = (mailerConfig.user || mailerConfig.senderEmail || '').toLowerCase().trim()
      if (sysEmail && (from === sysEmail || from.indexOf(sysEmail) !== -1)) {
        return {
          allow: false,
          reason: 'Remetente é a própria caixa de correio do sistema (' + from + ')',
        }
      }
    } catch (_) {}

    // 3. Cabeçalhos de e-mail (Auto-Submitted, Precedence, etc.)
    var headers = msgContext.headers || {}
    if (typeof headers === 'object') {
      var autoSubmitted = (
        headers['auto-submitted'] ||
        headers['Auto-Submitted'] ||
        ''
      ).toLowerCase()
      if (autoSubmitted && autoSubmitted !== 'no') {
        return {
          allow: false,
          reason: 'Cabeçalho Auto-Submitted detectado: ' + autoSubmitted,
        }
      }

      var precedence = (headers['precedence'] || headers['Precedence'] || '').toLowerCase()
      if (
        precedence === 'bulk' ||
        precedence === 'junk' ||
        precedence === 'auto_reply' ||
        precedence === 'list'
      ) {
        return {
          allow: false,
          reason: 'Cabeçalho Precedence detectado: ' + precedence,
        }
      }

      var xAutoResponse = (
        headers['x-auto-response-suppress'] ||
        headers['X-Auto-Response-Suppress'] ||
        ''
      ).toLowerCase()
      if (xAutoResponse && xAutoResponse.indexOf('all') !== -1) {
        return {
          allow: false,
          reason: 'Cabeçalho X-Auto-Response-Suppress: All detectado',
        }
      }
    }

    // 4. Se o assunto for um reply ou menção de resposta automática externa
    if (
      /auto(matic)?\s*reply/i.test(subject) ||
      /out of office/i.test(subject) ||
      /resposta autom[aá]tica/i.test(subject) ||
      /fora do expediente/i.test(subject) ||
      /f[eé]rias/i.test(subject)
    ) {
      return {
        allow: false,
        reason: 'Assunto indica mensagem automatizada ou fora do escritório: ' + subject,
      }
    }

    return { allow: true }
  }

  // Carrega configurações salvas em email_auto_replies
  function getAutoReplyConfig() {
    var defaults = {
      receipt_enabled: true,
      receipt_subject: 'Recebemos sua solicitação - Chamado #{{numero}}: {{assunto}}',
      receipt_body:
        'Olá, {{solicitante}}!\n\n' +
        'Confirmamos o recebimento do seu e-mail. Um novo chamado foi registrado em nosso sistema de atendimento com os dados abaixo:\n\n' +
        '• Número do Chamado: #{{numero}}\n' +
        '• Assunto: {{assunto}}\n' +
        '• Solicitante: {{solicitante}}\n' +
        '• Empresa: {{empresa}}\n' +
        '• Data e Hora de Abertura: {{data}}\n\n' +
        'Nossa equipe técnica já foi notificada e dará início ao atendimento conforme a prioridade e os prazos de SLA acordados.\n\n' +
        'Para enviar informações adicionais sobre esta solicitação, basta responder a este e-mail mantendo o número #{{numero}} no assunto.\n\n' +
        'Atenciosamente,\n' +
        'Equipe de Suporte e Atendimento',
      out_of_office_enabled: false,
      out_of_office_subject: 'Recebemos seu e-mail [Fora do Expediente] - Chamado #{{numero}}',
      out_of_office_body:
        'Olá, {{solicitante}}!\n\n' +
        'Recebemos seu e-mail e registramos o chamado #{{numero}} em nossa fila.\n\n' +
        'Informamos que no momento nossa equipe está fora do horário regular de expediente comercial ou em período de recesso/feriado.\n\n' +
        '• Número do Chamado: #{{numero}}\n' +
        '• Assunto: {{assunto}}\n' +
        '• Abertura registrada em: {{data}}\n\n' +
        'Sua solicitação está preservada e será atendida assim que nosso expediente for retomado pelo próximo analista disponível.\n\n' +
        'Caso se trate de uma emergência crítica contratual coberta por plantão, os canais de sobreaviso já foram alertados.\n\n' +
        'Atenciosamente,\n' +
        'Equipe de Suporte e Atendimento',
      anti_loop_enabled: true,
    }

    try {
      var records = $app.findRecordsByFilter(
        'email_auto_replies',
        'scope = "global"',
        '-created',
        1,
        0,
      )
      if (records.length > 0) {
        var r = records[0]
        return {
          id: r.id,
          receipt_enabled: r.getBool('receipt_enabled'),
          receipt_subject: r.getString('receipt_subject') || defaults.receipt_subject,
          receipt_body: r.getString('receipt_body') || defaults.receipt_body,
          out_of_office_enabled: r.getBool('out_of_office_enabled'),
          out_of_office_subject:
            r.getString('out_of_office_subject') || defaults.out_of_office_subject,
          out_of_office_body: r.getString('out_of_office_body') || defaults.out_of_office_body,
          anti_loop_enabled: r.getBool('anti_loop_enabled'),
        }
      }
    } catch (_) {}

    return defaults
  }

  // Função principal de disparo de resposta automática (Async / Safe)
  // params: {
  //   ticketId: string,
  //   ticketNumber: string,
  //   ticketTitle: string,
  //   recipientEmail: string,
  //   requesterName: string,
  //   companyName: string,
  //   createdDateFormatted: string,
  //   incomingMessageContext: { from, subject, headers, ... }
  // }
  function triggerAutoReply(params) {
    if (!params) return { status: 'skipped', reason: 'Parâmetros ausentes' }
    var recipient = (params.recipientEmail || '').trim()
    if (!recipient) {
      return { status: 'skipped', reason: 'Destinatário sem e-mail informado' }
    }

    var cfg = getAutoReplyConfig()

    // Decide qual resposta deve ser enviada:
    // Se out_of_office_enabled === true, ela tem precedência sobre a de recebimento padrão
    var isOutOfOffice = cfg.out_of_office_enabled === true
    var isReceiptActive = cfg.receipt_enabled === true

    if (!isOutOfOffice && !isReceiptActive) {
      $app
        .logger()
        .info(
          'email_auto_reply: respostas automáticas desativadas nas configurações (chamado #' +
            params.ticketNumber +
            ')',
        )
      return { status: 'skipped', reason: 'Respostas automáticas desativadas nas configurações' }
    }

    // Anti-loop check
    if (cfg.anti_loop_enabled !== false) {
      var loopCheck = evaluateAntiLoop(
        params.incomingMessageContext || { from: recipient, subject: params.ticketTitle },
      )
      if (!loopCheck.allow) {
        $app
          .logger()
          .info(
            'email_auto_reply: bloqueado por anti-loop (chamado #' +
              params.ticketNumber +
              '): ' +
              loopCheck.reason,
          )
        return { status: 'skipped', reason: loopCheck.reason }
      }
    }

    // Anti-duplicidade estrita via Central de Alertas (mesmo alert_key do chamado aberto)
    var referenceId = params.ticketId || params.ticketNumber || ''
    if (referenceId && typeof globalThis.hasEmailAlreadyBeenSent === 'function') {
      if (globalThis.hasEmailAlreadyBeenSent('ticket_created', referenceId, recipient)) {
        $app
          .logger()
          .info(
            'email_auto_reply: envio suprimido pois notificação/auto-reply já foi enviada anteriormente para chamado #' +
              params.ticketNumber +
              ' e destinatário ' +
              recipient,
          )
        return {
          status: 'skipped',
          reason: 'anti_duplication: e-mail já enviado para este chamado e destinatário',
        }
      }
    }

    // Busca configuração oficial do alerta "Chamado aberto" na Central de Alertas
    var alertCfg =
      typeof globalThis.getEmailAlertConfig === 'function'
        ? globalThis.getEmailAlertConfig('ticket_created')
        : null

    if (alertCfg && alertCfg.enabled === false) {
      $app
        .logger()
        .info(
          'email_auto_reply: envio suprimido pois alerta ticket_created está desabilitado na Central de Alertas',
        )
      return {
        status: 'skipped',
        reason: 'Alerta ticket_created desabilitado na Central de Alertas',
      }
    }

    var portalUrl = 'https://logos-aitsm.goskip.app/portal/login'
    var ticketLink = portalUrl + (params.ticketId ? '?ticket=' + params.ticketId : '')

    // Variáveis universais preenchidas para templates
    var tplData = {
      chamado_numero: params.ticketNumber || '',
      numero: params.ticketNumber || '',
      titulo: params.ticketTitle || 'Solicitação',
      assunto: params.ticketTitle || 'Solicitação',
      descricao:
        params.ticketDescription || params.ticketTitle || 'Chamado registrado via e-mail/portal.',
      cliente: params.requesterName || 'Cliente',
      solicitante: params.requesterName || 'Cliente',
      empresa: params.companyName || 'Empresa Cliente',
      data: params.createdDateFormatted || new Date().toLocaleString('pt-BR'),
      data_abertura: params.createdDateFormatted || new Date().toLocaleString('pt-BR'),
      prioridade: params.priority || 'Normal',
      tipo: params.ticketType || 'Incidente',
      atividade: params.activity || '',
      prazo: params.deadlineFormatted || '',
      operador: params.assignedOperatorName || 'Fila de Atendimento',
      status: params.status || 'Novo',
      link: ticketLink,
    }

    var replyType = isOutOfOffice ? 'ausencia' : 'recebimento'
    var finalSubject = ''
    var finalHtml = ''
    var finalBodyText = ''

    if (alertCfg && typeof globalThis.buildEmailHtmlFromConfig === 'function') {
      var rawSubject = isOutOfOffice
        ? cfg.out_of_office_subject || alertCfg.subject_template
        : alertCfg.subject_template ||
          alertCfg.default_subject_template ||
          'Chamado #{{chamado_numero}} registrado com sucesso - {{titulo}}'

      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        finalSubject = globalThis.interpolateEmailTemplate(rawSubject, tplData)
      } else {
        finalSubject = replaceVariables(rawSubject, tplData)
      }

      // Se for ausência, podemos customizar o corpo do template do alerta com a nota de expediente
      var alertCfgForSend = alertCfg
      if (isOutOfOffice && cfg.out_of_office_body) {
        alertCfgForSend = Object.assign({}, alertCfg, {
          body_template:
            '<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; color: #92400e; font-size: 14px;"><strong>Aviso de Expediente:</strong> Informamos que no momento nossa equipe está fora do horário regular de atendimento. Sua solicitação está preservada e será atendida assim que o expediente for retomado.</div>' +
            (alertCfg.body_template || alertCfg.default_body_template || ''),
        })
      }

      finalHtml = globalThis.buildEmailHtmlFromConfig(alertCfgForSend, tplData)
      var rawBody = alertCfgForSend.body_template || alertCfgForSend.default_body_template || ''
      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        finalBodyText = globalThis
          .interpolateEmailTemplate(rawBody, tplData)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      } else {
        finalBodyText = replaceVariables(cfg.receipt_body, tplData)
      }
    } else {
      // Central de Alertas indisponível (helpers em A0_email_alert_helpers.js não
      // carregados) — NÃO enviar e-mail de texto simples sem marca. Apenas
      // registra o erro com contexto completo e aborta o disparo.
      var centralErr =
        'Central de Alertas indisponível (getEmailAlertConfig/buildEmailHtmlFromConfig ausentes) — auto-reply NÃO enviado, sem fallback de texto simples. Helpers esperados em A0_email_alert_helpers.js.'
      $app
        .logger()
        .error(
          'email_auto_reply: ' + centralErr,
          'ticket_number',
          params.ticketNumber || '',
          'ticket_id',
          params.ticketId || '',
          'dest',
          recipient,
        )
      console.error(
        'email_auto_reply: ' +
          centralErr +
          ' | chamado #' +
          (params.ticketNumber || '') +
          ' | destinatário: ' +
          recipient,
      )
      recordAutoReplyAudit({
        success: false,
        recipient: recipient,
        ticketNumber: params.ticketNumber,
        subject: '',
        replyType: replyType,
        error: centralErr,
      })
      return {
        status: 'failed',
        reply_type: replyType,
        recipient: recipient,
        subject: '',
        error: centralErr,
      }
    }

    var mailerConfig = resolveSystemMailerConfig()
    var senderEmail = mailerConfig.user || mailerConfig.senderEmail || 'noreply@logositsm.com.br'
    var senderName = mailerConfig.senderName || 'Atendimento HelpDesk'

    var msg = createSystemMailMessage()
    msg.from = { address: senderEmail, name: senderName }
    msg.to = [{ address: recipient }]
    msg.subject = finalSubject
    msg.text = finalBodyText
    msg.html = finalHtml

    var replyTo = mailerConfig.replyTo || senderEmail
    if (replyTo && msg.headers) {
      msg.headers['Reply-To'] = replyTo
      // Adiciona cabeçalhos padronizados de auto-reply para evitar que outros robôs respondam em loop
      msg.headers['Auto-Submitted'] = 'auto-replied'
      msg.headers['Precedence'] = 'auto_reply'
      msg.headers['X-Auto-Response-Suppress'] = 'All'
    }

    var sendResult = null
    var success = false
    var errorMsg = ''

    try {
      sendResult = sendSystemMailMessage(msg, mailerConfig)
      success = true
      $app
        .logger()
        .info(
          'email_auto_reply: resposta automática (' +
            replyType +
            ') enviada com sucesso para ' +
            recipient +
            ' (Chamado #' +
            params.ticketNumber +
            ')',
        )
    } catch (sendErr) {
      success = false
      errorMsg = sendErr && sendErr.message ? sendErr.message : String(sendErr)
      $app
        .logger()
        .error(
          'email_auto_reply: falha ao enviar resposta automática',
          'dest',
          recipient,
          'err',
          errorMsg,
        )
      console.error(
        'email_auto_reply: FALHA ao enviar resposta automática | alert_key=ticket_created' +
          ' | destinatário=' +
          recipient +
          ' | chamado #' +
          (params.ticketNumber || '') +
          ' | motivo: ' +
          errorMsg,
      )
    }

    // Registra envio na Central de Alertas (email_sent_logs) para anti-duplicidade estrita
    if (success && referenceId && typeof globalThis.recordEmailSentLog === 'function') {
      try {
        globalThis.recordEmailSentLog('ticket_created', referenceId, recipient, finalSubject, {
          source: 'email_auto_reply_service',
          reply_type: replyType,
          ticket_number: params.ticketNumber,
        })
      } catch (logErr) {
        $app
          .logger()
          .warn(
            'email_auto_reply: aviso ao gravar email_sent_logs: ' +
              (logErr && logErr.message ? logErr.message : String(logErr)),
          )
      }
    }

    // Registra na auditoria
    recordAutoReplyAudit({
      success: success,
      recipient: recipient,
      ticketNumber: params.ticketNumber,
      subject: finalSubject,
      replyType: replyType,
      host: mailerConfig.host,
      port: mailerConfig.port,
      userAccount: senderEmail,
      encryption: mailerConfig.encryption,
      error: errorMsg,
    })

    return {
      status: success ? 'sent' : 'failed',
      reply_type: replyType,
      recipient: recipient,
      subject: finalSubject,
      error: errorMsg || null,
    }
  }

  // Registra globalThis para disponibilidade no backend
  if (typeof globalThis !== 'undefined') {
    globalThis.itsmTriggerAutoReply = triggerAutoReply
    globalThis.itsmGetAutoReplyConfig = getAutoReplyConfig
    globalThis.itsmRenderAutoReplyTemplate = renderInstitutionalTemplate
    globalThis.itsmReplaceAutoReplyVariables = replaceVariables
  }

  // -------------------------------------------------------------
  // Rota de Preview de Resposta Automática (POST /backend/v1/emails/auto-replies/preview)
  // -------------------------------------------------------------
  routerAdd('POST', '/backend/v1/emails/auto-replies/preview', (e) => {
    try {
      var body = e.requestInfo().body || {}
      var type = (body.type || 'receipt').toLowerCase() // 'receipt' ou 'out_of_office'
      var subjectTpl = body.subject || ''
      var bodyTpl = body.body || ''

      var vars = {
        numero: body.ticket_number || '1042',
        assunto: body.ticket_title || 'Falha de comunicação com o servidor de banco de dados',
        solicitante: body.requester_name || 'Mariana Souza',
        empresa: body.company_name || 'Hospital Santa Helena',
        data:
          body.date ||
          ('0' + new Date().getDate()).slice(-2) +
            '/' +
            ('0' + (new Date().getMonth() + 1)).slice(-2) +
            '/' +
            new Date().getFullYear() +
            ' às 14:35',
        prioridade: body.priority || 'Alta',
        atividade: body.activity || 'Suporte a Banco de Dados / Incidente Crítico',
        prazo: body.deadline || '4 horas (até hoje às 18:35)',
        operador: body.operator || 'Ainda sem atribuição',
        status: body.status || 'Novo',
      }

      var cfg = getAutoReplyConfig()
      if (!subjectTpl) {
        subjectTpl = type === 'out_of_office' ? cfg.out_of_office_subject : cfg.receipt_subject
      }
      if (!bodyTpl) {
        bodyTpl = type === 'out_of_office' ? cfg.out_of_office_body : cfg.receipt_body
      }

      var finalSubject = replaceVariables(subjectTpl, vars)
      var finalBodyText = replaceVariables(bodyTpl, vars)
      var contentHtml = textToStyledHtml(finalBodyText)

      var isOutOfOffice = type === 'out_of_office'

      // Usa os helpers da Central de Alertas para renderizar o layout do alerta ticket_created
      var alertCfg =
        typeof globalThis.getEmailAlertConfig === 'function'
          ? globalThis.getEmailAlertConfig('ticket_created')
          : null

      var tplData = {
        chamado_numero: vars.numero,
        numero: vars.numero,
        titulo: vars.assunto,
        assunto: vars.assunto,
        descricao: vars.assunto + ' (Pré-visualização do chamado)',
        cliente: vars.solicitante,
        solicitante: vars.solicitante,
        empresa: vars.empresa,
        data: vars.data,
        data_abertura: vars.data,
        prioridade: vars.prioridade,
        tipo: 'Incidente',
        atividade: vars.atividade,
        prazo: vars.prazo,
        operador: vars.operador,
        status: vars.status,
        link: 'https://logos-aitsm.goskip.app/portal/login',
      }

      var finalHtml = ''
      if (alertCfg && typeof globalThis.buildEmailHtmlFromConfig === 'function') {
        var alertCfgForPreview = alertCfg
        if (isOutOfOffice) {
          alertCfgForPreview = Object.assign({}, alertCfg, {
            body_template:
              '<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; color: #92400e; font-size: 14px;"><strong>Aviso de Expediente:</strong> Informamos que no momento nossa equipe está fora do horário regular de atendimento. Sua solicitação está preservada e será atendida assim que o expediente for retomado.</div>' +
              (alertCfg.body_template || alertCfg.default_body_template || ''),
          })
        }
        finalHtml = globalThis.buildEmailHtmlFromConfig(alertCfgForPreview, tplData)
      } else if (typeof renderInstitutionalTemplate === 'function') {
        var badgeText = isOutOfOffice ? 'Ausência / Fora do Expediente' : 'Recebimento Confirmado'
        var badgeColor = isOutOfOffice ? '#f59e0b' : '#d97706'
        var title = isOutOfOffice
          ? 'Aviso de Ausência e Confirmação de Recebimento'
          : 'Confirmação de Recebimento de Chamado'
        var subtitle = 'Chamado #' + vars.numero + ' registrado com sucesso'

        finalHtml = renderInstitutionalTemplate({
          preheader: 'Recebemos seu e-mail. Chamado #' + vars.numero + ' registrado.',
          badgeText: badgeText,
          badgeColor: badgeColor,
          title: title,
          subtitle: subtitle,
          contentHtml: contentHtml,
          footerNote:
            'Esta é uma mensagem automática de confirmação de recebimento. Para interagir com o suporte, responda mantendo o número #' +
            vars.numero +
            ' no assunto.',
        })
      }

      return e.json(200, {
        subject: finalSubject,
        text: finalBodyText,
        html: finalHtml,
        vars: vars,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao gerar pré-visualização' })
    }
  })
})()
