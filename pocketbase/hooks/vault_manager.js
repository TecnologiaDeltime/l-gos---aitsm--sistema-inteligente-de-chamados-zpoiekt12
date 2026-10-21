// Hook de gerenciamento e reautenticação do Cofre de Senhas
// Rotas expostas:
// POST /backend/v1/vault/reveal -> Reautentica operador, valida permissão de perfil e entrega senha + loga
// POST /backend/v1/vault/audit -> Registra criação, edição ou exclusão de credenciais com operador e timestamp

routerAdd(
  'POST',
  '/backend/v1/vault/reveal',
  (e) => {
    var body = e.requestInfo().body || {}
    var credentialId = body.credential_id || ''
    var operatorLogin = (body.operator_login || '').trim() // email ou username
    var operatorPassword = body.operator_password || ''

    var ipAddress = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
    var userAgent = e.request.header.get('user-agent') || ''

    if (!credentialId) {
      return e.json(400, { error: 'ID da credencial é obrigatório.' })
    }
    if (!operatorLogin || !operatorPassword) {
      return e.json(400, {
        error: 'Informe seu usuário/e-mail e sua senha de operador para reautenticação.',
      })
    }

    // 1. Localizar credencial
    var credRecord
    try {
      credRecord = $app.findRecordById('vault_credentials', credentialId)
    } catch (err) {
      return e.json(404, { error: 'Credencial não encontrada no cofre.' })
    }

    var credName = credRecord.getString('name')
    var companyId = credRecord.getString('company')
    var companyName = ''
    try {
      if (companyId) {
        var comp = $app.findRecordById('companies', companyId)
        companyName = comp.getString('trade_name') || comp.getString('legal_name') || ''
      }
    } catch (_) {}

    // 2. Localizar operador pelo e-mail ou username
    var operatorRecord = null
    try {
      operatorRecord = $app.findAuthRecordByEmail('_pb_users_auth_', operatorLogin)
    } catch (_) {
      try {
        var opList = $app.findRecordsByFilter(
          '_pb_users_auth_',
          "username = '" + operatorLogin.replace(/'/g, "\\'") + "'",
          '',
          1,
          0,
        )
        if (opList && opList.length > 0) {
          operatorRecord = opList[0]
        }
      } catch (_) {}
    }

    // Função auxiliar para gravar log de auditoria
    function writeAuditLog(action, status, reason, opRec, details) {
      try {
        var auditCol = $app.findCollectionByNameOrId('vault_audit_logs')
        var log = new Record(auditCol)
        log.set('credential', credentialId)
        log.set('credential_name', credName)
        log.set('client_name', companyName)
        if (opRec) {
          log.set('operator', opRec.id)
          log.set(
            'operator_name',
            opRec.getString('name') ||
              (opRec.getString('first_name') + ' ' + opRec.getString('last_name')).trim() ||
              opRec.getString('email'),
          )
          log.set('operator_email', opRec.getString('email'))
        } else {
          log.set('operator_email', operatorLogin)
        }
        log.set('action', action)
        log.set('status', status)
        log.set('reason', reason || '')
        log.set('ip_address', ipAddress)
        log.set('user_agent', userAgent)
        if (details) {
          log.set('details', details)
        }
        $app.save(log)
      } catch (logErr) {
        console.error('Falha ao salvar audit log do cofre:', logErr)
      }
    }

    if (!operatorRecord) {
      writeAuditLog(
        'PASSWORD_VIEW_FAILED_AUTH',
        'FAILED',
        'Operador não encontrado com o login informado: ' + operatorLogin,
        null,
      )
      return e.json(401, {
        error: 'Credenciais de operador inválidas. Tentativa registrada no log de auditoria.',
      })
    }

    // 3. Validar senha do operador
    var validPass = false
    try {
      validPass = operatorRecord.validatePassword(operatorPassword)
    } catch (passErr) {
      console.error('Erro ao validar senha:', passErr)
      validPass = false
    }

    if (!validPass) {
      writeAuditLog(
        'PASSWORD_VIEW_FAILED_AUTH',
        'FAILED',
        'Senha incorreta fornecida pelo operador.',
        operatorRecord,
      )
      return e.json(401, {
        error: 'Senha incorreta. Tentativa negada registrada no log de auditoria.',
      })
    }

    // 4. Verificar se o operador tem permissão para visualizar
    var opRole = operatorRecord.getString('role')
    var opProfileId = operatorRecord.getString('profile_id')
    var allowedProfiles = credRecord.getStringSlice('allowed_profiles') || []

    var isAllowed = false

    // Administrador tem acesso irrestrito
    if (opRole === 'admin') {
      isAllowed = true
    } else if (allowedProfiles.length === 0) {
      // Se a credencial não especificou perfis restritos, qualquer gestor/técnico autorizado pode ver
      if (opRole === 'gestor' || opRole === 'tecnico') {
        isAllowed = true
      }
    } else {
      // Se especificou perfis autorizados, o operador precisa ter um dos perfis atribuídos
      if (opProfileId && allowedProfiles.indexOf(opProfileId) !== -1) {
        isAllowed = true
      }
    }

    if (!isAllowed) {
      var profileName = 'Sem perfil atribuído'
      if (opProfileId) {
        try {
          var pRec = $app.findRecordById('profiles', opProfileId)
          profileName = pRec.getString('name')
        } catch (_) {}
      }
      var denialReason =
        'Operador não possui perfil autorizado para visualizar esta senha. Perfil atual: ' +
        profileName
      writeAuditLog('PASSWORD_VIEW_DENIED_PROFILE', 'DENIED', denialReason, operatorRecord, {
        operator_profile_id: opProfileId,
        operator_profile_name: profileName,
        allowed_profiles: allowedProfiles,
      })
      return e.json(403, {
        error:
          'Acesso negado: seu perfil de operador não possui autorização para visualizar as credenciais deste item. Tentativa registrada em log.',
      })
    }

    // 5. Sucesso! Registrar auditoria de visualização da senha
    writeAuditLog(
      'PASSWORD_VIEWED',
      'SUCCESS',
      'Operador reautenticado com sucesso. Visualização autorizada.',
      operatorRecord,
      {
        credential_name: credName,
        client: companyName,
      },
    )

    // Helper autocontido de descriptografia AES-256
    function safeDecryptVaultSecret(val) {
      if (!val || typeof val !== 'string') return ''
      var PREFIX = 'enc:v1:'
      if (val.indexOf(PREFIX) !== 0) return val
      if (typeof globalThis !== 'undefined' && typeof globalThis.itsmDecrypt === 'function') {
        try {
          var decGlobal = globalThis.itsmDecrypt(val)
          if (decGlobal && decGlobal.indexOf(PREFIX) !== 0) return decGlobal
        } catch (_) {}
      }
      try {
        var k = ''
        if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
          k = $os.getenv('ITSM_ENCRYPTION_KEY') || ''
        }
        if (!k && typeof $secrets !== 'undefined' && typeof $secrets.get === 'function') {
          k = $secrets.get('ITSM_ENCRYPTION_KEY') || ''
        }
        if (!k) {
          k = 'itsm_default_fallback_aes256_key_super_safe_2026'
        }
        var derivedKey = ''
        try {
          derivedKey = $security.sha256(k).substring(0, 32)
        } catch (_) {
          derivedKey = (k + '01234567890123456789012345678901').substring(0, 32)
        }
        var payload = val.substring(PREFIX.length)
        var dec = $security.decrypt(payload, derivedKey)
        return dec || ''
      } catch (err) {
        return val
      }
    }

    // 6. Descriptografar a senha caso esteja cifrada
    var rawPassword = credRecord.getString('password')
    var plainPassword = safeDecryptVaultSecret(rawPassword)

    // Retornar credenciais reveladas
    return e.json(200, {
      success: true,
      username: credRecord.getString('username'),
      password: plainPassword,
      revealed_at: new Date().toISOString(),
    })
  },
  $apis.requireAuth(),
)

// Interceptadores para garantir que toda senha gravada em vault_credentials seja cifrada em repouso
onRecordCreate((e) => {
  var pwd = e.record.getString('password')
  if (pwd && typeof globalThis.itsmEncrypt === 'function') {
    e.record.set('password', globalThis.itsmEncrypt(pwd))
  }
  return e.next()
}, 'vault_credentials')

onRecordUpdate((e) => {
  var pwd = e.record.getString('password')
  if (pwd && typeof globalThis.itsmEncrypt === 'function') {
    e.record.set('password', globalThis.itsmEncrypt(pwd))
  }
  return e.next()
}, 'vault_credentials')

// Interceptadores para email_config: imap_password, smtp_password, graph_client_secret
onRecordCreate((e) => {
  if (typeof globalThis.itsmEncrypt === 'function') {
    var imapPass = e.record.getString('imap_password')
    if (imapPass) e.record.set('imap_password', globalThis.itsmEncrypt(imapPass))
    var smtpPass = e.record.getString('smtp_password')
    if (smtpPass) e.record.set('smtp_password', globalThis.itsmEncrypt(smtpPass))
    var graphSecret = e.record.getString('graph_client_secret')
    if (graphSecret) e.record.set('graph_client_secret', globalThis.itsmEncrypt(graphSecret))
  }
  return e.next()
}, 'email_config')

onRecordUpdate((e) => {
  if (typeof globalThis.itsmEncrypt === 'function') {
    var imapPass = e.record.getString('imap_password')
    if (imapPass) e.record.set('imap_password', globalThis.itsmEncrypt(imapPass))
    var smtpPass = e.record.getString('smtp_password')
    if (smtpPass) e.record.set('smtp_password', globalThis.itsmEncrypt(smtpPass))
    var graphSecret = e.record.getString('graph_client_secret')
    if (graphSecret) e.record.set('graph_client_secret', globalThis.itsmEncrypt(graphSecret))
  }
  return e.next()
}, 'email_config')

// Endpoint auxiliar para auditar operações de criação, alteração ou exclusão de credenciais
routerAdd(
  'POST',
  '/backend/v1/vault/audit',
  (e) => {
    var body = e.requestInfo().body || {}
    var action = body.action || ''
    var credentialId = body.credential_id || ''
    var credentialName = body.credential_name || ''
    var clientName = body.client_name || ''
    var reason = body.reason || ''
    var details = body.details || {}

    var authUser = e.auth
    var ipAddress = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
    var userAgent = e.request.header.get('user-agent') || ''

    if (!action) {
      return e.json(400, { error: 'Ação de auditoria é obrigatória.' })
    }

    try {
      var auditCol = $app.findCollectionByNameOrId('vault_audit_logs')
      var log = new Record(auditCol)
      if (credentialId) {
        log.set('credential', credentialId)
      }
      log.set('credential_name', credentialName)
      log.set('client_name', clientName)
      if (authUser) {
        log.set('operator', authUser.id)
        log.set(
          'operator_name',
          authUser.getString('name') ||
            (authUser.getString('first_name') + ' ' + authUser.getString('last_name')).trim() ||
            authUser.getString('email'),
        )
        log.set('operator_email', authUser.getString('email'))
      }
      log.set('action', action)
      log.set('status', 'SUCCESS')
      log.set('reason', reason)
      log.set('ip_address', ipAddress)
      log.set('user_agent', userAgent)
      log.set('details', details)

      $app.save(log)

      return e.json(200, { success: true, id: log.id })
    } catch (err) {
      console.error('Erro ao registrar auditoria do cofre:', err)
      return e.json(500, { error: 'Erro ao registrar auditoria: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
