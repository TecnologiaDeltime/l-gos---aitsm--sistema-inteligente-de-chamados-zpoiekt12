migrate(
  (app) => {
    var categories = app.findCollectionByNameOrId('tkt_categories')

    function findOrCreateMain(name, description) {
      try {
        return app.findFirstRecordByData('tkt_categories', 'name', name)
      } catch (_) {
        var rec = new Record(categories)
        rec.set('name', name)
        rec.set('description', description)
        rec.set('active', true)
        app.save(rec)
        return rec
      }
    }

    function findOrCreateSub(parentId, name, impact, urgency, slaResp, slaSol) {
      try {
        return app.findFirstRecordByData('tkt_categories', 'name', name)
      } catch (_) {
        var rec = new Record(categories)
        rec.set('name', name)
        rec.set('parent', parentId)
        rec.set('active', true)
        rec.set('impact', impact)
        rec.set('urgency', urgency)
        rec.set('sla_response_minutes', slaResp)
        rec.set('sla_solution_minutes', slaSol)

        var matrix = {
          'Alto|Alta': 'Crítica',
          'Alto|Média': 'Alta',
          'Alto|Baixa': 'Média',
          'Médio|Alta': 'Alta',
          'Médio|Média': 'Média',
          'Médio|Baixa': 'Baixa',
          'Baixo|Alta': 'Média',
          'Baixo|Média': 'Baixa',
          'Baixo|Baixa': 'Baixa',
        }
        var key = impact + '|' + urgency
        rec.set('priority', matrix[key] || 'Média')
        app.save(rec)
        return rec
      }
    }

    var computador = findOrCreateMain(
      'Computador',
      'Problemas relacionados a computadores e notebooks',
    )
    findOrCreateSub(computador.id, 'Computador não liga', 'Alto', 'Alta', 30, 240)
    findOrCreateSub(computador.id, 'Computador com lentidão', 'Médio', 'Média', 60, 480)

    var rede = findOrCreateMain('Rede', 'Conectividade e infraestrutura de rede')
    findOrCreateSub(rede.id, 'Sem conectividade de rede', 'Alto', 'Alta', 30, 240)
    findOrCreateSub(rede.id, 'Lentidão na rede', 'Médio', 'Média', 60, 480)

    var impressora = findOrCreateMain('Impressora', 'Problemas com impressoras e multifuncionais')
    findOrCreateSub(impressora.id, 'Impressora não imprime', 'Médio', 'Alta', 45, 360)
    findOrCreateSub(impressora.id, 'Papel atolado', 'Baixo', 'Média', 120, 720)

    var software = findOrCreateMain('Sistema', 'Sistemas e aplicações corporativas')
    findOrCreateSub(software.id, 'Sistema fora do ar', 'Alto', 'Alta', 15, 120)
    findOrCreateSub(software.id, 'Erro ao salvar documento', 'Médio', 'Média', 60, 480)
  },
  (app) => {},
)
