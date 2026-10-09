migrate(
  (app) => {
    // 1. Obter IDs das coleções relacionadas
    const companiesColId = app.findCollectionByNameOrId('companies').id
    const profilesColId = app.findCollectionByNameOrId('profiles').id

    // 2. Criar coleção vault_credentials (Cofre de Senhas)
    let vaultCredsCol
    try {
      vaultCredsCol = app.findCollectionByNameOrId('vault_credentials')
    } catch (_) {
      vaultCredsCol = new Collection({
        name: 'vault_credentials',
        type: 'base',
        // list/view para usuários autenticados (a senha fica sob demanda / oculta)
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        updateRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        fields: [
          {
            name: 'company',
            type: 'relation',
            required: true,
            collectionId: companiesColId,
            maxSelect: 1,
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['Portal', 'Equipamento', 'Aplicação'],
            maxSelect: 1,
          },
          {
            name: 'name',
            type: 'text',
            required: true,
          },
          {
            name: 'environment',
            type: 'select',
            required: true,
            values: ['Produção', 'Homologação', 'Teste', 'Desenvolvimento', 'DR / Contingência'],
            maxSelect: 1,
          },
          {
            name: 'url_or_address',
            type: 'text',
          },
          {
            name: 'username',
            type: 'text',
            required: true,
          },
          {
            name: 'password',
            type: 'text',
            required: true,
          },
          {
            name: 'notes',
            type: 'text',
          },
          {
            name: 'allowed_profiles',
            type: 'relation',
            collectionId: profilesColId,
            maxSelect: 50,
          },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          {
            name: 'updated_by',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_vault_creds_company ON vault_credentials (company)',
          'CREATE INDEX idx_vault_creds_type ON vault_credentials (type)',
          'CREATE INDEX idx_vault_creds_env ON vault_credentials (environment)',
          'CREATE INDEX idx_vault_creds_name ON vault_credentials (name)',
        ],
      })
      app.save(vaultCredsCol)
    }

    // 3. Criar coleção vault_audit_logs (Auditoria Completa do Cofre)
    let vaultAuditCol
    const vaultCredsColId = app.findCollectionByNameOrId('vault_credentials').id
    try {
      vaultAuditCol = app.findCollectionByNameOrId('vault_audit_logs')
    } catch (_) {
      vaultAuditCol = new Collection({
        name: 'vault_audit_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: null, // logs são imutáveis
        deleteRule: null, // logs não podem ser excluídos via API
        fields: [
          {
            name: 'credential',
            type: 'relation',
            collectionId: vaultCredsColId,
            maxSelect: 1,
          },
          {
            name: 'credential_name',
            type: 'text',
          },
          {
            name: 'client_name',
            type: 'text',
          },
          {
            name: 'operator',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          {
            name: 'operator_name',
            type: 'text',
          },
          {
            name: 'operator_email',
            type: 'text',
          },
          {
            name: 'action',
            type: 'select',
            required: true,
            values: [
              'PASSWORD_VIEWED',
              'PASSWORD_VIEW_FAILED_AUTH',
              'PASSWORD_VIEW_DENIED_PROFILE',
              'CREDENTIAL_CREATED',
              'CREDENTIAL_UPDATED',
              'CREDENTIAL_DELETED',
            ],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['SUCCESS', 'DENIED', 'FAILED'],
            maxSelect: 1,
          },
          {
            name: 'reason',
            type: 'text',
          },
          {
            name: 'ip_address',
            type: 'text',
          },
          {
            name: 'user_agent',
            type: 'text',
          },
          {
            name: 'details',
            type: 'json',
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_vault_audit_op ON vault_audit_logs (operator)',
          'CREATE INDEX idx_vault_audit_action ON vault_audit_logs (action)',
          'CREATE INDEX idx_vault_audit_status ON vault_audit_logs (status)',
          'CREATE INDEX idx_vault_audit_created ON vault_audit_logs (created DESC)',
        ],
      })
      app.save(vaultAuditCol)
    }

    // 4. Atualizar perfis existentes com a nova chave de módulo 'vault'
    try {
      const profiles = app.findRecordsByFilter('profiles', '', 'name', 100, 0)
      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i]
        const rawJson = p.getString('permissions')
        let permissions = {}
        try {
          permissions = JSON.parse(rawJson) || {}
        } catch (_) {
          permissions = {}
        }

        const name = p.getString('name')
        if (name === 'Administrador' || name === 'Supervisor' || name === 'Gestor') {
          permissions['vault'] = { read: true, write: true, hidden: false }
        } else if (name === 'Técnico N2' || name === 'Técnico N1') {
          // Por padrão leitura liberada para operadores técnicos (com checagem granular por credencial)
          permissions['vault'] = { read: true, write: false, hidden: false }
        } else {
          // Perfis externos/solicitantes não veem o cofre
          permissions['vault'] = { read: false, write: false, hidden: true }
        }
        p.set('permissions', permissions)
        app.save(p)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const audit = app.findCollectionByNameOrId('vault_audit_logs')
      app.delete(audit)
    } catch (_) {}
    try {
      const creds = app.findCollectionByNameOrId('vault_credentials')
      app.delete(creds)
    } catch (_) {}
  },
)
