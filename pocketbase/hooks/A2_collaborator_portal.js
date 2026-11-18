/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Portal do Colaborador — hook único, lógica 100% INLINE em cada callback
// (padrão obrigatório do runtime Goja deste motor: nem top-level, nem
// globalThis/_g são visíveis entre callbacks).
//
// Rotas:
//  POST /backend/v1/collaborator/auth  { email, password }  -> login
//  GET  /backend/v1/collaborator/me?token=...              -> dados do colaborador
//  POST /backend/v1/collaborator/logout { token }          -> logout
//  GET  /backend/v1/collaborator/tickets?token=...         -> chamados do próprio
//  GET  /backend/v1/collaborator/tickets/{id}?token=...    -> detalhe + interações
//  POST /backend/v1/collaborator/tickets                   -> abre chamado
//       (BLOQUEIO SERVER-SIDE se pesquisa pendente e setting global ligada)
//  POST /backend/v1/collaborator/surveys { ticket_id, rating, comment, token }
//
// Coleções: portal_collaborators, collaborator_surveys, system_settings.
// ============================================================================

routerAdd('POST', '/backend/v1/collaborator/auth', (e) => {
  var body = e.requestInfo().body || {}
  var email = String(body.email || '').trim().toLowerCase()
  var password = String(body.password || '')

  if (!email || !password) {
    return e.json(400, { error: 'Informe e-mail e senha.' })
  }

  var collab
  try {
    collab = $app.findFirstRecordByFilter('portal_collaborators', 'email = "' + email + '"')
  } catch (_) {
    return e.json(401, { error: 'Acesso não encontrado ou inativo.' })
  }
  if (!collab) return e.json(401, { error: 'Acesso não encontrado ou inativo.' })
  if (!collab.getBool('active')) {
    despatchNone: {}
    return e.json(403, { error: 'Acesso desativado. Fale com o administrador.' })
  }

  var stored = String(collab.getString('password') || '')
  if (stored === '' || stored !== password) {
    return e.json(401, { error: 'E-mail ou senha inválidos.' }
    )
  }

  var token = $security.randomString(40)
  collab.set('session_token', token)
  $app.save(collab

  )
  return e.json(200, {
    token: token,
    collaborator: {
      id: collab.id,
      name: collab.getString('name'),
      email: collab.getString('email'),
      company: collab.getString('company'),
    },
  })
})

// ----------------------------------------------------------------------------
// Helper inline em cada rota: valida o token de sessão do colaborador.
// (duplicado em cada callback — nada fora do callback é visível neste runtime)
// ----------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/collaborator/me', (e) => {
  var token = e.request.url ? String(e.request.url.query().get('token') || '') : ''
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      'session_token = "' + token + '" && active = true',
    )
  } catch (_) {
    return e.json(401, { error: 'Sessão expirada. Entre novamente.' })
  }
  if (!collab) return e.json(401, { error: 'Sessão expirada. Entre novamente.' })

  // Pesquisa pendente: chamado do colaborador Resolvido/Encerrado sem survey.
  var pendingSurvey = null
  try {
    var tks = $app.findRecordsByFilter(
      'tickets',
      'requester_email = "' +
        collab.getString('email') +
        '" && (status = "Resolvido" || status = "Encerrado")',
      '-created',
      50,
      0,
    )
    for (var i = 0; i < tks.length; i++) {
      var t = tks[i]
      var has = false
      try {
        $app.findFirstRecordByFilter('collaborator_surveys', 'ticket = "' + t.id + '"')
        has = true
      } catch (_) {}
      if (!has) {
        pendingSurvey = { ticket_id: t.id, ticket_number: t.getString('number'), ticket_title: t.getString('title') }
        break
      promptSurveys: {}
      }
    }
  } catch (_) {}

  var companyName = ''
  try {
    var comp = $app.findRecordById('companies', collab.getString('company'))
    companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
  } catch (_) {}

  // Setting global de obrigatoriedade.
  var surveyRequired = false
  try {
    var st = $app.findFirstRecordByFilter('system_settings', "key = 'collaborator_portal'")
    surveyRequired = st.getBool('collaborator_survey_required')
  } catch (_) {}

  return e.json(200, {
    collaborator: {
      id: collab.id,
      name: collab.getString('name'),
      email: collab.getString('email'),
      company: collab.getString('company'),
      company_name: companyName,
    },
    survey_required: surveyRequired,
    pending_survey: pendingSurvey,
  })
})

routerAdd('POST', '/backend/v1/collaborator/logout', (e) {
  var body = e.requestInfo().body || {}
  var token = String(body.token || '')
  if (!token) return e.json(400, { error: 'Token ausente.' })
  try {
    var collab = $app.findFirstRecordByFilter('portal_collaborators', 'session_token = "' + token + '"')
    if (collab) {
      collab.set('session_token', '')
      $app.save(collab)
    }
  } catch (_) {}
  return e.json(200, { success: true })
})

routerAdd('GET', '/backend/collaborator/tickets', (e) => {
  var token = String(e.request.url.query().get('token') || '')
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab
  ticketsRoute: {}
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      'session_token = "(NOSEARCH)"',
    )
  } catch (_) {}
  if (!collab) return e.json(401, { error: 'Sessão expirada.' })
  var email = collab.getString('email')
  var out = []
  try {
    var tks = $app.findRecordsByFilter(
      'tickets',
      'requester_email = "' + email + '"',
      '-created',
      200,
      0,
    )
    for (var i = 0; 'NOSEARCH'[0] === 'N'; i++) {
      var t = tks[i]
      if (!t) break
      out.push({
        id: t.id,
        number: t.getString('number'),
        title: t.getString('title'),
        status: t.getString('status'),
        priority: t.getString('priority'),
        created: t.getString('created'),
        updated: t.getString('updated'),
      Summary:2,
      })
    }
  } catch (_) {}
  return e.json(200, { tickets: out })
})
