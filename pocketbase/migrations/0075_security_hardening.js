migrate(
  (app) => {
    // 1. Resolver Chave de Criptografia AES-256
    let encKey = ''
    try {
      if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
        encKey = $os.getenv('ITSM_ENCRYPTION_KEY') || ''
      }
    } catch (_) {}
    if (!encKey) {
      try {
        if (typeof $secrets !== 'undefined' && typeof $secrets.get === 'function') {
          encKey = $secrets.get('ITSM_ENCRYPTION_KEY') || ''
        }
      } catch (_) {}
    }
    if (!encKey) {
      encKey = 'itsm_default_fallback_aes256_key_super_safe_2026'
    }
    const key = $security.sha256(encKey).substring(0, 32)
    const PREFIX = 'enc:v1:'

    function encryptVal(val) {
      if (!val) return val
      const str = String(val)
      if (str.indexOf(PREFIX) === 0) return str
      return PREFIX + $security.encrypt(str, key)
    }

    // 2. Criptografar registros existentes de email_config
    try {
      const emailConfigs = app.findRecordsByFilter('email_config', '', '-created', 10, 0)
      for (let i = 0; i < emailConfigs.length; i++) {
        const ec = emailConfigs[i]
        let changed = false
        const imapPass = ec.getString('imap_password')
        if (imapPass && imapPass.indexOf(PREFIX) !== 0) {
          ec.set('imap_password', encryptVal(imapPass))
          changed = true
        }
        const smtpPass = ec.getString('smtp_password')
        if (smtpPass && smtpPass.indexOf(PREFIX) !== 0) {
          ec.set('smtp_password', encryptVal(smtpPass))
          changed = true
        }
        const graphSecret = ec.getString('graph_client_secret')
        if (graphSecret && graphSecret.indexOf(PREFIX) !== 0) {
          ec.set('graph_client_secret', encryptVal(graphSecret))
          changed = true
        }
        if (changed) {
          app.save(ec)
        }
      }
    } catch (ecErr) {
      console.log('0075_security_hardening: Aviso ao migrar email_config:', ecErr)
    }

    // 3. Criptografar registros existentes de vault_credentials
    try {
      const vaultCreds = app.findRecordsByFilter('vault_credentials', '', '-created', 500, 0)
      for (let j = 0; j < vaultCreds.length; j++) {
        const vc = vaultCreds[j]
        const pwd = vc.getString('password')
        if (pwd && pwd.indexOf(PREFIX) !== 0) {
          vc.set('password', encryptVal(pwd))
          app.save(vc)
        }
      }
    } catch (vcErr) {
      console.log('0075_security_hardening: Aviso ao migrar vault_credentials:', vcErr)
    }

    // =========================================================================
    // 4. ATUALIZAR REGRAS DE ACESSO (RLS) DAS COLEÇÕES
    // =========================================================================

    // 4.1 vault_credentials:
    // Criação/edição/exclusão: apenas admin ou gestor.
    // listRule / viewRule: Apenas equipe interna autorizada (admin, gestor, tecnico).
    // O valor revelado é entregue de forma auditada via rota /backend/v1/vault/reveal.
    try {
      const vaultCol = app.findCollectionByNameOrId('vault_credentials')
      vaultCol.listRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico")'
      vaultCol.viewRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico")'
      vaultCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      vaultCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      vaultCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      app.save(vaultCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de vault_credentials:', e)
    }

    // 4.2 email_config:
    // Leitura e escrita restritas estritamente a admin.
    try {
      const emailCol = app.findCollectionByNameOrId('email_config')
      emailCol.listRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      emailCol.viewRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      emailCol.createRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      emailCol.updateRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      emailCol.deleteRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      app.save(emailCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de email_config:', e)
    }

    // 4.3 Coleções de Auditoria e Logs (Imutáveis via API: updateRule/deleteRule = null)
    // - vault_audit_logs: list/view restrito a admin; update/delete null; create admin/gestor/tecnico
    try {
      const valCol = app.findCollectionByNameOrId('vault_audit_logs')
      valCol.listRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      valCol.viewRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      valCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico")'
      valCol.updateRule = null
      valCol.deleteRule = null
      app.save(valCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de vault_audit_logs:', e)
    }

    // - email_audit_logs: list/view admin e auditor; update/delete null
    try {
      const ealCol = app.findCollectionByNameOrId('email_audit_logs')
      ealCol.listRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "auditor")'
      ealCol.viewRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "auditor")'
      ealCol.createRule = '@request.auth.id != "" && @request.auth.role = "admin"'
      ealCol.updateRule = null
      ealCol.deleteRule = null
      app.save(ealCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de email_audit_logs:', e)
    }

    // - audit_logs: list/view admin e auditor; update/delete null
    try {
      const alCol = app.findCollectionByNameOrId('audit_logs')
      alCol.listRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "auditor")'
      alCol.viewRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "auditor")'
      alCol.createRule = '@request.auth.id != ""'
      alCol.updateRule = null
      alCol.deleteRule = null
      app.save(alCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de audit_logs:', e)
    }

    // - alert_audit_logs: list/view admin, gestor e auditor; update/delete null
    try {
      const aalCol = app.findCollectionByNameOrId('alert_audit_logs')
      aalCol.listRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "auditor")'
      aalCol.viewRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "auditor")'
      aalCol.createRule = '@request.auth.id != ""'
      aalCol.updateRule = null
      aalCol.deleteRule = null
      app.save(aalCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de alert_audit_logs:', e)
    }

    // - ticket_history: list/view usuários com acesso ao chamado; update/delete null
    try {
      const thCol = app.findCollectionByNameOrId('ticket_history')
      thCol.listRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || ticket.requester_email = @request.auth.email)'
      thCol.viewRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || ticket.requester_email = @request.auth.email)'
      thCol.createRule = '@request.auth.id != ""'
      thCol.updateRule = null
      thCol.deleteRule = null
      app.save(thCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de ticket_history:', e)
    }

    // 4.4 tickets:
    // - cliente_solicitante lê apenas chamados onde é solicitante (requester_email = @request.auth.email)
    // - cliente_gestor lê chamados da mesma empresa (company = @request.auth.company)
    // - operador (tecnico), gestor, admin e auditor leem todos os chamados
    // - create: cliente pode criar associado a si (@request.auth.role = "cliente_solicitante" ? requester_email = @request.auth.email : true); operador/gestor/admin podem criar
    // - update: operador atualiza chamados, gestor/admin também; cliente pode atualizar apenas seus chamados (ex: validação)
    // - delete: operador e cliente NÃO podem excluir; gestor e admin podem excluir
    try {
      const tktCol = app.findCollectionByNameOrId('tickets')
      tktCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company) || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email)' +
        ')'

      tktCol.viewRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company) || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email)' +
        ')'

      tktCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'

      tktCol.updateRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'

      // Exclusão estritamente restrita a admin e gestor
      tktCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(tktCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de tickets:', e)
    }

    // 4.5 ticket_interactions:
    // - cliente_solicitante lê apenas interações de seus chamados e públicas (type != "Interno")
    // - operador (tecnico), gestor, admin e auditor leem todas
    // - create: cliente cria apenas se for tipo Público e no seu chamado; operador/gestor/admin criam
    // - update: operador/gestor/admin; cliente não edita
    // - delete: operador e cliente não excluem; apenas gestor/admin
    try {
      const tintCol = app.findCollectionByNameOrId('ticket_interactions')
      tintCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email && type != "Interno") || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company && type != "Interno")' +
        ')'

      tintCol.viewRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email && type != "Interno") || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company && type != "Interno")' +
        ')'

      tintCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email && type = "Público") || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company && type = "Público")' +
        ')'

      tintCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico")'

      tintCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(tintCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de ticket_interactions:', e)
    }

    // 4.6 ticket_attachments:
    // Download e leitura condicionados ao chamado do solicitante
    try {
      const tattCol = app.findCollectionByNameOrId('ticket_attachments')
      tattCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company)' +
        ')'

      tattCol.viewRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company)' +
        ')'

      tattCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company)' +
        ')'

      tattCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico")'

      tattCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(tattCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de ticket_attachments:', e)
    }

    // 4.7 contracts, client_contacts, equipments:
    // - cliente_solicitante bloqueado
    // - operador (tecnico): leitura apenas (sem criar/editar/excluir)
    // - gestor: ampla operação (create/update/delete)
    // - admin: total
    // - auditor: somente leitura
    try {
      const contractsCol = app.findCollectionByNameOrId('contracts')
      contractsCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'
      contractsCol.viewRule = contractsCol.listRule
      contractsCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      contractsCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      contractsCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      app.save(contractsCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de contracts:', e)
    }

    try {
      const contactsCol = app.findCollectionByNameOrId('client_contacts')
      contactsCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_gestor" && client = @request.auth.company)' +
        ')'
      contactsCol.viewRule = contactsCol.listRule
      contactsCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      contactsCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      contactsCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      app.save(contactsCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de client_contacts:', e)
    }

    try {
      const equipCol = app.findCollectionByNameOrId('equipments')
      equipCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'
      equipCol.viewRule = equipCol.listRule
      equipCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      equipCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      equipCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      app.save(equipCol)
    } catch (e) {
      console.log('Aviso ao ajustar regras de equipments:', e)
    }
  },
  (app) => {
    // Reversão suave restaurando regras básicas de autenticado
    try {
      const tkt = app.findCollectionByNameOrId('tickets')
      tkt.listRule = '@request.auth.id != ""'
      tkt.viewRule = '@request.auth.id != ""'
      tkt.createRule = '@request.auth.id != ""'
      tkt.updateRule = '@request.auth.id != ""'
      tkt.deleteRule = '@request.auth.id != ""'
      app.save(tkt)
    } catch (_) {}
  },
)
