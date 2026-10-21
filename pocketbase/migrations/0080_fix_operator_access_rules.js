migrate(
  (app) => {
    // 1. Atualizar tickets para permitir admin, gestor, operador, tecnico, auditor
    try {
      const tktCol = app.findCollectionByNameOrId('tickets')
      tktCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company) || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email)' +
        ')'

      tktCol.viewRule = tktCol.listRule

      tktCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'

      tktCol.updateRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_solicitante" && requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'

      tktCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(tktCol)
    } catch (e) {
      console.log('0080_fix_operator_access_rules: Erro ao ajustar tickets:', e)
    }

    // 2. Atualizar users (_pb_users_auth_) para que equipe interna possa listar e visualizar analistas/operadores
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.listRule =
        '@request.auth.id != "" && (' +
        'id = @request.auth.id || ' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = ""' +
        ')'

      usersCol.viewRule = usersCol.listRule

      usersCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      usersCol.updateRule =
        '@request.auth.id != "" && (' +
        'id = @request.auth.id || ' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor"' +
        ')'

      usersCol.deleteRule = '@request.auth.id != "" && @request.auth.role = "admin"'

      app.save(usersCol)
    } catch (e) {
      console.log('0080_fix_operator_access_rules: Erro ao ajustar users:', e)
    }

    // 3. Atualizar contracts
    try {
      const contractsCol = app.findCollectionByNameOrId('contracts')
      contractsCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
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
      console.log('0080_fix_operator_access_rules: Erro ao ajustar contracts:', e)
    }

    // 4. Atualizar ticket_interactions
    try {
      const tintCol = app.findCollectionByNameOrId('ticket_interactions')
      tintCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email && type != "Interno") || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company && type != "Interno")' +
        ')'

      tintCol.viewRule = tintCol.listRule

      tintCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email && type = "Público") || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company && type = "Público")' +
        ')'

      tintCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")'

      tintCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(tintCol)
    } catch (e) {
      console.log('0080_fix_operator_access_rules: Erro ao ajustar ticket_interactions:', e)
    }

    // 5. Atualizar ticket_attachments
    try {
      const tattCol = app.findCollectionByNameOrId('ticket_attachments')
      tattCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company)' +
        ')'
      tattCol.viewRule = tattCol.listRule
      tattCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_solicitante" && ticket.requester_email = @request.auth.email) || ' +
        '(@request.auth.role = "cliente_gestor" && ticket.company = @request.auth.company)' +
        ')'
      tattCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")'
      tattCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      app.save(tattCol)
    } catch (e) {
      console.log('0080_fix_operator_access_rules: Erro ao ajustar ticket_attachments:', e)
    }

    // 6. Atualizar client_contacts
    try {
      const contactsCol = app.findCollectionByNameOrId('client_contacts')
      contactsCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
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
      console.log('0080_fix_operator_access_rules: Erro ao ajustar client_contacts:', e)
    }

    // 7. Atualizar equipments
    try {
      const equipCol = app.findCollectionByNameOrId('equipments')
      equipCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
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
      console.log('0080_fix_operator_access_rules: Erro ao ajustar equipments:', e)
    }

    // 8. Atualizar retained_tickets
    try {
      const retCol = app.findCollectionByNameOrId('retained_tickets')
      retCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "operador" || ' +
        '@request.auth.role = "tecnico"' +
        ')'
      retCol.viewRule = retCol.listRule
      retCol.createRule = '@request.auth.id != ""'
      retCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      retCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'
      app.save(retCol)
    } catch (e) {
      console.log('0080_fix_operator_access_rules: Erro ao ajustar retained_tickets:', e)
    }
  },
  (app) => {
    // Reversão
  },
)
