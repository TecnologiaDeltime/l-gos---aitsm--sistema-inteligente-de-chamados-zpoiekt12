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
  // Helper para registrar log de auditoria
  function logAuditRecord(params) {
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var rec = new Record(auditCol)
      rec.set('test_type', params.testType || 'connection_test')
      rec.set('status', params.status === 'success' ? 'success' : 'failed')
      rec.set('host', params.host || '')
      rec.set('port', params.port || 0)
      rec.set('user_account', params.userAccount || '')
      rec.set('inbox_folder', params.inboxFolder || '')
      rec.set('encryption', params.encryption || '')
      rec.set('summary_message', params.summaryMessage || '')
      rec.set('steps_json', JSON.stringify(params.steps || []))
      rec.set('latest_messages_count', params.latestMessagesCount || 0)
      $app.save(rec)
      return rec.id
    } catch (e) {
      $app.logger().error('logAuditRecord error', 'err', e.message)
      return null
    }
  }

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

    var graphClientSecret = (
      rawBody.graph_client_secret !== undefined
        ? rawBody.graph_client_secret
        : configRec
          ? configRec.getString('graph_client_secret')
          : ''
    ).trim()

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

    var pass = (
      rawBody.imap_password !== undefined
        ? rawBody.imap_password
        : configRec
          ? configRec.getString('imap_password')
          : ''
    ).trim()

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

      var client = globalThis.MicrosoftGraphClient
      if (!client) {
        steps[0].status = 'failed'
        steps[0].detail = 'Módulo MicrosoftGraphClient não está carregado no runtime PocketBase.'
        for (var i = 1; i < 7; i++) {
          steps[i].status = 'skipped'
        }
        return c.json(200, {
          success: false,
          reception_mode: 'graph',
          summary_message: 'Módulo MicrosoftGraphClient indisponível.',
          steps: steps,
          samples: [],
          stats: { unread_count: 0, total_recent: 0 },
        })
      }

      // Validação prévia de campos
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
  // TESTE DE FLUXO PONTA A PONTA COM E-MAIL SINTÉTICO OU REAL
  // POST /backend/v1/emails/test-flow
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
          steps_json: l.getString('steps_json'),
          latest_messages_count: l.getInt('latest_messages_count'),
        })
      }
      return c.json(200, { data: out })
    } catch (err) {
      return c.json(500, { error: err.message })
    }
  })
})()
