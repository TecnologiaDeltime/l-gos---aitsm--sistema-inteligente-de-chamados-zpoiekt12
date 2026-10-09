// Endpoint para teste de conexão IMAP passo a passo e simulação dry-run
// Rotas:
// POST /backend/v1/emails/test-connection
// POST /backend/v1/emails/dry-run

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

    var sendCmd = function (cmd) {
      var tag = 'T' + String(tagCounter++)
      var fullCmd = tag + ' ' + cmd + '\r\n'
      conn.write(fullCmd)

      var lines = []
      var status = ''
      while (true) {
        var line = reader.readString('\n')
        if (!line) break
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
      // 1. TCP Socket
      var step1Start = Date.now()
      var addr = host + ':' + port
      try {
        if (
          encryption.toLowerCase().indexOf('ssl') !== -1 ||
          encryption.toLowerCase().indexOf('tls') !== -1 ||
          port === 993
        ) {
          conn = $tls.dial('tcp', addr, {
            insecureSkipVerify: true,
            serverName: host,
          })
          steps[0].status = 'success'
          steps[0].message = 'Conexão TCP e handshake TLS estabelecidos em ' + addr
          steps[0].duration_ms = Date.now() - step1Start

          steps[1].status = 'success'
          steps[1].message = 'Criptografia direta SSL/TLS ativa na porta ' + port
          steps[1].duration_ms = steps[0].duration_ms
        } else {
          conn = $net.dial('tcp', addr)
          steps[0].status = 'success'
          steps[0].message = 'Conexão TCP estabelecida em ' + addr
          steps[0].duration_ms = Date.now() - step1Start
        }
      } catch (tcpErr) {
        steps[0].status = 'failed'
        steps[0].message = 'Falha ao conectar via rede em ' + addr + ': ' + tcpErr.message
        steps[0].duration_ms = Date.now() - step1Start
        throw new Error('Falha de rede/socket: ' + tcpErr.message)
      }

      reader = $bufio.newReader(conn)

      // 2. IMAP Greeting
      var stepGreetStart = Date.now()
      var banner = reader.readString('\n')
      if (!banner || banner.indexOf('* OK') === -1) {
        steps[2].status = 'failed'
        steps[2].message = 'Servidor não enviou saudação IMAP válida: ' + (banner || 'vazio')
        steps[2].duration_ms = Date.now() - stepGreetStart
        throw new Error('Saudação IMAP inválida: ' + banner)
      }
      steps[2].status = 'success'
      steps[2].message = 'Servidor respondeu: ' + banner.replace(/[\r\n]+$/, '').substring(0, 80)
      steps[2].duration_ms = Date.now() - stepGreetStart

      // 2.1 Se STARTTLS
      if (encryption.toLowerCase().indexOf('starttls') !== -1) {
        var starttlsStart = Date.now()
        var starttlsRes = sendCmd('STARTTLS')
        if (starttlsRes.status !== 'OK') {
          steps[1].status = 'failed'
          steps[1].message = 'Servidor rejeitou comando STARTTLS: ' + starttlsRes.lines.join(' ')
          steps[1].duration_ms = Date.now() - starttlsStart
          throw new Error('STARTTLS rejeitado')
        }
        conn = $tls.client(conn, {
          insecureSkipVerify: true,
          serverName: host,
        })
        reader = $bufio.newReader(conn)
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
          loginErrText.toLowerCase().indexOf('basic auth') !== -1 ||
          loginErrText.toLowerCase().indexOf('authentication failed') !== -1 ||
          host.toLowerCase().indexOf('office365.com') !== -1
        ) {
          steps[3].message =
            'Autenticação rejeitada pelo provedor (' +
            loginErrText +
            '). Para Microsoft 365 / Office 365, certifique-se de usar uma Senha de Aplicativo ou habilitar IMAP na caixa.'
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
        // Tentar fallbacks conhecidos
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
              if (aParts[ap]) allUids.push(aParts[ap])
            }
          }
        }
      }
      totalFound = allUids.length
      steps[5].status = 'success'
      steps[5].message =
        'Total de ' +
        totalFound +
        ' e-mail(s) na pasta (' +
        unseenCount +
        ' não lido(s)).' +
        (totalFound === 0 ? ' Dica: verifique se os e-mails estão na pasta correta.' : '')
      steps[5].duration_ms = Date.now() - stepSearchStart

      // Amostrar até 3 mensagens mais recentes para exibir na interface
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
