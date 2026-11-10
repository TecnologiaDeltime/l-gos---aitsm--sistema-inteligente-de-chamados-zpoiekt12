// Helpers da Central de Alertas por E-mail — Lógos AITSM
// PocketBase JSVM (Goja) — carregado PRIMEIRO (prefixo 00_ garante precedência
// alfabética de carregamento dos hooks), para que getEmailAlertConfig,
// buildEmailHtmlFromConfig, sendSystemAlertEmail, hasEmailAlreadyBeenSent e
// recordEmailSentLog estejam definidos ANTES de qualquer hook de e-mail disparar.
//
// Este módulo NÃO registra hooks/eventos — apenas expõe helpers em globalThis.
// Toda montagem de HTML/assunto de e-mail de notificação passa EXCLUSIVAMENTE
// por aqui (Central de Alertas); hooks nunca montam HTML próprio.
//
// Regra de envio (Skip Mailer): usa globalThis.sendSystemEmail (mailer_service.js),
// que resolve a caixa SMTP dedicada (email_config) com fallback automático.

;(function () {
  /**
   * Formata data no formato datetime exigido pelo PocketBase ('YYYY-MM-DD HH:MM:SS.sssZ').
   */
  function formatPbDate(d) {
    var dt = d instanceof Date ? d : new Date()
    return dt.toISOString().replace('T', ' ')
  }

  /**
   * Verifica se um alerta específico está ativo no catálogo de configurações.
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
   * Obtém as configurações e template de um alerta específico (email_alert_settings).
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
      $app
        .logger()
        .error(
          'email_alert_helpers: falha ao carregar configuração do alerta',
          'alert_key',
          alertKey,
          'error',
          err.message,
        )
      return null
    }
  }

  /**
   * Anti-duplicidade estrita por (alert_key, reference_id, recipient).
   * Retorna true se já houve envio registrado para a combinação.
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
   * Registra no log de anti-duplicidade (email_sent_logs) que o e-mail foi disparado.
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
      log.set('sent_at', new DateTime())
      log.set('subject', subject || '')
      if (meta) log.set('meta', meta)
      $app.save(log)
    } catch (err) {
      $app
        .logger()
        .warn(
          'email_alert_helpers: falha ao registrar email_sent_logs',
          'alert_key',
          alertKey,
          'error',
          err.message,
        )
    }
  }

  /**
   * Substitui placeholders {{chave}} pelos valores fornecidos.
   * Variáveis ausentes são removidas com segurança para nunca quebrar o envio.
   * Suporta aliases padronizados comuns do Lógos AITSM (numero/chamado_numero,
   * cliente/solicitante, operador/responsavel, prazo/prazo_sla, etc).
   */
  function interpolateTemplate(template, data) {
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

    // Placeholders restantes são removidos para não degradar a legibilidade
    result = result.replace(/\{\{\s*[a-zA-Z0-9_\-.]+\s*\}\}/g, '')

    return result
  }
  globalThis.interpolateEmailTemplate = interpolateTemplate

  /**
   * Constrói o HTML completo do e-mail de acordo com o layout configurado na Central.
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

    // Padrão 'modern' (identidade Amber Alert / Grafite do Lógos AITSM)
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
   * Dispara um e-mail respeitando o switch da Central de Alertas por E-mail,
   * gerando o layout configurado no editor (marca Lógos AITSM) e gravando
   * anti-duplicidade por (alert_key, reference_id, recipient).
   * Suporta recipient único (string) ou múltiplos destinatários (recipients: [...]).
   *
   * Retorno: { sent, reason?, sent_count?, skipped_duplicates?, errors? }
   */
  globalThis.sendSystemAlertEmail = function (opts) {
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
      return { sent: false, reason: 'recipient_missing' }
    }

    // 1. Switch da Central de Alertas: alerta desligado = não envia
    var cfg = globalThis.getEmailAlertConfig(alertKey)
    if (!cfg) {
      return { sent: false, reason: 'alert_config_missing', alert_key: alertKey }
    }
    if (!cfg.enabled) {
      $app
        .logger()
        .info(
          'sendSystemAlertEmail: alerta desligado nas configurações',
          'alert_key',
          alertKey,
          'recipients_count',
          recipients.length,
        )
      return { sent: false, reason: 'alert_disabled_by_config', alert_key: alertKey }
    }

    // 2. Assunto e corpo vindos EXCLUSIVAMENTE do template da Central (editor).
    var data = opts.data || {}
    var rawSubject =
      cfg.subject_template || cfg.default_subject_template || opts.subject || 'Notificação Lógos AITSM'
    var subject = interpolateTemplate(rawSubject, data)

    if (!cfg.body_template && cfg.default_body_template) {
      cfg.body_template = cfg.default_body_template
    }

    var htmlContent = globalThis.buildEmailHtmlFromConfig(cfg, data)
    var rawBody = cfg.body_template || cfg.default_body_template || ''
    var textFallback =
      opts.fallbackText || interpolateTemplate(rawBody, data).replace(/<[^>]+>/g, ' ')

    var sentCount = 0
    var skippedDuplicates = 0
    var errors = []

    for (var i = 0; i < recipients.length; i++) {
      var recipient = recipients[i]

      // 3. Anti-duplicidade estrita por (alertKey, referenceId, recipient)
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
        skippedDuplicates++
        continue
      }

      // 4. Envio via mailer do sistema (Skip Mailer / caixa dedicada / fallback SMTP)
      try {
        globalThis.sendSystemEmail({
          to: recipient,
          subject: subject,
          html: htmlContent,
          text: textFallback,
        })

        if (referenceId) {
          globalThis.recordEmailSentLog(alertKey, referenceId, recipient, subject, {
            template_layout: cfg.template_layout,
            primary_color: cfg.primary_color,
          })
        }

        $app
          .logger()
          .info(
            'sendSystemAlertEmail: enviado com sucesso',
            'alert_key',
            alertKey,
            'recipient',
            recipient,
          )
        sentCount++
      } catch (err) {
        $app
          .logger()
          .error(
            'sendSystemAlertEmail: falha no envio para ' + recipient,
            'alert_key',
            alertKey,
            'error',
            err.message,
          )
        errors.push({ recipient: recipient, error: err.message })
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
})()
