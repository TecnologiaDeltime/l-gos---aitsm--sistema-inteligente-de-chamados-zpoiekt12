onRecordCreate((e) => {
  var companyId = e.record.getString('company')
  if (companyId) {
    try {
      var company = $app.findRecordById('companies', companyId)
      var companyCode = company.getString('code') || 'SEM_COD'

      var existingTickets = $app.findRecordsByFilter(
        'tickets',
        'company = "' + companyId + '"',
        '-created',
        0,
        0,
      )

      var maxSeq = 0
      for (var i = 0; i < existingTickets.length; i++) {
        var num = existingTickets[i].getString('number')
        var match = num.match(/(\d+)\s*$/)
        if (match) {
          var seq = parseInt(match[1], 10)
          if (seq > maxSeq) maxSeq = seq
        }
      }

      var nextSeq = maxSeq + 1
      var seqStr = String(nextSeq)
      while (seqStr.length < 5) seqStr = '0' + seqStr
      e.record.set('number', companyCode + ' - ' + seqStr)
    } catch (err) {
      $app
        .logger()
        .error('ticket_on_create: failed to generate ticket number', 'error', err.message)
    }
  }

  var subCategoryId = e.record.getString('subcategory')
  if (!subCategoryId) return e.next()

  try {
    var subCat = $app.findRecordById('tkt_categories', subCategoryId)
    var parent = subCat.getString('parent')
    if (!parent) return e.next()

    var impact = subCat.getString('impact')
    var urgency = subCat.getString('urgency')
    var priority = subCat.getString('priority')

    if (impact) e.record.set('impact', impact)
    if (urgency) e.record.set('urgency', urgency)
    if (priority) e.record.set('priority', priority)
  } catch (err) {
    $app.logger().error('ticket_on_create: failed to read subcategory', 'error', err.message)
  }

  // Resolução de SLA conforme ordem de precedência:
  // 1. Atividade do catálogo (subcategoria)
  // 2. Cliente (company)
  // 3. Contrato
  // 4. Padrão do sistema (30 min resposta / 240 min solução)
  try {
    var now = new Date()
    var targetResp = 0
    var targetSol = 0
    var slaSource = ''

    if (subCategoryId) {
      try {
        var act = $app.findRecordById('tkt_categories', subCategoryId)
        var actResp = act.getInt('sla_response_minutes') || 0
        var actSol = act.getInt('sla_solution_minutes') || 0
        if (actResp > 0 || actSol > 0) {
          targetResp = actResp > 0 ? actResp : 30
          targetSol = actSol > 0 ? actSol : 240
          slaSource = 'Atividade: ' + (act.getString('name') || 'Catálogo')
        }
      } catch (_) {}
    }

    // 1b. Categoria principal (se subcategoria não possuir SLA próprio)
    var categoryId = e.record.getString('category')
    if (!targetResp && !targetSol && categoryId) {
      try {
        var mainCat = $app.findRecordById('tkt_categories', categoryId)
        var mainResp = mainCat.getInt('sla_response_minutes') || 0
        var mainSol = mainCat.getInt('sla_solution_minutes') || 0
        if (mainResp > 0 || mainSol > 0) {
          targetResp = mainResp > 0 ? mainResp : 30
          targetSol = mainSol > 0 ? mainSol : 240
          slaSource = 'Atividade: ' + (mainCat.getString('name') || 'Catálogo')
        }
      } catch (_) {}
    }

    if (!targetResp && !targetSol && companyId) {
      try {
        var comp = $app.findRecordById('companies', companyId)
        var compResp = comp.getInt('sla_response_minutes') || 0
        var compSol = comp.getInt('sla_solution_minutes') || 0
        if (compResp > 0 || compSol > 0) {
          targetResp = compResp > 0 ? compResp : 30
          targetSol = compSol > 0 ? compSol : 240
          slaSource = 'Cliente: ' + (comp.getString('trade_name') || 'Configuração do Cliente')
        }
      } catch (_) {}
    }

    var contractId = e.record.getString('contract')
    if (!targetResp && !targetSol && contractId) {
      try {
        var cntr = $app.findRecordById('contracts', contractId)
        var cntrResp = cntr.getInt('sla_response_time') || 0
        var cntrSol = cntr.getInt('sla_solution_time') || 0
        if (cntrResp > 0 || cntrSol > 0) {
          targetResp = cntrResp > 0 ? cntrResp : 30
          targetSol = cntrSol > 0 ? cntrSol : 240
          slaSource = 'Contrato'
        }
      } catch (_) {}
    }

    if (!targetResp && !targetSol) {
      targetResp = 30
      targetSol = 240
      slaSource = 'Padrão do Sistema'
    }

    if (!e.record.getString('sla_response_deadline') && targetResp > 0) {
      e.record.set(
        'sla_response_deadline',
        new Date(now.getTime() + targetResp * 60000).toISOString(),
      )
    }
    if (!e.record.getString('sla_solution_deadline') && targetSol > 0) {
      e.record.set(
        'sla_solution_deadline',
        new Date(now.getTime() + targetSol * 60000).toISOString(),
      )
    }
    if (slaSource && !e.record.getString('sla_source')) {
      e.record.set('sla_source', slaSource)
    }
  } catch (slaErr) {
    $app.logger().error('ticket_on_create: failed to resolve SLA', 'error', slaErr.message)
  }

  return e.next()
}, 'tickets')
