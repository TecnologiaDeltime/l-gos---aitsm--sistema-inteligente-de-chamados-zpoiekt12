/// <reference path="../pb_data/types.d.ts" />
/**
 * 0151 — Backfill de SLA do catálogo em chamados abertos sem prazo de solução.
 *
 * Garante que nenhum chamado Novo/Em Triagem/Aguardando Atribuição/Em Atendimento
 * fique sem prazo quando a atividade/subatividade do catálogo (tkt_categories)
 * define SLA. Idempotente: só toca em chamados com sla_solution_deadline vazio.
 * Precedência por campo: subatividade > atividade principal; sem catálogo =>
 * padrões do sistema (30 min resposta / 240 min solução).
 */
migrate(
  (app) => {
    const openStatuses = ['Novo', 'Em Triagem', 'Aguardando Atribuição', 'Em Atendimento']
    let fixed = 0

    for (const status of openStatuses) {
      let records = []
      try {
        records = app.findRecordsByFilter(
          'tickets',
          "status = '" + status + "' && sla_solution_deadline = ''",
          '-created',
          500,
          0,
        )
      } catch (_) {
        continue
      }

      for (const rec of records) {
        try {
          const catId = rec.getString('category') || ''
          const subId = rec.getString('subcategory') || ''

          let resp = 0
          let sol = 0
          let actName = ''

          if (subId) {
            try {
              const sub = app.findRecordById('tkt_categories', subId)
              resp = sub.getInt('sla_response_minutes') || 0
              sol = sub.getInt('sla_solution_minutes') || 0
              actName = sub.getString('name') || ''
            } catch (_) {}
          }
          if (catId && (resp <= 0 || sol <= 0)) {
            try {
              const main = app.findRecordById('tkt_categories', catId)
              if (resp <= 0) resp = main.getInt('sla_response_minutes') || 0
              if (sol <= 0) sol = main.getInt('sla_solution_minutes') || 0
              if (!actName) actName = main.getString('name') || ''
            } catch (_) {}
          }

          if (resp <= 0) resp = 30
          if (sol <= 0) sol = 240

          const createdStr = rec.getString('created')
          const createdMs = createdStr ? new Date(createdStr).getTime() : Date.now()
          const baseMs = isNaN(createdMs) ? Date.now() : createdMs

          if (!rec.getString('sla_response_deadline')) {
            rec.set('sla_response_deadline', new Date(baseMs + resp * 60000).toISOString())
          }
          rec.set('sla_solution_deadline', new Date(baseMs + sol * 60000).toISOString())
          if (!rec.getString('sla_source')) {
            rec.set('sla_source', 'Atividade: ' + (actName || 'Catálogo'))
          }
          app.save(rec)
          fixed++
        } catch (err) {
          console.log('[0151] falha ao preencher SLA do chamado ' + rec.id + ': ' + err)
        }
      }
    }

    console.log('[0151] backfill de SLA do catálogo concluído: ' + fixed + ' chamado(s)')
  },
  (app) => {
    // Down: no-op (prazos gravados permanecem)
  },
)
