migrate(
  (app) => {
    // Ação: Definir regras de acesso (RLS) alinhadas com as roles reais do sistema:
    // admin | gestor | tecnico | cliente_gestor | cliente_solicitante | auditor
    // Permite que equipe interna (admin, gestor, tecnico, auditor) e fallback autenticado (@request.auth.role = "")
    // leiam companies, company_units, company_departments, configuration_items e ci_types.
    // Clientes gestores leem somente a própria empresa / unidades / departamentos / itens.
    // Clientes solicitantes leem a própria empresa (para identificação em chamados e portal).

    // 1. Coleção companies
    try {
      const compCol = app.findCollectionByNameOrId('companies')
      compCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_gestor" && id = @request.auth.company) || ' +
        '(@request.auth.role = "cliente_solicitante" && id = @request.auth.company)' +
        ')'

      compCol.viewRule = compCol.listRule

      compCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      compCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      compCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(compCol)
    } catch (e) {
      console.log('0082_fix_client_and_company_visibility: Erro ao ajustar companies:', e)
    }

    // 2. Coleção company_units
    try {
      const unitCol = app.findCollectionByNameOrId('company_units')
      unitCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company) || ' +
        '(@request.auth.role = "cliente_solicitante" && company = @request.auth.company)' +
        ')'

      unitCol.viewRule = unitCol.listRule

      unitCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      unitCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      unitCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(unitCol)
    } catch (e) {
      console.log('0082_fix_client_and_company_visibility: Erro ao ajustar company_units:', e)
    }

    // 3. Coleção company_departments
    try {
      const deptCol = app.findCollectionByNameOrId('company_departments')
      deptCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company) || ' +
        '(@request.auth.role = "cliente_solicitante" && company = @request.auth.company)' +
        ')'

      deptCol.viewRule = deptCol.listRule

      deptCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      deptCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      deptCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(deptCol)
    } catch (e) {
      console.log('0082_fix_client_and_company_visibility: Erro ao ajustar company_departments:', e)
    }

    // 4. Coleção configuration_items (CMDB)
    try {
      const ciCol = app.findCollectionByNameOrId('configuration_items')
      ciCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '(@request.auth.role = "cliente_gestor" && company = @request.auth.company)' +
        ')'

      ciCol.viewRule = ciCol.listRule

      ciCol.createRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico"' +
        ')'

      ciCol.updateRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico"' +
        ')'

      ciCol.deleteRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico"' +
        ')'

      app.save(ciCol)
    } catch (e) {
      console.log('0082_fix_client_and_company_visibility: Erro ao ajustar configuration_items:', e)
    }

    // 5. Coleção ci_types
    try {
      const citypesCol = app.findCollectionByNameOrId('ci_types')
      citypesCol.listRule =
        '@request.auth.id != "" && (' +
        '@request.auth.role = "admin" || ' +
        '@request.auth.role = "gestor" || ' +
        '@request.auth.role = "tecnico" || ' +
        '@request.auth.role = "auditor" || ' +
        '@request.auth.role = "" || ' +
        '@request.auth.role = "cliente_gestor" || ' +
        '@request.auth.role = "cliente_solicitante"' +
        ')'

      citypesCol.viewRule = citypesCol.listRule

      citypesCol.createRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      citypesCol.updateRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      citypesCol.deleteRule =
        '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")'

      app.save(citypesCol)
    } catch (e) {
      console.log('0082_fix_client_and_company_visibility: Erro ao ajustar ci_types:', e)
    }
  },
  (app) => {
    // Reversão
  },
)
