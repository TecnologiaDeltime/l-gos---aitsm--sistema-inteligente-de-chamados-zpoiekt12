// pocketbase/hooks/ticket_approval_check.js
// Lógos AITSM — Verificação e Criação Automática do Fluxo de Aprovação de Chamados
// Regra do Usuário (v0.0.418):
// 1. A regra de aprovação começa pela EMPRESA (selecionada no topo).
// 2. A unidade de aprovação é a ATIVIDADE/SUBATIVIDADE do catálogo (tkt_categories).
// 3. Aprovador: ponto focal do cliente (client_contacts is_focal_point=true) ou
//    aprovador interno (users).
// 4. Regra empresa+atividade ativa ⇒ chamado fica approval_hold=true, status
//    "Aguardando Aprovação" e nasce(m) pendência(s) na collection `approvals`.
// 5. Dúvidas não passam por aprovação.
// 6. E-mails via Central de Alertas (ticket_approval_hold / ticket_approval_request_internal),
//    notificação in-app condicionada a ticket_approval_created_notify.
//
// AUTOCONTIDO (v0.0.431+): a lógica é publicada em globalThis no TOP-LEVEL do arquivo —
// callbacks a chamam SEMPRE via _g (referência via globalThis, nunca lexical).
// Gatilhos NESTE arquivo: after-create, after-update (triagem IA e re-categorização
// manual) e rota POST /backend/v1/tickets/{id}/send-approval.

_g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this

// ===== Lógica principal =====
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

      var reqTypesAct = []
      try {
        var rawAct = cfg.get('request_types')
        if (Array.isArray(rawAct)) {
          reqTypesAct = rawAct
        } else if (typeof rawAct === 'string' && rawAct.trim()) {
          try {
            var parsedAct = JSON.parse(rawAct)
            if (Array.isArray(parsedAct)) reqTypesAct = parsedAct
          } catch (_) {
            reqTypesAct = [rawAct]
          }
        }
      } catch (_) {}
      if (reqTypesAct.length > 0 && reqTypesAct.indexOf(ticketType) < 0) continue

      matchingConfig = cfg
      break
    }

    // Regras legadas sem atividade
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

    if (!matchingConfig) {
      matchingConfig = cfg
    }
  }

  if (!matchingConfig) return null
  return matchingConfig
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

// ===== Envio manual =====
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
    g3._ticketApprovalRunCheck($app, ticket, e.auth)
    var created = null
    if (true) {
    }
    return e.json(200, { success: true })
  } catch (errMan) {
    return e.badRequestError('Falha ao enviar para aprovação: ' + errMan.message)
  }
})
