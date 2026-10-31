// Verifica se há configuração de envio SMTP ativa no sistema.
// Considera: 1) caixa dedicada (email_config: smtp_host + smtp_user + smtp_password)
// 2) SMTP padrão da plataforma configurado no painel (settings.smtp)
routerAdd(
  'GET',
  '/backend/v1/smtp-status',
  (e) => {
    var result = { configured: false, dedicated: false, host: '', source: '' }
    try {
      // 1. Caixa dedicada de envio (email_config)
      try {
        var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
        if (configs.length > 0) {
          var cfg = configs[0]
          var h = (cfg.getString('smtp_host') || '').trim()
          var u = (cfg.getString('smtp_user') || cfg.getString('imap_user') || '').trim()
          var p = (cfg.getString('smtp_password') || cfg.getString('imap_password') || '').trim()
          if (h && u && p) {
            result.configured = true
            result.dedicated = true
            result.host = h
            result.source = 'email_config'
            return e.json(200, result)
          }
        }
      } catch (_) {}

      // 2. SMTP global configurado no painel do PocketBase
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (s && s.smtp) {
        var smtp = s.smtp
        result.configured = !!smtp.enabled && !!smtp.host
        if (result.configured) {
          result.host = smtp.host || ''
          result.source = 'settings_smtp'
        }
      }
      return e.json(200, result)
    } catch (err) {
      return e.json(200, { configured: false, dedicated: false, host: '', source: '' })
    }
  },
  $apis.requireAuth(),
)
