/// <reference path="../pb_data/types.d.ts" />
/**
 * 0156 — Backfill de triage_suggestions para chamados existentes que têm categoria
 * mas estão com o campo json triage_suggestions vazio.
 */
migrate(
  (app) => {
    let allCategories = []
    try {
      allCategories = app.findRecordsByFilter('tkt_categories', 'id != ""', 'name', 500, 0)
    } catch (e) {
      console.log('[0156] erro ao buscar categorias: ' + e)
      return
    }

    const catById = {}
    for (let i = 0; i < allCategories.length; i++) {
      catById[allCategories[i].id] = allCategories[i]
    }

    let tickets = []
    try {
      tickets = app.findRecordsByFilter('tickets', 'id != ""', '-created', 500, 0)
    } catch (e) {
      console.log('[0156] erro ao buscar tickets: ' + e)
      return
    }

    let count = 0
    for (let j = 0; j < tickets.length; j++) {
      const t = tickets[j]
      const ts = t.get('triage_suggestions')
      const isEmpty = !ts || (typeof ts === 'object' && Object.keys(ts).length === 0)
      const cId = t.getString('category')
      const sId = t.getString('subcategory')

      if (isEmpty && (cId || sId)) {
        const cRec = cId && catById[cId] ? catById[cId] : null
        const sRec = sId && catById[sId] ? catById[sId] : null

        t.set('triage_suggestions', {
          type: t.getString('type') || 'Incidente',
          category: cId || (sRec && sRec.getString('parent') ? sRec.getString('parent') : ''),
          category_name: cRec ? cRec.getString('name') || '' : '',
          subcategory: sId || '',
          subcategory_name: sRec ? sRec.getString('name') || '' : '',
          queue: t.getString('queue') || '',
          confidence: 0.9,
          reason: 'Categorização aplicada do catálogo de atividades.',
          source: 'catalog_sync',
          applied: true,
        })

        try {
          app.save(t)
          count++
        } catch (saveErr) {
          console.log('[0156] falha ao salvar ticket ' + t.id + ': ' + saveErr)
        }
      }
    }

    console.log('[0156] triage_suggestions atualizado em ' + count + ' chamado(s).')
  },
  (app) => {
    // Down
  },
)
