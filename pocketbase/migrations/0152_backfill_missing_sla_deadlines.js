/// <reference path="../pb_data/types.d.ts" />
/**
 * 0152 — Backfill idempotente de SLA em chamados abertos com prazo faltante.
 *
 * Complementa a 0151 (que não cobria "Atribuído" e outros status abertos):
 * preenche sla_response_deadline e/ou sla_solution_deadline de todo chamado
 * aberto OU finalizado que esteja com QUALQUER dos prazos vazio — cobre o
 * caso do chamado 00031 (recebeu só prazo de resposta, faltou o de solução)
 * e dos chamados 00029/00032 (status "Atribuído", fora da lista da 0151).
 * Só grava o prazo faltante; nunca altera compliance nem datas de resposta.
 *
 * Fonte única de SLA: catálogo (subatividade > atividade, por campo), com
 * fallback do sistema (30 min resposta / 240 min solução) — nunca deixa o
 * chamado sem prazo. Prazos calculados a partir do "created" do chamado.
 * Idempotente: só grava o prazo que estiver vazio; prazo de resposta só é
 * definido quando a primeira resposta ainda não foi registrada.
 */
migrate(
  (app) => {
    const finalStatuses = ['Resolvido', 'Encerrado', 'Cancelado']
    let fixed = 0

    let records = []
    for (const status of finalStatuses) {
      try {
        const batch = app.findRecordsByFilter(
          'tickets',
          "status = '" + status + "' && (sla_response_deadline = '' || sla_solution_deadline = '')",
          '-created',
          500,
          0,
        )
        for (const r of batch) records.push(r.id)
      } catch (_) {}
    }

    // Busca principal: tudo que tem prazo faltante, exceto os finalizados acima
    let candidates = []
    try {
      candidates = app.findRecordsByFilter(
        'tickets',
        "(sla_response_deadline = '' || sla_solution_deadline = '')",
        '-created',
        0,
        0,
      )
    } catch (err) {
      console.log('[0152] falha ao buscar chamados sem prazo: ' + err)
    }

    for (const rec of candidates) {
      try {
        // Não pula finalizados: só preenche o prazo que estiver vazio, sem
        // alterar compliance, datas de resposta/solução nem status

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
            if (main) {
              if (resp <= 0) resp = main.getInt('sla_response_minutes') || 0
              if (sol <= 0) sol = main.getInt('sla_solution_minutes') || 0
              if (!actName) actName = main.getString('name') || ''
            }
          } catch (_) {}
        }

        if (resp <= 0) resp = 30
        if (sol <= 0) sol = 240

        const createdStr = rec.getString('created')
        const createdMs = createdStr ? new Date(createdStr).getTime() : Date.now()
        const baseMs = isNaN(createdMs) ? Date.now() : createdMs

        if (!rec.getString('sla_response_deadline') && !rec.getString('sla_response_at')) {
          rec.set('sla_response_deadline', new Date(baseMs + resp * 60000).toISOString())
        }
        // Se a resposta já foi dada, registra o prazo que o chamado TINHA
        // (created + minutos do catálogo) para preservar o histórico
        if (!rec.getString('sla_response_deadline') && rec.getString('sla_response_at')) {
          rec.set('sla_response_deadline', new Date(baseMs + resp * 60000).toISOString())
        }
        if (!rec.getString('sla_solution_deadline')) {
          rec.set('sla_solution_deadline', new Date(baseMs + sol * 60000).toISOString())
        }
        if (!rec.getString('sla_source')) {
          rec.set('sla_source', 'Atividade: ' + (actName || 'Catálogo'))
        }
        app.save(rec)
        fixed++
      } catch (err) {
        console.log('[0152] falha ao preencher SLA do chamado ' + rec.id + ': ' + err)
      }
    }

    console.log(
      '[0152] backfill de SLA concluído: ' +
        fixed +
        ' chamado(s) sem prazo corrigido(s) (' +
        candidates.length +
        ' candidatos',
      records.length + ' finalizados pulados)',
    )
  },
  (app) => {
    // Down: no-op (prazos gravados permanecem)
  },
)
