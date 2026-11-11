/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Serviço Unificado de Envio de E-mails do Sistema ITSM (Lógos AITSM / Skip Cloud)
// ----------------------------------------------------------------------------
// TRANSPORTE EXCLUSIVO: Skip Cloud Transacional ($app.newMailClient)
// Remetente canônico: Lógos AITSM <noreply@mail.goskip.dev>
//
// Disponibiliza as funções globais:
// - resolveSystemMailerConfig()
// - sendSystemEmail(options)
// - sendSystemMailMessage(message)
// ============================================================================

;(function () {
  var SKIP_CLOUD_SENDER_EMAIL = 'noreply@mail.goskip.dev'
  var SKIP_CLOUD_SENDER_NAME = 'Lógos AITSM'

  function getSystemSenderInfo() {
    var senderEmail = SKIP_CLOUD_SENDER_EMAIL
    var senderName = SKIP_CLOUD_SENDER_NAME
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.meta && s.meta.senderAddress) senderEmail = s.meta.senderAddress
      if (s && s.meta && s.meta.senderName) senderName = s.meta.senderName
    } catch (_) {}
    return { senderEmail: senderEmail, senderName: senderName }
  }

  // Retorna a configuração resolvida de envio (sempre apontada para o Skip Cloud puro)
  globalThis.resolveSystemMailerConfig = function () {
    var info = getSystemSenderInfo()
    return {
      isDedicated: false,
      host: 'mail.goskip.dev',
      port: 587,
      encryption: 'STARTTLS',
      user: info.senderEmail,
      password: '',
      senderName: info.senderName,
      replyTo: '',
      senderEmail: info.senderEmail,
      transport: 'skip_cloud',
    }
  }

  // Envia um objeto MailerMessage diretamente pelo Skip Cloud sem alterar settings SMTP
  globalThis.sendSystemMailMessage = function (message) {
    if (!message) throw new Error('sendSystemMailMessage: message obrigatória')

    // Assegura remetente padrão Skip Cloud se não definido
    var info = getSystemSenderInfo()
    if (!message.from || !message.from.address) {
      message.from = {
        address: info.senderEmail,
        name: info.senderName,
      }
    }

    var client = $app.newMailClient()
    client.send(message)

    return {
      success: true,
      transport: 'skip_cloud',
      sender: message.from.address,
    }
  }

  // Helper de alto nível para envio de e-mails em formato simples ou HTML
  globalThis.sendSystemEmail = function (options) {
    if (!options) throw new Error('sendSystemEmail: options obrigatórias')

    var toAddress = ''
    if (typeof options.to === 'string') {
      toAddress = options.to.trim()
    } else if (options.to && typeof options.to === 'object') {
      toAddress = (options.to.address || options.to.email || '').trim()
    }
    if (!toAddress) throw new Error('sendSystemEmail: destinatário inválido')

    var info = getSystemSenderInfo()
    var senderName = options.fromName || info.senderName
    var senderAddress = options.fromEmail || info.senderEmail

    var message = new MailerMessage({
      from: {
        address: senderAddress,
        name: senderName,
      },
      to: [{ address: toAddress }],
      subject: options.subject || 'Notificação Lógos AITSM',
      html: options.html || '',
      text: options.text || '',
    })

    if (options.replyTo && message.headers) {
      message.headers['Reply-To'] = options.replyTo
    }

    return globalThis.sendSystemMailMessage(message)
  }

  console.log('[mailer_service] transporte Skip Cloud puro inicializado')
})()
