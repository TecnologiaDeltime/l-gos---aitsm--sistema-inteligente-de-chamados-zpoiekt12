// pocketbase/hooks/ticket_approval_check.js
// Lógos AITSM — Fluxo de Aprovação Automática de Chamados (COMPLETO v0.0.433)
// Regra do Usuário (v0.0.418):
// 1. A regra de aprovação começa pela EMPRESA (selecionada no topo).
// 2. A unidade de aprovação é a ATIVIDADE/SUBATIVIDADE do catálogo (tkt_categories).
// 3. Aprovador: ponto focal do cliente (client_contacts is_focal_point=true) ou
//    aprovador interno (users).
// 4. Regra empresa+atividade ativa ⇒ cria pendência(s) em `approvals`, grava
//    approval_hold=true + status "Aguardando Aprovação" no chamado, envia e-mails
//    pela Central de Alertas e cria notificação in-app.
// 5. Dúvidas não passam por aprovação.
//
// AUTOCONTIDO (Goja/pool): TODA a lógica vive dentro de _g._ticketApprovalRunCheck,
// publicada em globalThis no TOP-LEVEL do arquivo. Callbacks chamam SEMPRE via _g —
// funções de módulo (nem deste arquivo, nem de outros) não são visíveis nos callbacks.
// Gatilhos NESTE arquivo: after-create, after-update (triagem IA / re-categorização)
// e rota POST /backend/v1/tickets/{id}/send-approval (envio manual pelo operador).

_g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this

_g._ticketApprovalRunCheck = function (app, ticket, auth) {
  if (!ticket) return null
  if (!app) app = $app

  var companyId = ticket.getString('company')
  if (!companyId) return null

  var categoryId = ticket.getString('category') || ''
  var subcategoryId = ticket.getString('subcategory') || ''
  var ticketType = ticket.getString('type') || ''
  var ticketPriority = ticket.getString('priority') || ''

  // Chamados encerrados não são tocados
  var stLower = String(ticket.getString('status') || '').toLowerCase()
  if (
    stLower === 'resolvido' ||
    stLower === 'encerrado' ||
    stLower === 'cancelado' ||
    stLower === 'fechado'
  ) {
    return null
  }

  // Regra de usuário: Dúvidas não passam por aprovação
  var typeLower = String(ticketType).toLowerCase()
  if (typeLower === 'duvida' || typeLower === 'dúvida' || typeLower === 'requisição de dúvida') {
    return null
  }

  // Duplicidade: já existe pendência Pendente para o chamado?
  var existingApp = null
  try {
    existingApp = app.findFirstRecordByFilter(
      'approvals',
      'ticket = "' + ticket.id + '" && status = "Pendente"',
    )
  } catch (_) {}
  if (existingApp) return null

  // Casamento da regra empresa+atividade
  var configs = []
  try {
    configs = app.findRecordsByFilter('approval_configs', 'active = true', '-created', 200, 0)
  } catch (err) {
    return null
  }
  if (!configs || configs.length === 0) return null

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
      isCompanyMatch = true // regra global
    }
    if (!isCompanyMatch) continue

    var activityId = cfg.getString('activity')
    if (activityId) {
      var activityMatched =
        (subcategoryId && activityId === subcategoryId) || (categoryId && activityId === categoryId)
      if (!activityMatched) continue

      var reqTypesAct = _g._ticketApprovalParseJsonList(cfg, 'request_types')
      if (reqTypesAct.length > 0 && reqTypesAct.indexOf(ticketType) < 0) continue

      matchingConfig = cfg
      break
    }

    // Regras legadas sem atividade
    var reqTypes = _g._ticketApprovalParseJsonList(cfg, 'request_types')
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

    if (!matchingConfig) {
      matchingConfig = cfg
    }
  }

  _g._ticketApprovalParseJsonList = function (rec, field) {
    var out = []
    try {
      var raw = rec.get(field)
      if (Array.isArray(raw)) out = raw
      else if (typeof raw === 'string' && raw.trim()) {
        try {
          var parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) out = parsed
          else out = [raw]
        } catch (_) {
          out = [raw]
        }
      }
    } catch (_) {}
    var clean = []
    for (var k = 0; k < out.length; k++) {
      if (out[k]) clean.push(String(out[k]))
    }
    return clean
  }

  if (!matchingConfig) return null

  // =====================================================================
  // CRIAÇÃO COMPLETA DA PENDÊNCIA (restaurado do histórico v0.0.431/059c978)
  // =====================================================================
  var ticketNumber = ticket.getString('number') || ticket.id
  var ticketTitle = ticket.getString('title') || 'Chamado sem título'
  console.log(
    '[APPROVAL_CHECK] regra casa para #' +
      ticketNumber +
      ' (config=' +
      matchingConfig.id +
      ') — criando pendência de aprovação',
  )

  // ---- helpers locais (autocontidos nesta função) ----
  function _idList(rec, keyAll, keyLegacy, keySingle) {
    var list = _g._ticketApprovalParseJsonList(rec, keyAll)
    if (list.length === 0) list = _g._ticketApprovalParseJsonList(rec, keyLegacy)
    if (list.length === 0) {
      try {
        var single = rec.getString(keySingle)
        if (single) list = [single]
      } catch (_) {}
    }
    return list
  }

  function _genToken() {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    var tok = ''
    for (var s = 0; s < 24; s++) {
      tok += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return tok
  }

  // ---- resolvido: solicitante (approvals.requester é relation REQUIRED → users) ----
  var requesterId = ''
  var requesterEmail = (ticket.getString('requester_email') || '').trim()
  var requesterName = (ticket.getString('requester_name') || '').trim() || 'Solicitante'
  if (requesterEmail) {
    try {
      var uByEmail = app.findFirstRecordByFilter(
        'users',
        'email = "' + requesterEmail.toLowerCase().replace(/"/g, '\\"') + '"',
      )
      if (uByEmail) requesterId = uByEmail.id
    } catch (_) {}
  }
  if (!requesterId && auth && auth.id) requesterId = auth.id
  if (!requesterId) {
    try {
      var uCompany = app.findFirstRecordByFilter('users', 'company = "' + companyId + '"')
      if (uCompany) requesterId = uCompany.id
    } catch (_) {}
  }
  if (!requesterId) {
    var assignedId = ticket.getString('assigned_to')
    if (assignedId) requesterId = assignedId
  }
  if (!requesterId) {
    try {
      var uAdmin = app.findFirstRecordByFilter('users', 'role = "admin"')
      if (uAdmin) requesterId = uAdmin.id
    } catch (_) {}
  }
  if (!requesterId) {
    console.error(
      '[APPROVAL_CHECK] ABORTADO para #' +
        ticketNumber +
        ' — nenhum usuário disponível para approvals.requester (relation obrigatória)',
    )
    return null
  }

  // ---- aprovadores da regra (múltiplos, mig 0163; fallback aos legados) ----
  var focalIds = _idList(matchingConfig, 'focal_points_all', 'focal_points', 'approver_focal_point')
  var internalIds = _idList(
    matchingConfig,
    'internal_approvers_all',
    'internal_approvers',
    'approver_user',
  )
  if (focalIds.length === 0 && internalIds.length === 0) {
    console.warn(
      '[APPROVAL_CHECK] regra ' +
        matchingConfig.id +
        ' sem aprovador configurado — nada a criar para #' +
        ticketNumber,
    )
    return null
  }

  var mode = matchingConfig.getString('mode') || 'Individual'
  var escalationMinutes = matchingConfig.getInt('escalation_timeout_minutes')
  var nowIso = new Date().toISOString()
  var escDeadline =
    new Date(Date.now() + (escalationMinutes > 0 ? escalationMinutes : 60) * 60000)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19) + 'Z'

  var approvalsCol
  try {
    approvalsCol = app.findCollectionByNameOrId('approvals')
  } catch (colErr) {
    console.error('[APPROVAL_CHECK] collection approvals não encontrada: ' + colErr.message)
    return null
  }

  var createdApprovals = []
  var approverEmails = []
  var notifyUserIds = []

  // ---- cria uma pendência por aprovador (regra "basta um" decide na 1ª decisão) ----
  function _createApproval(role, contactRec, userRec) {
    var rec = new Record(approvalsCol)
    rec.set('ticket', ticket.id)
    rec.set('requester', requesterId)
    rec.set('type', 'Outros')
    rec.set(
      'justification',
      'Atividade "' +
        (ticket.getString('service') || ticketTitle) +
        '" requer aprovação conforme regra cadastrada (empresa + atividade).',
    )
    rec.set('status', 'Pendente')
    rec.set('token', _genToken())
    rec.set('approval_config', matchingConfig.id)
    rec.set('stage', 1)
    rec.set('mode', mode)
    rec.set('escalation_deadline', escDeadline)
    rec.set('approval_role', role)
    if (contactRec) {
      rec.set('target_contact', contactRec.id)
      var cEmail = (contactRec.getString('email') || '').trim()
      if (cEmail) rec.set('target_email', cEmail)
    }
    if (userRec) rec.set('approver', userRec.id)
    app.save(rec)
    return rec
  }

  for (var f = 0; f < focalIds.length; f++) {
    try {
      var contact = app.findRecordById('client_contacts', focalIds[f])
      var contactUser = null
      try {
        var cuId = contact.getString('user')
        if (cuId) contactUser = app.findRecordById('users', cuId)
      } catch (_) {}
      var created = _createApproval('client', contact, contactUser)
      createdApprovals.push(created)
      var cMail = (contact.getString('email') || '').trim().toLowerCase()
      if (cMail) approverEmails.push(cMail)
      if (contactUser && contactUser.id) notifyUserIds.push(contactUser.id)
    } catch (errF) {
      console.error(
        '[APPROVAL_CHECK] falha ao criar aprovação do ponto focal ' +
          focalIds[f] +
          ' | ' +
          (errF && errF.message ? errF.message : String(errF)),
      )
    }
  }

  for (var n = 0; n < internalIds.length; n++) {
    try {
      var iUser = app.findRecordById('users', internalIds[n])
      var createdInt = _createApproval('internal', null, iUser)
      createdApprovals.push(createdInt)
      var iMail = (iUser.getString('email') || '').trim().toLowerCase()
      if (iMail) approverEmails.push(iMail)
      notifyUserIds.push(iUser.id)
    } catch (errI) {
      console.error(
        '[APPROVAL_CHECK] falha ao criar aprovação interna ' +
          internalIds[n] +
          ' | ' +
          (errI && errI.message ? errI.message : String(errI)),
      )
    }
  }

  if (createdApprovals.length === 0) {
    console.error('[APPROVAL_CHECK] nenhuma pendência criada para #' + ticketNumber)
    return null
  }

  // status anterior do chamado, capturado ANTES de travar
  var statusBefore = String(ticket.getString('status') || '')

  // ---- trava o chamado: approval_hold + status Aguardando Aprovação ----
  try {
    ticket.set('approval_hold', true)
    ticket.set('status', 'Aguardando Aprovação')
    app.save(ticket)
    console.log(
      '[APPROVAL_CHECK] chamado #' +
        ticketNumber +
        ' travado: approval_hold=true, status=Aguardando Aprovação',
    )
  } catch (errHold) {
    console.error(
      '[APPROVAL_CHECK] FALHA ao travar chamado #' +
        ticketNumber +
        ' | ' +
        (errHold && errHold.message ? errHold.message : String(errHold)),
    )
  }

  // ---- histórico do chamado ----
  try {
    var historyCol = app.findCollectionByNameOrId('ticket_history')
    var hist = new Record(historyCol)
    hist.set('ticket', ticket.id)
    hist.set('user', requesterId)
    hist.set(
      'action',
      'Chamado enviado para aprovação (regra empresa + atividade). ' +
        createdApprovals.length +
        ' pendência(s) criada(s) — status "Aguardando Aprovação".',
    )
    hist.set('field', 'status')
    hist.set('old_value', statusBefore || 'Atribuído')
    hist.set('new_value', 'Aguardando Aprovação')
    app.save(hist)
  } catch (errHist) {
    console.warn('[APPROVAL_CHECK] falha ao gravar histórico: ' + errHist.message)
  }

  // ---- e-mails via Central de Alertas (alert_keys controlam ligado/desligado) ----
  var baseUrl = ''
  try {
    if (typeof _g.getTicketBaseUrl === 'function') baseUrl = _g.getTicketBaseUrl()
  } catch (_) {}
  var portalLink = baseUrl ? baseUrl + '/portal' : ''
  var companyName = ''
  try {
    var comp = app.findRecordById('companies', companyId)
    companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
  } catch (_) {}

  var baseData = {
    chamado_numero: ticketNumber,
    numero: ticketNumber,
    titulo: ticketTitle,
    solicitante: requesterName,
    cliente: requesterName,
    empresa: companyName,
    aprovador: requesterName,
    responsavel: requesterName,
    atividade: ticket.getString('service') || ticketTitle,
    link: portalLink,
  }

  // (a) solicitante: chamado aguardando aprovação
  if (requesterEmail && typeof _g.sendSystemAlertEmail === 'function') {
    try {
      var r1 = _g.sendSystemAlertEmail({
        alert_key: 'ticket_approval_hold',
        reference_id: ticket.id + ':hold',
        recipients: [requesterEmail],
        subject: 'Chamado #' + ticketNumber + ' aguardando aprovação - ' + ticketTitle,
        data: baseData,
      })
      console.log(
        '[APPROVAL_CHECK] e-mail solicitante (ticket_approval_hold): ' + JSON.stringify(r1),
      )
    } catch (errE1) {
      console.error('[APPROVAL_CHECK] erro e-mail solicitante: ' + errE1.message)
    }
  }

  // (b) aprovador(es): solicitação de aprovação
  if (approverEmails.length > 0 && typeof _g.sendSystemAlertEmail === 'function') {
    try {
      var r2 = _g.sendSystemAlertEmail({
        alert_key: 'ticket_approval_request_internal',
        reference_id: ticket.id + ':request',
        recipients: approverEmails,
        subject: 'Aprovação pendente: Chamado #' + ticketNumber + ' - ' + ticketTitle,
        data: baseData,
      })
      console.log(
        '[APPROVAL_CHECK] e-mail aprovador (ticket_approval_request_internal): ' +
          JSON.stringify(r2),
      )
    } catch (errE2) {
      console.error('[APPROVAL_CHECK] erro e-mail aprovador: ' + errE2.message)
    }
  }

  // (c) notificação in-app (type Aprovação), condicionada a ticket_approval_created_notify
  if (notifyUserIds.length > 0) {
    var notifyEnabled = false
    try {
      if (typeof _g.isEmailAlertEnabled === 'function') {
        notifyEnabled = _g.isEmailAlertEnabled('ticket_approval_created_notify')
      }
    } catch (_) {}
    if (notifyEnabled) {
      var notifsCol = null
      try {
        notifsCol = app.findCollectionByNameOrId('notifications')
      } catch (_) {}
      if (notifsCol) {
        var seenUsers = {}
        for (var uIdx = 0; uIdx < notifyUserIds.length; uIdx++) {
          var uid = notifyUserIds[uIdx]
          if (!uid || seenUsers[uid]) continue
          seenUsers[uid] = true
          try {
            var notif = new Record(notifsCol)
            notif.set('user', uid)
            notif.set('ticket', ticket.id)
            notif.set('title', 'Aprovação pendente — #' + ticketNumber)
            notif.set(
              'message',
              'O chamado #' +
                ticketNumber +
                ' (' +
                ticketTitle +
                ') aguarda sua aprovação para liberar o atendimento.',
            )
            notif.set('type', 'Aprovação')
            notif.set('read', false)
            app.save(notif)
          } catch (errN) {
            console.warn('[APPROVAL_CHECK] falha na notificação in-app: ' + errN.message)
          }
        }
      }
    } else {
      console.log(
        '[APPROVAL_CHECK] notificação in-app suprimida (ticket_approval_created_notify desligado)',
      )
    }
  }

  console.log(
    '[APPROVAL_CHECK] fluxo concluído para #' +
      ticketNumber +
      ' — ' +
      createdApprovals.length +
      ' pendência(s), ' +
      approverEmails.length +
      ' aprovador(es) por e-mail',
  )

  return createdApprovals[0]
}

// ===== Gatilhos =====
onRecordAfterCreateSuccess((e) => {
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : global
    g._ticketApprovalRunCheck(e.app, e.record, e.auth)
  } catch (errHook) {
    $app.logger().error('ticket_approval_check: hook error', 'error', errHook.message)
  }
  return e.next()
}, 'tickets')

onRecordAfterUpdateSuccess((e) => {
  try {
    var rec = e.record
    if (rec.getBool('approval_hold')) return e.next()
    var st = rec.getString('status') || ''
    if (st === 'Resolvido' || st === 'Encerrado' || st === 'Cancelado') return e.next()

    var newCat = rec.getString('category') || ''
    var newSub = rec.getString('subcategory') || ''
    if (!newCat && !newSub) return e.next()

    var oldCat = ''
    var oldSub = ''
    try {
      var orig = typeof rec.original === 'function' ? rec.original() : null
      if (orig) {
        oldCat = orig.getString('category') || ''
        oldSub = orig.getString('subcategory') || ''
      }
    } catch (_) {}
    if (newCat === oldCat && newSub === oldSub) return e.next()

    console.log(
      '[APPROVAL_CHECK] atividade alterada no chamado #' +
        (rec.getString('number') || rec.id) +
        ' — reexecutando checagem de aprovação',
    )
    var g2 = typeof globalThis !== 'undefined' ? globalThis : global
    g2._ticketApprovalRunCheck(e.app, rec, e.auth)
  } catch (errUpd) {
    console.error('[APPROVAL_CHECK] erro no recheck pós-update: ' + errUpd.message)
  }
  return e.next()
}, 'tickets')

// ===== Envio manual (operador dispara pela ficha do chamado) =====
routerAdd('POST', '/backend/v1/tickets/{id}/send-approval', (e) => {
  if (!e.auth) return e.unauthorizedError('Autenticação necessária')
  try {
    var ticket = $app.findRecordById('tickets', e.request.pathValue('id'))
    var stNow = ticket.getString('status') || ''
    if (
      stNow === 'Resolvido' ||
      stNow === 'Encerrado' ||
      stNow === 'Cancelado' ||
      ticket.getBool('approval_hold')
    ) {
      return e.badRequestError(
        'Este chamado já possui aprovação pendente ou está encerrado/resolvido.',
      )
    }
    var dup = null
    try {
      dup = $app.findFirstRecordByFilter(
        'approvals',
        'ticket = "' + ticket.id + '" && status = "Pendente"',
      )
    } catch (_) {}
    if (dup) {
      return e.badRequestError('Já existe uma aprovação pendente para este chamado.')
    }
    var catM = ticket.getString('category') || ''
    var subM = ticket.getString('subcategory') || ''
    if (!catM && !subM) {
      return e.badRequestError(
        'Classifique a atividade/subatividade do chamado antes de enviar para aprovação.',
      )
    }
    var g3 = typeof globalThis !== 'undefined' ? globalThis : global
    var created = g3._ticketApprovalRunCheck($app, ticket, e.auth)
    if (!created) {
      return e.badRequestError(
        'Nenhuma regra de aprovação ativa encontrada para este chamado (empresa + atividade).',
      )
    }
    return e.json(200, { success: true, approval: created.id })
  } catch (errMan) {
    return e.badRequestError('Falha ao enviar para aprovação: ' + errMan.message)
  }
})
