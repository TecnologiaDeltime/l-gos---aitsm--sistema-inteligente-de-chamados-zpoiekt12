migrate(
  (app) => {
    // 1. Coleção security_settings (parâmetros de segurança: timeout de inatividade, tentativas de login, bloqueio)
    try {
      if (!app.findCollectionByNameOrId('security_settings')) {
        // already exists
      }
    } catch (_) {
      const secCol = new Collection({
        name: 'security_settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        updateRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        deleteRule: null,
        fields: [
          { name: 'session_timeout_minutes', type: 'number', required: true },
          { name: 'max_login_attempts', type: 'number', required: true },
          { name: 'lockout_duration_minutes', type: 'number', required: true },
          { name: 'require_2fa_admin', type: 'bool' },
          { name: 'require_2fa_gestor', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(secCol)

      // Seed inicial de security_settings
      const rec = new Record(secCol)
      rec.set('session_timeout_minutes', 60)
      rec.set('max_login_attempts', 5)
      rec.set('lockout_duration_minutes', 15)
      rec.set('require_2fa_admin', true)
      rec.set('require_2fa_gestor', false)
      app.save(rec)
    }

    // 2. Coleção login_attempt_logs (registro imutável de tentativas de login e bloqueios)
    try {
      if (!app.findCollectionByNameOrId('login_attempt_logs')) {
        // already exists
      }
    } catch (_) {
      const logsCol = new Collection({
        name: 'login_attempt_logs',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "auditor")',
        viewRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "auditor")',
        createRule: null, // Apenas backend cria
        updateRule: null, // Imutável
        deleteRule: null, // Imutável
        fields: [
          { name: 'email', type: 'text', required: true },
          { name: 'ip_address', type: 'text' },
          { name: 'user_agent', type: 'text' },
          {
            name: 'outcome',
            type: 'select',
            required: true,
            values: [
              'success',
              'failed_password',
              'account_locked',
              'unlocked_by_admin',
              'totp_failed',
              'totp_success',
            ],
            maxSelect: 1,
          },
          { name: 'details', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_login_logs_email ON login_attempt_logs (email)',
          'CREATE INDEX idx_login_logs_created ON login_attempt_logs (created DESC)',
          'CREATE INDEX idx_login_logs_outcome ON login_attempt_logs (outcome)',
        ],
      })
      app.save(logsCol)
    }

    // 3. Coleção user_totp (segredos e códigos de recuperação do 2FA TOTP cifrados)
    try {
      if (!app.findCollectionByNameOrId('user_totp')) {
        // already exists
      }
    } catch (_) {
      const totpCol = new Collection({
        name: 'user_totp',
        type: 'base',
        listRule: null, // Sem leitura pública via API - somente via rotas seguras do backend
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'secret', type: 'text', required: true },
          { name: 'is_enabled', type: 'bool' },
          { name: 'recovery_codes', type: 'json' }, // array de hashes ou códigos cifrados
          { name: 'last_used_step', type: 'number' },
          { name: 'confirmed_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_user_totp_user ON user_totp (user)'],
      })
      app.save(totpCol)
    }

    // 4. Adicionar campos complementares à coleção users (se ainda não existirem):
    // - failed_login_attempts (number)
    // - locked_until (date)
    // - totp_enabled (bool)
    // - session_last_activity (date)
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      let changed = false
      if (!usersCol.fields.getByName('failed_login_attempts')) {
        usersCol.fields.add(new NumberField({ name: 'failed_login_attempts' }))
        changed = true
      }
      if (!usersCol.fields.getByName('locked_until')) {
        usersCol.fields.add(new DateField({ name: 'locked_until' }))
        changed = true
      }
      if (!usersCol.fields.getByName('totp_enabled')) {
        usersCol.fields.add(new BoolField({ name: 'totp_enabled' }))
        changed = true
      }
      if (!usersCol.fields.getByName('session_last_activity')) {
        usersCol.fields.add(new DateField({ name: 'session_last_activity' }))
        changed = true
      }
      if (changed) {
        app.save(usersCol)
      }
    } catch (uErr) {
      console.log('0076_security_hardening_phase2: Aviso ao atualizar users:', uErr)
    }
  },
  (app) => {
    try {
      const s = app.findCollectionByNameOrId('security_settings')
      app.delete(s)
    } catch (_) {}
    try {
      const l = app.findCollectionByNameOrId('login_attempt_logs')
      app.delete(l)
    } catch (_) {}
    try {
      const t = app.findCollectionByNameOrId('user_totp')
      app.delete(t)
    } catch (_) {}
  },
)
