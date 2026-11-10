/// <reference path="../pb_data/types.d.ts" />

/**
 * ticket_sla_from_activity.js — Aplica o SLA cadastrado na atividade/subatividade
 * do catálogo (tkt_categories) ao chamado sempre que a categoria é (re)categorizada.
 *
 * Cobre os três caminhos de categorização, pois todos passam por um update em tickets:
 *  1. Correção manual do operador (TicketCategoryCard -> updateTicket)
 *  2. "Reclassificar IA" na Triagem por IA (rota /backend/v1/ai/portal-triage)
 *  3. Triagem automática do portal na abertura (mesma rota, $app.save)
 *
 * Fonte ÚNICA de SLA: catálogo de atividades (precedência por campo:
 * subatividade > atividade principal; se ambos faltarem, padrões do sistema).
 * Não altera prazos de chamados já Resolvidos/Encerrados/Cancelados nem reinicia
 * o prazo de resposta quando a primeira resposta já foi registrada.
 *
 * Regra do JSVM: helpers publicados via globalThis (A1_sla_business_hours.js) —
 * referências bare de topo de outro arquivo lançam ReferenceError dentro do callback.
 */
onRecordUpdate((e) => {
  try {
    var rec = e.record
    var newCat = rec.getString('category') || ''
    var newSub = rec.getString('subcategory') || ''

    // Valor antigo (ainda persistido no banco durante o BeforeUpdate)
    var oldCat = ''
    var oldSub = ''
    try {
      var old = $app.findRecordById('tickets', rec.id)
      if (old) {
        oldCat = old.getString('category') || ''
        oldSub = old.getString('subcategory') || ''
      }
    } catch (_) {}

    if (newCat === oldCat && newSub === oldSub) return e.next()

    var status = rec.getString('status') || ''
    if (status === 'Resolvido' || status === 'Encerrado' || status === 'Cancelado') {
      return e.next()
    }

    if (!newCat && !newSub) return e.next()

    // Precedência POR CAMPO: subatividade > atividade principal.
    // Se a subatividade define só um dos prazos, o outro vem da atividade principal.
    var resp = 0
    var sol = 0
    var actName = ''
    if (newSub) {
      try {
        var sub = $app.findRecordById('tkt_categories', newSub)
        if (sub) {
          resp = sub.getInt('sla_response_minutes') || 0
          sol = sub.getInt('sla_solution_minutes') || 0
          actName = sub.getString('name') || ''
        }
      } catch (_) {}
    }
    if (newCat && (resp <= 0 || sol <= 0)) {
      try {
        var main = $app.findRecordById('tkt_categories', newCat)
        if (main) {
          if (resp <= 0) resp = main.getInt('sla_response_minutes') || 0
          if (sol <= 0) sol = main.getInt('sla_solution_minutes') || 0
          if (!actName) actName = main.getString('name') || ''
        }
      } catch (_) {}
    }

    // Padrões do sistema por campo quando o catálogo não define o prazo
    if (resp <= 0) resp = 30
    if (sol <= 0) sol = 240

    var now = new Date()

    // Contabilidade por expediente (empresa operadora): sem cadastro => calendário contínuo.
    var offset =
      typeof globalThis.TZ_OFFSET_SAO_PAULO_MIN !== 'undefined'
        ? globalThis.TZ_OFFSET_SAO_PAULO_MIN
        : -180
    var respDeadline = null
    var solDeadline = null
    if (typeof globalThis.bhComputeDeadline === 'function') {
      respDeadline = globalThis.bhComputeDeadline(now.getTime(), resp, offset)
      solDeadline = globalThis.bhComputeDeadline(now.getTime(), sol, offset)
    }
    if (!respDeadline) respDeadline = new Date(now.getTime() + resp * 60000).toISOString()
    if (!solDeadline) solDeadline = new Date(now.getTime() + sol * 60000).toISOString()

    // Prazo de resposta: só reinicia se a primeira resposta ainda não foi registrada
    if (!rec.getString('sla_response_at')) {
      rec.set('sla_response_deadline', respDeadline)
    }
    rec.set('sla_solution_deadline', solDeadline)
    rec.set('sla_source', 'Atividade: ' + (actName || 'Catálogo'))

    console.log(
      '[SLA da Atividade] aplicado no chamado #' +
        (rec.getString('number') || rec.id) +
        ' | atividade: ' +
        (actName || newSub || newCat) +
        ' | resp: ' +
        resp +
        'min | sol: ' +
        sol +
        'min',
    )
  } catch (err) {
    console.error('[SLA da Atividade] erro ao aplicar SLA da atividade:', err)
  }

  return e.next()
}, 'tickets')
