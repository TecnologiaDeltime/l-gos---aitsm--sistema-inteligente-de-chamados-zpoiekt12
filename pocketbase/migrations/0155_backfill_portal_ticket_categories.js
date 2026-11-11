/// <reference path="../pb_data/types.d.ts" />
/**
 * 0155 — Backfill idempotente de categorias, subcategorias e triage_suggestions
 * nos chamados antigos que ficaram com campos vazios.
 *
 * Garante que chamados como o CLI-001 - 00033 ("Notebook com lentidão") e outros
 * que nasceram pelo portal ou e-mail sem categoria/subcategoria ou sem triage_suggestions
 * recebam a correspondência correta do catálogo de atividades e SLA correspondente.
 */
migrate(
  (app) => {
    let allCategories = []
    try {
      allCategories = app.findRecordsByFilter(
        'tkt_categories',
        'active = true || deleted = false',
        'name',
        500,
        0,
      )
    } catch (errCats) {
      console.log('[0155] erro ao buscar tkt_categories: ' + errCats)
      return
    }

    if (allCategories.length === 0) {
      console.log('[0155] nenhuma categoria ativa encontrada')
      return
    }

    const categoryById = {}
    const subcategoryMap = {}
    for (let i = 0; i < allCategories.length; i++) {
      const c = allCategories[i]
      categoryById[c.id] = c
      const p = c.getString('parent')
      if (p) {
        if (!subcategoryMap[p]) subcategoryMap[p] = []
        subcategoryMap[p].push(c)
      }
    }

    const keywordsMap = [
      { words: ['vpn', 'acesso remoto', 'anydesk', 'teamviewer', 'openvpn'], boost: 0.85 },
      {
        words: [
          'internet',
          'navegação',
          'sem rede',
          'conexão',
          'wi-fi',
          'wifi',
          'cabo de rede',
          'roteador',
          'link',
        ],
        boost: 0.8,
      },
      {
        words: ['email', 'e-mail', 'outlook', 'webmail', 'caixa postal', 'troca de senha de email'],
        boost: 0.8,
      },
      {
        words: ['impressora', 'impressão', 'toner', 'imprimir', 'papel preso', 'scanner'],
        boost: 0.8,
      },
      {
        words: [
          'computador',
          'notebook',
          'desktop',
          'não liga',
          'tela azul',
          'formatação',
          'lentidão',
        ],
        boost: 0.75,
      },
      {
        words: ['senha', 'login', 'bloqueio', 'desbloqueio', 'reset de senha', 'usuário bloqueado'],
        boost: 0.8,
      },
      {
        words: ['sistema', 'erp', 'software', 'erro no sistema', 'banco de dados'],
        boost: 0.7,
      },
    ]

    const matchCatalog = function (text) {
      if (!text) return null
      const cleanText = text.toLowerCase()
      let best = null
      let maxScore = 0

      for (let idx = 0; idx < allCategories.length; idx++) {
        const c = allCategories[idx]
        const name = (c.getString('name') || '').toLowerCase()
        const desc = (c.getString('description') || '').toLowerCase()
        let score = 0
        if (name.length >= 4 && cleanText.indexOf(name) !== -1) {
          score += 0.6
        }

        for (let kIdx = 0; kIdx < keywordsMap.length; kIdx++) {
          const entry = keywordsMap[kIdx]
          for (let wIdx = 0; wIdx < entry.words.length; wIdx++) {
            const word = entry.words[wIdx]
            if (
              cleanText.indexOf(word) !== -1 &&
              (name.indexOf(word) !== -1 || desc.indexOf(word) !== -1)
            ) {
              if (entry.boost > score) score = entry.boost
            }
          }
        }

        if (score > maxScore) {
          maxScore = score
          best = c
        }
      }

      if (best) {
        const isSub = Boolean(best.getString('parent'))
        return {
          category:
            isSub && categoryById[best.getString('parent')]
              ? categoryById[best.getString('parent')]
              : best,
          subcategory: isSub ? best : null,
          confidence: maxScore >= 0.5 ? maxScore : 0.4,
          reason:
            'Classificado por correspondência de termos no catálogo ("' +
            best.getString('name') +
            '").',
        }
      }

      // Default
      const rootCats = allCategories.filter((c) => !c.getString('parent'))
      if (rootCats.length > 0) {
        return {
          category: rootCats[0],
          subcategory: null,
          confidence: 0.3,
          reason: 'Classificado na atividade padrão do catálogo.',
        }
      }

      return null
    }

    // SLA helper
    const resolveCatalogSla = function (catId, subId, baseMs) {
      let resp = 0
      let sol = 0
      let actName = ''
      if (subId && categoryById[subId]) {
        const sub = categoryById[subId]
        resp = sub.getInt('sla_response_minutes') || 0
        sol = sub.getInt('sla_solution_minutes') || 0
        actName = sub.getString('name') || ''
      }
      if (catId && categoryById[catId] && (resp <= 0 || sol <= 0)) {
        const main = categoryById[catId]
        if (resp <= 0) resp = main.getInt('sla_response_minutes') || 0
        if (sol <= 0) sol = main.getInt('sla_solution_minutes') || 0
        if (!actName) actName = main.getString('name') || ''
      }
      if (resp <= 0) resp = 30
      if (sol <= 0) sol = 240

      return {
        respDl: new Date(baseMs + resp * 60000).toISOString(),
        solDl: new Date(baseMs + sol * 60000).toISOString(),
        actName: actName || 'Catálogo',
      }
    }

    // 1. Backfill dos chamados com category vazia OU subcategory vazia
    let ticketsToFix = []
    try {
      ticketsToFix = app.findRecordsByFilter(
        'tickets',
        "category = '' || subcategory = ''",
        '-created',
        500,
        0,
      )
    } catch (errQuery) {
      console.log('[0155] erro ao buscar chamados sem categoria: ' + errQuery)
    }

    let fixedCount = 0
    for (let tI = 0; tI < ticketsToFix.length; tI++) {
      const ticket = ticketsToFix[tI]
      try {
        let changed = false
        const title = ticket.getString('title') || ''
        const desc = ticket.getString('description') || ''
        let curCatId = ticket.getString('category') || ''
        let curSubId = ticket.getString('subcategory') || ''

        let catRecord = curCatId && categoryById[curCatId] ? categoryById[curCatId] : null
        let subRecord = curSubId && categoryById[curSubId] ? categoryById[curSubId] : null

        if (!catRecord) {
          const match = matchCatalog(title + ' ' + desc)
          if (match && match.category) {
            catRecord = match.category
            ticket.set('category', catRecord.id)
            changed = true
            if (!subRecord && match.subcategory) {
              subRecord = match.subcategory
              ticket.set('subcategory', subRecord.id)
              changed = true
            }
          }
        }

        // Se tem categoria mas não tem subcategoria, preenche com subatividade correspondente
        if (catRecord && !subRecord) {
          const subs = subcategoryMap[catRecord.id] || []
          if (subs.length > 0) {
            const fullText = (title + ' ' + desc).toLowerCase()
            let chosenSub = null
            for (let sIdx = 0; sIdx < subs.length; sIdx++) {
              const sName = (subs[sIdx].getString('name') || '').toLowerCase()
              if (sName && fullText.indexOf(sName) !== -1) {
                chosenSub = subs[sIdx]
                break
              }
            }
            if (!chosenSub) chosenSub = subs[0]
            subRecord = chosenSub
            ticket.set('subcategory', subRecord.id)
            changed = true
          }
        }

        // Garantir fila se estiver sem
        if (!ticket.getString('queue')) {
          if (subRecord && subRecord.getString('queue')) {
            ticket.set('queue', subRecord.getString('queue'))
            changed = true
          } else if (catRecord && catRecord.getString('queue')) {
            ticket.set('queue', catRecord.getString('queue'))
            changed = true
          }
        }

        // Garantir SLA atualizado a partir da atividade
        if (catRecord || subRecord) {
          const createdStr = ticket.getString('created')
          const createdMs = createdStr ? new Date(createdStr).getTime() : Date.now()
          const baseMs = isNaN(createdMs) ? Date.now() : createdMs
          const sla = resolveCatalogSla(
            catRecord ? catRecord.id : '',
            subRecord ? subRecord.id : '',
            baseMs,
          )

          if (!ticket.getString('sla_response_deadline')) {
            ticket.set('sla_response_deadline', sla.respDl)
            changed = true
          }
          if (
            !ticket.getString('sla_solution_deadline') ||
            ticket.getString('sla_source') === 'Atividade: Catálogo'
          ) {
            ticket.set('sla_solution_deadline', sla.solDl)
            ticket.set('sla_source', 'Atividade: ' + sla.actName)
            changed = true
          }
        }

        // Preencher triage_suggestions se vazio
        const curTriage = ticket.get('triage_suggestions')
        const isTriageEmpty =
          !curTriage || (typeof curTriage === 'object' && Object.keys(curTriage).length === 0)
        if (isTriageEmpty && (catRecord || curCatId)) {
          const finalCat =
            catRecord || (curCatId && categoryById[curCatId] ? categoryById[curCatId] : null)
          const finalSub =
            subRecord || (curSubId && categoryById[curSubId] ? categoryById[curSubId] : null)
          ticket.set('triage_suggestions', {
            type: ticket.getString('type') || 'Incidente',
            category: finalCat ? finalCat.id : '',
            category_name: finalCat ? finalCat.getString('name') || '' : '',
            subcategory: finalSub ? finalSub.id : '',
            subcategory_name: finalSub ? finalSub.getString('name') || '' : '',
            queue: ticket.getString('queue') || '',
            confidence: 0.85,
            reason: 'Categorização regularizada por backfill no catálogo de atividades.',
            source: 'backfill',
            applied: true,
          })
          changed = true
        }

        if (changed) {
          app.save(ticket)
          fixedCount++
        }
      } catch (errTicket) {
        console.log('[0155] erro ao processar chamado ' + ticket.id + ': ' + errTicket)
      }
    }

    // 2. Backfill de triage_suggestions nos chamados que já tinham categoria mas triage_suggestions vazio
    try {
      const ticketsWithoutTriage = app.findRecordsByFilter(
        'tickets',
        "category != ''",
        '-created',
        500,
        0,
      )
      for (let wI = 0; wI < ticketsWithoutTriage.length; wI++) {
        const tObj = ticketsWithoutTriage[wI]
        const tg = tObj.get('triage_suggestions')
        const tgEmpty = !tg || (typeof tg === 'object' && Object.keys(tg).length === 0)
        if (tgEmpty) {
          const cId = tObj.getString('category')
          const sId = tObj.getString('subcategory')
          const cRec = cId && categoryById[cId] ? categoryById[cId] : null
          const sRec = sId && categoryById[sId] ? categoryById[sId] : null
          if (cRec) {
            tObj.set('triage_suggestions', {
              type: tObj.getString('type') || 'Incidente',
              category: cRec.id,
              category_name: cRec.getString('name') || '',
              subcategory: sRec ? sRec.id : '',
              subcategory_name: sRec ? sRec.getString('name') || '' : '',
              queue: tObj.getString('queue') || '',
              confidence: 0.9,
              reason: 'Triagem recuperada do catálogo de atividades.',
              source: 'backfill',
              applied: true,
            })
            app.save(tObj)
            fixedCount++
          }
        }
      }
    } catch (errTriageOnly) {
      console.log('[0155] erro ao preencher triage_suggestions em lote: ' + errTriageOnly)
    }

    console.log(
      '[0155] backfill de categorias e triagem concluído: ' +
        fixedCount +
        ' chamado(s) atualizados.',
    )
  },
  (app) => {
    // Down: idempotente, no-op
  },
)
