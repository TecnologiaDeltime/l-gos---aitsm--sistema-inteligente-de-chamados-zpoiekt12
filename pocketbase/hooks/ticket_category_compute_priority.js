onRecordValidate((e) => {
  var parent = e.record.getString('parent')
  if (!parent) return e.next()

  var impact = e.record.getString('impact')
  var urgency = e.record.getString('urgency')
  if (!impact || !urgency) return e.next()

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
  var priority = matrix[key] || 'Média'
  e.record.set('priority', priority)

  return e.next()
}, 'tkt_categories')
