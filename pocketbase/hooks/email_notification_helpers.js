// Helper unificado de templates HTML elegantes e envio com auditoria
// Compatível com Goja / PocketBase v0.36
// Fornece em globalThis:
// - itsmEscapeHtml(str)
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

  // Gera o layout HTML base (compatível com Outlook, Gmail, Webmail, mobile)
  // opts: {
  //   preheader: string,
  //   badgeText: string,
  //   badgeColor: string ('#2563eb', '#d97706', '#dc2626', etc.),
  //   title: string,
  //   subtitle: string,
  //   contentHtml: string,
  //   actionHtml: string (opcional),
  //   footerNote: string (opcional)
  // }
  function renderBaseEmailTemplate(opts) {
    opts = opts || {}
    var preheader = escapeHtml(opts.preheader || '')
    var badgeText = escapeHtml(opts.badgeText || 'ServiceOne ITSM')
    var badgeColor = opts.badgeColor || '#0284c7'
    var title = escapeHtml(opts.title || '')
    var subtitle = escapeHtml(opts.subtitle || '')
    var contentHtml = opts.contentHtml || ''
    var actionHtml = opts.actionHtml || ''
    var footerNote = escapeHtml(
      opts.footerNote ||
        'Esta é uma notificação automática gerada pelo sistema ITSM ServiceOne. Por favor, não responda diretamente a este e-mail.',
    )

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
      '    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }\n' +
      '    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }\n' +
      '    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }\n' +
      '    a { color: #0284c7; text-decoration: none; }\n' +
      '    @media only screen and (max-width: 600px) {\n' +
      '      .email-container { width: 100% !important; max-width: 100% !important; }\n' +
      '      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }\n' +
      '      .mobile-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; margin-bottom: 10px !important; }\n' +
      '      .mobile-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; margin-bottom: 10px !important; }\n' +
      '    }\n' +
      '  </style>\n' +
      '</head>\n' +
      '<body style="margin: 0; padding: 0; background-color: #f1f5f9;">\n' +
      (preheader
        ? '  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">' +
          preheader +
          '</div>\n'
        : '') +
      '  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">\n' +
      '    <tr>\n' +
      '      <td align="center" style="padding: 30px 15px 40px 15px;">\n' +
      '        <!-- CONTAINER PRINCIPAL -->\n' +
      '        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">\n' +
      '          \n' +
      '          <!-- CABEÇALHO COM IDENTIDADE VISUAL E LOGOTIPO -->\n' +
      '          <tr>\n' +
      '            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); background-color: #0f172a; padding: 26px 32px; border-bottom: 3px solid #0284c7;" class="mobile-padding">\n' +
      '              <table border="0" cellpadding="0" cellspacing="0" width="100%">\n' +
      '                <tr>\n' +
      '                  <td valign="middle">\n' +
      '                    <table border="0" cellpadding="0" cellspacing="0">\n' +
      '                      <tr>\n' +
      '                        <td style="background-color: #0284c7; width: 40px; height: 40px; border-radius: 8px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: bold; font-size: 20px; font-family: Arial, sans-serif;">\n' +
      '                          ⚡\n' +
      '                        </td>\n' +
      '                        <td style="padding-left: 14px; vertical-align: middle;">\n' +
      '                          <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 22px;">ServiceOne <span style="color: #38bdf8; font-weight: 600;">ITSM</span></div>\n' +
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
      '          \n' +
      '          <!-- TÍTULO DO CARD -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 28px 32px 12px 32px;" class="mobile-padding">\n' +
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
      '          \n' +
      '          <!-- CONTEÚDO PRINCIPAL -->\n' +
      '          <tr>\n' +
      '            <td style="padding: 12px 32px 28px 32px;" class="mobile-padding">\n' +
      contentHtml +
      (actionHtml
        ? '              <!-- BLOCO DE AÇÃO -->\n' +
          '              <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">\n' +
          actionHtml +
          '              </div>\n'
        : '') +
      '            </td>\n' +
      '          </tr>\n' +
      '          \n' +
      '          <!-- RODAPÉ -->\n' +
      '          <tr>\n' +
      '            <td style="background-color: #f8fafc; padding: 22px 32px; border-top: 1px solid #e2e8f0; text-align: center;" class="mobile-padding">\n' +
      '              <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 16px;">' +
      footerNote +
      '</p>\n' +
      '              <p style="margin: 0; font-size: 11px; color: #94a3b8;">© ' +
      new Date().getFullYear() +
      ' ServiceOne ITSM • Plataforma de Gestão de Incidentes e Requisições</p>\n' +
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
  //   testType: 'abertura_chamado' | 'alerta_sla' | 'aprovacao_chamado',
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

    var senderAccount = mailerConfig.user || mailerConfig.senderEmail || 'noreply@serviceone.com.br'
    var senderName = mailerConfig.senderName || 'ServiceOne ITSM'

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
        var msg = new MailerMessage()
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

    // Registra na coleção de auditoria email_audit_logs
    try {
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
    } catch (auditErr) {
      $app.logger().warn('sendWithAudit: falha ao gravar email_audit_logs', 'err', auditErr.message)
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
