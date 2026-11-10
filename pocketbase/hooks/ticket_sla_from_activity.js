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
 * Precedência de SLA: subatividade > atividade principal (espelha ticket_on_create.js).
 * Não altera prazos de chamados já Resolvidos/Encerrados/Cancelados nem reinicia
 * o prazo de resposta quando a primeira resposta já foi registrada.
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

    var actId = newSub || newCat
    if (!actId) return e.next()

    var act = null
    try {
      act = $app.findRecordById('tkt_categories', actId)
    } catch (_) {
      return e.next()
    }
    if (!act) return e.next()

    var resp = act.getInt('sla_response_minutes') || 0
    var sol = act.getInt('sla_solution_minutes') || 0
    if (resp <= 0 && sol <= 0) return e.next()

    // Padrões do sistema quando a atividade define só um dos prazos (espelha ticket_on_create.js)
    if (resp <= 0) resp = 30
    if (sol <= 0) sol = 240

    var now = new Date()

    // Prazo de resposta: só reinicia se a primeira resposta ainda não foi registrada
    if (!rec.getString('sla_response_at')) {
      rec.set('sla_response_deadline', new Date(now.getTime() + resp * 60000).toISOString())
    }
    rec.set('sla_solution_deadline', new Date(now.getTime() + sol * 60000).toISOString())
    rec.set('sla_source', 'Atividade: ' + (act.getString('name') || 'Catálogo'))

    console.log(
      '[SLA da Atividade] aplicado no chamado #' +
        (rec.getString('number') || rec.id) +
        ' | atividade: ' +
        (act.getString('name') || actId) +
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
