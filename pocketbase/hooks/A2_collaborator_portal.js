/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// Portal do Colaborador — hook único, lógica 100% INLINE em cada callback
// (padrão obrigatório do runtime Goja deste motor: nem top-level, nem
// globalThis/_g são visíveis entre callbacks).
//
// Rotas:
//  POST /backend/v1/collaborator/auth  { email, password }  -> login (session_token)
//  POST /backend/v1/collaborator/impersonate               -> modo suporte (support_token)
//  GET  /backend/v1/collaborator/me?token=...              -> dados do colaborador
//  POST /backend/v1/collaborator/logout { token }          -> logout
//
// Tokens: sessões são independentes — o login normal grava/valida
// session_token; o modo suporte (impersonação do admin) grava/valida
// support_token. Um nunca derruba o outro.
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
  var email = String(body.email || '')
    .trim()
    .toLowerCase()
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
    return e.json(403, { error: 'Acesso desativado. Fale com o administrador.' })
  }

  var stored = String(collab.getString('password') || '')
  if (stored === '' || stored !== password) {
    return e.json(401, { error: 'E-mail ou senha inválidos.' })
  }

  var token = $security.randomString(40)
  collab.set('session_token', token)
  $app.save(collab)
  return e.json(200, {
    token: token,
    mode: 'normal',
    collaborator: {
      id: collab.id,
      name: collab.getString('name'),
      email: collab.getString('email'),
      company: collab.getString('company'),
    },
  })
})

// ----------------------------------------------------------------------------
// POST /impersonate — admin emite ticket de sessão curto para um colaborador.
// Exige usuário autenticado (e.auth) com role 'admin'. Nunca expõe a senha do
// colaborador: registra um SUPPORT_TOKEN próprio, que NÃO toca no
// session_token — assim a sessão real do colaborador não é derrubada.
// ----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/collaborator/impersonate', (e) => {
  var authUser = e.auth
  if (!authUser) {
    // Fallback: resolver token do cabeçalho Authorization (padrão dos demais hooks)
    try {
      var authHeader = ''
      if (typeof e.requestInfo === 'function') {
        var info = e.requestInfo()
        if (info && info.headers) {
          authHeader = info.headers['authorization'] || info.headers['Authorization'] || ''
        }
      }
      var hdrToken = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (hdrToken) {
        try {
          authUser = $app.findAuthRecordByToken(hdrToken, 'auth')
        } catch (_) {
          try {
            authUser = $app.findAuthRecordByToken(hdrToken)
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
  if (!authUser || authUser.getString('role') !== 'admin') {
    return e.json(403, {
      error: 'Apenas administradores podem visualizar o portal do colaborador.',
    })
  }

  var body = e.requestInfo().body || {}
  var collabId = String(body.collaborator_id || '')
  if (!collabId) return e.json(400, { error: 'Colaborador não informado.' })

  var collab
  try {
    collab = $app.findRecordById('portal_collaborators', collabId)
  } catch (_) {
    return e.json(404, { error: 'Acesso do colaborador não encontrado.' })
  }
  if (!collab.getBool('active')) {
    return e.json(403, { error: 'Acesso desativado. Ative-o antes de visualizar o portal.' })
  }

  var token = $security.randomString(40)
  collab.set('support_token', token)
  $app.save(collab)
  return e.json(200, { token: token, mode: 'support' })
})

// ----------------------------------------------------------------------------
// GET /me — dados do colaborador + pesquisa pendente + setting de obrigatoriedade
// ----------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/collaborator/me', (e) => {
  var token = e.request.url ? String(e.request.url.query().get('token') || '') : ''
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab = null
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      '(session_token = "' + token + '" || support_token = "' + token + '") && active = true',
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
        pendingSurvey = {
          ticket_id: t.id,
          ticket_number: t.getString('number'),
          ticket_title: t.getString('title'),
        }
        break
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

// ----------------------------------------------------------------------------
// POST /logout — encerra a sessão
// ----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/collaborator/logout', (e) => {
  var body = e.requestInfo().body || {}
  var token = String(body.token || '')
  if (!token) return e.json(400, { error: 'Token ausente.' })
  var isSupport = false
  try {
    var collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      'support_token = "' + token + '"',
    )
    if (collab) {
      isSupport = true
      collab.set('support_token', '')
      $app.save(collab)
    }
  } catch (_) {}
  if (!isSupport) {
    try {
      var collab2 = $app.findFirstRecordByFilter(
        'portal_collaborators',
        'session_token = "' + token + '"',
      )
      if (collab2) {
        collab2.set('session_token', '')
        $app.save(collab2)
      }
    } catch (_) {}
  }
  return e.json(200, { success: true })
})

// ----------------------------------------------------------------------------
// GET /tickets — chamados abertos pelo próprio colaborador (requester_email)
// ----------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/collaborator/tickets', (e) => {
  var token = String(e.request.url.query().get('token') || '')
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      '(session_token = "' + token + '" || support_token = "' + token + '") && active = true',
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
    for (var i = 0; i < tks.length; i++) {
      var t = tks[i]
      out.push({
        id: t.id,
        number: t.getString('number'),
        title: t.getString('title'),
        status: t.getString('status'),
        priority: t.getString('priority'),
        created: t.getString('created'),
        updated: t.getString('updated'),
      })
    }
  } catch (_) {}
  return e.json(200, { tickets: out })
})

// ----------------------------------------------------------------------------
// GET /tickets/{id} — detalhe do chamado + interações dos operadores
// ----------------------------------------------------------------------------
routerAdd('GET', '/backend/v1/collaborator/tickets/{id}', (e) => {
  var token = String(e.request.url.query().get('token') || '')
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      '(session_token = "' + token + '" || support_token = "' + token + '") && active = true',
    )
  } catch (_) {}
  if (!collab) return e.json(401, { error: 'Sessão expirada.' })

  var ticketId = String(e.request.pathValue('id') || '')
  if (!ticketId) return e.json(400, { error: 'Chamado não informado.' })

  var ticket
  try {
    ticket = $app.findRecordById('tickets', ticketId)
  } catch (_) {
    return e.json(404, { error: 'Chamado não encontrado.' })
  }

  // Só o próprio colaborador (por e-mail solicitante) pode ver.
  if (
    String(ticket.getString('requester_email') || '').toLowerCase() !==
    String(collab.getString('email') || '').toLowerCase()
  ) {
    return e.json(403, { error: 'Este chamado não pertence a você.' })
  }

  var interactions = []
  try {
    var its = $app.findRecordsByFilter(
      'ticket_interactions',
      'ticket = "' + ticket.id + '"',
      'created',
      200,
      0,
    )
    for (var i = 0; i < its.length; i++) {
      var it = its[i]
      // Somente interações públicas (type != "Interno").
      var itType = String(it.getString('type') || '')
      if (itType === 'Interno') continue
      var authorName = ''
      try {
        var authorId = String(it.getString('author') || '')
        if (authorId) {
          var authorRec = $app.findRecordById('users', authorId)
          authorName = authorRec.getString('name') || ''
        }
      } catch (_) {}
      interactions.push({
        id: it.id,
        content: it.getString('content'),
        type: itType || 'Público',
        origin: it.getString('origin'),
        author_name: authorName,
        created: it.getString('created'),
      })
    }
  } catch (_) {}

  var survey = null
  try {
    var sv = $app.findFirstRecordByFilter(
      'collaborator_surveys',
      'ticket = "' + ticket.id + '" && collaborator = "' + collab.id + '"',
    )
    if (sv) {
      survey = {
        rating: sv.getInt('rating'),
        comment: sv.getString('comment'),
        responded_at: sv.getString('responded_at'),
      }
    }
  } catch (_) {}

  return e.json(200, {
    ticket: {
      id: ticket.id,
      number: ticket.getString('number'),
      title: ticket.getString('title'),
      description: ticket.getString('description'),
      status: ticket.getString('status'),
      priority: ticket.getString('priority'),
      created: ticket.getString('created'),
      updated: ticket.getString('updated'),
    },
    interactions: interactions,
    survey: survey,
  })
})

// ----------------------------------------------------------------------------
// POST /tickets — abrir chamado (bloqueio server-side por pesquisa pendente)
// ----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/collaborator/tickets', (e) => {
  var body = e.requestInfo().body || {}
  var token = String(body.token || '')
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      '(session_token = "' + token + '" || support_token = "' + token + '") && active = true',
    )
  } catch (_) {}
  if (!collab) return e.json(401, { error: 'Sessão expirada.' })

  // Setting global de obrigatoriedade.
  var surveyRequired = false
  try {
    var st = $app.findFirstRecordByFilter('system_settings', "key = 'collaborator_portal'")
    surveyRequired = st.getBool('collaborator_survey_required')
  } catch (_) {}

  if (surveyRequired) {
    // Existe chamado encerrado/resolvido do colaborador sem pesquisa?
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
          return e.json(403, {
            error:
              'Pesquisa de satisfação pendente no chamado #' +
              t.getString('number') +
              '. Responda antes de abrir um novo chamado.',
            pending_survey: { ticket_id: t.id, ticket_number: t.getString('number') },
          })
        }
      }
    } catch (_) {}
  }

  var title = String(body.title || '').trim()
  var description = String(body.description || '').trim()
  var priority = String(body.priority || 'Média').trim()
  if (!title || !description) {
    return e.json(400, { error: 'Informe título e descrição do chamado.' })
  }

  // Ativo (equipamento) opcional: precisa existir e pertencer à mesma empresa
  // do colaborador — nunca confia em id arbitrário do cliente.
  var equipmentId = String(body.equipment || '').trim()
  if (equipmentId) {
    var eqOk = false
    try {
      var eq = $app.findRecordById('equipments', equipmentId)
      eqOk = String(eq.getString('company') || '') === String(collab.getString('company') || '')
    } catch (_) {
      eqOk = false
    }
    if (!eqOk) {
      return e.json(400, { error: 'Ativo informado não pertence à sua empresa.' })
    }
  }

  var rec
  try {
    rec = new Record($app.findCollectionByNameOrId('tickets'))
    rec.set('title', title)
    rec.set('description', description)
    rec.set('priority', priority)
    rec.set('status', 'Novo')
    rec.set('requester_email', collab.getString('email'))
    rec.set('requester_name', collab.getString('name'))
    rec.set('company', collab.getString('company'))
    rec.set('source', 'Portal')
    rec.set('type', 'Incidente')
    if (equipmentId) rec.set('equipment', equipmentId)
    $app.save(rec)
  } catch (err) {
    return e.json(500, { error: 'Falha ao abrir chamado: ' + err })
  }

  return e.json(201, {
    ticket: { id: rec.id, number: rec.getString('number'), title: rec.getString('title') },
  })
})

// ----------------------------------------------------------------------------
// POST /surveys — registra a pesquisa de satisfação (nota 1–5 + comentário)
// ----------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/collaborator/surveys', (e) => {
  var body = e.requestInfo().body || {}
  var token = String(body.token || '')
  if (!token) return e.json(401, { error: 'Sessão inválida.' })
  var collab
  try {
    collab = $app.findFirstRecordByFilter(
      'portal_collaborators',
      '(session_token = "' + token + '" || support_token = "' + token + '") && active = true',
    )
  } catch (_) {}
  if (!collab) return e.json(401, { error: 'Sessão expirada.' })

  var ticketId = String(body.ticket_id || '')
  var rating = parseInt(String(body.rating || '0'), 10)
  var comment = String(body.comment || '')
  if (!ticketId || !rating || rating < 1 || rating > 5) {
    return e.json(400, { error: 'Informe ticket_id e nota de 1 a 5.' })
  }

  var ticket
  try {
    ticket = $app.findRecordById('tickets', ticketId)
  } catch (_) {
    return e.json(404, { error: 'Chamado não encontrado.' })
  }
  if (
    String(ticket.getString('requester_email') || '').toLowerCase() !==
    String(collab.getString('email') || '').toLowerCase()
  ) {
    return e.json(403, { error: 'Este chamado não pertence a você.' })
  }

  // Já respondeu?
  try {
    $app.findFirstRecordByFilter(
      'collaborator_surveys',
      'ticket = "' + ticket.id + '" && collaborator = "' + collab.id + '"',
    )
    return e.json(409, { error: 'Você já respondeu a pesquisa deste chamado.' })
  } catch (_) {}

  var rec
  try {
    rec = new Record($app.findCollectionByNameOrId('collaborator_surveys'))
    rec.set('ticket', ticket.id)
    rec.set('collaborator', collab.id)
    rec.set('rating', rating)
    rec.set('comment', comment)
    rec.set('responded_at', new Date().toISOString().replace('T', ' '))
    $app.save(rec)
  } catch (err) {
    return e.json(500, { error: 'Falha ao registrar pesquisa: ' + err })
  }

  return e.json(201, { success: true, id: rec.id })
})
