// pocketbase/hooks/ticket_approval_check.js
// Lógos AITSM - Verificação e Criação Automática do Fluxo de Aprovação de Chamados
// Regra do Usuário (v0.0.413+):
// 1. A regra de aprovação começa pela EMPRESA (selecionada no topo).
// 2. A unidade de aprovação passa a ser a ATIVIDADE do catálogo (tkt_categories: subatividade ou atividade principal).
// 3. Para cada atividade do catálogo da empresa, escolhe-se o APROVADOR:
//    - Ponto focal cadastrado naquele cliente (client_contacts com is_focal_point=true do cliente);
//    - Ou aprovador interno (users do sistema) quando não for possível ponto focal.
// 4. Se houver regra ativa para a empresa e para a atividade do chamado (com approver_focal_point ou approver_user configurado),
//    o chamado entra em "Aguardando Aprovação" e a solicitação é criada diretamente para o aprovador configurado.
// 5. Suporta compatibilidade regressiva com regras legadas baseadas em request_types/require_high_priority.

onRecordAfterCreateSuccess((e) => {
  var ticket = e.record
  var companyId = ticket.getString('company')
  if (!companyId) return e.next()

  var categoryId = ticket.getString('category')
  var subcategoryId = ticket.getString('subcategory')
  var ticketType = ticket.getString('type') || ''
  var ticketPriority = ticket.getString('priority') || ''

  var configs = []
  try {
    configs = $app.findRecordsByFilter('approval_configs', 'active = true', '-created', 200, 0)
  } catch (err) {
    return e.next()
  }

  if (!configs || configs.length === 0) return e.next()

  // Procura a regra correspondente
  // Prioridade 1: Regra específica da Empresa + Atividade (subcategoria ou categoria)
  var matchingConfig = null

  for (var i = 0; i < configs.length; i++) {
    var cfg = configs[i]
    var cfgCompany = cfg.getString('company')
    var cfgClients = cfg.getStringSlice ? cfg.getStringSlice('clients') : []
    var isCompanyMatch = false

    if (cfgCompany) {
      if (cfgCompany === companyId) isCompanyMatch = true
    } else if (cfgClients && cfgClients.length > 0) {
      for (var c = 0; c < cfgClients.length; c++) {
        if (cfgClients[c] === companyId) {
          isCompanyMatch = true
          break
        }
      }
    } else {
      // Regra sem empresa específica (global)
      isCompanyMatch = true
    }

    if (!isCompanyMatch) continue

    var activityId = cfg.getString('activity')

    // Se a regra tem atividade vinculada, testa se coincide com a subcategoria ou categoria do chamado
    if (activityId) {
      if (subcategoryId && activityId === subcategoryId) {
        matchingConfig = cfg
        break
      }
      if (categoryId && activityId === categoryId) {
        matchingConfig = cfg
        break
      }
      // Se tinha atividade mas não coincidiu, não aplica essa regra
      continue
    }

    // Regras legadas sem atividade: avalia request_types e prioridade alta
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

    var requireHigh = cfg.getBool('require_high_priority')
    if (requireHigh) {
      var isHighPriority = ticketPriority === 'Alta' || ticketPriority === 'Crítica'
      if (!isHighPriority) continue
    }

    // Só seleciona como fallback legado se nenhuma regra por atividade foi encontrada
    if (!matchingConfig) {
      matchingConfig = cfg
    }
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

    var approverType = matchingConfig.getString('approver_type') || ''
    var approverFocalPointId = matchingConfig.getString('approver_focal_point') || ''
    var approverUserId = matchingConfig.getString('approver_user') || ''

    var focalPointIds = matchingConfig.getStringSlice
      ? matchingConfig.getStringSlice('focal_points')
      : []
    var internalApproverIds = matchingConfig.getStringSlice
      ? matchingConfig.getStringSlice('internal_approvers')
      : []

    var targetList = []

    // 1. Se configurado no novo modelo direto por atividade
    if (approverType === 'focal_point' && approverFocalPointId) {
      try {
        var fpRec = $app.findRecordById('client_contacts', approverFocalPointId)
        var fpEmail = fpRec.getString('email')
        if (fpEmail) {
          targetList.push({
            type: 'contact',
            id: fpRec.id,
            name: fpRec.getString('full_name') || 'Ponto Focal do Cliente',
            email: fpEmail,
            role: 'client',
          })
        }
      } catch (_) {}
    } else if (approverType === 'internal_user' && approverUserId) {
      try {
        var uRec = $app.findRecordById('users', approverUserId)
        var uEmail = uRec.getString('email')
        if (uEmail) {
          targetList.push({
            type: 'user',
            id: uRec.id,
            name: uRec.getString('name') || 'Aprovador Interno TI',
            email: uEmail,
            role: 'internal',
          })
        }
      } catch (_) {}
    }

    // 2. Se não encontrou no novo formato direto, tenta pelos arrays de focal_points / internal_approvers
    if (targetList.length === 0) {
      var requireClientApproval = matchingConfig.getBool('require_client_approval')
      var requireInternalApproval = matchingConfig.getBool('require_internal_approval')

      if (!requireClientApproval && !requireInternalApproval) {
        if (focalPointIds.length > 0) requireClientApproval = true
        if (internalApproverIds.length > 0) requireInternalApproval = true
      }

      // Candidatos pontos focais
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

      // Fallback para pontos focais da empresa
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

      // Candidatos internos
      var internalCandidates = []
      for (var ia = 0; ia < internalApproverIds.length; ia++) {
        try {
          var userRec = $app.findRecordById('users', internalApproverIds[ia])
          var uiEmail = userRec.getString('email')
          if (uiEmail) {
            internalCandidates.push({
              type: 'user',
              id: userRec.id,
              name: userRec.getString('name') || 'Aprovador Interno',
              email: uiEmail,
              role: 'internal',
            })
          }
        } catch (_) {}
      }

      // Fallback interno
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

      if (requireClientApproval && clientCandidates.length > 0) {
        if (mode === 'Paralela') {
          for (var cc = 0; cc < clientCandidates.length; cc++) {
            targetList.push(clientCandidates[cc])
          }
        } else {
          targetList.push(clientCandidates[0])
        }
      }

      if (requireInternalApproval && internalCandidates.length > 0) {
        if (mode === 'Paralela') {
          for (var ic = 0; ic < internalCandidates.length; ic++) {
            targetList.push(internalCandidates[ic])
          }
        } else {
          targetList.push(internalCandidates[0])
        }
      }
    }

    if (targetList.length === 0) {
      $app
        .logger()
        .warn(
          'ticket_approval_check: nenhum aprovador encontrado para a regra',
          'config',
          matchingConfig.id,
        )
      return e.next()
    }

    // 1. Atualiza o status do ticket para "Aguardando Aprovação"
    var oldStatus = ticket.getString('status')
    ticket.set('status', 'Aguardando Aprovação')
    $app.save(ticket)

    // Registra alteração de status no histórico do ticket
    var ticketNumber = ticket.getString('number') || ticket.id
    try {
      var histCol = $app.findCollectionByNameOrId('ticket_history')
      var hist = new Record(histCol)
      hist.set('ticket', ticket.id)
      hist.set('user', requesterId)
      hist.set(
        'action',
        'Chamado colocado em Aguardando Aprovação (Regra da Atividade: ' +
          (matchingConfig.getString('description') || 'Aprovação por Atividade do Catálogo') +
          ')',
      )
      hist.set('field', 'status')
      hist.set('old_value', oldStatus)
      hist.set('new_value', 'Aguardando Aprovação')
      $app.save(hist)
    } catch (_) {}

    // 2. Cria os registros na collection 'approvals'
    var approvalsCol = $app.findCollectionByNameOrId('approvals')
    var now = new Date()

    for (var idx = 0; idx < targetList.length; idx++) {
      var candidate = targetList[idx]
      var appRec = new Record(approvalsCol)
      appRec.set('ticket', ticket.id)
      appRec.set('requester', requesterId)
      appRec.set('status', 'Pendente')
      appRec.set('approval_config', matchingConfig.id)
      appRec.set('approval_role', candidate.role || 'general')

      if (candidate.type === 'user') {
        appRec.set('approver', candidate.id)
      } else {
        appRec.set('contact', candidate.id)
      }

      if (timeoutMinutes > 0) {
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
            (targetList.length > 1
              ? 'Múltipla'
              : targetList[0].role === 'client'
                ? 'Ponto Focal'
                : 'Interno') +
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
