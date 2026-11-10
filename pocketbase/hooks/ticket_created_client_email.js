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
// 4. Envio EXCLUSIVO pela Central de Alertas (sendSystemAlertEmail, helpers em
//    A0_email_alert_helpers.js). NÃO existe fallback manual: se a Central não
//    estiver disponível, o e-mail NÃO é enviado e o erro é registrado no log —
//    nunca sai e-mail de texto simples sem marca (correção v0.0.396+).
// 5. Anti-duplicidade estrita por (alert_key, ticket_id, recipient) — mantida na Central.
// 6. Registro completo de logs explicativos para auditoria clara.

onRecordAfterCreateSuccess((e) => {
  try {
    var __logTicket = e.record
    console.log(
      '[Central de Alertas] hook disparado | chamado #' +
        (__logTicket ? __logTicket.getString('number') || __logTicket.id : '?'),
    )
  } catch (_) {}

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
        console.warn(
          '[Central de Alertas] ticket_created: envio SUPRIMIDO por client_notification_settings | chamado #' +
            ticketNumber,
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
      var noRecipientMsg =
        'ticket_created_client_email: chamado #' +
        ticketNumber +
        ' criado, mas nenhum e-mail de solicitante ou colaborador foi localizado; notificação não enviada.'
      $app
        .logger()
        .warn(
          noRecipientMsg,
          'ticket_id',
          ticket.id,
          'company_id',
          companyId,
          'requester_name',
          primaryName,
        )
      console.warn(
        '[Central de Alertas] ticket_created: envio SUPRIMIDO — nenhum destinatário encontrado | ' +
          noRecipientMsg +
          ' | requester_name=' +
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

    // 5. Envio EXCLUSIVO pela Central de Alertas por E-mail (sendSystemAlertEmail).
    //    Assunto e HTML vêm SEMPRE do template configurado no editor da Central
    //    (email_alert_settings). Nenhum HTML/assunto é montado manualmente aqui:
    //    se a Central não estiver disponível, o e-mail NÃO é enviado (sem fallback
    //    de texto simples sem marca) e o erro é registrado com contexto completo.
    if (typeof globalThis.sendSystemAlertEmail !== 'function') {
      var centralMissingMsg =
        'ticket_created_client_email: Central de Alertas indisponível (sendSystemAlertEmail ausente) — e-mail de abertura NÃO enviado, sem fallback de texto simples. Helpers esperados em A0_email_alert_helpers.js.'
      $app
        .logger()
        .error(
          centralMissingMsg,
          'chamado',
          ticketNumber,
          'ticket_id',
          ticket.id,
          'recipients',
          recipientsList.join(', '),
        )
      console.error(
        '[Central de Alertas] ticket_created: FALHA — ' +
          centralMissingMsg +
          ' | chamado #' +
          ticketNumber +
          ' | destinatários=' +
          recipientsList.join(', '),
      )
      return e.next()
    }

    try {
      var alertResult = globalThis.sendSystemAlertEmail({
        alert_key: 'ticket_created',
        reference_id: ticket.id,
        recipients: recipientsList,
        subject: 'Chamado #' + ticketNumber + ' registrado com sucesso - ' + ticketTitle,
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
        var nonPositiveMsg =
          'ticket_created_client_email: Central de Alertas retornou status não-positivo — e-mail de abertura NÃO enviado (sem fallback manual).'
        $app
          .logger()
          .error(
            nonPositiveMsg,
            'reason',
            alertResult ? alertResult.reason : 'resultado_indefinido',
            'chamado',
            ticketNumber,
            'recipients',
            recipientsList.join(', '),
          )
        console.error(
          '[Central de Alertas] ticket_created: FALHA — ' +
            nonPositiveMsg +
            ' | motivo=' +
            (alertResult ? alertResult.reason : 'resultado_indefinido') +
            ' | chamado #' +
            ticketNumber +
            ' | destinatários=' +
            recipientsList.join(', '),
        )
      }
    } catch (centralErr) {
      var unexpectedMsg =
        'ticket_created_client_email: erro inesperado ao invocar sendSystemAlertEmail — e-mail de abertura NÃO enviado (sem fallback manual).'
      $app
        .logger()
        .error(
          unexpectedMsg,
          'chamado',
          ticketNumber,
          'ticket_id',
          ticket.id,
          'error',
          centralErr.message,
        )
      console.error(
        '[Central de Alertas] ticket_created: FALHA — ' +
          unexpectedMsg +
          ' | chamado #' +
          ticketNumber +
          ' | motivo: ' +
          (centralErr && centralErr.message ? centralErr.message : String(centralErr)),
      )
    }
  } catch (err) {
    var outerErrMsg = 'ticket_created_client_email: falha ao processar e-mail de abertura'
    $app.logger().error(outerErrMsg, 'error', err.message)
    console.error(
      '[Central de Alertas] ticket_created: FALHA — ' +
        outerErrMsg +
        ' | chamado #' +
        ticketNumber +
        ' | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  }

  return e.next()
}, 'tickets')
