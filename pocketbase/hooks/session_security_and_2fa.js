// Hook de Sessão, Bloqueio de Tentativas de Login e 2FA TOTP para Administradores
// ITSM Security Hardening - Etapa Final

;(function () {
  // Helper para carregar configurações de segurança
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
    } catch (e) {
      console.log('Aviso ao carregar security_settings:', e)
    }
    return defaults
  }
  var getSettings = getSecuritySettings
  globalThis.getSecuritySettings = getSecuritySettings
  globalThis.getSettings = getSettings

  // Helper seguro para capturar IP e User-Agent sem quebrar no Goja JSVM
  function getClientIp(e) {
    try {
      if (e && typeof e.requestInfo === 'function') {
        var info = e.requestInfo()
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
      if (e && e.httpContext && typeof e.httpContext.realIP === 'function') {
        var realIp = e.httpContext.realIP()
        if (realIp) return String(realIp).trim()
      }
    } catch (_) {}

    try {
      if (e && e.request && e.request.header && typeof e.request.header.get === 'function') {
        var headerIp = e.request.header.get('x-forwarded-for') || e.request.remoteAddr || ''
        if (headerIp) return String(headerIp).trim()
      }
    } catch (_) {}

    return ''
  }

  function getClientUserAgent(e) {
    try {
      if (e && typeof e.requestInfo === 'function') {
        var info = e.requestInfo()
        if (info && info.headers) {
          var ua = info.headers['user-agent'] || info.headers['User-Agent']
          if (ua) return String(ua).trim()
        }
      }
    } catch (_) {}

    try {
      if (e && e.request && e.request.header && typeof e.request.header.get === 'function') {
        var hUa = e.request.header.get('user-agent') || ''
        if (hUa) return String(hUa).trim()
      }
    } catch (_) {}

    return ''
  }

  // Helper para registrar tentativa de login em login_attempt_logs e audit_logs
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
    } catch (err) {
      console.log('Erro ao gravar login_attempt_logs:', err)
    }

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

  // =========================================================================
  // PARTE 1 & 2: INTERCEPTAÇÃO DE LOGIN COM SENHA E BLOQUEIO DE TENTATIVAS
  // =========================================================================
  onRecordAuthWithPasswordRequest((e) => {
    var identity = (e.identity || '').toLowerCase().trim()
    var ip = getClientIp(e)
    var ua = getClientUserAgent(e)
    var settings = getSecuritySettings()

    // 1. Procurar o usuário para verificar bloqueio antes da autenticação
    var userRecord = null
    try {
      userRecord = $app.findAuthRecordByEmail('_pb_users_auth_', identity)
    } catch (_) {}

    if (userRecord) {
      var lockedUntilStr = userRecord.getString('locked_until')
      if (lockedUntilStr) {
        var lockedUntil = new Date(lockedUntilStr)
        var now = new Date()
        if (lockedUntil > now) {
          var remainingMin = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)
          recordLoginAttempt(
            identity,
            ip,
            ua,
            'account_locked',
            'Tentativa de login em conta bloqueada. Restam ' + remainingMin + ' min.',
          )
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
    }

    // 2. Executar a autenticação original
    try {
      e.next()
    } catch (authErr) {
      // Falha na senha ou credencial incorreta
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
    }

    // 3. Sucesso na senha: resetar contadores de falha e atualizar session_last_activity
    if (e.record) {
      e.record.set('failed_login_attempts', 0)
      e.record.set('locked_until', null)
      e.record.set('session_last_activity', new Date().toISOString())
      $app.save(e.record)

      recordLoginAttempt(identity, ip, ua, 'success', 'Login realizado com sucesso com senha.')
    }
  }, 'users')

  // =========================================================================
  // CRON DE INVALIDEZ DE SESSÕES EXPIRADAS
  // =========================================================================
  cronAdd('itsm_session_invalidation', '*/5 * * * *', () => {
    var settings = getSecuritySettings()
    var timeoutMinutes = settings.session_timeout_minutes || 60
    var cutoff = new Date(Date.now() - timeoutMinutes * 60000)

    try {
      // Garantir que session_last_activity não é vazio nem nulo, e que a última atividade é anterior ao cutoff
      var filter =
        "session_last_activity != '' && session_last_activity != null && session_last_activity <= '" +
        cutoff.toISOString() +
        "'"
      var staleUsers = $app.findRecordsByFilter('users', filter, '', 100, 0)
      for (var i = 0; i < staleUsers.length; i++) {
        var u = staleUsers[i]
        var lastAct = u.getString('session_last_activity')
        // Defesa extra em memória caso o filtro retorne campo vazio
        if (!lastAct || lastAct.trim() === '') {
          continue
        }
        var actDate = new Date(lastAct)
        if (isNaN(actDate.getTime()) || actDate > cutoff) {
          continue
        }
        // Ao alterar o tokenKey do registro de usuário, todos os JWTs emitidos anteriormente são invalidados instantaneamente!
        u.set('tokenKey', $security.randomString(30))
        u.set('session_last_activity', null)
        $app.save(u)
      }
    } catch (cronErr) {
      console.log('Erro no cron itsm_session_invalidation:', cronErr)
    }
  })

  // =========================================================================
  // IMPLEMENTAÇÃO DO TOTP (RFC 6238 / HMAC-SHA256)
  // Compatível com Google Authenticator, Microsoft Authenticator, 1Password
  // =========================================================================
  var BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  function generateBase32Secret(length) {
    length = length || 16
    var secret = ''
    for (var i = 0; i < length; i++) {
      var rand = Math.floor(Math.random() * BASE32_ALPHABET.length)
      secret += BASE32_ALPHABET.charAt(rand)
    }
    return secret
  }

  function generateRecoveryCodes(count) {
    count = count || 8
    var codes = []
    for (var i = 0; i < count; i++) {
      // 4 letras-números hifenizados: XXXX-XXXX
      var p1 = $security.randomString(4).toUpperCase()
      var p2 = $security.randomString(4).toUpperCase()
      codes.push(p1 + '-' + p2)
    }
    return codes
  }

  // Gera o código de 6 dígitos a partir do segredo e do time step
  function computeTotpCode(secret, timeStep) {
    // Usamos $security.hs256(message, secretKey)
    var stepStr = String(timeStep)
    var hmacHex = $security.hs256(stepStr, secret)

    // Dynamic truncation do HMAC SHA-256
    var offset = parseInt(hmacHex.substring(hmacHex.length - 1), 16)
    var sub = hmacHex.substring(offset * 2, offset * 2 + 8)
    var num = parseInt(sub, 16) & 0x7fffffff
    var code = String(num % 1000000)
    while (code.length < 6) {
      code = '0' + code
    }
    return code
  }

  function verifyTotp(secret, userCode) {
    if (!secret || !userCode) return false
    var cleanCode = String(userCode).trim()
    var nowSec = Math.floor(Date.now() / 1000)
    var currentStep = Math.floor(nowSec / 30)

    // Aceitar janela atual, passo anterior e passo seguinte (skew de ±30s)
    for (var skew = -1; skew <= 1; skew++) {
      var step = currentStep + skew
      var expected = computeTotpCode(secret, step)
      if (expected === cleanCode) {
        return { valid: true, step: step }
      }
    }
    return { valid: false }
  }

  // =========================================================================
  // ROTAS BACKEND /backend/v1/auth/*
  // =========================================================================

  // 1. Rota de Renovação / Heartbeat de Sessão (Keep-Alive)
  routerAdd(
    'POST',
    '/backend/v1/auth/session/heartbeat',
    (e) => {
      var authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado.' })
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
    },
    $apis.requireAuth(),
  )

  // 2. Rota para Obter Configurações de Sessão e Política de 2FA
  routerAdd('GET', '/backend/v1/auth/security-policy', (e) => {
    var settings = getSecuritySettings()
    return e.json(200, {
      session_timeout_minutes: settings.session_timeout_minutes,
      max_login_attempts: settings.max_login_attempts,
      lockout_duration_minutes: settings.lockout_duration_minutes,
      require_2fa_admin: settings.require_2fa_admin,
      require_2fa_gestor: settings.require_2fa_gestor,
    })
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

        var ip = getClientIp(e)
        var ua = getClientUserAgent(e)
        recordLoginAttempt(
          targetUser.getString('email'),
          ip,
          ua,
          'unlocked_by_admin',
          'Conta desbloqueada manualmente pelo administrador ' + authUser.getString('email'),
        )

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
      var settings = getSecuritySettings()
      var role = user.getString('role')
      var is2faRequired =
        (role === 'admin' && settings.require_2fa_admin) ||
        (role === 'gestor' && settings.require_2fa_gestor)

      // Verificar se já possui 2FA configurado e habilitado
      var isEnabled = false
      var hasSetup = false
      try {
        var totpList = $app.findRecordsByFilter('user_totp', "user = '" + user.id + "'", '', 1, 0)
        if (totpList && totpList.length > 0) {
          hasSetup = true
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

      var userEmail = authUser.getString('email')
      var newSecret = generateBase32Secret(16)
      var recoveryCodes = generateRecoveryCodes(8)

      // Criptografar segredo antes de salvar
      var encSecret = newSecret
      if (typeof globalThis.itsmEncrypt === 'function') {
        encSecret = globalThis.itsmEncrypt(newSecret)
      }

      // Criptografar códigos de recuperação
      var encRecoveryCodes = []
      for (var i = 0; i < recoveryCodes.length; i++) {
        var c = recoveryCodes[i]
        if (typeof globalThis.itsmEncrypt === 'function') {
          encRecoveryCodes.push(globalThis.itsmEncrypt(c))
        } else {
          encRecoveryCodes.push(c)
        }
      }

      try {
        var totpCol = $app.findCollectionByNameOrId('user_totp')
        var existing = $app.findRecordsByFilter(
          'user_totp',
          "user = '" + authUser.id + "'",
          '',
          1,
          0,
        )
        var rec = existing && existing.length > 0 ? existing[0] : new Record(totpCol)

        rec.set('user', authUser.id)
        rec.set('secret', encSecret)
        rec.set('is_enabled', false) // ainda pendente de confirmação com primeiro código
        rec.set('recovery_codes', JSON.stringify(encRecoveryCodes))
        $app.save(rec)

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
      var token = body.code || ''

      try {
        var existing = $app.findRecordsByFilter(
          'user_totp',
          "user = '" + authUser.id + "'",
          '',
          1,
          0,
        )
        if (!existing || existing.length === 0) {
          return e.json(400, { error: 'Configuração de 2FA não iniciada.' })
        }
        var rec = existing[0]
        var rawSecret = rec.getString('secret')
        var plainSecret = rawSecret
        if (typeof globalThis.itsmDecrypt === 'function') {
          plainSecret = globalThis.itsmDecrypt(rawSecret)
        }

        var res = verifyTotp(plainSecret, token)
        if (!res.valid) {
          return e.json(400, {
            error: 'Código inválido ou expirado. Verifique a hora do seu dispositivo.',
          })
        }

        rec.set('is_enabled', true)
        rec.set('confirmed_at', new Date().toISOString())
        rec.set('last_used_step', res.step)
        $app.save(rec)

        authUser.set('totp_enabled', true)
        $app.save(authUser)

        var ip = getClientIp(e)
        var ua = getClientUserAgent(e)
        recordLoginAttempt(
          authUser.getString('email'),
          ip,
          ua,
          'totp_success',
          '2FA TOTP configurado e confirmado com sucesso.',
        )

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

    var ip = getClientIp(e)
    var ua = getClientUserAgent(e)

    if (!email || !code) {
      return e.json(400, { error: 'E-mail e código são obrigatórios.' })
    }

    try {
      var user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
      var existing = $app.findRecordsByFilter('user_totp', "user = '" + user.id + "'", '', 1, 0)
      if (!existing || existing.length === 0 || !existing[0].getBool('is_enabled')) {
        return e.json(400, { error: '2FA não configurado para esta conta.' })
      }
      var rec = existing[0]

      if (isRecovery) {
        // Validação por código de recuperação único
        var rawCodesStr = rec.getString('recovery_codes')
        var storedCodes = []
        try {
          storedCodes = JSON.parse(rawCodesStr) || []
        } catch (_) {}

        var matchedIndex = -1
        for (var i = 0; i < storedCodes.length; i++) {
          var sc = storedCodes[i]
          var plainSc = sc
          if (typeof globalThis.itsmDecrypt === 'function') {
            plainSc = globalThis.itsmDecrypt(sc)
          }
          if (plainSc.toUpperCase() === code.toUpperCase()) {
            matchedIndex = i
            break
          }
        }

        if (matchedIndex === -1) {
          recordLoginAttempt(email, ip, ua, 'totp_failed', 'Código de recuperação inválido.')
          return e.json(400, { error: 'Código de recuperação inválido ou já utilizado.' })
        }

        // Remover código de recuperação usado
        storedCodes.splice(matchedIndex, 1)
        rec.set('recovery_codes', JSON.stringify(storedCodes))
        $app.save(rec)

        recordLoginAttempt(email, ip, ua, 'totp_success', 'Autenticado via código de recuperação.')
        return e.json(200, {
          success: true,
          message: 'Autenticação 2FA por código de recuperação concluída.',
        })
      }

      // Validação normal TOTP de 6 dígitos
      var rawSecret = rec.getString('secret')
      var plainSecret = rawSecret
      if (typeof globalThis.itsmDecrypt === 'function') {
        plainSecret = globalThis.itsmDecrypt(rawSecret)
      }

      var res = verifyTotp(plainSecret, code)
      if (!res.valid) {
        recordLoginAttempt(email, ip, ua, 'totp_failed', 'Código TOTP inválido.')
        return e.json(400, { error: 'Código inválido ou expirado. Tente novamente.' })
      }

      // Prevenir repetição do mesmo passo no mesmo ciclo
      var lastStep = rec.getInt('last_used_step')
      if (lastStep && lastStep >= res.step) {
        recordLoginAttempt(email, ip, ua, 'totp_failed', 'Reuso de código TOTP no mesmo ciclo.')
        return e.json(400, {
          error: 'Código já utilizado. Aguarde o próximo código no seu aplicativo.',
        })
      }

      rec.set('last_used_step', res.step)
      $app.save(rec)

      recordLoginAttempt(email, ip, ua, 'totp_success', 'Código TOTP validado com sucesso.')
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

        var ip = getClientIp(e)
        var ua = getClientUserAgent(e)
        recordLoginAttempt(
          targetUser.getString('email'),
          ip,
          ua,
          'unlocked_by_admin',
          '2FA reiniciado/desativado pelo administrador ' + authUser.getString('email'),
        )

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
})()
