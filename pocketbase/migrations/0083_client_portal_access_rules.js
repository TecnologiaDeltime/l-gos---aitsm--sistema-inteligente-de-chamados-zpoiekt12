/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Atualiza technical_visits para permitir leitura pelo cliente da mesma empresa
  try {
    const visitsCol = app.findCollectionByNameOrId('technical_visits')
    visitsCol.listRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || ticket.company = @request.auth.company)'
    visitsCol.viewRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || ticket.company = @request.auth.company)'
    app.save(visitsCol)
  } catch (e) {
    console.log('0083: erro ao atualizar technical_visits:', e)
  }

  // 2. Atualiza approvals para permitir leitura pelo cliente da mesma empresa
  try {
    const approvalsCol = app.findCollectionByNameOrId('approvals')
    approvalsCol.listRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || ticket.company = @request.auth.company)'
    approvalsCol.viewRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || ticket.company = @request.auth.company)'
    app.save(approvalsCol)
  } catch (e) {
    console.log('0083: erro ao atualizar approvals:', e)
  }

  // 3. Atualiza contract_periods para permitir leitura pelo cliente da mesma empresa
  try {
    const periodsCol = app.findCollectionByNameOrId('contract_periods')
    periodsCol.listRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || contract.company = @request.auth.company)'
    periodsCol.viewRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || contract.company = @request.auth.company)'
    app.save(periodsCol)
  } catch (e) {
    console.log('0083: erro ao atualizar contract_periods:', e)
  }

  // 4. Atualiza configuration_items para cliente_solicitante e cliente_gestor da mesma empresa
  try {
    const ciCol = app.findCollectionByNameOrId('configuration_items')
    ciCol.listRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || company = @request.auth.company)'
    ciCol.viewRule =
      '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "tecnico" || @request.auth.role = "auditor" || company = @request.auth.company)'
    app.save(ciCol)
  } catch (e) {
    console.log('0083: erro ao atualizar configuration_items:', e)
  }

  // 5. Normalizar logs existentes de ticket_interactions que não possuam type preenchido
  try {
    const records = app.findRecordsByFilter(
      'ticket_interactions',
      'type = "" || type = null',
      '',
      500,
      0,
    )
    for (let r of records) {
      r.set('type', 'Público')
      app.save(r)
    }
  } catch (e) {
    console.log('0083: normalizacao ticket_interactions:', e)
  }
})
