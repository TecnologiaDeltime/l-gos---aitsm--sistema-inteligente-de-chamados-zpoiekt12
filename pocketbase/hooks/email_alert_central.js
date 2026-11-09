// Helper central de templates, anti-duplicidade e envio de e-mails via Skip Mailer
// Sistema Lógos AITSM

;(function () {
  /**
   * Verifica se um alerta específico está ativo no catálogo de configurações.
   * Por padrão de projeto, TODOS são desligados (enabled === false).
   */
  globalThis.isEmailAlertEnabled = function (alertKey) {
    if (!alertKey) return false
    try {
      var rec = $app.findFirstRecordByFilter(
        'email_alert_settings',
        'alert_key = "' + alertKey + '"',
      )
      return rec ? Boolean(rec.getBool('enabled')) : false
    } catch (_) {
      return false
    }
  }

  /**
   * Obtém as configurações e template de um alerta específico.
   */
  globalThis.getEmailAlertConfig = function (alertKey) {
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
        header_title: rec.getString('header_title') || 'Lógos AITSM',
        header_subtitle: rec.getString('header_subtitle') || '',
        body_template: rec.getString('body_template') || '',
        footer_text: rec.getString('footer_text') || '',
        show_button: rec.getBool('show_button'),
        button_label: rec.getString('button_label') || 'Acessar',
        button_url_template: rec.getString('button_url_template') || '',
      }
    } catch (_) {
      return null
    }
  }

  /**
   * Verifica se já houve envio para (alert_key, reference_id, recipient).
   * Retorna true se já foi enviado (anti-duplicidade estrita).
   */
  globalThis.hasEmailAlreadyBeenSent = function (alertKey, referenceId, recipient) {
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

  /**
   * Registra no log de anti-duplicidade que o e-mail foi disparado.
   */
  globalThis.recordEmailSentLog = function (alertKey, referenceId, recipient, subject, meta) {
    if (!alertKey || !referenceId || !recipient) return
    try {
      var col = $app.findCollectionByNameOrId('email_sent_logs')
      var cleanRecipient = String(recipient).trim().toLowerCase()
      var log = new Record(col)
      log.set('alert_key', alertKey)
      log.set('reference_id', referenceId)
      log.set('recipient', cleanRecipient)
      log.set('sent_at', new Date().toISOString())
      log.set('subject', subject || '')
      if (meta) log.set('meta', meta)
      $app.save(log)
    } catch (err) {
      $app.logger().warn('recordEmailSentLog failed', 'error', err.message)
    }
  }

  /**
   * Substitui placeholders no formato {{chave}} pelos valores fornecidos.
   * Variáveis ausentes são removidas com segurança para nunca quebrar o envio.
   * Suporta aliases padronizados comuns do Lógos AITSM.
   */
  function interpolateTemplate(template, data) {
    if (!template) return ''
    var normalizedData = {}
    if (data && typeof data === 'object') {
      var inKeys = Object.keys(data)
      for (var j = 0; j < inKeys.length; j++) {
        var key = inKeys[j]
        normalizedData[key] = data[key]
      }
    }

    // Aliases bidirecionais comuns para tolerância a formatos
    if (normalizedData.chamado_numero && !normalizedData.numero) {
      normalizedData.numero = normalizedData.chamado_numero
    }
    if (normalizedData.mudanca_numero && !normalizedData.numero) {
      normalizedData.numero = normalizedData.mudanca_numero
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
    if (normalizedData.prazo_sla && !normalizedData.prazo) {
      normalizedData.prazo = normalizedData.prazo_sla
    }
    if (normalizedData.prazo && !normalizedData.prazo_sla) {
      normalizedData.prazo_sla = normalizedData.prazo
    }
    if (normalizedData.data_abertura && !normalizedData.data_hora) {
      normalizedData.data_hora = normalizedData.data_abertura
    }
    if (normalizedData.data_hora && !normalizedData.data_abertura) {
      normalizedData.data_abertura = normalizedData.data_hora
    }
    if (normalizedData.projeto_nome && !normalizedData.titulo) {
      normalizedData.titulo = normalizedData.projeto_nome
    }

    var result = template
    var keys = Object.keys(normalizedData)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var val = normalizedData[k] == null ? '' : String(normalizedData[k])
      var regex = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi')
      result = result.replace(regex, val)
    }

    // Limpar quaisquer placeholders {{restantes}} que não puderam ser preenchidos para não quebrar a legibilidade
    result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')

    return result
  }
  globalThis.interpolateEmailTemplate = interpolateTemplate

  /**
   * Constrói o HTML completo do e-mail de acordo com o layout e a marca oficial Lógos AITSM.
   * Layouts: 'modern' | 'corporate' | 'minimal'
   */
  globalThis.buildEmailHtmlFromConfig = function (cfg, data) {
    var primaryColor = (cfg && cfg.primary_color) || '#D97706'
    var layout = (cfg && cfg.template_layout) || 'modern'
    var headerTitle = (cfg && cfg.header_title) || 'Lógos AITSM'
    var headerSubtitle =
      (cfg && cfg.header_subtitle) || 'Sistema Inteligente de Gestão de Serviços de TI'
    var footerText = (cfg && cfg.footer_text) || 'Lógos AITSM • Central de Serviços Inteligente'

    var bodyContent = interpolateTemplate((cfg && cfg.body_template) || '', data)
    var buttonLabel = interpolateTemplate((cfg && cfg.button_label) || 'Acessar', data)
    var buttonUrl = interpolateTemplate((cfg && cfg.button_url_template) || '', data)
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

    // Padrão 'modern' (Amber Alert / Grafite da identidade visual do Lógos AITSM)
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

  /**
   * Dispara um e-mail respeitando o switch da central de alertas por e-mail,
   * gerando o layout customizado com a marca Lógos AITSM e gravando anti-duplicidade.
   */
  globalThis.sendSystemAlertEmail = function (opts) {
    if (!opts) return { sent: false, reason: 'opts missing' }
    var alertKey = opts.alert_key
    var referenceId = opts.reference_id || ''
    var recipient = opts.recipient
    if (!recipient) return { sent: false, reason: 'recipient missing' }

    // 1. Verificar se o alerta está ligado na Central de Configurações
    var cfg = globalThis.getEmailAlertConfig(alertKey)
    if (!cfg || !cfg.enabled) {
      $app
        .logger()
        .info(
          'sendSystemAlertEmail: alerta desligado nas configurações',
          'alert_key',
          alertKey,
          'recipient',
          recipient,
        )
      return { sent: false, reason: 'alert_disabled_by_config', alert_key: alertKey }
    }

    // 2. Anti-duplicidade estrita
    if (referenceId && globalThis.hasEmailAlreadyBeenSent(alertKey, referenceId, recipient)) {
      $app
        .logger()
        .info(
          'sendSystemAlertEmail: e-mail já enviado anteriormente (anti-duplicidade)',
          'alert_key',
          alertKey,
          'ref',
          referenceId,
          'to',
          recipient,
        )
      return { sent: false, reason: 'already_sent', alert_key: alertKey, reference_id: referenceId }
    }

    // 3. Montar assunto e corpo HTML via template dinâmico (com fallback para template padrão)
    var data = opts.data || {}
    var rawSubject =
      cfg.subject_template ||
      cfg.default_subject_template ||
      opts.subject ||
      'Notificação Lógos AITSM'
    var subject = interpolateTemplate(rawSubject, data)

    // Se o body_template estiver vazio, utiliza o default_body_template de fábrica
    if (!cfg.body_template && cfg.default_body_template) {
      cfg.body_template = cfg.default_body_template
    }

    var htmlContent = globalThis.buildEmailHtmlFromConfig(cfg, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var textFallback =
      opts.fallbackText || interpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

    // 4. Envio via Skip Mailer centralizado (sendSystemEmail / $app.newMailClient)
    try {
      var brandName = cfg.header_title || globalThis.SYSTEM_BRAND_NAME || 'Lógos AITSM'
      var defaultEmail = globalThis.SYSTEM_DEFAULT_SENDER_EMAIL || 'noreply@logositsm.com.br'

      var message = globalThis.createSystemMailMessage
        ? globalThis.createSystemMailMessage()
        : new MailerMessage()

      message.from = { address: defaultEmail, name: brandName }
      message.to = [{ address: String(recipient).trim() }]
      message.subject = subject
      message.html = htmlContent
      message.text = textFallback

      if (globalThis.sendSystemMailMessage) {
        globalThis.sendSystemMailMessage(message)
      } else {
        var client = $app.newMailClient()
        client.send(message)
      }

      // 5. Registrar no log de envios para evitar qualquer duplicação
      if (referenceId) {
        globalThis.recordEmailSentLog(alertKey, referenceId, recipient, subject, {
          template_layout: cfg.template_layout,
          primary_color: cfg.primary_color,
        })
      }

      $app
        .logger()
        .info(
          'sendSystemAlertEmail: enviado com sucesso via Skip Mailer',
          'alert_key',
          alertKey,
          'recipient',
          recipient,
        )

      return { sent: true, alert_key: alertKey, recipient: recipient }
    } catch (err) {
      $app
        .logger()
        .error(
          'sendSystemAlertEmail: falha no envio',
          'alert_key',
          alertKey,
          'recipient',
          recipient,
          'error',
          err.message,
        )
      return { sent: false, error: err.message }
    }
  }
})()
