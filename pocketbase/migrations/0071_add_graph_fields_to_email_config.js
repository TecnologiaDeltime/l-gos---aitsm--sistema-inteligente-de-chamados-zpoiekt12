migrate(
  (app) => {
    const emailConfig = app.findCollectionByNameOrId('email_config')

    // 1. Campo de modo de recepção: 'graph' (Microsoft Graph HTTPS - recomendado M365) ou 'imap'
    if (!emailConfig.fields.getByName('reception_mode')) {
      emailConfig.fields.add(
        new SelectField({
          name: 'reception_mode',
          values: ['graph', 'imap'],
          maxSelect: 1,
        }),
      )
    }

    // 2. Tenant ID (ID do Locatário do Microsoft Entra ID)
    if (!emailConfig.fields.getByName('graph_tenant_id')) {
      emailConfig.fields.add(
        new TextField({
          name: 'graph_tenant_id',
        }),
      )
    }

    // 3. Client ID (ID do Aplicativo registrado no Microsoft Entra ID)
    if (!emailConfig.fields.getByName('graph_client_id')) {
      emailConfig.fields.add(
        new TextField({
          name: 'graph_client_id',
        }),
      )
    }

    // 4. Client Secret (Segredo do Cliente gerado no Entra ID)
    if (!emailConfig.fields.getByName('graph_client_secret')) {
      emailConfig.fields.add(
        new TextField({
          name: 'graph_client_secret',
        }),
      )
    }

    // 5. graph_mailbox: Conta/caixa que será monitorada (ex: atendimento.helpdesk@deltime.com.br)
    if (!emailConfig.fields.getByName('graph_mailbox')) {
      emailConfig.fields.add(
        new TextField({
          name: 'graph_mailbox',
        }),
      )
    }

    app.save(emailConfig)

    // Atualizar registro existente com padrões adequados
    try {
      const records = app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (records.length > 0) {
        const rec = records[0]
        const imapUser = rec.getString('imap_user') || ''
        const imapHost = (rec.getString('imap_host') || '').toLowerCase()

        // Se for Office 365, definir modo padrão como 'graph' e preencher mailbox com a conta configurada
        if (!rec.getString('reception_mode')) {
          if (imapHost.indexOf('office365.com') !== -1 || imapHost.indexOf('outlook.com') !== -1) {
            rec.set('reception_mode', 'graph')
          } else {
            rec.set('reception_mode', 'imap')
          }
        }

        if (!rec.getString('graph_mailbox') && imapUser) {
          rec.set('graph_mailbox', imapUser)
        }

        app.save(rec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const emailConfig = app.findCollectionByNameOrId('email_config')
      const fieldsToRemove = [
        'reception_mode',
        'graph_tenant_id',
        'graph_client_id',
        'graph_client_secret',
        'graph_mailbox',
      ]
      for (let i = 0; i < fieldsToRemove.length; i++) {
        const f = emailConfig.fields.getByName(fieldsToRemove[i])
        if (f) emailConfig.fields.remove(f)
      }
      app.save(emailConfig)
    } catch (_) {}
  },
)
