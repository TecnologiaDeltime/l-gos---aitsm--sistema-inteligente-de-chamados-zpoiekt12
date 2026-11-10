// Gatilho imediato de e-mail na resolução/conclusão de chamado para o cliente
// Requisito:
// "E-mail de resolução do chamado — avisar o cliente quando o chamado for concluído,
// no mesmo template institucional (com logotipo, badge colorido verde de status,
// cartões de detalhes e rodapé). Coloque em configuração quais alertas e e-mails
// queremos que o cliente receba."
//
// Dispara após update do chamado quando o status muda para 'Resolvido'
// (ou 'Encerrado' direto sem ter passado por 'Resolvido').
// Evita e-mail duplicado caso transite de Resolvido para Encerrado.
// Autocontido, seguro e com registro de auditoria em email_audit_logs (tipo 'resolucao_chamado').

onRecordAfterUpdateSuccess((e) => {
  var ticket = e.record
  if (!ticket) return e.next()

  var original = ticket.original()
  if (!original) return e.next()

  var oldStatus = original.getString('status')
  var newStatus = ticket.getString('status')

  // Se o status não mudou, ignora
  if (oldStatus === newStatus) return e.next()

  // Não disparar para chamados cancelados
  if (newStatus === 'Cancelado') return e.next()

  // Dispara apenas quando vai para 'Resolvido' ou 'Encerrado' direto
  var isResolutionTarget = newStatus === 'Resolvido' || newStatus === 'Encerrado'
  if (!isResolutionTarget) return e.next()

  // Se já estava 'Resolvido' e foi para 'Encerrado', não duplica notificação ao cliente
  if (oldStatus === 'Resolvido' && newStatus === 'Encerrado') {
    return e.next()
  }

  // Verifica configuração de notificação do cliente (por empresa ou global)
  var companyId = ticket.getString('company')
  try {
    var settingsRec = null
    if (companyId) {
      try {
        settingsRec = $app.findFirstRecordByFilter(
          'client_notification_settings',
          'company = "' + companyId + '"',
        )
      } catch (_) {}
    }

    if (!settingsRec) {
      try {
        settingsRec = $app.findFirstRecordByFilter(
          'client_notification_settings',
          'scope = "global"',
        )
      } catch (_) {}
    }

    if (settingsRec && settingsRec.getBool('notify_ticket_resolved') === false) {
      var suppressedMsg =
        'ticket_resolved_client_email: notificação de resolução desativada nas configurações (chamado #' +
        ticket.getString('number') +
        ')'
      $app.logger().info(suppressedMsg)
      console.warn(
        '[Central de Alertas] ticket_resolved: envio SUPRIMIDO por client_notification_settings | ' +
          suppressedMsg,
      )
      return e.next()
    }
  } catch (_) {}

  try {
    var recipientEmail = (ticket.getString('requester_email') || '').trim()
    var requesterName = (ticket.getString('requester_name') || 'Cliente').trim()

    // Se não tiver requester_email direto, tenta buscar pelo usuário criador se houver
    if (!recipientEmail && e.auth && typeof e.auth.getString === 'function') {
      var authRole = e.auth.getString('role')
      if (authRole === 'cliente_solicitante' || authRole === 'cliente_gestor') {
        recipientEmail = (e.auth.getString('email') || '').trim()
        if (!requesterName || requesterName === 'Cliente') {
          requesterName = (e.auth.getString('name') || requesterName).trim()
        }
      }
    }

    // Coleta recipientes extras se notify_focal_points estiver ativo
    var extraRecipients = []
    if (settingsRec && settingsRec.getBool('notify_focal_points') === true && companyId) {
      try {
        var focalPoints = $app.findRecordsByFilter(
          'client_contacts',
          'client = "' + companyId + '" && is_focal_point = true',
          'full_name',
          50,
          0,
        )
        for (var f = 0; f < focalPoints.length; f++) {
          var fpEmail = (focalPoints[f].getString('email') || '').trim()
          if (fpEmail && fpEmail !== recipientEmail && extraRecipients.indexOf(fpEmail) === -1) {
            extraRecipients.push(fpEmail)
          }
        }
      } catch (_) {}
    }

    if (!recipientEmail && extraRecipients.length === 0) {
      var noEmailMsg =
        'ticket_resolved_client_email: chamado #' +
        ticket.getString('number') +
        ' sem e-mail do cliente informado; notificação por e-mail ignorada.'
      $app.logger().info(noEmailMsg)
      console.warn(
        '[Central de Alertas] ticket_resolved: envio SUPRIMIDO — sem destinatário | ' + noEmailMsg,
      )
      return e.next()
    }

    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Chamado sem título'
    var ticketDescription = ticket.getString('description') || ''

    // Descrição limpa do problema
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

    // Solução aplicada
    var solutionText = (ticket.getString('solution') || '').trim()
    var cleanSolution = solutionText
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleanSolution) {
      cleanSolution = 'Atendimento concluído com sucesso pela equipe técnica.'
    }

    // Data de abertura
    var createdRaw = ticket.getString('created')
    var createdDate = createdRaw ? new Date(createdRaw) : new Date()
    var createdFormatted =
      ('0' + createdDate.getDate()).slice(-2) +
      '/' +
      ('0' + (createdDate.getMonth() + 1)).slice(-2) +
      '/' +
      createdDate.getFullYear() +
      ' às ' +
      ('0' + createdDate.getHours()).slice(-2) +
      ':' +
      ('0' + createdDate.getMinutes()).slice(-2)

    // Data de resolução
    var resRaw = ticket.getString('resolution_date') || ticket.getString('updated')
    var resDate = resRaw ? new Date(resRaw) : new Date()
    var resFormatted =
      ('0' + resDate.getDate()).slice(-2) +
      '/' +
      ('0' + (resDate.getMonth() + 1)).slice(-2) +
      '/' +
      resDate.getFullYear() +
      ' às ' +
      ('0' + resDate.getHours()).slice(-2) +
      ':' +
      ('0' + resDate.getMinutes()).slice(-2)

    var priority = ticket.getString('priority') || 'Média'
    var type = ticket.getString('type') || 'Incidente'

    // Operador responsável
    var operatorName = 'Equipe Lógos'
    var assignedId = ticket.getString('assigned_to')
    if (assignedId) {
      try {
        var opUser = $app.findRecordById('users', assignedId)
        operatorName = opUser.getString('name') || operatorName
      } catch (_) {}
    } else if (e.auth && typeof e.auth.getString === 'function') {
      var authRole = e.auth.getString('role')
      if (
        authRole === 'admin' ||
        authRole === 'gestor' ||
        authRole === 'operador' ||
        authRole === 'tecnico'
      ) {
        operatorName = e.auth.getString('name') || operatorName
      }
    }

    // Nome da empresa
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

    // Monta dados para template
    var resolvedTemplateData = {
      chamado_numero: ticketNumber,
      numero: ticketNumber,
      titulo: ticketTitle,
      solucao: cleanSolution,
      cliente: requesterName,
      solicitante: requesterName,
      operador: operatorName,
      data_abertura: createdFormatted,
      data_conclusao: resFormatted,
      status: newStatus,
      empresa: companyName,
      prioridade: priority,
      tipo: type,
      link: baseUrl
        ? baseUrl + '/portal?tab=tickets&openTicketId=' + encodeURIComponent(ticket.id)
        : '',
    }

    // Envio EXCLUSIVO pela Central de Alertas por E-mail (sendSystemAlertEmail).
    // Assunto e HTML vêm SEMPRE do template configurado no editor da Central
    // (email_alert_settings). Nenhum HTML/assunto é montado manualmente aqui:
    // se a Central não estiver disponível, o e-mail NÃO é enviado (sem fallback
    // de texto simples sem marca) e o erro é registrado com contexto completo.
    // Lista consolidada de destinatários (solicitante + contatos/focais extras se configurados)
    var allDestinations = []
    if (recipientEmail) allDestinations.push(recipientEmail)
    for (var ed = 0; ed < extraRecipients.length; ed++) {
      if (allDestinations.indexOf(extraRecipients[ed]) === -1) {
        allDestinations.push(extraRecipients[ed])
      }
    }

    if (allDestinations.length === 0) {
      var noDestMsg =
        'ticket_resolved_client_email: chamado #' +
        ticketNumber +
        ' sem destinatários após consolidação.'
      $app.logger().info(noDestMsg)
      console.warn(
        '[Central de Alertas] ticket_resolved: envio SUPRIMIDO — sem destinatário | ' + noDestMsg,
      )
      return e.next()
    }

    if (typeof globalThis.sendSystemAlertEmail !== 'function') {
      var centralMissingMsg =
        'ticket_resolved_client_email: Central de Alertas indisponível (sendSystemAlertEmail ausente) — e-mail de resolução NÃO enviado, sem fallback de texto simples. Helpers esperados em A0_email_alert_helpers.js.'
      $app
        .logger()
        .error(
          centralMissingMsg,
          'chamado',
          ticketNumber,
          'ticket_id',
          ticket.id,
          'recipients',
          allDestinations.join(', '),
        )
      console.error(
        '[Central de Alertas] ticket_resolved: FALHA — ' +
          centralMissingMsg +
          ' | chamado #' +
          ticketNumber +
          ' | destinatários=' +
          allDestinations.join(', '),
      )
      return e.next()
    }

    try {
      var resolvedAlertResult = globalThis.sendSystemAlertEmail({
        alert_key: 'ticket_resolved',
        reference_id: ticket.id + '_resolved',
        recipients: allDestinations,
        subject: 'Chamado #' + ticketNumber + ' concluído: ' + ticketTitle,
        data: resolvedTemplateData,
      })

      if (resolvedAlertResult && resolvedAlertResult.sent) {
        $app
          .logger()
          .info(
            'ticket_resolved_client_email: notificação enviada via Central de Alertas para ' +
              resolvedAlertResult.sent_count +
              ' destinatário(s) (chamado #' +
              ticketNumber +
              ')',
            'recipients',
            allDestinations.join(', '),
          )
      } else if (resolvedAlertResult && resolvedAlertResult.reason === 'alert_disabled_by_config') {
        $app
          .logger()
          .info(
            'ticket_resolved_client_email: envio suprimido pois o alerta ticket_resolved está DESLIGADO nas configurações.',
            'chamado',
            ticketNumber,
          )
      } else if (resolvedAlertResult && resolvedAlertResult.reason === 'already_sent') {
        $app
          .logger()
          .info(
            'ticket_resolved_client_email: envio suprimido pois notificação de resolução já foi enviada anteriormente (anti-duplicidade), chamado #' +
              ticketNumber,
          )
      } else {
        var nonPositiveMsg =
          'ticket_resolved_client_email: Central de Alertas retornou status não-positivo — e-mail de resolução NÃO enviado (sem fallback manual).'
        $app
          .logger()
          .error(
            nonPositiveMsg,
            'reason',
            resolvedAlertResult ? resolvedAlertResult.reason : 'resultado_indefinido',
            'chamado',
            ticketNumber,
            'recipients',
            allDestinations.join(', '),
          )
        console.error(
          '[Central de Alertas] ticket_resolved: FALHA — ' +
            nonPositiveMsg +
            ' | motivo=' +
            (resolvedAlertResult ? resolvedAlertResult.reason : 'resultado_indefinido') +
            ' | chamado #' +
            ticketNumber +
            ' | destinatários=' +
            allDestinations.join(', '),
        )
      }
    } catch (centralErr) {
      var unexpectedMsg =
        'ticket_resolved_client_email: erro inesperado ao invocar sendSystemAlertEmail — e-mail de resolução NÃO enviado (sem fallback manual).'
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
        '[Central de Alertas] ticket_resolved: FALHA — ' +
          unexpectedMsg +
          ' | chamado #' +
          ticketNumber +
          ' | motivo: ' +
          (centralErr && centralErr.message ? centralErr.message : String(centralErr)),
      )
    }
  } catch (err) {
    var outerErrMsg = 'ticket_resolved_client_email: falha ao processar e-mail de resolução'
    $app.logger().error(outerErrMsg, 'error', err.message)
    console.error(
      '[Central de Alertas] ticket_resolved: FALHA — ' +
        outerErrMsg +
        ' | motivo: ' +
        (err && err.message ? err.message : String(err)),
    )
  }

  return e.next()
}, 'tickets')
