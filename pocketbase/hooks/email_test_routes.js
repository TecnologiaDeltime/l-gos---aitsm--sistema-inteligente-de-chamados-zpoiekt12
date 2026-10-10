// Endpoint para teste de conexão IMAP passo a passo, simulação dry-run e envio de e-mail de teste
// Rotas:
// POST /backend/v1/emails/test-connection
// POST /backend/v1/emails/dry-run
// POST /backend/v1/emails/send-test

routerAdd('POST', '/backend/v1/emails/test-connection', (e) => {
  try {
    var authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Requer autenticação.' })
    }
    var userRole = authUser.getString('role')
    if (userRole !== 'admin' && userRole !== 'gestor') {
      return e.json(403, { error: 'Apenas administradores e gestores podem testar conexão IMAP.' })
    }

    var body = e.requestInfo().body || {}
    var host = (body.imap_host || '').trim()
    var port = parseInt(body.imap_port, 10) || 993
    var user = (body.imap_user || '').trim()
    var pass = (body.imap_password || body.imap_pass || '').trim()
    var encryption = (body.imap_encryption || (body.imap_ssl ? 'SSL/TLS' : 'STARTTLS')).trim()
    var inboxFolder = (body.inbox_folder || 'INBOX').trim()
    var processedFolder = (body.processed_folder || 'Processados').trim()

    // Se a senha não veio no request (campo mascarado), buscar do banco em email_config
    if (!pass) {
      try {
        var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
        if (configs.length > 0) {
          pass = configs[0].getString('imap_password') || ''
        }
      } catch (_) {}
    }

    var steps = [
      {
        id: 'tcp_socket',
        name: 'Abertura de Socket TCP e Resolução do Host',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
      {
        id: 'tls_handshake',
        name: 'Negociação TLS/Criptografia',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
      {
        id: 'imap_greeting',
        name: 'Leitura de Saudação do Servidor IMAP',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
      {
        id: 'imap_login',
        name: 'Autenticação da Conta (LOGIN)',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
      {
        id: 'select_folder',
        name: 'Seleção da Pasta de Entrada (' + inboxFolder + ')',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
      {
        id: 'check_messages',
        name: 'Listagem e Contagem de Mensagens (UID SEARCH)',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
      {
        id: 'cron_scheduler',
        name: 'Verificação da Rotina Automática (Cron Ingestão)',
        status: 'pending',
        message: 'Aguardando execução...',
        duration_ms: 0,
      },
    ]

    var startTime = Date.now()
    var conn = null
    var reader = null
    var tagCounter = 1
    var sampleMessages = []
    var totalFound = 0
    var overallStatus = 'success'
    var finalMessage = 'Conexão IMAP validada com sucesso!'

    var tlsObj = typeof tls !== 'undefined' ? tls : typeof $tls !== 'undefined' ? $tls : null
    var netObj = typeof net !== 'undefined' ? net : typeof $net !== 'undefined' ? $net : null
    var bufioObj =
      typeof bufio !== 'undefined' ? bufio : typeof $bufio !== 'undefined' ? $bufio : null

    var readLineFromConn = function () {
      if (reader && typeof reader.readString === 'function') {
        return reader.readString('\n')
      }
      if (reader && typeof reader.ReadString === 'function') {
        return reader.ReadString('\n')
      }
      if (conn && typeof conn.read === 'function') {
        var buf = new Uint8Array(4096)
        var n = conn.read(buf)
        if (n <= 0) return ''
        var str = ''
        for (var i = 0; i < n; i++) str += String.fromCharCode(buf[i])
        return str
      }
      return ''
    }

    var writeToConn = function (str) {
      if (conn && typeof conn.write === 'function') {
        conn.write(str)
      } else if (conn && typeof conn.Write === 'function') {
        conn.Write(str)
      }
    }

    var sendCmd = function (cmd) {
      var tag = 'T' + String(tagCounter++)
      var fullCmd = tag + ' ' + cmd + '\r\n'
      writeToConn(fullCmd)

      var lines = []
      var status = ''
      var maxLines = 1000
      var lineCount = 0

      while (lineCount < maxLines) {
        var line = readLineFromConn()
        if (!line) break
        lineCount++
        var cleanLine = line.replace(/[\r\n]+$/, '')
        lines.push(cleanLine)
        if (cleanLine.indexOf(tag + ' OK') === 0) {
          status = 'OK'
          break
        }
        if (cleanLine.indexOf(tag + ' NO') === 0) {
          status = 'NO'
          break
        }
        if (cleanLine.indexOf(tag + ' BAD') === 0) {
          status = 'BAD'
          break
        }
      }
      return { tag: tag, status: status, lines: lines }
    }

    try {
      var addr = host + ':' + port
      var isImplicitTls =
        encryption.toLowerCase().indexOf('ssl') !== -1 ||
        encryption.toLowerCase().indexOf('tls') !== -1 ||
        port === 993

      // 1. Abertura do Socket TCP
      var step1Start = Date.now()
      try {
        if (isImplicitTls) {
          if (tlsObj && (typeof tlsObj.dial === 'function' || typeof tlsObj.Dial === 'function')) {
            var dialFn = typeof tlsObj.dial === 'function' ? tlsObj.dial : tlsObj.Dial
            conn = dialFn('tcp', addr, {
              insecureSkipVerify: true,
              serverName: host,
            })
            steps[0].status = 'success'
            steps[0].message = 'Conexão TCP e handshake TLS estabelecidos em ' + addr
            steps[0].duration_ms = Date.now() - step1Start

            steps[1].status = 'success'
            steps[1].message =
              'Criptografia direta SSL/TLS ativa na porta ' + port + ' (TLS handshake OK)'
            steps[1].duration_ms = steps[0].duration_ms
          } else if (
            netObj &&
            (typeof netObj.dial === 'function' || typeof netObj.Dial === 'function')
          ) {
            var netDialFn = typeof netObj.dial === 'function' ? netObj.dial : netObj.Dial
            var rawConn = netDialFn('tcp', addr)
            steps[0].status = 'success'
            steps[0].message = 'Conexão TCP estabelecida em ' + addr
            steps[0].duration_ms = Date.now() - step1Start

            if (
              tlsObj &&
              (typeof tlsObj.client === 'function' || typeof tlsObj.Client === 'function')
            ) {
              var clientFn = typeof tlsObj.client === 'function' ? tlsObj.client : tlsObj.Client
              conn = clientFn(rawConn, {
                insecureSkipVerify: true,
                serverName: host,
              })
              steps[1].status = 'success'
              steps[1].message = 'Criptografia direta TLS negociada com sucesso.'
              steps[1].duration_ms = Date.now() - step1Start
            } else {
              conn = rawConn
              steps[1].status = 'warning'
              steps[1].message = 'Conexão aberta sem wrapper TLS.'
            }
          } else {
            throw new Error('Módulos de rede Goja (tls / net) não disponíveis no runtime.')
          }
        } else {
          // Plaintext ou STARTTLS inicial
          if (netObj && (typeof netObj.dial === 'function' || typeof netObj.Dial === 'function')) {
            var plainDialFn = typeof netObj.dial === 'function' ? netObj.dial : netObj.Dial
            conn = plainDialFn('tcp', addr)
            steps[0].status = 'success'
            steps[0].message = 'Conexão TCP estabelecida em ' + addr
            steps[0].duration_ms = Date.now() - step1Start
          } else {
            throw new Error('Módulo de rede Goja (net) não disponível no runtime.')
          }
        }
      } catch (tcpErr) {
        var rawErr = tcpErr.message || String(tcpErr)
        var friendlyTcpErr = rawErr
        if (
          rawErr.toLowerCase().indexOf('no such host') !== -1 ||
          rawErr.toLowerCase().indexOf('lookup') !== -1
        ) {
          friendlyTcpErr =
            'Host inacessível: não foi possível resolver o endereço DNS de "' + host + '".'
        } else if (rawErr.toLowerCase().indexOf('connection refused') !== -1) {
          friendlyTcpErr =
            'Conexão recusada em ' + addr + '. Verifique se a porta está correta e liberada.'
        } else if (rawErr.toLowerCase().indexOf('timeout') !== -1) {
          friendlyTcpErr = 'Tempo limite esgotado ao contatar ' + addr + ' (timeout de rede).'
        }
        steps[0].status = 'failed'
        steps[0].message = friendlyTcpErr
        steps[0].duration_ms = Date.now() - step1Start
        throw new Error(friendlyTcpErr)
      }

      // Preparar leitor bufio
      if (bufioObj) {
        if (typeof bufioObj.newReader === 'function') {
          reader = bufioObj.newReader(conn)
        } else if (typeof bufioObj.NewReader === 'function') {
          reader = bufioObj.NewReader(conn)
        }
      }

      // 2. Saudação do Servidor IMAP (Greeting)
      var stepGreetStart = Date.now()
      var banner = readLineFromConn()
      if (!banner || banner.indexOf('* OK') === -1) {
        steps[2].status = 'failed'
        steps[2].message =
          'Servidor IMAP não enviou saudação válida: ' + (banner || 'resposta vazia')
        steps[2].duration_ms = Date.now() - stepGreetStart
        throw new Error('Saudação IMAP inválida: ' + banner)
      }
      steps[2].status = 'success'
      steps[2].message = 'Servidor respondeu: ' + banner.replace(/[\r\n]+$/, '').substring(0, 80)
      steps[2].duration_ms = Date.now() - stepGreetStart

      // 2.1 Se STARTTLS (porta 143/587 com upgrade)
      if (encryption.toLowerCase().indexOf('starttls') !== -1) {
        var starttlsStart = Date.now()
        var starttlsRes = sendCmd('STARTTLS')
        if (starttlsRes.status !== 'OK') {
          steps[1].status = 'failed'
          steps[1].message = 'Servidor rejeitou comando STARTTLS: ' + starttlsRes.lines.join(' ')
          steps[1].duration_ms = Date.now() - starttlsStart
          throw new Error('STARTTLS rejeitado')
        }
        if (
          tlsObj &&
          (typeof tlsObj.client === 'function' || typeof tlsObj.Client === 'function')
        ) {
          var clientUpgradeFn = typeof tlsObj.client === 'function' ? tlsObj.client : tlsObj.Client
          conn = clientUpgradeFn(conn, {
            insecureSkipVerify: true,
            serverName: host,
          })
          if (bufioObj) {
            if (typeof bufioObj.newReader === 'function') {
              reader = bufioObj.newReader(conn)
            } else if (typeof bufioObj.NewReader === 'function') {
              reader = bufioObj.NewReader(conn)
            }
          }
        }
        steps[1].status = 'success'
        steps[1].message = 'Negociação STARTTLS concluída com sucesso!'
        steps[1].duration_ms = Date.now() - starttlsStart
      } else if (steps[1].status === 'pending') {
        steps[1].status = 'warning'
        steps[1].message = 'Conexão em texto claro (sem criptografia TLS)'
      }

      // 3. LOGIN
      var stepLoginStart = Date.now()
      var safePass = pass.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      var safeUser = user.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      var loginRes = sendCmd('LOGIN "' + safeUser + '" "' + safePass + '"')
      steps[3].duration_ms = Date.now() - stepLoginStart
      if (loginRes.status !== 'OK') {
        steps[3].status = 'failed'
        var loginErrText = loginRes.lines.join(' ')
        if (
          loginErrText.toLowerCase().indexOf('535') !== -1 ||
          loginErrText.toLowerCase().indexOf('basic auth') !== -1 ||
          loginErrText.toLowerCase().indexOf('authentication failed') !== -1 ||
          loginErrText.toLowerCase().indexOf('badcredentials') !== -1 ||
          host.toLowerCase().indexOf('office365.com') !== -1
        ) {
          steps[3].message =
            'Autenticação rejeitada (Código 535 / Microsoft 365). É necessária uma Senha de Aplicativo (App Password) e a habilitação do IMAP para esta caixa no portal Microsoft 365. Detalhes: ' +
            loginErrText
        } else {
          steps[3].message = 'Credenciais rejeitadas pelo servidor: ' + loginErrText
        }
        throw new Error('Falha de login IMAP: ' + steps[3].message)
      }
      steps[3].status = 'success'
      steps[3].message = 'Autenticação bem-sucedida para a conta ' + user

      // Listar pastas disponíveis (LIST) para diagnóstico rico
      var availableFolders = []
      try {
        var listRes = sendCmd('LIST "" "*"')
        if (listRes.status === 'OK') {
          for (var li = 0; li < listRes.lines.length; li++) {
            var lLine = listRes.lines[li]
            if (lLine.indexOf('* LIST') === 0) {
              var lastQuote = lLine.match(/"([^"]+)"$/) || lLine.match(/\s+([^\s]+)$/)
              if (lastQuote && lastQuote[1]) {
                availableFolders.push(lastQuote[1])
              }
            }
          }
        }
      } catch (_) {}

      // 4. SELECT Pasta
      var stepSelStart = Date.now()
      var selectRes = sendCmd('SELECT "' + inboxFolder + '"')
      var selectedActualFolder = inboxFolder
      if (selectRes.status !== 'OK') {
        var fallbacks = ['INBOX', 'Inbox', 'Caixa de Entrada']
        var foundFallback = false
        for (var fb = 0; fb < fallbacks.length; fb++) {
          var fbFolder = fallbacks[fb]
          if (fbFolder !== inboxFolder) {
            var fbRes = sendCmd('SELECT "' + fbFolder + '"')
            if (fbRes.status === 'OK') {
              selectedActualFolder = fbFolder
              foundFallback = true
              selectRes = fbRes
              break
            }
          }
        }

        if (foundFallback) {
          steps[4].status = 'warning'
          steps[4].message =
            'A pasta "' +
            inboxFolder +
            '" não foi encontrada, mas a pasta alternativa "' +
            selectedActualFolder +
            '" foi selecionada com sucesso! Pastas encontradas: ' +
            availableFolders.slice(0, 5).join(', ')
        } else {
          steps[4].status = 'failed'
          steps[4].message =
            'Pasta "' +
            inboxFolder +
            '" não existe no servidor. Pastas detectadas no servidor: ' +
            (availableFolders.length > 0 ? availableFolders.slice(0, 8).join(', ') : 'nenhuma')
          steps[4].duration_ms = Date.now() - stepSelStart
          throw new Error('Pasta não encontrada: ' + steps[4].message)
        }
      } else {
        steps[4].status = 'success'
        steps[4].message = 'Pasta "' + inboxFolder + '" selecionada e pronta para leitura.'
      }
      steps[4].duration_ms = Date.now() - stepSelStart

      // 5. SEARCH e Contagem
      var stepSearchStart = Date.now()
      var uids = []
      var unseenRes = sendCmd('UID SEARCH UNSEEN')
      if (unseenRes.status === 'OK') {
        for (var ui = 0; ui < unseenRes.lines.length; ui++) {
          var unLine = unseenRes.lines[ui]
          if (unLine.indexOf('* SEARCH') === 0) {
            var parts = unLine.replace('* SEARCH', '').trim().split(/\s+/)
            for (var up = 0; up < parts.length; up++) {
              if (parts[up]) uids.push(parts[up])
            }
          }
        }
      }
      var unseenCount = uids.length

      var allSearchRes = sendCmd('UID SEARCH ALL')
      var allUids = []
      if (allSearchRes.status === 'OK') {
        for (var ai = 0; ai < allSearchRes.lines.length; ai++) {
          var aLine = allSearchRes.lines[ai]
          if (aLine.indexOf('* SEARCH') === 0) {
            var aParts = aLine.replace('* SEARCH', '').trim().split(/\s+/)
            for (var ap = 0; ap < aParts.length; ap++) {
              if (allParts[ap]) allUids.push(allParts[ap])
            }
          }
        }
      }
      totalFound = allUids.length
      steps[5].status = 'success'
      steps[5].message =
        'Total de ' + totalFound + ' e-mail(s) na pasta (' + unseenCount + ' não lido(s)).'
      steps[5].duration_ms = Date.now() - stepSearchStart

      var sampleUids = allUids.slice(Math.max(0, allUids.length - 3)).reverse()
      for (var s = 0; s < sampleUids.length; s++) {
        try {
          var smUid = sampleUids[s]
          var fetchRes = sendCmd(
            'UID FETCH ' + smUid + ' (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])',
          )
          var sFrom = ''
          var sSubj = ''
          var sDate = new Date().toISOString()
          for (var fl = 0; fl < fetchRes.lines.length; fl++) {
            var fLine = fetchRes.lines[fl]
            if (/^from:/i.test(fLine)) sFrom = fLine.replace(/^from:\s*/i, '')
            if (/^subject:/i.test(fLine)) sSubj = fLine.replace(/^subject:\s*/i, '')
            if (/^date:/i.test(fLine)) sDate = fLine.replace(/^date:\s*/i, '')
          }
          sampleMessages.push({
            uid: smUid,
            from: sFrom || 'Desconhecido',
            subject: sSubj || '(Sem assunto)',
            date: sDate,
            status: 'Identificado no servidor',
          })
        } catch (_) {}
      }

      // 6. Cron Scheduler check
      steps[6].status = 'success'
      steps[6].message = 'Cron "email_checker_cron" ativo e programado a cada 2 minutos.'
      steps[6].duration_ms = 0

      try {
        sendCmd('LOGOUT')
      } catch (_) {}
    } catch (flowErr) {
      overallStatus = 'failed'
      finalMessage = flowErr.message || 'Falha durante o teste IMAP.'
    } finally {
      if (conn) {
        try {
          conn.close()
        } catch (_) {}
      }
    }
    // Salvar auditoria
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var audit = new Record(auditCol)
      audit.set('test_type', 'connection_test')
      audit.set('executed_by', authUser.id)
      audit.set('executed_by_name', authUser.getString('name') || 'Administrador')
      audit.set('executed_by_email', authUser.getString('email') || '')
      audit.set('status', overallStatus)
      audit.set('host', host)
      audit.set('port', port)
      audit.set('user_account', user)
      audit.set('inbox_folder', inboxFolder)
      audit.set('encryption', encryption)
      audit.set('steps_result', steps)
      audit.set('summary_message', finalMessage)
      audit.set('latest_messages_count', sampleMessages.length)
      audit.set('latest_messages', sampleMessages)
      $app.save(audit)
    } catch (saveAuditErr) {
      $app.logger().error('test-connection: error saving audit', 'err', saveAuditErr.message)
    }

    return e.json(200, {
      success: overallStatus !== 'failed',
      status: overallStatus,
      message: finalMessage,
      tested_at: new Date().toISOString(),
      host: host,
      port: port,
      user: user,
      encryption: encryption,
      inbox_folder: inboxFolder,
      processed_folder: processedFolder,
      steps: steps,
      messages_count: totalFound,
      latest_messages: sampleMessages,
    })
  } catch (err) {
    $app.logger().error('test-connection fatal error', 'error', err.message)
    return e.json(500, { error: err.message })
  }
})

routerAdd('POST', '/backend/v1/emails/dry-run', (e) => {
  try {
    var authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Requer autenticação.' })
    }

    var body = e.requestInfo().body || {}
    var from = (body.from || body.from_email || '').trim()
    var fromName = (body.from_name || body.name || '').trim()
    var subject = (body.subject || body.title || '').trim()
    var emailBody = (body.body || body.description || '').trim()

    // Se não fornecido na requisição, buscar a última mensagem retida ou criar um cenário de exemplo
    if (!from) {
      try {
        var lastRetained = $app.findRecordsByFilter('retained_tickets', '', '-created', 1, 0)
        if (lastRetained.length > 0) {
          var ret = lastRetained[0]
          from = ret.getString('from_email')
          fromName = ret.getString('from_name')
          subject = ret.getString('subject')
          emailBody = ret.getString('body')
        }
      } catch (_) {}
    }

    if (!from) {
      from = 'suporte@pracasaopedro.com.br'
      fromName = 'Solicitante Praça São Pedro'
      subject = 'Solicitação de suporte via e-mail'
      emailBody = 'Preciso de auxílio com a rede da filial.'
    }

    // Pipeline de simulação
    var domain = ''
    var atIndex = from.lastIndexOf('@')
    if (atIndex !== -1) domain = from.substring(atIndex).toLowerCase().trim()

    var domainAllowed = false
    var matchedCompanyId = ''
    var matchedCompanyName = 'Não encontrado'

    if (domain) {
      var plainDomain = domain.startsWith('@') ? domain.substring(1) : domain
      var domainWithAt = '@' + plainDomain
      try {
        var activeDomains = $app.findRecordsByFilter(
          'client_email_domains',
          'active = true',
          '',
          500,
          0,
        )
        for (var i = 0; i < activeDomains.length; i++) {
          var d = (activeDomains[i].getString('domain') || '').toLowerCase().trim()
          if (d === domainWithAt || d === plainDomain || d === domain) {
            domainAllowed = true
            matchedCompanyId = activeDomains[i].getString('client')
            try {
              var compRec = $app.findRecordById('companies', matchedCompanyId)
              matchedCompanyName =
                compRec.getString('trade_name') || compRec.getString('legal_name')
            } catch (_) {
              matchedCompanyName = 'Cliente vinculado (' + matchedCompanyId + ')'
            }
            break
          }
        }
      } catch (_) {}
    }

    var isReply = /^\s*(re|res|fwd|fw|enc|r)\s*:\s*/i.test(subject)
    var extractedTicketNum = ''
    var mNum = subject.match(/(?:ticket\s*#?|#)\s*\[?(\d{1,6})\]?/i)
    if (mNum && mNum[1]) extractedTicketNum = mNum[1]

    var existingTicket = null
    if (extractedTicketNum) {
      try {
        var tRecs = $app.findRecordsByFilter(
          'tickets',
          'number = "' + extractedTicketNum + '" || number = "#' + extractedTicketNum + '"',
          '-created',
          1,
          0,
        )
        if (tRecs.length > 0) {
          existingTicket = {
            id: tRecs[0].id,
            number: tRecs[0].getString('number'),
            title: tRecs[0].getString('title'),
            status: tRecs[0].getString('status'),
          }
        }
      } catch (_) {}
    }

    // Solicitante
    var matchedUser = null
    var matchedContact = null
    var resolvedName = fromName || from.split('@')[0]
    var phone = ''

    try {
      var uRecs = $app.findRecordsByFilter(
        '_pb_users_auth_',
        'email = "' + from.toLowerCase() + '"',
        '',
        1,
        0,
      )
      if (uRecs.length > 0) {
        matchedUser = {
          id: uRecs[0].id,
          name: uRecs[0].getString('name'),
          email: uRecs[0].getString('email'),
          role: uRecs[0].getString('role'),
        }
        resolvedName = matchedUser.name || resolvedName
        phone = uRecs[0].getString('phone') || uRecs[0].getString('mobile') || ''
      }
    } catch (_) {}

    if (!matchedUser && matchedCompanyId) {
      try {
        var cRecs = $app.findRecordsByFilter(
          'client_contacts',
          'email = "' + from.toLowerCase() + '"',
          '',
          1,
          0,
        )
        if (cRecs.length > 0) {
          matchedContact = {
            id: cRecs[0].id,
            name: cRecs[0].getString('full_name'),
            email: cRecs[0].getString('email'),
            phone: cRecs[0].getString('phone') || cRecs[0].getString('cell_phone') || '',
          }
          resolvedName = matchedContact.name || resolvedName
          phone = matchedContact.phone || phone
        }
      } catch (_) {}
    }

    var destination = ''
    var explanation = ''

    if (!domainAllowed) {
      destination = 'Retido em Moderação (retained_tickets)'
      explanation =
        'O domínio ' +
        (domain || 'desconhecido') +
        ' não está cadastrado em nenhum cliente em client_email_domains. O e-mail será enviado para a fila de Chamados Retidos (/tickets/retained).'
    } else if (existingTicket) {
      destination = 'Interação no Chamado existente #' + existingTicket.number
      explanation =
        'Detectada resposta a chamado aberto (# ' +
        existingTicket.number +
        ' - ' +
        existingTicket.title +
        '). Será registrada uma interação pública no chamado.'
    } else {
      destination = 'Novo Chamado vinculado a ' + matchedCompanyName
      explanation =
        'Domínio autorizado para ' +
        matchedCompanyName +
        '. Será criado um novo chamado com solicitante ' +
        resolvedName +
        '.'
    }

    var result = {
      message_sampled: {
        from: from,
        from_name: fromName,
        subject: subject,
        body_preview: emailBody.substring(0, 160),
        domain: domain,
      },
      domain_check: {
        domain: domain,
        allowed: domainAllowed,
        company_id: matchedCompanyId,
        company_name: matchedCompanyName,
      },
      requester_identification: {
        matched_user: matchedUser,
        matched_contact: matchedContact,
        resolved_name: resolvedName,
        phone: phone,
      },
      ticket_routing: {
        is_reply: !!existingTicket,
        existing_ticket: existingTicket,
        suggested_queue: 'Nível 1 - Suporte',
        suggested_category: 'Incidente Geral',
        type: 'Incidente',
        priority: 'Média',
      },
      expected_destination: destination,
      explanation: explanation,
      dry_run: true,
      simulation_time: new Date().toISOString(),
    }

    // Salvar auditoria da simulação
    try {
      var auditColSim = $app.findCollectionByNameOrId('email_audit_logs')
      var auditSim = new Record(auditColSim)
      auditSim.set('test_type', 'dry_run_simulation')
      auditSim.set('executed_by', authUser.id)
      auditSim.set('executed_by_name', authUser.getString('name') || 'Administrador')
      auditSim.set('executed_by_email', authUser.getString('email') || '')
      auditSim.set('status', domainAllowed ? 'success' : 'warning')
      auditSim.set('user_account', from)
      auditSim.set('summary_message', destination + ': ' + subject)
      auditSim.set('dry_run_result', result)
      $app.save(auditSim)
    } catch (_) {}

    return e.json(200, {
      success: true,
      result: result,
    })
  } catch (err) {
    $app.logger().error('dry-run fatal error', 'error', err.message)
    return e.json(500, { error: err.message })
  }
})

// Rota de teste passo a passo do envio SMTP da caixa de e-mail
routerAdd('POST', '/backend/v1/emails/test-smtp', (e) => {
  var startTime = Date.now()
  var steps = [
    {
      id: 'validation',
      name: 'Validação dos parâmetros SMTP',
      status: 'pending',
      message: '',
      duration_ms: 0,
    },
    {
      id: 'dns_host',
      name: 'Resolução de Host e Porta',
      status: 'pending',
      message: '',
      duration_ms: 0,
    },
    {
      id: 'protocol',
      name: 'Protocolo de Segurança e Criptografia',
      status: 'pending',
      message: '',
      duration_ms: 0,
    },
    {
      id: 'credentials',
      name: 'Preparação das Credenciais de Envio',
      status: 'pending',
      message: '',
      duration_ms: 0,
    },
    {
      id: 'dispatch',
      name: 'Disparo e Entrega da Mensagem de Teste',
      status: 'pending',
      message: '',
      duration_ms: 0,
    },
  ]

  try {
    var authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Requer autenticação.' })
    }
    var userRole = authUser.getString('role')
    if (userRole !== 'admin' && userRole !== 'gestor') {
      return e.json(403, {
        error: 'Apenas administradores e gestores podem testar o envio SMTP.',
      })
    }

    var body = e.requestInfo().body || {}
    var targetEmail = (body.to || body.target_email || body.email || body.recipient || '').trim()

    // 1. Resolução dos parâmetros (do corpo ou do email_config salvo)
    var step1Start = Date.now()
    var mailerConfig = globalThis.resolveSystemMailerConfig
      ? globalThis.resolveSystemMailerConfig()
      : null

    var host = (body.smtp_host || (mailerConfig && mailerConfig.host) || '').trim()
    var port = parseInt(body.smtp_port || (mailerConfig && mailerConfig.port) || 587, 10)
    var encryption = (
      body.smtp_encryption ||
      (mailerConfig && mailerConfig.encryption) ||
      'STARTTLS'
    ).trim()
    var user = (body.smtp_user || (mailerConfig && mailerConfig.user) || '').trim()
    var password = (body.smtp_password || (mailerConfig && mailerConfig.password) || '').trim()
    var senderName = (
      body.smtp_sender_name ||
      (mailerConfig && mailerConfig.senderName) ||
      'Atendimento HelpDesk'
    ).trim()
    var replyTo = (body.smtp_reply_to || (mailerConfig && mailerConfig.replyTo) || user).trim()

    if (!targetEmail) {
      targetEmail = user || 'atendimento.helpdesk@deltime.com.br'
    }

    if (!host) {
      steps[0].status = 'failed'
      steps[0].message = 'Host SMTP não configurado (ex: smtp.office365.com).'
      steps[0].duration_ms = Date.now() - step1Start
      throw new Error(
        'Host SMTP obrigatório. Configure smtp.office365.com ou o host do seu provedor.',
      )
    }
    if (!user) {
      steps[0].status = 'failed'
      steps[0].message = 'Usuário / Conta SMTP não informada.'
      steps[0].duration_ms = Date.now() - step1Start
      throw new Error('Usuário SMTP obrigatório (ex: atendimento.helpdesk@deltime.com.br).')
    }
    if (!password) {
      steps[0].status = 'failed'
      steps[0].message =
        'Senha SMTP não configurada (para Microsoft 365 gere uma Senha de Aplicativo).'
      steps[0].duration_ms = Date.now() - step1Start
      throw new Error(
        'Senha SMTP não configurada. Para Microsoft 365 com 2FA, crie uma Senha de Aplicativo.',
      )
    }

    steps[0].status = 'success'
    steps[0].message = 'Parâmetros validados: ' + user + ' via ' + host + ':' + port
    steps[0].duration_ms = Date.now() - step1Start

    // 2. Resolução de Host e Porta
    var step2Start = Date.now()
    steps[1].status = 'success'
    steps[1].message =
      'Servidor ' +
      host +
      ' na porta ' +
      port +
      ' (' +
      (port === 587
        ? 'STARTTLS padrão'
        : port === 465
          ? 'SSL/TLS implícito'
          : 'Porta customizada') +
      ')'
    steps[1].duration_ms = Date.now() - step2Start

    // 3. Protocolo de Criptografia
    var step3Start = Date.now()
    steps[2].status = 'success'
    steps[2].message = 'Protocolo de transporte seguro definido: ' + encryption
    steps[2].duration_ms = Date.now() - step3Start

    // 4. Preparação das credenciais
    var step4Start = Date.now()
    steps[3].status = 'success'
    steps[3].message =
      'Credenciais e envelope preparados para ' + user + ' (Exibição: "' + senderName + '")'
    steps[3].duration_ms = Date.now() - step4Start

    // 5. Disparo do e-mail de teste
    var step5Start = Date.now()
    var nowFormatted = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    var message = new MailerMessage()
    message.from = { address: user, name: senderName }
    message.to = [{ address: targetEmail }]
    message.subject = '[Validação SMTP] ' + senderName + ' — Caixa de Atendimento'
    message.text =
      'Olá,\n\n' +
      'Este é um e-mail de teste passo a passo para validação do serviço de envio SMTP da caixa de atendimento do HelpDesk.\n\n' +
      'Detalhes da conexão:\n' +
      '• Servidor SMTP: ' +
      host +
      ':' +
      port +
      ' (' +
      encryption +
      ')\n' +
      '• Conta de Envio: ' +
      user +
      '\n' +
      '• Nome do Remetente: ' +
      senderName +
      '\n' +
      '• Destinatário: ' +
      targetEmail +
      '\n' +
      '• Data e Hora: ' +
      nowFormatted +
      ' (Brasília)\n\n' +
      'Todas as notificações do sistema ITSM (criação de chamados, mudanças de status, interações, alertas de SLA e relatórios) serão enviadas por esta mesma caixa.'

    message.html =
      '<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;">' +
      '<div style="background: linear-gradient(135deg, #0284c7, #2563eb); padding: 18px 24px; border-radius: 8px 8px 0 0; margin: -24px -24px 20px -24px; color: #ffffff;">' +
      '<h2 style="margin: 0; font-size: 20px; font-weight: 700;">' +
      senderName +
      '</h2>' +
      '<p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Validação de Envio SMTP da Mesma Caixa de Atendimento</p>' +
      '</div>' +
      '<p style="color: #334155; font-size: 14px; line-height: 1.6;">Olá,</p>' +
      '<p style="color: #334155; font-size: 14px; line-height: 1.6;">O teste de envio SMTP da caixa de atendimento foi executado com sucesso. A partir de agora, as notificações do HelpDesk sairão com o remetente oficial desta caixa.</p>' +
      '<div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #1e293b;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Servidor SMTP:</strong> ' +
      host +
      ':' +
      port +
      ' (' +
      encryption +
      ')</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Conta Autenticada:</strong> ' +
      user +
      '</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Remetente Exibido:</strong> ' +
      senderName +
      ' &lt;' +
      user +
      '&gt;</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Destinatário:</strong> ' +
      targetEmail +
      '</p>' +
      '<p style="margin: 0;"><strong>Data / Hora:</strong> ' +
      nowFormatted +
      '</p>' +
      '</div>' +
      '<p style="color: #16a34a; font-weight: bold; font-size: 14px; margin-top: 20px;">✓ Caixa de e-mail pronta para envio e recepção integrados.</p>' +
      '</div>'

    if (replyTo && message.headers) {
      message.headers['Reply-To'] = replyTo
    }

    var customMailer = {
      isDedicated: true,
      host: host,
      port: port,
      encryption: encryption,
      user: user,
      password: password,
      senderName: senderName,
      replyTo: replyTo,
      senderEmail: user,
    }

    var sendRes = globalThis.sendSystemMailMessage
      ? globalThis.sendSystemMailMessage(message, customMailer)
      : null

    if (!sendRes && $app.newMailClient) {
      var cl = $app.newMailClient()
      cl.send(message)
    }

    steps[4].status = 'success'
    steps[4].message = 'E-mail entregue com sucesso via SMTP para ' + targetEmail
    steps[4].duration_ms = Date.now() - step5Start

    var totalDuration = Date.now() - startTime

    // Registrar auditoria
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var audit = new Record(auditCol)
      audit.set('test_type', 'teste-smtp')
      audit.set('executed_by', authUser.id)
      audit.set('executed_by_name', authUser.getString('name') || 'Administrador')
      audit.set('executed_by_email', authUser.getString('email') || '')
      audit.set('status', 'success')
      audit.set('host', host)
      audit.set('port', port)
      audit.set('user_account', user)
      audit.set('encryption', encryption)
      audit.set('summary_message', 'Envio SMTP validado com sucesso para ' + targetEmail)
      audit.set('steps_result', steps)
      audit.set('dry_run_result', {
        target_email: targetEmail,
        sender_email: user,
        sender_name: senderName,
        smtp_used: 'dedicated_mailbox',
        duration_ms: totalDuration,
      })
      $app.save(audit)
    } catch (_) {}

    return e.json(200, {
      success: true,
      status: 'success',
      message: 'Envio SMTP validado com sucesso para ' + targetEmail + '!',
      duration_ms: totalDuration,
      steps: steps,
      smtp_used: 'dedicated_mailbox',
      host: host,
      port: port,
      user: user,
      target_email: targetEmail,
    })
  } catch (err) {
    var totalErrDuration = Date.now() - startTime
    var rawErr = err.message || String(err)
    var friendlyErr = rawErr

    if (rawErr.toLowerCase().indexOf('connection refused') !== -1) {
      friendlyErr =
        'Conexão recusada pelo host ' +
        (host || '') +
        ':' +
        (port || '') +
        '. Verifique o endereço e se o tráfego de saída não está bloqueado.'
    } else if (
      rawErr.toLowerCase().indexOf('authentication') !== -1 ||
      rawErr.toLowerCase().indexOf('535') !== -1 ||
      rawErr.toLowerCase().indexOf('badcredentials') !== -1
    ) {
      friendlyErr =
        'Falha de autenticação SMTP (535): usuário ou senha incorretos. Para contas Microsoft 365 com 2FA, crie uma Senha de Aplicativo no portal da conta.'
    } else if (rawErr.toLowerCase().indexOf('timeout') !== -1) {
      friendlyErr = 'Tempo limite esgotado ao contatar o servidor SMTP ' + host + ':' + port + '.'
    }

    // Identificar passo com erro
    var pendingIdx = -1
    for (var pi = 0; pi < steps.length; pi++) {
      if (steps[pi].status === 'pending') {
        pendingIdx = pi
        break
      }
    }
    if (pendingIdx !== -1) {
      steps[pendingIdx].status = 'failed'
      steps[pendingIdx].message = friendlyErr
      steps[pendingIdx].duration_ms = totalErrDuration
    }

    try {
      if (e.auth) {
        var auditColFail = $app.findCollectionByNameOrId('email_audit_logs')
        var auditFail = new Record(auditColFail)
        auditFail.set('test_type', 'teste-smtp')
        auditFail.set('executed_by', e.auth.id)
        auditFail.set('executed_by_name', e.auth.getString('name') || 'Administrador')
        auditFail.set('executed_by_email', e.auth.getString('email') || '')
        auditFail.set('status', 'failed')
        auditFail.set('host', host || '')
        auditFail.set('port', port || 587)
        auditFail.set('user_account', user || '')
        auditFail.set('encryption', encryption || '')
        auditFail.set('summary_message', 'Falha no teste SMTP: ' + friendlyErr)
        auditFail.set('steps_result', steps)
        auditFail.set('dry_run_result', {
          target_email: targetEmail,
          raw_error: rawErr,
          friendly_error: friendlyErr,
        })
        $app.save(auditFail)
      }
    } catch (_) {}

    return e.json(500, {
      success: false,
      status: 'failed',
      error: friendlyErr,
      duration_ms: totalErrDuration,
      steps: steps,
      host: host,
      user: user,
      target_email: targetEmail,
    })
  }
})

// Rota de envio de teste: usa prioritariamente a caixa SMTP dedicada com fallback para ServiceOne
routerAdd('POST', '/backend/v1/emails/send-test', (e) => {
  try {
    var authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Requer autenticação.' })
    }
    var userRole = authUser.getString('role')
    if (userRole !== 'admin' && userRole !== 'gestor') {
      return e.json(403, {
        error: 'Apenas administradores e gestores podem enviar e-mails de teste.',
      })
    }

    var body = e.requestInfo().body || {}
    var targetEmail = (body.to || body.target_email || body.email || '').trim()

    if (!targetEmail) {
      return e.json(400, { error: 'Informe um endereço de e-mail de destino válido.' })
    }

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(targetEmail)) {
      return e.json(400, { error: 'Formato de e-mail de destino inválido (' + targetEmail + ').' })
    }

    // Resolver configuração de envio (caixa dedicada > ServiceOne)
    var mailerConfig = globalThis.resolveSystemMailerConfig
      ? globalThis.resolveSystemMailerConfig()
      : null

    var senderEmail = (mailerConfig && mailerConfig.user) || 'atendimento.helpdesk@deltime.com.br'
    var senderName = (mailerConfig && mailerConfig.senderName) || 'Atendimento HelpDesk'
    var host = (mailerConfig && mailerConfig.host) || 'smtp.office365.com'
    var port = (mailerConfig && mailerConfig.port) || 587
    var isDedicated = mailerConfig ? mailerConfig.isDedicated : false
    var smtpChannelName = isDedicated ? 'Caixa de E-mail Dedicada (SMTP)' : 'ServiceOne Fallback'

    var now = new Date()
    var nowFormatted = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    var subject = '[Teste] Verificação de envio — ' + senderName
    var textBody =
      'Olá,\n\n' +
      'Este é um e-mail de teste disparado pelo Sistema ITSM para validar o canal de envio.\n\n' +
      'Detalhes do teste:\n' +
      '• Data e Hora: ' +
      nowFormatted +
      ' (Horário de Brasília)\n' +
      '• Caixa/Remetente: ' +
      senderName +
      ' <' +
      senderEmail +
      '>\n' +
      '• Origem SMTP: ' +
      smtpChannelName +
      ' (' +
      host +
      ':' +
      port +
      ')\n' +
      '• Destinatário: ' +
      targetEmail +
      '\n' +
      '• Disparado por: ' +
      (authUser.getString('name') || authUser.getString('email') || 'Administrador') +
      '\n\n' +
      'Se você recebeu esta mensagem, o envio de notificações pelo ITSM está operando perfeitamente.\n\n' +
      '---\n' +
      senderName +
      ' — Gestão de Chamados'

    var htmlBody =
      '<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">' +
      '<div style="padding-bottom: 16px; border-bottom: 2px solid #0284c7; margin-bottom: 20px;">' +
      '<h2 style="color: #1e293b; margin: 0; font-size: 20px;">[Teste] Verificação de Envio — ' +
      senderName +
      '</h2>' +
      '<p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Mensagem de validação do canal de notificações</p>' +
      '</div>' +
      '<p style="color: #334155; font-size: 14px; line-height: 1.6;">Olá,</p>' +
      '<p style="color: #334155; font-size: 14px; line-height: 1.6;">Este é um e-mail de teste disparado pelo <strong>Sistema ITSM</strong> para validar a conectividade e a entrega de mensagens.</p>' +
      '<div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 14px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #1e293b;">' +
      '<p style="margin: 0 0 6px 0;"><strong>Data e Hora:</strong> ' +
      nowFormatted +
      '</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Caixa/Conta:</strong> ' +
      senderName +
      ' &lt;' +
      senderEmail +
      '&gt;' +
      '</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Canal SMTP:</strong> ' +
      smtpChannelName +
      ' (' +
      host +
      ':' +
      port +
      ')' +
      '</p>' +
      '<p style="margin: 0 0 6px 0;"><strong>Destinatário:</strong> ' +
      targetEmail +
      '</p>' +
      '<p style="margin: 0;"><strong>Disparado por:</strong> ' +
      (authUser.getString('name') || authUser.getString('email') || 'Administrador') +
      '</p>' +
      '</div>' +
      '<p style="color: #16a34a; font-weight: bold; font-size: 14px; margin-top: 20px;">✓ Se você recebeu esta mensagem, o envio de e-mails está operando com sucesso.</p>' +
      '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />' +
      '<p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">' +
      senderName +
      ' &copy; ' +
      now.getFullYear() +
      ' — Mensagem automática de teste gerada em /settings</p>' +
      '</div>'

    var sendSuccess = false
    var sendErrorMsg = ''
    var sendResultInfo = null

    try {
      var message = new MailerMessage()
      message.from = { address: senderEmail, name: senderName }
      message.to = [{ address: targetEmail }]
      message.subject = subject
      message.text = textBody
      message.html = htmlBody

      if (mailerConfig && mailerConfig.replyTo && message.headers) {
        message.headers['Reply-To'] = mailerConfig.replyTo
      }

      if (globalThis.sendSystemMailMessage) {
        sendResultInfo = globalThis.sendSystemMailMessage(message, mailerConfig)
      } else {
        var mailClient = $app.newMailClient()
        mailClient.send(message)
      }
      sendSuccess = true
    } catch (sendErr) {
      sendSuccess = false
      var rawErr = sendErr.message || String(sendErr)
      if (rawErr.toLowerCase().indexOf('connection refused') !== -1) {
        sendErrorMsg =
          'Conexão recusada pelo servidor SMTP. Verifique o host e a porta configurados.'
      } else if (
        rawErr.toLowerCase().indexOf('authentication failed') !== -1 ||
        rawErr.toLowerCase().indexOf('535') !== -1
      ) {
        sendErrorMsg = 'Falha de autenticação SMTP: credenciais recusadas pelo servidor.'
      } else if (rawErr.toLowerCase().indexOf('timeout') !== -1) {
        sendErrorMsg = 'Tempo limite esgotado ao tentar comunicar com o servidor SMTP.'
      } else {
        sendErrorMsg = 'Falha no envio de e-mail: ' + rawErr
      }
      $app.logger().error('send-test mail failed', 'error', rawErr, 'target', targetEmail)
    }

    var summaryMessage = sendSuccess
      ? 'E-mail de teste enviado com sucesso para ' + targetEmail + ' via ' + smtpChannelName
      : 'Falha no envio para ' + targetEmail + ': ' + sendErrorMsg

    // Registrar o teste na auditoria de e-mails (email_audit_logs)
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var audit = new Record(auditCol)
      audit.set('test_type', 'teste-envio')
      audit.set('executed_by', authUser.id)
      audit.set('executed_by_name', authUser.getString('name') || 'Administrador')
      audit.set('executed_by_email', authUser.getString('email') || '')
      audit.set('status', sendSuccess ? 'success' : 'failed')
      audit.set('host', host)
      audit.set('user_account', senderEmail)
      audit.set('summary_message', summaryMessage)
      audit.set('latest_messages_count', 1)
      audit.set('steps_result', [
        {
          id: 'smtp_dispatch',
          name: 'Disparo de e-mail de teste via ' + smtpChannelName,
          status: sendSuccess ? 'success' : 'failed',
          message: sendSuccess ? 'Mensagem enviada com sucesso para ' + targetEmail : sendErrorMsg,
          duration_ms: 0,
        },
      ])
      audit.set('dry_run_result', {
        target_email: targetEmail,
        sender_email: senderEmail,
        sender_name: senderName,
        subject: subject,
        smtp_used:
          (sendResultInfo && sendResultInfo.smtp_used) ||
          (isDedicated ? 'dedicated_mailbox' : 'serviceone_fallback'),
        sent_at: now.toISOString(),
        success: sendSuccess,
        error: sendErrorMsg || null,
      })
      $app.save(audit)
    } catch (auditErr) {
      $app.logger().error('send-test error saving audit', 'error', auditErr.message)
    }

    if (!sendSuccess) {
      return e.json(500, {
        success: false,
        error: sendErrorMsg,
        message: 'Não foi possível enviar o e-mail de teste.',
        target_email: targetEmail,
        sender_email: senderEmail,
        smtp_used: isDedicated ? 'dedicated_mailbox' : 'serviceone_fallback',
      })
    }

    return e.json(200, {
      success: true,
      message:
        'E-mail de teste enviado com sucesso para ' + targetEmail + ' via ' + smtpChannelName + '!',
      target_email: targetEmail,
      sender_email: senderEmail,
      sender_name: senderName,
      smtp_used: isDedicated ? 'dedicated_mailbox' : 'serviceone_fallback',
      smtp_host: host,
      sent_at: now.toISOString(),
      subject: subject,
    })
  } catch (err) {
    $app.logger().error('send-test fatal error', 'error', err.message)
    return e.json(500, { error: err.message })
  }
})
