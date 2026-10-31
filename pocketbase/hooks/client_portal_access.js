/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de auto-provisionamento e gestão do Portal do Cliente.
 * Todos os métodos estão inlined dentro de cada callback para conformidade com a JSVM do PocketBase.
 */

// Ao cadastrar empresa, garante usuário de acesso ao portal imediatamente
onRecordAfterCreateSuccess((e) => {
  try {
    var companyRec = e.record
    var companyId = companyRec.id
    var companyName = companyRec.getString('name') || 'Cliente'
    var companyEmail = (companyRec.getString('email') || '').trim().toLowerCase()

    function slugify(str) {
      if (!str) return 'cliente'
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
    }

    // Se não tiver e-mail na empresa, verifica se tem algum contato
    if (!companyEmail) {
      try {
        var contact = $app.findFirstRecordByFilter(
          'client_contacts',
          'company = "' + companyId + '" && email != ""',
        )
        if (contact) {
          companyEmail = (contact.getString('email') || '').trim().toLowerCase()
        }
      } catch (_) {}
    }

    if (!companyEmail) {
      companyEmail = 'portal.' + slugify(companyName) + '@cliente.itsm'
    }

    var hasUser = false
    try {
      var existing = $app.findFirstRecordByFilter('users', 'company = "' + companyId + '"')
      if (existing) hasUser = true
    } catch (_) {}

    if (!hasUser) {
      try {
        var usersCol = $app.findCollectionByNameOrId('users')
        var newUser = new Record(usersCol)
        newUser.set('email', companyEmail)
        newUser.setPassword('Cliente@123')
        newUser.set('name', companyName + ' (Gestor)')
        newUser.set('role', 'cliente_gestor')
        newUser.set('company', companyId)
        newUser.set('status', 'Ativo')
        newUser.set('verified', true)
        $app.save(newUser)
        $app
          .logger()
          .info(
            'client_portal_access: criado usuário de portal para ' + companyName,
            'email',
            companyEmail,
          )
      } catch (createErr) {
        $app
          .logger()
          .error('client_portal_access: falha ao criar usuário de portal', 'err', createErr.message)
      }
    }
  } catch (err) {
    $app
      .logger()
      .error('onRecordAfterCreateSuccess companies portal user error', 'err', err.message)
  }
  return e.next()
}, 'companies')

// Rota administrativa para consultar acessos e clientes do portal
routerAdd('GET', '/backend/v1/portal/clients-access', (c) => {
  var auth = c.auth
  if (!auth) {
    return c.json(401, { error: 'Não autorizado' })
  }
  var role = auth.getString('role')
  if (role !== 'admin' && role !== 'gestor') {
    return c.json(403, { error: 'Permissão insuficiente' })
  }

  try {
    var companies = $app.findRecordsByFilter(
      'companies',
      'active = true || active = null',
      'name',
      200,
      0,
    )
    var result = []

    for (var i = 0; i < companies.length; i++) {
      var comp = companies[i]
      var users = []
      try {
        var compUsers = $app.findRecordsByFilter(
          'users',
          'company = "' +
            comp.id +
            '" && (role = "cliente_gestor" || role = "cliente_solicitante")',
          '-created',
          50,
          0,
        )
        for (var u = 0; u < compUsers.length; u++) {
          var usr = compUsers[u]
          users.push({
            id: usr.id,
            name: usr.getString('name'),
            email: usr.getString('email'),
            role: usr.getString('role'),
            status: usr.getString('status') || 'Ativo',
            created: usr.getString('created'),
          })
        }
      } catch (_) {}

      // Busca contatos / pontos focais
      var focalPoints = []
      try {
        var contacts = $app.findRecordsByFilter(
          'client_contacts',
          'company = "' + comp.id + '"',
          'full_name',
          50,
          0,
        )
        for (var ct = 0; ct < contacts.length; ct++) {
          var contact = contacts[ct]
          focalPoints.push({
            id: contact.id,
            name: contact.getString('full_name'),
            email: contact.getString('email'),
            phone: contact.getString('phone'),
            role: contact.getString('role'),
            isFocalPoint: contact.getBool('is_focal_point') || false,
          })
        }
      } catch (_) {}

      result.push({
        company: {
          id: comp.id,
          name: comp.getString('name'),
          cnpj: comp.getString('cnpj'),
          email: comp.getString('email'),
          hours_contracted: comp.getInt('contracted_hours') || comp.getInt('hours_contracted') || 0,
        },
        portalUsers: users,
        contacts: focalPoints,
      })
    }

    return c.json(200, { clients: result })
  } catch (err) {
    return c.json(500, { error: err.message })
  }
})

// Rota administrativa para criar usuário de portal para um contato ou empresa
routerAdd('POST', '/backend/v1/portal/generate-user', (c) => {
  var auth = c.auth
  if (!auth) {
    return c.json(401, { error: 'Não autorizado' })
  }
  var role = auth.getString('role')
  if (role !== 'admin' && role !== 'gestor') {
    return c.json(403, { error: 'Permissão insuficiente' })
  }

  function slugify(str) {
    if (!str) return 'cliente'
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  }

  var info = c.requestInfo()
  var data = info.body || {}
  var companyId = data.companyId
  var email = (data.email || '').trim().toLowerCase()
  var name = (data.name || '').trim()
  var userRole = data.role === 'cliente_gestor' ? 'cliente_gestor' : 'cliente_solicitante'
  var initialPassword = data.password || 'Cliente@123'

  if (!companyId) {
    return c.json(400, { error: 'companyId é obrigatório' })
  }

  var comp = null
  try {
    comp = $app.findRecordById('companies', companyId)
  } catch (err) {
    return c.json(404, { error: 'Empresa não encontrada' })
  }

  if (!email) {
    email = 'portal.' + slugify(comp.getString('name')) + '@cliente.itsm'
  }
  if (!name) {
    name =
      comp.getString('name') + (userRole === 'cliente_gestor' ? ' (Ponto Focal)' : ' (Usuário)')
  }

  try {
    var existing = null
    try {
      existing = $app.findFirstRecordByFilter('users', 'email = "' + email + '"')
    } catch (_) {}

    if (existing) {
      existing.set('company', companyId)
      existing.set('role', userRole)
      existing.setPassword(initialPassword)
      $app.save(existing)
      return c.json(200, {
        success: true,
        message: 'Usuário atualizado com nova senha inicial: ' + initialPassword,
        user: { id: existing.id, email: existing.getString('email'), role: userRole },
      })
    }

    var usersCol = $app.findCollectionByNameOrId('users')
    var newUser = new Record(usersCol)
    newUser.set('email', email)
    newUser.setPassword(initialPassword)
    newUser.set('name', name)
    newUser.set('role', userRole)
    newUser.set('company', companyId)
    newUser.set('status', 'Ativo')
    newUser.set('verified', true)
    $app.save(newUser)

    return c.json(200, {
      success: true,
      message: 'Acesso criado com sucesso! Senha inicial: ' + initialPassword,
      user: { id: newUser.id, email: email, role: userRole },
    })
  } catch (err) {
    return c.json(500, { error: err.message })
  }
})

// Rota administrativa para resetar senha do usuário do portal
routerAdd('POST', '/backend/v1/portal/reset-password', (c) => {
  var auth = c.auth
  if (!auth) {
    return c.json(401, { error: 'Não autorizado' })
  }
  var role = auth.getString('role')
  if (role !== 'admin' && role !== 'gestor') {
    return c.json(403, { error: 'Permissão insuficiente' })
  }

  var info = c.requestInfo()
  var data = info.body || {}
  var userId = data.userId
  var newPassword = data.newPassword || 'Cliente@123'

  if (!userId) {
    return c.json(400, { error: 'userId é obrigatório' })
  }

  try {
    var usr = $app.findRecordById('users', userId)
    usr.setPassword(newPassword)
    $app.save(usr)
    return c.json(200, {
      success: true,
      message: 'Senha do portal redefinida para ' + newPassword,
    })
  } catch (err) {
    return c.json(500, { error: err.message })
  }
})
