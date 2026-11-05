// Helper unificado de templates HTML elegantes e envio com auditoria
// Compatível com Goja / PocketBase v0.36
// Fornece em globalThis:
// - itsmEscapeHtml(str)
// - itsmGetSystemLogoUrl()
// - itsmRenderBaseEmailTemplate(opts)
// - itsmSendWithAudit(opts)

;(function () {
  // Função para sanitização HTML segura
  function escapeHtml(str) {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  globalThis.itsmEscapeHtml = escapeHtml

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

  // Tenta obter o logotipo configurado em design_settings (caso o cliente tenha subido logo customizado)
  function getSystemLogoUrl() {
    try {
      if (typeof $app === 'undefined' || !$app) return ''
      var ds = $app.findRecordsByFilter('design_settings', 'scope = "global"', '-created', 1, 0)
      if (ds && ds.length > 0) {
        var rec = ds[0]
        var logoFilename = rec.getString('report_logo') || rec.getString('logo') || ''
        if (logoFilename) {
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
  globalThis.itsmGetSystemLogoUrl = getSystemLogoUrl

  // Resolve a paleta visual do e-mail de acordo com a regra de severidade do usuário:
  // 1. VERMELHO: SLA vencido ou notificação crítica
  // 2. AMARELO: Notificação de algo prestes a vencer
  // 3. MARCA LÓGOS (Grafite #17181C + Âmbar #D97706 + Dourado #FCD34D): Votações e demais notificações
  function resolveThemePalette(opts) {
    var rawVariant = (opts.variant || opts.severity || '').toLowerCase()
    var titleLower = (
      (opts.title || '') +
      ' ' +
      (opts.badgeText || '') +
      ' ' +
      (opts.preheader || '')
    ).toLowerCase()
    var bc = (opts.badgeColor || '').toLowerCase()

    var isRed =
      rawVariant === 'red' ||
      rawVariant === 'critical' ||
      rawVariant === 'danger' ||
      rawVariant === 'vermelho' ||
      rawVariant === 'vencido' ||
      bc === '#dc2626' ||
      bc === '#ef4444' ||
      bc === '#b91c1c' ||
      titleLower.indexOf('vencid') !== -1 ||
      titleLower.indexOf('crític') !== -1 ||
      titleLower.indexOf('urgente') !== -1 ||
      titleLower.indexOf('bloqueio') !== -1

    var isYellow =
      !isRed &&
      (rawVariant === 'yellow' ||
        rawVariant === 'warning' ||
        rawVariant === 'amarelo' ||
        rawVariant === 'vencimento' ||
        rawVariant === 'prestes' ||
        bc === '#eab308' ||
        bc === '#f59e0b' ||
        bc === '#ca8a04' ||
        titleLower.indexOf('a vencer') !== -1 ||
        titleLower.indexOf('prestes a vencer') !== -1 ||
        titleLower.indexOf('expirar') !== -1 ||
        titleLower.indexOf('expira') !== -1 ||
        titleLower.indexOf('prazo') !== -1 ||
        titleLower.indexOf('renovação') !== -1)

    if (isRed) {
      return {
        type: 'critical',
        stripeColor: '#DC2626',
        accentColor: '#DC2626',
        accentBg: '#FEF2F2',
        accentBorder: '#F87171',
        badgeBg: '#FEE2E2',
        badgeText: '#991B1B',
        badgeBorder: '#FCA5A5',
        buttonBg: '#DC2626',
        buttonHover: '#B91C1C',
        iconBg: '#DC2626',
        iconSymbol: '⚠️',
      }
    }

    if (isYellow) {
      return {
        type: 'warning',
        stripeColor: '#EAB308',
        accentColor: '#CA8A04',
        accentBg: '#FEFCE8',
        accentBorder: '#FACC15',
        badgeBg: '#FEF08A',
        badgeText: '#854D0E',
        badgeBorder: '#FDE047',
        buttonBg: '#D97706',
        buttonHover: '#B45309',
        iconBg: '#EAB308',
        iconSymbol: '⏳',
      }
    }

    // Padrão: Paleta Oficial Lógos AITSM (Grafite #17181C + Âmbar #D97706 + Amarelo/Dourado #FCD34D)
    return {
      type: 'brand',
      stripeColor: '#D97706',
      accentColor: '#D97706',
      accentBg: '#FFFBEB',
      accentBorder: '#FCD34D',
      badgeBg: 'rgba(252, 211, 77, 0.18)',
      badgeText: '#FCD34D',
      badgeBorder: 'rgba(252, 211, 77, 0.35)',
      buttonBg: '#D97706',
      buttonHover: '#B45309',
      iconBg: '#D97706',
      iconSymbol: '⚡',
    }
  }

  // Gera o layout HTML institucional de alta fidelidade
  // Compatível com Outlook, Gmail, Apple Mail, Webmail e dispositivos móveis
  // opts: {
  //   variant / severity: 'critical' | 'warning' | 'brand' (ou autodetectado),
  //   preheader: string,
  //   badgeText: string,
  //   badgeColor: string (opcional),
  //   title: string,
  //   subtitle: string (opcional),
  //   contentHtml: string,
  //   actionHtml: string (opcional),
  //   footerNote: string (opcional),
  //   logoUrl: string (opcional)
  // }
  function renderBaseEmailTemplate(opts) {
    opts = opts || {}
    var theme = resolveThemePalette(opts)

    var preheader = escapeHtml(opts.preheader || '')
    var badgeText = escapeHtml(
      opts.badgeText ||
        (theme.type === 'critical'
          ? 'Alerta Crítico'
          : theme.type === 'warning'
            ? 'Atenção'
            : 'Lógos AITSM'),
    )
    var title = escapeHtml(opts.title || 'Notificação do Sistema')
    var subtitle = escapeHtml(opts.subtitle || '')
    var contentHtml = opts.contentHtml || ''
    var actionHtml = opts.actionHtml || ''
    var footerNote = escapeHtml(
      opts.footerNote || 'Esta é uma notificação automática gerada pelo sistema Lógos AITSM.',
    )

    var logoUrl = opts.logoUrl || getSystemLogoUrl()

    // Marca no cabeçalho (Grafite #17181C com logo oficial Lógos AITSM)
    var brandLogoHtml = ''
    if (logoUrl) {
      brandLogoHtml =
        '<table border="0" cellpadding="0" cellspacing="0">\n' +
        '  <tr>\n' +
        '    <td style="vertical-align: middle;">\n' +
        '      <img src="' +
        escapeHtml(logoUrl) +
        '" alt="Lógos AITSM" height="38" style="max-height: 38px; max-width: 160px; display: block; border: 0;" />\n' +
        '    </td>\n' +
        '    <td style="padding-left: 14px; vertical-align: middle; border-left: 1px solid rgba(255,255,255,0.15);">\n' +
        '      <div style="font-size: 17px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.4px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif;">\n' +
        '        Lógos <span style="color: #FCD34D; font-weight: 700;">AITSM</span>\n' +
        '      </div>\n' +
        '      <div style="font-size: 10px; color: #94A3B8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px;">Gestão Inteligente de TI</div>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'
    } else {
      brandLogoHtml =
        '<table border="0" cellpadding="0" cellspacing="0">\n' +
        '  <tr>\n' +
        '    <td style="background-color: ' +
        theme.iconBg +
        '; width: 38px; height: 38px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: bold; font-size: 18px; font-family: Arial, sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">\n' +
        '      ' +
        theme.iconSymbol +
        '\n' +
        '    </td>\n' +
        '    <td style="padding-left: 12px; vertical-align: middle;">\n' +
        '      <div style="font-size: 18px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif;">\n' +
        '        Lógos <span style="color: #FCD34D; font-weight: 700;">AITSM</span>\n' +
        '      </div>\n' +
        '      <div style="font-size: 10px; color: #94A3B8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px;">Gestão de Serviços de TI</div>\n' +
        '    </td>\n' +
        '  </tr>\n' +
        '</table>'
    }

    var html =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">\n' +
      '<head>\n' +
      '  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
      '  <meta name="format-detection" content="telephone=no" />\n' +
      '  <title>' +
      title +
      '</title>\n' +
      '  <style type="text/css">\n' +
      '    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #0B0E14; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }\n' +
      '    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }\n' +
      '    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }\n' +
      '    a { color: #D97706; text-decoration: none; }\n' +
      '    a:hover { text-decoration: underline; }\n' +
      '    @media only screen and (max-width: 620px) {\n' +
      '      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }\n' +
      '      .mobile-padding { padding-left: 18px !important; padding-right: 18px !important; }\n' +
      '      .mobile-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; margin-bottom: 10px !important; }\n' +
      '      .mobile-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; margin-bottom: 8px !important; }\n' +
      '    }\n' +
      '  </style>\n' +
      '</head>\n' +
      '<body style="margin: 0; padding: 0; background-color: #0F1117;">\n' +
      (preheader
        ? '  <div style="display: none; font-size: 1px; color: #0F1117; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">' +
          preheader +
          '</div>\n'
        : '') +
      '  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0F1117; table-layout: fixed; min-height: 100vh;">\n' +
      '    <tr>\n' +
      '      <td align="center" style="padding: 24px 12px 36px 12px;">\n' +
      '        <!-- CONTAINER PRINCIPAL -->\n' +
      '        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25); border: 1px solid #262933;">\n' +
      '          \n' +
      '          <!-- FAIXA SUPERIOR DE STATUS / GRAVIDADE (Vermelho, Amarelo ou Âmbar Marca) -->\n' +
      '          <tr>\n' +
      '            <td height="5" style="background-color: ' +
      theme.stripeColor +
      '; font-size: 0px; line-height: 5px;">&nbsp;</td>\n' +
      '          </tr>\n' +
      '          \n' +
      '          <!-- CABEÇALHO INSTITUCIONAL GRAFITE #17181C -->\n' +
      '          <tr>\n' +
      '            <td style="background-color: #17181C; padding: 22px 28px; border-bottom: 1px solid #2B2E3A;" class="mobile-padding">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td valign="middle">\n' +
      '                    ' +
      brandLogoHtml +
      '\n' +
      '                  </td>\n' +
      '                  <td align="right" valign="middle">\n' +
      '                    <span style="display: inline-block; background-color: ' +
      theme.badgeBg +
      '; color: ' +
      theme.badgeText +
      '; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.6px; border: 1px solid ' +
      theme.badgeBorder +
      "; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;\">\n" +
      '                      ' +
      badgeText +
      '\n' +
      '                    </span>\n' +
      '                  </td>\n' +
      '                </tr>\n' +
      '              </table>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '          \n' +
      '          <!-- BANNER / TÍTULO COM DESTAQUE LATERAL -->\n' +
      '          <tr>\n' +
      '            <td style="background-color: #FAFAFA; padding: 24px 28px 18px 28px; border-bottom: 1px solid #E5E7EB;" class="mobile-padding">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td style="border-left: 4px solid ' +
      theme.accentColor +
      '; padding-left: 14px;">\n' +
      '                    <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #111827; line-height: 24px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Arial, sans-serif;">\n' +
      '                      ' +
      title +
      '\n' +
      '                    </h1>\n' +
      (subtitle
        ? '                    <div style="margin-top: 4px; font-size: 13px; color: #4B5563; line-height: 18px; font-weight: 500;">' +
          subtitle +
          '</div>\n'
        : '') +
      '                  </td>\n' +
      '                </tr>\n' +
      '              </table>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '          \n' +
      '          <!-- CORPO DA NOTIFICAÇÃO -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 24px 28px 28px 28px; background-color: #FFFFFF; font-size: 14px; line-height: 22px; color: #374151;" class="mobile-padding">\n' +
      '              ' +
      contentHtml +
      '\n' +
      (actionHtml
        ? '              <!-- BLOCO DE AÇÃO INTERATIVA -->\n' +
          '              <div style="margin-top: 26px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center;">\n' +
          '                ' +
          actionHtml +
          '\n' +
          '              </div>\n'
        : '') +
      '            </td>\n' +
      '          </tr>\n' +
      '          \n' +
      '          <!-- RODAPÉ INSTITUCIONAL DISCRETO -->\n' +
      '          <tr>\n' +
      '            <td style="background-color: #F8FAFC; padding: 20px 28px; border-top: 1px solid #E2E8F0; text-align: center;" class="mobile-padding">\n' +
      '              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; line-height: 17px;">' +
      footerNote +
      '</p>\n' +
      '              <p style="margin: 0; font-size: 11px; color: #94A3B8; font-weight: 500;">\n' +
      '                <strong>Lógos AITSM</strong> • Sistema de Gestão de Serviços de TI • Remetente: <span style="color: #64748B;">noreply@logositsm.com.br</span>\n' +
      '              </p>\n' +
      '            </td>\n' +
      '          </tr>\n' +
      '        </table>\n' +
      '      </td>\n' +
      '    </tr>\n' +
      '  </table>\n' +
      '</body>\n' +
      '</html>'

    return html
  }
  globalThis.itsmRenderBaseEmailTemplate = renderBaseEmailTemplate

  // Helper central para envio e registro imediato em email_audit_logs
  // opts: {
  //   testType: 'abertura_chamado' | 'alerta_sla' | 'aprovacao_chamado' | ...,
  //   to: string,
  //   subject: string,
  //   html: string,
  //   text: string,
  //   meta: { ticketNumber, summary, ... }
  // }
  function sendWithAudit(opts) {
    if (!opts || !opts.to) {
      throw new Error('Destinatário não informado para envio.')
    }
    var targetEmail = String(opts.to).trim()
    if (!targetEmail) {
      throw new Error('E-mail do destinatário vazio.')
    }

    var mailerConfig =
      typeof globalThis.resolveSystemMailerConfig === 'function'
        ? globalThis.resolveSystemMailerConfig()
        : { host: '', port: 587, encryption: 'STARTTLS', user: '', senderEmail: '' }

    var senderAccount = mailerConfig.user || mailerConfig.senderEmail || 'noreply@logositsm.com.br'
    var senderName = mailerConfig.senderName || 'Lógos AITSM'

    var sendSuccess = false
    var sendErrorMsg = ''
    var sendResult = null

    try {
      if (typeof globalThis.sendSystemEmail === 'function') {
        sendResult = globalThis.sendSystemEmail({
          to: targetEmail,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        })
        sendSuccess = true
      } else {
        var msg =
          typeof globalThis.createSystemMailMessage === 'function'
            ? globalThis.createSystemMailMessage()
            : typeof MailerMessage !== 'undefined'
              ? new MailerMessage()
              : typeof MailMessage !== 'undefined'
                ? new MailMessage()
                : {}
        msg.from = { address: senderAccount, name: senderName }
        msg.to = [{ address: targetEmail }]
        msg.subject = opts.subject
        if (opts.text) msg.text = opts.text
        if (opts.html) msg.html = opts.html

        if (typeof globalThis.sendSystemMailMessage === 'function') {
          sendResult = globalThis.sendSystemMailMessage(msg, mailerConfig)
        } else {
          var client = $app.newMailClient()
          client.send(msg)
          sendResult = { success: true, smtp_used: 'default_mail_client' }
        }
        sendSuccess = true
      }
    } catch (err) {
      sendSuccess = false
      sendErrorMsg = err && err.message ? err.message : String(err)
      if (typeof $app !== 'undefined' && $app && typeof $app.logger === 'function') {
        $app
          .logger()
          .error(
            'sendWithAudit error',
            'type',
            opts.testType,
            'dest',
            targetEmail,
            'err',
            sendErrorMsg,
          )
      }
    }

    // Registra na coleção de auditoria email_audit_logs se disponível
    try {
      if (
        typeof $app !== 'undefined' &&
        $app &&
        typeof $app.findCollectionByNameOrId === 'function'
      ) {
        var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
        var rec = new Record(auditCol)
        rec.set('test_type', opts.testType || 'teste-envio')
        rec.set('status', sendSuccess ? 'success' : 'failed')
        rec.set('host', (sendResult && sendResult.host) || mailerConfig.host || '')
        rec.set('port', mailerConfig.port || 587)
        rec.set('user_account', senderAccount)
        rec.set('encryption', mailerConfig.encryption || 'STARTTLS')

        var summary =
          (sendSuccess ? 'Envio com sucesso para ' : 'Falha no envio para ') +
          targetEmail +
          ': ' +
          (opts.subject || '') +
          (sendErrorMsg ? ' (' + sendErrorMsg + ')' : '')
        rec.set('summary_message', summary)

        var steps = [
          {
            step: 1,
            name: 'Disparo de E-mail (' + (opts.testType || 'geral') + ')',
            status: sendSuccess ? 'success' : 'failed',
            detail: sendSuccess ? 'Mensagem entregue ao transporte SMTP.' : sendErrorMsg,
            duration_ms: 0,
          },
        ]
        rec.set('steps_result', steps)
        rec.set('latest_messages_count', 1)

        rec.set('dry_run_result', {
          recipient: targetEmail,
          subject: opts.subject,
          smtp_used: (sendResult && sendResult.smtp_used) || 'smtp',
          meta: opts.meta || {},
          error: sendErrorMsg || null,
        })

        $app.save(rec)
      }
    } catch (auditErr) {
      if (typeof $app !== 'undefined' && $app && typeof $app.logger === 'function') {
        $app
          .logger()
          .warn('sendWithAudit: falha ao gravar email_audit_logs', 'err', auditErr.message)
      }
    }

    return {
      success: sendSuccess,
      error: sendErrorMsg || null,
      recipient: targetEmail,
      result: sendResult,
    }
  }
  globalThis.itsmSendWithAudit = sendWithAudit
})()
