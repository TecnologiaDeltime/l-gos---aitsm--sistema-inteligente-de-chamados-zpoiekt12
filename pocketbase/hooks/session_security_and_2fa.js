// Hook de Sessão, Bloqueio de Tentativas de Login e 2FA TOTP para Administradores
// ITSM Security Hardening - Skip Cloud PocketBase Hook
// IMPORTANTE: Todas as funções auxiliares ficam declaradas internamente em cada callback/handler
// para total compatibilidade com os pools isolados de execução do JSVM do PocketBase.

// =========================================================================
// PARTE 1: INTERCEPTAÇÃO DE LOGIN COM SENHA E BLOQUEIO DE TENTATIVAS
// =========================================================================
onRecordAuthWithPasswordRequest((e) => {
  // Helper interno de configurações de segurança
  function getSecuritySettings() {
    var defaults = {
      session_timeout_minutes: 60,
      max_login_attempts: 5,
      lockout_duration_minutes: 15,
      require_2fa_admin: true,
      require_2fa_gestor: false,
    }
    try {
      var records = $app.findRecordsByFilter('security_settings', '', '-created', 1, 0)
      if (records && records.length > 0) {
        var r = records[0]
        return {
          id: r.id,
          session_timeout_minutes: r.getInt('session_timeout_minutes') || 60,
          max_login_attempts: r.getInt('max_login_attempts') || 5,
          lockout_duration_minutes: r.getInt('lockout_duration_minutes') || 15,
          require_2fa_admin: r.getBool('require_2fa_admin'),
          require_2fa_gestor: r.getBool('require_2fa_gestor'),
        }
      }
    } catch (_) {}
    return defaults
  }

  // Helper interno para captura segura de IP
  function getClientIp(evt) {
    try {
      if (!evt) return ''
      if (typeof evt.requestInfo === 'function') {
        var info = evt.requestInfo()
        if (info && info.headers) {
          var xf = info.headers['x-forwarded-for'] || info.headers['X-Forwarded-For']
          if (xf) {
            var parts = String(xf).split(',')
            return parts[0].trim()
          }
          var ra = info.headers['remote-addr'] || info.headers['Remote-Addr']
          if (ra) return String(ra).trim()
        }
      }
    } catch (_) {}

    try {
      if (evt && evt.httpContext && typeof evt.httpContext.realIP === 'function') {
        var realIp = evt.httpContext.realIP()
        if (realIp) return String(realIp).trim()
      }
    } catch (_) {}

    return ''
  }

  // Helper interno para captura segura de User-Agent
  function getClientUserAgent(evt) {
    try {
      if (!evt) return ''
      if (typeof evt.requestInfo === 'function') {
        var info = evt.requestInfo()
        if (info && info.headers) {
          var ua = info.headers['user-agent'] || info.headers['User-Agent']
          if (ua) return String(ua).trim()
        }
      }
    } catch (_) {}
    return ''
  }

  // Helper interno de log de tentativa
  function recordLoginAttempt(email, ip, userAgent, outcome, details) {
    try {
      var col = $app.findCollectionByNameOrId('login_attempt_logs')
      var rec = new Record(col)
      rec.set('email', (email || '').toLowerCase().trim())
      rec.set('ip_address', ip || '')
      rec.set('user_agent', userAgent || '')
      rec.set('outcome', outcome)
      rec.set('details', details || '')
      $app.save(rec)
    } catch (_) {}

    try {
      var auditCol = $app.findCollectionByNameOrId('audit_logs')
      var auditRec = new Record(auditCol)
      auditRec.set('action', 'AUTH_' + outcome.toUpperCase())
      auditRec.set('entity_type', 'users')
      auditRec.set('entity_id', email)
      auditRec.set('description', 'Tentativa de login: ' + outcome + ' - ' + (details || ''))
      auditRec.set('ip_address', ip || '')
      auditRec.set('user_agent', userAgent || '')
      $app.save(auditRec)
    } catch (_) {}
  }

  var identity = ''
  var ip = ''
  var ua = ''
  var settings = { max_login_attempts: 5, lockout_duration_minutes: 15 }
  var userRecord = null

  try {
    identity = (e.identity || '').toLowerCase().trim()
    ip = getClientIp(e)
    ua = getClientUserAgent(e)
    settings = getSecuritySettings()
  } catch (initErr) {
    console.log('Aviso pre-init auth request:', initErr)
  }

  // 1. Procurar o usuário para verificar bloqueio antes da autenticação
  try {
    if (identity) {
      userRecord = $app.findAuthRecordByEmail('_pb_users_auth_', identity)
    }
  } catch (_) {}

  if (userRecord) {
    try {
      var lockedUntilStr = userRecord.getString('locked_until')
      if (lockedUntilStr) {
        var lockedUntil = new Date(lockedUntilStr)
        var now = new Date()
        if (lockedUntil > now) {
          var remainingMin = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000))
          try {
            recordLoginAttempt(
              identity,
              ip,
              ua,
              'account_locked',
              'Tentativa de login em conta bloqueada. Restam ' + remainingMin + ' min.',
            )
          } catch (_) {}
          throw new ForbiddenError(
            'Sua conta está temporariamente bloqueada por excesso de tentativas incorretas. Tente novamente em ' +
              remainingMin +
              ' minuto(s) ou contate o administrador.',
          )
        } else {
          // O tempo de bloqueio expirou: resetar o contador
          userRecord.set('locked_until', null)
          userRecord.set('failed_login_attempts', 0)
          $app.save(userRecord)
        }
      }
    } catch (lockCheckErr) {
      if (lockCheckErr instanceof ForbiddenError) {
        throw lockCheckErr
      }
      console.log('Aviso ao checar tempo de bloqueio:', lockCheckErr)
    }
  }

  // 2. Executar a autenticação original
  try {
    e.next()
  } catch (authErr) {
    // Falha na senha ou credencial incorreta
    try {
      if (userRecord) {
        var failed = (userRecord.getInt('failed_login_attempts') || 0) + 1
        userRecord.set('failed_login_attempts', failed)

        if (failed >= settings.max_login_attempts) {
          var lockDate = new Date(Date.now() + settings.lockout_duration_minutes * 60000)
          userRecord.set('locked_until', lockDate.toISOString())
          $app.save(userRecord)

          recordLoginAttempt(
            identity,
            ip,
            ua,
            'account_locked',
            'Conta bloqueada após ' +
              failed +
              ' tentativas falhas. Bloqueio por ' +
              settings.lockout_duration_minutes +
              ' min.',
          )

          throw new ForbiddenError(
            'Número máximo de tentativas excedido (' +
              settings.max_login_attempts +
              '). Sua conta foi bloqueada por ' +
              settings.lockout_duration_minutes +
              ' minutos por motivos de segurança.',
          )
        } else {
          $app.save(userRecord)
          var attemptsLeft = settings.max_login_attempts - failed
          recordLoginAttempt(
            identity,
            ip,
            ua,
            'failed_password',
            'Senha incorreta. Tentativa ' + failed + '/' + settings.max_login_attempts,
          )
          throw new BadRequestError(
            'E-mail ou senha incorretos. Você tem mais ' +
              attemptsLeft +
              ' tentativa(s) antes do bloqueio da conta.',
          )
        }
      } else {
        recordLoginAttempt(
          identity,
          ip,
          ua,
          'failed_password',
          'Usuário não encontrado: ' + identity,
        )
        throw new BadRequestError('E-mail ou senha incorretos.')
      }
    } catch (handlingErr) {
      if (handlingErr instanceof ForbiddenError || handlingErr instanceof BadRequestError) {
        throw handlingErr
      }
      console.log('Aviso no tratamento de falha de login:', handlingErr)
      throw authErr
    }
  }

  // 3. Sucesso na senha: resetar contadores de falha e atualizar session_last_activity
  try {
    if (e.record) {
      e.record.set('failed_login_attempts', 0)
      e.record.set('locked_until', null)
      e.record.set('session_last_activity', new Date().toISOString())
      $app.save(e.record)

      recordLoginAttempt(identity, ip, ua, 'success', 'Login realizado com sucesso com senha.')
    }
  } catch (postAuthErr) {
    console.log('Aviso no pós-sucesso de login:', postAuthErr)
  }
}, 'users')

// Interceptador para Password Reset nativo do PocketBase
onRecordRequestPasswordResetRequest((e) => {
  try {
    e.next()
  } catch (resetErr) {
    console.log('Aviso onRecordRequestPasswordResetRequest:', resetErr)
    try {
      var userEmail = (e.record && e.record.email()) || (e.user && e.user.email()) || ''
      if (userEmail && typeof globalThis.sendSystemEmail === 'function') {
        globalThis.sendSystemEmail({
          to: userEmail,
          subject: 'Recuperação de Acesso - ServiceOne ITSM',
          text: 'Recebemos uma solicitação de recuperação de senha para a sua conta no ServiceOne ITSM. Se você solicitou a recuperação, contate o administrador para receber uma nova senha provisória.',
          html: '<p>Recebemos uma solicitação de recuperação de senha para a sua conta no ServiceOne ITSM.</p><p>Se você solicitou a recuperação, contate o administrador para receber uma nova senha provisória.</p>',
        })
        return
      }
    } catch (fallbackMailErr) {
      console.log('Aviso ao disparar e-mail de recuperação alternativo:', fallbackMailErr)
    }
    throw new BadRequestError(
      'Não foi possível enviar o e-mail de recuperação no momento. Verifique com o administrador do sistema.',
    )
  }
}, 'users')

// =========================================================================
// CRON DE INVALIDEZ DE SESSÕES EXPIRADAS
// =========================================================================
cronAdd('itsm_session_invalidation', '*/5 * * * *', () => {
  try {
    var timeoutMinutes = 60
    try {
      var records = $app.findRecordsByFilter('security_settings', '', '-created', 1, 0)
      if (records && records.length > 0) {
        timeoutMinutes = records[0].getInt('session_timeout_minutes') || 60
      }
    } catch (_) {}

    var cutoff = new Date(Date.now() - timeoutMinutes * 60000)
    var filter =
      "session_last_activity != '' && session_last_activity != null && session_last_activity <= '" +
      cutoff.toISOString() +
      "'"
    var staleUsers = $app.findRecordsByFilter('users', filter, '', 100, 0)
    for (var i = 0; i < staleUsers.length; i++) {
      var u = staleUsers[i]
      var lastAct = u.getString('session_last_activity')
      if (!lastAct || lastAct.trim() === '') {
        continue
      }
      var actDate = new Date(lastAct)
      if (isNaN(actDate.getTime()) || actDate > cutoff) {
        continue
      }
      u.set('tokenKey', $security.randomString(30))
      u.set('session_last_activity', null)
      $app.save(u)
    }
  } catch (cronErr) {
    console.log('Erro no cron itsm_session_invalidation:', cronErr)
  }
})

// =========================================================================
// ROTAS BACKEND /backend/v1/auth/*
// =========================================================================

// 1. Rota de Renovação / Heartbeat de Sessão (Keep-Alive)
routerAdd('POST', '/backend/v1/auth/session/heartbeat', (e) => {
  var authUser = e.auth

  // Fallback: se e.auth não estiver preenchido pelo middleware, tentar resolver pelo token do cabeçalho
  if (!authUser) {
    try {
      var authHeader = ''
      if (typeof e.requestInfo === 'function') {
        var info = e.requestInfo()
        if (info && info.headers) {
          authHeader = info.headers['authorization'] || info.headers['Authorization'] || ''
        }
      }
      if (!authHeader && e.httpContext && typeof e.httpContext.request === 'function') {
        var req = e.httpContext.request()
        if (req && req.header) {
          authHeader = req.header.get('Authorization') || req.header.get('authorization') || ''
        }
      }

      var token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (token) {
        try {
          authUser = $app.findAuthRecordByToken(token, 'auth')
        } catch (_) {
          try {
            authUser = $app.findAuthRecordByToken(token)
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  if (!authUser) {
    return e.json(401, { error: 'Sessão expirada ou não autenticado.' })
  }

  try {
    authUser.set('session_last_activity', new Date().toISOString())
    $app.save(authUser)
    return e.json(200, {
      success: true,
      session_last_activity: authUser.getString('session_last_activity'),
    })
  } catch (err) {
    return e.json(500, { error: 'Falha ao atualizar sessão: ' + err.message })
  }
})

// 2. Rota para Obter Configurações de Sessão e Política de 2FA
routerAdd('GET', '/backend/v1/auth/security-policy', (e) => {
  var defaults = {
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    require_2fa_admin: true,
    require_2fa_gestor: false,
  }
  try {
    var records = $app.findRecordsByFilter('security_settings', '', '-created', 1, 0)
    if (records && records.length > 0) {
      var r = records[0]
      return e.json(200, {
        session_timeout_minutes: r.getInt('session_timeout_minutes') || 60,
        max_login_attempts: r.getInt('max_login_attempts') || 5,
        lockout_duration_minutes: r.getInt('lockout_duration_minutes') || 15,
        require_2fa_admin: r.getBool('require_2fa_admin'),
        require_2fa_gestor: r.getBool('require_2fa_gestor'),
      })
    }
  } catch (err) {
    console.log('Erro ao retornar security-policy:', err)
  }
  return e.json(200, defaults)
})

// 3. Rota de Atualização das Configurações de Segurança (Apenas Admin)
routerAdd(
  'POST',
  '/backend/v1/auth/security-policy',
  (e) => {
    var authUser = e.auth
    if (!authUser || authUser.getString('role') !== 'admin') {
      return e.json(403, {
        error: 'Apenas administradores podem alterar as políticas de segurança.',
      })
    }
    var body = e.requestInfo().body || {}
    try {
      var col = $app.findCollectionByNameOrId('security_settings')
      var recs = $app.findRecordsByFilter('security_settings', '', '-created', 1, 0)
      var rec = recs && recs.length > 0 ? recs[0] : new Record(col)

      if (body.session_timeout_minutes !== undefined) {
        rec.set('session_timeout_minutes', parseInt(body.session_timeout_minutes, 10) || 60)
      }
      if (body.max_login_attempts !== undefined) {
        rec.set('max_login_attempts', parseInt(body.max_login_attempts, 10) || 5)
      }
      if (body.lockout_duration_minutes !== undefined) {
        rec.set('lockout_duration_minutes', parseInt(body.lockout_duration_minutes, 10) || 15)
      }
      if (body.require_2fa_admin !== undefined) {
        rec.set('require_2fa_admin', !!body.require_2fa_admin)
      }
      if (body.require_2fa_gestor !== undefined) {
        rec.set('require_2fa_gestor', !!body.require_2fa_gestor)
      }
      $app.save(rec)

      return e.json(200, {
        success: true,
        settings: {
          session_timeout_minutes: rec.getInt('session_timeout_minutes'),
          max_login_attempts: rec.getInt('max_login_attempts'),
          lockout_duration_minutes: rec.getInt('lockout_duration_minutes'),
          require_2fa_admin: rec.getBool('require_2fa_admin'),
          require_2fa_gestor: rec.getBool('require_2fa_gestor'),
        },
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao salvar parâmetros: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 4. Rota para Desbloqueio Manual de Usuário (Admin)
routerAdd(
  'POST',
  '/backend/v1/auth/unlock-user',
  (e) => {
    var authUser = e.auth
    if (!authUser || authUser.getString('role') !== 'admin') {
      return e.json(403, { error: 'Apenas administradores podem desbloquear contas.' })
    }
    var body = e.requestInfo().body || {}
    var targetUserId = body.user_id || ''
    if (!targetUserId) {
      return e.json(400, { error: 'ID do usuário é obrigatório.' })
    }

    try {
      var targetUser = $app.findRecordById('users', targetUserId)
      targetUser.set('failed_login_attempts', 0)
      targetUser.set('locked_until', null)
      $app.save(targetUser)

      var ip = ''
      var ua = ''
      try {
        var info = e.requestInfo()
        if (info && info.headers) {
          ip = info.headers['x-forwarded-for'] || info.headers['remote-addr'] || ''
          ua = info.headers['user-agent'] || ''
        }
      } catch (_) {}

      try {
        var col = $app.findCollectionByNameOrId('login_attempt_logs')
        var rec = new Record(col)
        rec.set('email', targetUser.getString('email').toLowerCase().trim())
        rec.set('ip_address', ip)
        rec.set('user_agent', ua)
        rec.set('outcome', 'unlocked_by_admin')
        rec.set(
          'details',
          'Conta desbloqueada manualmente pelo administrador ' + authUser.getString('email'),
        )
        $app.save(rec)
      } catch (_) {}

      return e.json(200, { success: true, message: 'Conta desbloqueada com sucesso.' })
    } catch (err) {
      return e.json(500, { error: 'Falha ao desbloquear conta: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 5. Rota de Status 2FA do Usuário no Login ou Perfil
routerAdd('POST', '/backend/v1/auth/2fa/check', (e) => {
  var body = e.requestInfo().body || {}
  var email = (body.email || '').toLowerCase().trim()
  if (!email) {
    return e.json(400, { error: 'E-mail é obrigatório.' })
  }

  try {
    var user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    var role = user.getString('role')

    // Administrador de testes dedicado não exige 2FA
    if (email === 'admin@teste.local') {
      return e.json(200, {
        required: false,
        configured: false,
        needs_setup: false,
        user_id: user.id,
        role: role,
      })
    }

    var requireAdmin = true
    var requireGestor = false
    try {
      var secRecords = $app.findRecordsByFilter('security_settings', '', '-created', 1, 0)
      if (secRecords && secRecords.length > 0) {
        requireAdmin = secRecords[0].getBool('require_2fa_admin')
        requireGestor = secRecords[0].getBool('require_2fa_gestor')
      }
    } catch (_) {}

    var is2faRequired = (role === 'admin' && requireAdmin) || (role === 'gestor' && requireGestor)

    var isEnabled = false
    try {
      var totpList = $app.findRecordsByFilter('user_totp', "user = '" + user.id + "'", '', 1, 0)
      if (totpList && totpList.length > 0) {
        isEnabled = totpList[0].getBool('is_enabled')
      }
    } catch (_) {}

    return e.json(200, {
      required: is2faRequired,
      configured: isEnabled,
      needs_setup: is2faRequired && !isEnabled,
      user_id: user.id,
      role: role,
    })
  } catch (_) {
    return e.json(200, { required: false, configured: false, needs_setup: false })
  }
})

// 6. Rota para Iniciar Configuração de 2FA (Setup)
routerAdd(
  'POST',
  '/backend/v1/auth/2fa/setup',
  (e) => {
    var authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Não autenticado.' })
    }

    var BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    var newSecret = ''
    for (var i = 0; i < 16; i++) {
      var rand = Math.floor(Math.random() * BASE32_CHARS.length)
      newSecret += BASE32_CHARS.charAt(rand)
    }

    var recoveryCodes = []
    for (var r = 0; r < 8; r++) {
      var p1 = $security.randomString(4).toUpperCase()
      var p2 = $security.randomString(4).toUpperCase()
      recoveryCodes.push(p1 + '-' + p2)
    }

    var encSecret = newSecret
    if (typeof globalThis.itsmEncrypt === 'function') {
      encSecret = globalThis.itsmEncrypt(newSecret)
    }

    var encRecoveryCodes = []
    for (var j = 0; j < recoveryCodes.length; j++) {
      var c = recoveryCodes[j]
      if (typeof globalThis.itsmEncrypt === 'function') {
        encRecoveryCodes.push(globalThis.itsmEncrypt(c))
      } else {
        encRecoveryCodes.push(c)
      }
    }

    try {
      var totpCol = $app.findCollectionByNameOrId('user_totp')
      var existing = $app.findRecordsByFilter('user_totp', "user = '" + authUser.id + "'", '', 1, 0)
      var rec = existing && existing.length > 0 ? existing[0] : new Record(totpCol)

      rec.set('user', authUser.id)
      rec.set('secret', encSecret)
      rec.set('is_enabled', false)
      rec.set('recovery_codes', JSON.stringify(encRecoveryCodes))
      $app.save(rec)

      var userEmail = authUser.getString('email')
      var issuer = 'ITSM ServiceOne'
      var otpauthUrl =
        'otpauth://totp/' +
        encodeURIComponent(issuer) +
        ':' +
        encodeURIComponent(userEmail) +
        '?secret=' +
        newSecret +
        '&issuer=' +
        encodeURIComponent(issuer) +
        '&algorithm=SHA256&digits=6&period=30'

      return e.json(200, {
        success: true,
        secret: newSecret,
        otpauth_url: otpauthUrl,
        recovery_codes: recoveryCodes,
      })
    } catch (err) {
      return e.json(500, { error: 'Falha ao iniciar setup do 2FA: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 7. Rota para Confirmar Configuração de 2FA com primeiro código
routerAdd(
  'POST',
  '/backend/v1/auth/2fa/confirm',
  (e) => {
    var authUser = e.auth
    if (!authUser) {
      return e.json(401, { error: 'Não autenticado.' })
    }
    var body = e.requestInfo().body || {}
    var token = (body.code || '').trim()

    function computeCode(secret, timeStep) {
      var stepStr = String(timeStep)
      var hmacHex = $security.hs256(stepStr, secret)
      var offset = parseInt(hmacHex.substring(hmacHex.length - 1), 16)
      var sub = hmacHex.substring(offset * 2, offset * 2 + 8)
      var num = parseInt(sub, 16) & 0x7fffffff
      var c = String(num % 1000000)
      while (c.length < 6) {
        c = '0' + c
      }
      return c
    }

    try {
      var existing = $app.findRecordsByFilter('user_totp', "user = '" + authUser.id + "'", '', 1, 0)
      if (!existing || existing.length === 0) {
        return e.json(400, { error: 'Configuração de 2FA não iniciada.' })
      }
      var rec = existing[0]
      // Descriptografia autocontida do segredo TOTP
      function safeDecryptTotp(val) {
        if (!val || typeof val !== 'string') return ''
        var PREFIX = 'enc:v1:'
        if (val.indexOf(PREFIX) !== 0) return val
        if (typeof globalThis !== 'undefined' && typeof globalThis.itsmDecrypt === 'function') {
          try {
            var decG = globalThis.itsmDecrypt(val)
            if (decG && decG.indexOf(PREFIX) !== 0) return decG
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
          if (!k) k = 'itsm_default_fallback_aes256_key_super_safe_2026'
          var derivedKey = ''
          try {
            derivedKey = $security.sha256(k).substring(0, 32)
          } catch (_) {
            derivedKey = (k + '01234567890123456789012345678901').substring(0, 32)
          }
          var payload = val.substring(PREFIX.length)
          var dec = $security.decrypt(payload, derivedKey)
          return dec || ''
        } catch (_) {
          return val
        }
      }

      var rawSecret = rec.getString('secret')
      var plainSecret = safeDecryptTotp(rawSecret)

      var nowSec = Math.floor(Date.now() / 1000)
      var currentStep = Math.floor(nowSec / 30)
      var matchedStep = null

      for (var skew = -1; skew <= 1; skew++) {
        var testStep = currentStep + skew
        var exp = computeCode(plainSecret, testStep)
        if (exp === token) {
          matchedStep = testStep
          break
        }
      }

      if (matchedStep === null) {
        return e.json(400, {
          error: 'Código inválido ou expirado. Verifique a hora do seu dispositivo.',
        })
      }

      rec.set('is_enabled', true)
      rec.set('confirmed_at', new Date().toISOString())
      rec.set('last_used_step', matchedStep)
      $app.save(rec)

      authUser.set('totp_enabled', true)
      $app.save(authUser)

      return e.json(200, { success: true, message: '2FA ativado com sucesso!' })
    } catch (err) {
      return e.json(500, { error: 'Erro ao confirmar 2FA: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 8. Rota para Validar Código 2FA ou Código de Recuperação no Login
routerAdd('POST', '/backend/v1/auth/2fa/verify', (e) => {
  var body = e.requestInfo().body || {}
  var email = (body.email || '').toLowerCase().trim()
  var code = (body.code || '').trim()
  var isRecovery = !!body.is_recovery

  if (!email || !code) {
    return e.json(400, { error: 'E-mail e código são obrigatórios.' })
  }

  function computeCode(secret, timeStep) {
    var stepStr = String(timeStep)
    var hmacHex = $security.hs256(stepStr, secret)
    var offset = parseInt(hmacHex.substring(hmacHex.length - 1), 16)
    var sub = hmacHex.substring(offset * 2, offset * 2 + 8)
    var num = parseInt(sub, 16) & 0x7fffffff
    var c = String(num % 1000000)
    while (c.length < 6) {
      c = '0' + c
    }
    return c
  }

  try {
    var user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    var existing = $app.findRecordsByFilter('user_totp', "user = '" + user.id + "'", '', 1, 0)
    if (!existing || existing.length === 0 || !existing[0].getBool('is_enabled')) {
      return e.json(400, { error: '2FA não configurado para esta conta.' })
    }
    var rec = existing[0]

    if (isRecovery) {
      var rawCodesStr = rec.getString('recovery_codes')
      var storedCodes = []
      try {
        storedCodes = JSON.parse(rawCodesStr) || []
      } catch (_) {}

      var matchedIndex = -1
      for (var i = 0; i < storedCodes.length; i++) {
        var sc = storedCodes[i]
        var plainSc = safeDecryptTotp(sc)
        if (plainSc.toUpperCase() === code.toUpperCase()) {
          matchedIndex = i
          break
        }
      }

      if (matchedIndex === -1) {
        return e.json(400, { error: 'Código de recuperação inválido ou já utilizado.' })
      }

      storedCodes.splice(matchedIndex, 1)
      rec.set('recovery_codes', JSON.stringify(storedCodes))
      $app.save(rec)

      return e.json(200, {
        success: true,
        message: 'Autenticação 2FA por código de recuperação concluída.',
      })
    }

    var rawSecret = rec.getString('secret')
    var plainSecret = safeDecryptTotp(rawSecret)

    var nowSec = Math.floor(Date.now() / 1000)
    var currentStep = Math.floor(nowSec / 30)
    var validStep = null

    for (var skew = -1; skew <= 1; skew++) {
      var testStep = currentStep + skew
      var expected = computeCode(plainSecret, testStep)
      if (expected === code) {
        validStep = testStep
        break
      }
    }

    if (validStep === null) {
      return e.json(400, { error: 'Código inválido ou expirado. Tente novamente.' })
    }

    var lastStep = rec.getInt('last_used_step')
    if (lastStep && lastStep >= validStep) {
      return e.json(400, {
        error: 'Código já utilizado. Aguarde o próximo código no seu aplicativo.',
      })
    }

    rec.set('last_used_step', validStep)
    $app.save(rec)

    return e.json(200, { success: true, message: 'Autenticação de 2 fatores concluída.' })
  } catch (err) {
    return e.json(500, { error: 'Erro ao verificar código: ' + err.message })
  }
})

// 9. Rota para Administrador Resetar/Desativar 2FA de outro usuário
routerAdd(
  'POST',
  '/backend/v1/auth/2fa/reset-user',
  (e) => {
    var authUser = e.auth
    if (!authUser || authUser.getString('role') !== 'admin') {
      return e.json(403, { error: 'Apenas administradores podem reiniciar o 2FA de usuários.' })
    }
    var body = e.requestInfo().body || {}
    var targetUserId = body.user_id || ''
    if (!targetUserId) {
      return e.json(400, { error: 'ID do usuário é obrigatório.' })
    }

    try {
      var targetUser = $app.findRecordById('users', targetUserId)
      var totpList = $app.findRecordsByFilter(
        'user_totp',
        "user = '" + targetUserId + "'",
        '',
        1,
        0,
      )
      if (totpList && totpList.length > 0) {
        $app.delete(totpList[0])
      }
      targetUser.set('totp_enabled', false)
      $app.save(targetUser)

      return e.json(200, {
        success: true,
        message: '2FA do usuário reiniciado. Ele precisará reconfigurar no próximo acesso.',
      })
    } catch (err) {
      return e.json(500, { error: 'Falha ao reiniciar 2FA: ' + err.message })
    }
  },
  $apis.requireAuth(),
)

// 10. Rota Segura de Solicitação de Recuperação de Senha (Evita 400 genérico se SMTP falhar)
routerAdd('POST', '/backend/v1/auth/request-password-reset', (e) => {
  var body = e.requestInfo().body || {}
  var email = (body.email || '').toLowerCase().trim()

  if (!email) {
    return e.json(400, { error: 'E-mail é obrigatório.' })
  }

  try {
    var user = null
    try {
      user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}

    if (!user) {
      // Resposta opaca para proteção de enumeração de usuários
      return e.json(200, {
        success: true,
        message:
          'Se o e-mail estiver cadastrado, as orientações de recuperação foram encaminhadas.',
      })
    }

    var emailSent = false

    if (typeof globalThis.sendSystemEmail === 'function') {
      try {
        globalThis.sendSystemEmail({
          to: email,
          subject: 'Recuperação de Acesso - ServiceOne ITSM',
          text:
            'Olá ' +
            (user.getString('name') || 'usuário') +
            ',\n\nRecebemos uma solicitação de recuperação de senha para a sua conta no ServiceOne ITSM.\n' +
            'Por favor, contate o administrador de TI da sua organização para obter sua nova senha provisória de acesso.',
          html:
            '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">' +
            '<h2 style="color: #1e3a8a;">ServiceOne ITSM</h2>' +
            '<p>Olá <strong>' +
            (user.getString('name') || 'usuário') +
            '</strong>,</p>' +
            '<p>Recebemos uma solicitação de recuperação de senha para a sua conta.</p>' +
            '<p>Por questões de política interna de segurança, entre em contato com o administrador de TI ou suporte interno para a atribuição de uma credencial temporária.</p>' +
            '</div>',
        })
        emailSent = true
      } catch (sendErr) {
        console.log('Aviso ao enviar e-mail de recuperação:', sendErr)
      }
    }

    return e.json(200, {
      success: true,
      email_sent: emailSent,
      message: emailSent
        ? 'As orientações de recuperação foram enviadas para seu e-mail cadastrado.'
        : 'Sua solicitação foi registrada no sistema. Como o serviço de envio de e-mails está operando em contingência, contate o administrador para obter sua senha temporária.',
    })
  } catch (err) {
    return e.json(200, {
      success: true,
      message: 'Se o e-mail estiver cadastrado, as orientações de recuperação foram encaminhadas.',
    })
  }
})
