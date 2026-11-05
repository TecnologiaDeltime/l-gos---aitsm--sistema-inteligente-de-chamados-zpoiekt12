// pocketbase/hooks/ticket_approval_check.js
// Lógos AITSM - Verificação e Criação Automática do Fluxo de Aprovação de Chamados
// Regra do Usuário:
// 1. Aprovação exigida quando TIPO DE SOLICITAÇÃO configurado E PRIORIDADE ALTA coincidirem (as DUAS juntas).
// 2. Aprovação DUPLA: Cliente no Portal E Aprovador Interno (ou conforme regras da configuração).
// 3. Status inicial do chamado vira "Aguardando Aprovação". Chamado NÃO entra na fila de atendimento antes das aprovações.

onRecordAfterCreateSuccess((e) => {
  var ticket = e.record
  var companyId = ticket.getString('company')
  if (!companyId) return e.next()

  var ticketType = ticket.getString('type') || ''
  var ticketPriority = ticket.getString('priority') || ''
  var categoryId = ticket.getString('category')
  var subcategoryId = ticket.getString('subcategory')

  var configs = []
  try {
    configs = $app.findRecordsByFilter('approval_configs', 'active = true', '-created', 100, 0)
  } catch (err) {
    return e.next()
  }

  if (!configs || configs.length === 0) return e.next()

  // Procura a regra correspondente
  var matchingConfig = null
  for (var i = 0; i < configs.length; i++) {
    var cfg = configs[i]

    // 1. Filtro por clientes (se especificado na regra)
    var clients = cfg.getStringSlice ? cfg.getStringSlice('clients') : []
    if (clients && clients.length > 0) {
      var clientMatched = false
      for (var c = 0; c < clients.length; c++) {
        if (clients[c] === companyId) {
          clientMatched = true
          break
        }
      }
      if (!clientMatched) continue
    }

    // 2. Condição de Tipo de Solicitação (request_types)
    var reqTypes = []
    try {
      var rawTypes = cfg.get('request_types')
      if (Array.isArray(rawTypes)) {
        reqTypes = rawTypes
      } else if (typeof rawTypes === 'string' && rawTypes.trim()) {
        try {
          var parsed = JSON.parse(rawTypes)
          if (Array.isArray(parsed)) reqTypes = parsed
        } catch (_) {
          reqTypes = [rawTypes]
        }
      }
    } catch (_) {}

    if (reqTypes && reqTypes.length > 0) {
      var typeMatched = false
      for (var t = 0; t < reqTypes.length; t++) {
        if (reqTypes[t] === ticketType) {
          typeMatched = true
          break
        }
      }
      if (!typeMatched) continue
    }

    // 3. Condição de Prioridade Alta (require_high_priority)
    // Se a regra exigir prioridade alta, o chamado precisa ser "Alta" ou "Crítica"
    var requireHigh = cfg.getBool('require_high_priority')
    if (requireHigh) {
      var isHighPriority = ticketPriority === 'Alta' || ticketPriority === 'Crítica'
      if (!isHighPriority) {
        continue // Não bateu as duas condições juntas
      }
    }

    // 4. Se a regra tiver atividade vinculada (legado / específico)
    var activityId = cfg.getString('activity')
    if (activityId) {
      if (activityId === subcategoryId || activityId === categoryId) {
        matchingConfig = cfg
        break
      }
      continue
    }

    // Se passou em todos os filtros, encontramos a regra correspondente
    matchingConfig = cfg
    break
  }

  if (!matchingConfig) return e.next()

  // Evita duplicar se já houver aprovação pendente para o chamado
  try {
    var existingApp = $app.findFirstRecordByFilter(
      'approvals',
      'ticket = "' + ticket.id + '" && status = "Pendente"',
    )
    if (existingApp) return e.next()
  } catch (_) {}

  var assignedTo = ticket.getString('assigned_to')
  var requesterId = assignedTo || ''
  if (!requesterId && e.auth) {
    requesterId = e.auth.id
  }
  if (!requesterId) {
    try {
      var firstAdmin = $app.findFirstRecordByFilter('users', 'role = "admin"')
      if (firstAdmin) requesterId = firstAdmin.id
    } catch (_) {}
  }
  if (!requesterId) return e.next()

  try {
    var mode = matchingConfig.getString('mode') || 'Individual'
    var timeoutMinutes = matchingConfig.getInt('escalation_timeout_minutes') || 60
    var focalPointIds = matchingConfig.getStringSlice
      ? matchingConfig.getStringSlice('focal_points')
      : []
    var internalApproverIds = matchingConfig.getStringSlice
      ? matchingConfig.getStringSlice('internal_approvers')
      : []

    var requireClientApproval = matchingConfig.getBool('require_client_approval')
    var requireInternalApproval = matchingConfig.getBool('require_internal_approval')

    // Se nenhum dos dois foi explicitamente marcado, o comportamento padrão é aprovação dupla se houver pontos focais E internos
    if (!requireClientApproval && !requireInternalApproval) {
      requireClientApproval = true
      requireInternalApproval = true
    }

    // Coleta contatos clientes (pontos focais)
    var clientCandidates = []
    for (var fp = 0; fp < focalPointIds.length; fp++) {
      try {
        var contactRec = $app.findRecordById('client_contacts', focalPointIds[fp])
        var cEmail = contactRec.getString('email')
        if (cEmail) {
          clientCandidates.push({
            type: 'contact',
            id: contactRec.id,
            name: contactRec.getString('full_name') || 'Ponto Focal do Cliente',
            email: cEmail,
            role: 'client',
          })
        }
      } catch (_) {}
    }

    // Se precisar de aprovação do cliente e nenhum ponto focal foi listado na regra, busca pontos focais da empresa
    if (requireClientApproval && clientCandidates.length === 0) {
      try {
        var companyFps = $app.findRecordsByFilter(
          'client_contacts',
          'client = "' + companyId + '" && is_focal_point = true',
          '-created',
          5,
          0,
        )
        for (var cfp = 0; cfp < companyFps.length; cfp++) {
          var cEmail2 = companyFps[cfp].getString('email')
          if (cEmail2) {
            clientCandidates.push({
              type: 'contact',
              id: companyFps[cfp].id,
              name: companyFps[cfp].getString('full_name') || 'Ponto Focal',
              email: cEmail2,
              role: 'client',
            })
          }
        }
      } catch (_) {}
    }

    // Coleta aprovadores internos
    var internalCandidates = []
    for (var ia = 0; ia < internalApproverIds.length; ia++) {
      try {
        var userRec = $app.findRecordById('users', internalApproverIds[ia])
        var uEmail = userRec.getString('email')
        if (uEmail) {
          internalCandidates.push({
            type: 'user',
            id: userRec.id,
            name: userRec.getString('name') || 'Aprovador Interno',
            email: uEmail,
            role: 'internal',
          })
        }
      } catch (_) {}
    }

    // Fallback para aprovadores internos: gestores/admins se precisar e não houver cadastrado
    if (requireInternalApproval && internalCandidates.length === 0) {
      try {
        var fallbackUsers = $app.findRecordsByFilter(
          'users',
          'role = "admin" || role = "gestor"',
          '',
          10,
          0,
        )
        for (var fu = 0; fu < fallbackUsers.length; fu++) {
          var fbEmail = fallbackUsers[fu].getString('email')
          if (fbEmail) {
            internalCandidates.push({
              type: 'user',
              id: fallbackUsers[fu].id,
              name: fallbackUsers[fu].getString('name') || 'Gestor Responsável',
              email: fbEmail,
              role: 'internal',
            })
          }
        }
      } catch (_) {}
    }

    // Lista final de aprovações a serem geradas
    // No fluxo de aprovação dupla: gera aprovação de cliente (se exigida) E aprovação interna (se exigida)
    var targetList = []

    if (requireClientApproval && clientCandidates.length > 0) {
      if (mode === 'Paralela') {
        for (var cc = 0; cc < clientCandidates.length; cc++) {
          targetList.push(clientCandidates[cc])
        }
      } else {
        // Individual ou Sequencial: primeiro ponto focal
        targetList.push(clientCandidates[0])
      }
    }

    if (requireInternalApproval && internalCandidates.length > 0) {
      if (mode === 'Paralela') {
        for (var ic = 0; ic < internalCandidates.length; ic++) {
          targetList.push(internalCandidates[ic])
        }
      } else {
        // Individual ou Sequencial: primeiro aprovador interno
        targetList.push(internalCandidates[0])
      }
    }

    // Se por acaso nem cliente nem interno puderam ser resolvidos, tenta fallback geral
    if (targetList.length === 0) {
      if (clientCandidates.length > 0) targetList.push(clientCandidates[0])
      else if (internalCandidates.length > 0) targetList.push(internalCandidates[0])
    }

    if (targetList.length === 0) return e.next()

    // 1. Atualiza status do chamado para 'Aguardando Aprovação'
    var ticketRecord = $app.findRecordById('tickets', ticket.id)
    var oldStatus = ticketRecord.getString('status')
    ticketRecord.set('status', 'Aguardando Aprovação')
    $app.save(ticketRecord)

    // 2. Registra histórico no ticket
    var historyCol = $app.findCollectionByNameOrId('ticket_history')
    var hist = new Record(historyCol)
    hist.set('ticket', ticket.id)
    hist.set('user', requesterId)
    hist.set(
      'action',
      'Fluxo de aprovação iniciado (Tipo: ' +
        ticketType +
        ' | Prioridade: ' +
        ticketPriority +
        ' | Modo: ' +
        mode +
        ')',
    )
    hist.set('field', 'status')
    hist.set('old_value', oldStatus)
    hist.set('new_value', 'Aguardando Aprovação')
    $app.save(hist)

    var approvalsCol = $app.findCollectionByNameOrId('approvals')
    var backendBase = (
      $os.getenv('PB_INSTANCE_URL') ||
      $os.getenv('SITE_URL') ||
      'https://sistema-itsm-de-chamados-b1534.shrd03.internal.goskip.dev'
    ).replace(/\/$/, '')

    var ticketNumber = ticket.getString('number') || ticket.id
    var ticketTitle = ticket.getString('title') || 'Sem título'
    var ticketDescription = ticket.getString('description') || 'Sem descrição fornecida'

    var compName = ''
    try {
      var compRec = $app.findRecordById('companies', companyId)
      compName = compRec.getString('trade_name') || compRec.getString('legal_name') || ''
    } catch (_) {}

    var reqName = 'Solicitante'
    try {
      var reqRec = $app.findRecordById('users', requesterId)
      reqName = reqRec.getString('name') || reqRec.getString('email') || reqName
    } catch (_) {}

    var now = new Date()

    // Cria os registros de aprovação
    for (var idx = 0; idx < targetList.length; idx++) {
      var cand = targetList[idx]
      var appRec = new Record(approvalsCol)
      appRec.set('ticket', ticket.id)
      appRec.set('requester', requesterId)
      if (cand.type === 'user') {
        appRec.set('approver', cand.id)
      } else {
        appRec.set('target_contact', cand.id)
      }
      appRec.set('target_email', cand.email)
      appRec.set('type', cand.role === 'client' ? 'Aprovação de Cliente' : 'Aprovação Interna TI')
      appRec.set('approval_role', cand.role || 'general')
      appRec.set(
        'justification',
        'Aprovação exigida para chamado com Tipo "' +
          ticketType +
          '" e Prioridade "' +
          ticketPriority +
          '" (' +
          (cand.role === 'client' ? 'Ponto Focal do Cliente' : 'Aprovador Interno TI') +
          ')',
      )
      appRec.set('status', 'Pendente')
      appRec.set('mode', mode)
      appRec.set('stage', idx + 1)
      appRec.set('approval_config', matchingConfig.id)
      if (mode === 'Sequencial') {
        var escalationDeadline = new Date(
          now.getTime() + timeoutMinutes * 60000 * (idx + 1),
        ).toISOString()
        appRec.set('escalation_deadline', escalationDeadline)
      }
      var tokenVal = $security.randomString(32)
      appRec.set('token', tokenVal)
      $app.save(appRec)
    }

    // Notificações in-app
    try {
      var notifCol = $app.findCollectionByNameOrId('notifications')
      var gestores = $app.findRecordsByFilter(
        'users',
        'role = "admin" || role = "gestor"',
        '',
        20,
        0,
      )
      for (var j = 0; j < gestores.length; j++) {
        var notif = new Record(notifCol)
        notif.set('user', gestores[j].id)
        notif.set('ticket', ticket.id)
        notif.set(
          'title',
          'Nova aprovação pendente (' +
            (requireClientApproval && requireInternalApproval ? 'Dupla' : mode) +
            ')',
        )
        notif.set('message', 'Chamado #' + ticketNumber + ' aguarda aprovação para entrar na fila')
        notif.set('type', 'Aprovação')
        notif.set('read', false)
        $app.save(notif)
      }
    } catch (_) {}
  } catch (err) {
    $app.logger().error('ticket_approval_check: failed to create approval', 'error', err.message)
  }

  return e.next()
}, 'tickets')
