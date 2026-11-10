// Gatilho imediato de e-mail na abertura de chamado para o cliente e colaboradores vinculados
//
// Requisito do usuário:
// "Todos os colaboradores cadastrados possuem e-mail cadastrado, e cada um deles devem
// receber notificação de abertura de chamado quando abrir um chamado. Usar o e-mail
// transacional do Skip para todas as notificações."
//
// Comportamento:
// 1. Resolução robusta de e-mail e nome do solicitante:
//    - ticket.requester_email / ticket.requester_name
//    - fallback para e.auth (usuário autenticado criador)
//    - fallback para busca na coleção client_contacts por nome aproximado na mesma empresa
//    - fallback para busca na coleção users vinculada à empresa ou criador
// 2. Coleta de colaboradores cadastrados com e-mail vinculados ao chamado:
//    - participantes explícitos (ticket.participants) se preenchidos
//    - colaboradores/contatos da empresa do chamado marcados como ponto focal ou vinculados
// 3. Respeita o interruptor da Central de Alertas por E-mail (chave 'ticket_created').
//    Se desligado na Central, registra no log o motivo exato.
// 4. Se a Central de Alertas falhar ou não estiver disponível, executa fallback seguro
//    via sendSystemEmail / itsmSendWithAudit / $app.newMailClient.
// 5. Anti-duplicidade estrita por (alert_key, ticket_id, recipient).
// 6. Registro completo de logs explicativos para auditoria clara.

onRecordAfterCreateSuccess((e) => {
  var ticket = e.record
  if (!ticket) return e.next()

  try {
    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Chamado sem título'
    var ticketDescription = ticket.getString('description') || ''
    var companyId = ticket.getString('company')

    // 1. Verifica configuração herdada de notificação do cliente (client_notification_settings)
    // Se explicitamente configurado como notify_ticket_created === false para a empresa,
    // registra e honra o desejo do cliente.
    try {
      var clientSettingsRec = null
      if (companyId) {
        try {
          clientSettingsRec = $app.findFirstRecordByFilter(
            'client_notification_settings',
            'company = "' + companyId + '"',
          )
        } catch (_) {}
      }

      if (!clientSettingsRec) {
        try {
          clientSettingsRec = $app.findFirstRecordByFilter(
            'client_notification_settings',
            'scope = "global"',
          )
        } catch (_) {}
      }

      if (clientSettingsRec && clientSettingsRec.getBool('notify_ticket_created') === false) {
        $app
          .logger()
          .info(
            'ticket_created_client_email: notificação suprimida por client_notification_settings (chamado #' +
              ticketNumber +
              ')',
          )
        return e.next()
      }
    } catch (_) {}

    // 2. Resolução do Solicitante Principal (e-mail e nome)
    var primaryEmail = (ticket.getString('requester_email') || '').trim()
    var primaryName = (ticket.getString('requester_name') || '').trim()

    // Fallback 1: se vazio, tenta obter pelo usuário autenticado na requisição
    if (!primaryEmail && e.auth && typeof e.auth.getString === 'function') {
      primaryEmail = (e.auth.getString('email') || '').trim()
      if (!primaryName) {
        primaryName = (e.auth.getString('name') || '').trim()
      }
    }

    // Fallback 2: se ainda vazio e houver requester_name, busca em client_contacts pelo nome na empresa
    if (!primaryEmail && primaryName && companyId) {
      try {
        var safeName = primaryName.replace(/"/g, '\\"')
        var contactByName = $app.findFirstRecordByFilter(
          'client_contacts',
          'client = "' + companyId + '" && full_name ~ "' + safeName + '"',
        )
        if (contactByName && contactByName.getString('email')) {
          primaryEmail = contactByName.getString('email').trim()
          $app
            .logger()
            .info(
              'ticket_created_client_email: e-mail do solicitante resolvido via client_contacts (' +
                primaryEmail +
                ') para o chamado #' +
                ticketNumber,
            )
        }
      } catch (_) {}
    }

    // Fallback 3: se houver requester_phone e company, tenta casar com client_contacts
    var reqPhone = (ticket.getString('requester_phone') || '').trim()
    if (!primaryEmail && reqPhone && companyId) {
      try {
        var digitsOnly = reqPhone.replace(/\D/g, '')
        if (digitsOnly.length >= 8) {
          var contactByPhone = $app.findFirstRecordByFilter(
            'client_contacts',
            'client = "' +
              companyId +
              '" && (cell_phone ~ "' +
              digitsOnly +
              '" || phone ~ "' +
              digitsOnly +
              '")',
          )
          if (contactByPhone && contactByPhone.getString('email')) {
            primaryEmail = contactByPhone.getString('email').trim()
            if (!primaryName) primaryName = contactByPhone.getString('full_name').trim()
            $app
              .logger()
              .info(
                'ticket_created_client_email: e-mail resolvido via telefone do contato (' +
                  primaryEmail +
                  ') para o chamado #' +
                  ticketNumber,
              )
          }
        }
      } catch (_) {}
    }

    // Fallback 4: se ainda vazio, busca se o usuário criador é um contato vinculado da empresa
    if (!primaryEmail && companyId) {
      try {
        var focalContact = $app.findFirstRecordByFilter(
          'client_contacts',
          'client = "' + companyId + '" && is_focal_point = true && email != ""',
        )
        if (focalContact && focalContact.getString('email')) {
          primaryEmail = focalContact.getString('email').trim()
          if (!primaryName) primaryName = focalContact.getString('full_name').trim()
          $app
            .logger()
            .info(
              'ticket_created_client_email: e-mail resolvido via ponto focal da empresa (' +
                primaryEmail +
                ') para o chamado #' +
                ticketNumber,
            )
        }
      } catch (_) {}
    }

    if (!primaryName) {
      primaryName = 'Solicitante'
    }

    // 3. Montar lista de destinatários com deduplicação:
    //    - Solicitante principal
    //    - Colaboradores listados no campo participants do ticket (se contiver e-mails ou ids de usuários)
    var recipientsList = []
    var seenRecipients = {}

    function addRecipient(emailStr, label) {
      if (!emailStr) return
      var clean = String(emailStr).trim().toLowerCase()
      if (clean && clean.indexOf('@') > 0 && !seenRecipients[clean]) {
        seenRecipients[clean] = true
        recipientsList.push(clean)
        if (label) {
          $app
            .logger()
            .debug('ticket_created_client_email: destinatário adicionado (' + label + '): ' + clean)
        }
      }
    }

    if (primaryEmail) {
      addRecipient(primaryEmail, 'solicitante principal')
    }

    // Processa participantes extras do chamado caso existam
    try {
      var parts = ticket.get('participants')
      if (Array.isArray(parts) && parts.length > 0) {
        for (var pIdx = 0; pIdx < parts.length; pIdx++) {
          var pItem = parts[pIdx]
          if (typeof pItem === 'string') {
            if (pItem.indexOf('@') > 0) {
              addRecipient(pItem, 'participante e-mail')
            } else {
              // Tenta carregar como ID de usuário
              try {
                var uRec = $app.findRecordById('users', pItem)
                if (uRec && uRec.getString('email')) {
                  addRecipient(
                    uRec.getString('email'),
                    'participante usuário ' + uRec.getString('name'),
                  )
                }
              } catch (_) {}
            }
          } else if (pItem && typeof pItem === 'object') {
            var itemEmail = pItem.email || pItem.userEmail || pItem.address
            if (itemEmail) addRecipient(itemEmail, 'participante objeto')
          }
        }
      }
    } catch (_) {}

    // Se nenhum destinatário com e-mail foi encontrado, registra explicitamente no log
    if (recipientsList.length === 0) {
      $app
        .logger()
        .warn(
          'ticket_created_client_email: chamado #' +
            ticketNumber +
            ' criado, mas nenhum e-mail de solicitante ou colaborador foi localizado; notificação não enviada.',
          'ticket_id',
          ticket.id,
          'company_id',
          companyId,
          'requester_name',
          primaryName,
        )
      return e.next()
    }

    // 4. Limpeza da descrição e formatação de dados para interpolação
    var cleanDescription = ticketDescription
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleanDescription.length > 500) {
      cleanDescription = cleanDescription.substring(0, 497) + '...'
    }
    if (!cleanDescription) {
      cleanDescription = ticketTitle
    }

    var createdRaw = ticket.getString('created')
    var createdDate = createdRaw ? new Date(createdRaw) : new Date()
    var dateFormatted =
      ('0' + createdDate.getDate()).slice(-2) +
      '/' +
      ('0' + (createdDate.getMonth() + 1)).slice(-2) +
      '/' +
      createdDate.getFullYear() +
      ' às ' +
      ('0' + createdDate.getHours()).slice(-2) +
      ':' +
      ('0' + createdDate.getMinutes()).slice(-2)

    var priority = ticket.getString('priority') || 'Média'
    var type = ticket.getString('type') || 'Incidente'

    // Nome da empresa do cliente
    var companyName = ''
    if (companyId) {
      try {
        var comp = $app.findRecordById('companies', companyId)
        companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
      } catch (_) {}
    }

    // URL pública do chamado no portal do cliente
    var baseUrl = (function () {
      try {
        var host = $os.getenv('PUBLIC_URL') || $os.getenv('APP_URL') || ''
        if (host) return host.replace(/\/+$/, '')
      } catch (_) {}
      return ''
    })()
    var ticketLink = baseUrl ? baseUrl + '/portal/tickets/' + ticket.id : ''

    var templateData = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      descricao: cleanDescription,
      cliente: primaryName,
      solicitante: primaryName,
      prioridade: priority,
      tipo: type,
      data_abertura: dateFormatted,
      empresa: companyName,
      link: ticketLink,
    }

    // 5. Tenta enviar pela Central de Alertas por E-mail (sendSystemAlertEmail)
    // Respeita o switch de alerta (alerta 'ticket_created' ativo por padrão na migração 0148)
    var centralSuccess = false
    var centralFailureReason = ''
    if (typeof globalThis.sendSystemAlertEmail === 'function') {
      try {
        var alertResult = globalThis.sendSystemAlertEmail({
          alert_key: 'ticket_created',
          reference_id: ticket.id,
          recipients: recipientsList,
          subject: 'Chamado #' + ticketNumber + ' aberto com sucesso: ' + ticketTitle,
          data: templateData,
        })

        if (alertResult && alertResult.sent) {
          $app
            .logger()
            .info(
              'ticket_created_client_email: notificação enviada via Central de Alertas para ' +
                alertResult.sent_count +
                ' destinatário(s) (chamado #' +
                ticketNumber +
                ')',
              'recipients',
              recipientsList.join(', '),
            )
          return e.next()
        } else if (alertResult && alertResult.reason === 'alert_disabled_by_config') {
          $app
            .logger()
            .info(
              'ticket_created_client_email: envio suprimido pois o alerta ticket_created está DESLIGADO na Central de Alertas por E-mail.',
              'chamado',
              ticketNumber,
            )
          return e.next()
        } else if (alertResult && alertResult.reason === 'already_sent') {
          $app
            .logger()
            .info(
              'ticket_created_client_email: notificação de abertura já enviada anteriormente (anti-duplicidade) para chamado #' +
                ticketNumber,
            )
          return e.next()
        } else {
          centralFailureReason = alertResult ? alertResult.reason : 'resultado_indefinido'
          $app
            .logger()
            .warn(
              'ticket_created_client_email: Central de Alertas retornou status não-positivo, acionando fallback de envio.',
              'reason',
              centralFailureReason,
            )
        }
      } catch (centralErr) {
        centralFailureReason = 'exception: ' + centralErr.message
        $app
          .logger()
          .warn(
            'ticket_created_client_email: erro inesperado ao invocar sendSystemAlertEmail, acionando fallback.',
            'error',
            centralErr.message,
          )
      }
    } else {
      centralFailureReason = 'sendSystemAlertEmail_not_a_function'
      $app
        .logger()
        .warn(
          'ticket_created_client_email: globalThis.sendSystemAlertEmail indisponível, acionando fallback.',
        )
    }

    // 6. Fallback seguro: lê a configuração do template da Central para NUNCA ignorar personalização
    var cfg =
      typeof globalThis.getEmailAlertConfig === 'function'
        ? globalThis.getEmailAlertConfig('ticket_created')
        : null

    var subject = ''
    var htmlBody = ''
    var textBody = ''

    if (cfg) {
      // Se o alerta estiver explicitamente desligado na central de alertas, respeita e não envia
      if (cfg.enabled === false) {
        $app
          .logger()
          .info(
            'ticket_created_client_email: fallback interrompido pois alerta ticket_created está desligado nas configurações.',
            'chamado',
            ticketNumber,
          )
        return e.next()
      }

      var rawSubject =
        cfg.subject_template ||
        cfg.default_subject_template ||
        'Chamado #' + ticketNumber + ' aberto com sucesso: ' + ticketTitle

      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        subject = globalThis.interpolateEmailTemplate(rawSubject, templateData)
      } else {
        subject = rawSubject
      }

      if (typeof globalThis.buildEmailHtmlFromConfig === 'function') {
        htmlBody = globalThis.buildEmailHtmlFromConfig(cfg, templateData)
      }

      var rawBody = cfg.body_template || cfg.default_body_template || ''
      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        var interpolatedBody = globalThis.interpolateEmailTemplate(rawBody, templateData)
        textBody = interpolatedBody
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      } else {
        textBody = rawBody
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      $app
        .logger()
        .info(
          'ticket_created_client_email: fallback utilizando template configurado na Central de Alertas.',
          'alert_key',
          'ticket_created',
          'template_layout',
          cfg.template_layout || 'modern',
          'subject',
          subject,
          'central_failure_reason',
          centralFailureReason || 'none',
        )
    }

    // Se cfg for nulo ou falhou montar htmlBody, usa configuração padrão da Central processada por buildEmailHtmlFromConfig
    if (!htmlBody) {
      var factoryCfg = {
        alert_key: 'ticket_created',
        name: 'Chamado aberto',
        template_layout: 'corporate',
        primary_color: '#D97706',
        header_title: 'Lógos AITSM',
        header_subtitle: 'Atendimento & Central de Serviços',
        subject_template: 'Chamado #{{chamado_numero}} registrado com sucesso - {{titulo}}',
        body_template:
          '<p>Olá <strong>{{cliente}}</strong>,</p><p>Confirmamos o registro do seu chamado em nossa central. Ele já se encontra na fila de atendimento da equipe técnica.</p><div style="background-color: #f8fafc; border-left: 4px solid #D97706; padding: 12px 16px; margin: 16px 0; border-radius: 4px;"><p style="margin: 0 0 6px 0;"><strong>Número:</strong> #{{chamado_numero}}</p><p style="margin: 0 0 6px 0;"><strong>Assunto:</strong> {{titulo}}</p><p style="margin: 0;"><strong>Empresa:</strong> {{empresa}}</p></div><p>Você pode acompanhar o andamento pelo Portal do Cliente Lógos AITSM.</p>',
        footer_text: 'Central de Serviços de TI — Lógos AITSM',
        show_button: true,
        button_label: 'Acompanhar Chamado',
        button_url_template: '{{link}}',
      }

      if (typeof globalThis.interpolateEmailTemplate === 'function') {
        subject = globalThis.interpolateEmailTemplate(factoryCfg.subject_template, templateData)
      } else {
        subject = 'Chamado #' + ticketNumber + ' registrado com sucesso - ' + ticketTitle
      }

      if (typeof globalThis.buildEmailHtmlFromConfig === 'function') {
        htmlBody = globalThis.buildEmailHtmlFromConfig(factoryCfg, templateData)
      } else {
        htmlBody =
          '<div><p>Olá <strong>' +
          primaryName +
          '</strong>,</p><p>Seu chamado #' +
          ticketNumber +
          ' foi registrado com sucesso.</p></div>'
      }

      textBody =
        'Olá ' +
        primaryName +
        ',\n\n' +
        'Seu chamado foi registrado com sucesso no sistema Lógos AITSM e já está na fila de atendimento.\n\n' +
        'Número: #' +
        ticketNumber +
        '\n' +
        'Assunto: ' +
        ticketTitle +
        '\n' +
        'Data: ' +
        dateFormatted +
        '\n\n' +
        '-- Lógos AITSM'
    }

    for (var fIdx = 0; fIdx < recipientsList.length; fIdx++) {
      var rEmail = recipientsList[fIdx]

      // Anti-duplicidade no fallback
      if (
        typeof globalThis.hasEmailAlreadyBeenSent === 'function' &&
        globalThis.hasEmailAlreadyBeenSent('ticket_created', ticket.id, rEmail)
      ) {
        continue
      }

      if (typeof globalThis.itsmSendWithAudit === 'function') {
        globalThis.itsmSendWithAudit({
          testType: 'abertura_chamado',
          to: rEmail,
          subject: subject,
          html: htmlBody,
          text: textBody,
          meta: {
            ticket_id: ticket.id,
            ticket_number: ticketNumber,
            requester_name: primaryName,
            created_at: createdRaw,
          },
        })
      } else if (typeof globalThis.sendSystemEmail === 'function') {
        globalThis.sendSystemEmail({
          to: rEmail,
          subject: subject,
          html: htmlBody,
          text: textBody,
        })
      } else {
        var defaultEmail = 'noreply@logositsm.com.br'
        var client = $app.newMailClient()
        var msg = new MailerMessage()
        msg.from = { address: defaultEmail, name: 'Lógos AITSM' }
        msg.to = [{ address: rEmail }]
        msg.subject = subject
        msg.html = htmlBody
        msg.text = textBody
        client.send(msg)
      }

      if (typeof globalThis.recordEmailSentLog === 'function') {
        globalThis.recordEmailSentLog('ticket_created', ticket.id, rEmail, subject, {
          fallback: true,
        })
      }

      $app
        .logger()
        .info(
          'ticket_created_client_email: notificação enviada (fallback) para ' +
            rEmail +
            ' (chamado #' +
            ticketNumber +
            ')',
        )
    }
  } catch (err) {
    $app
      .logger()
      .error(
        'ticket_created_client_email: falha ao processar e-mail de abertura',
        'error',
        err.message,
      )
  }

  return e.next()
}, 'tickets')
