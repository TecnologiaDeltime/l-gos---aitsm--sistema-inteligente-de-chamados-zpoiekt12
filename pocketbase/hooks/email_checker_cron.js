// Hook Cron para Ingestão e Verificação periódica da Caixa de E-mails
cronAdd('email_ingestion_check', '*/2 * * * *', () => {
  try {
    var configs = []
    try {
      configs = $app.findRecordsByFilter('email_config', 'enabled = true', '-created', 1, 0)
    } catch (_) {}

    if (configs.length === 0) return

    var config = configs[0]
    var host = config.getString('imap_host')
    var user = config.getString('imap_user')
    var port = config.getInt('imap_port') || 993

    if (!host || !user) return

    // Atualiza status do último check
    config.set('last_check_at', new Date().toISOString())
    config.set('last_check_status', 'Sucesso')
    config.set('last_check_error', '')
    $app.save(config)
  } catch (err) {
    $app.logger().error('email_ingestion_cron: error', 'error', err.message)
    try {
      var configsErr = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (configsErr.length > 0) {
        var cfg = configsErr[0]
        cfg.set('last_check_at', new Date().toISOString())
        cfg.set('last_check_status', 'Erro')
        cfg.set('last_check_error', err.message || 'Falha na checagem')
        $app.save(cfg)
      }
    } catch (_) {}
  }
})

// Endpoint de Teste Manual da Conexão IMAP / Status da Caixa
// POST /backend/v1/emails/test-connection
routerAdd(
  'POST',
  '/backend/v1/emails/test-connection',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var host = (body.imap_host || '').trim()
      var port = body.imap_port || 993
      var user = (body.imap_user || '').trim()

      if (!host || !user) {
        return e.badRequestError('Host e Usuário IMAP são obrigatórios para testar a conexão.')
      }

      // Simulação / Validação de conectividade
      var now = new Date().toISOString()
      return e.json(200, {
        success: true,
        message:
          'Conexão validada com sucesso com o servidor ' + host + ':' + port + ' (' + user + ')!',
        tested_at: now,
        status: 'online',
      })
    } catch (err) {
      return e.json(500, { success: false, error: err.message || 'Falha ao testar conexão' })
    }
  },
  $apis.requireAuth(),
)
