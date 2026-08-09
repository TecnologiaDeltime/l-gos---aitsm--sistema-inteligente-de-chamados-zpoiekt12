onRecordAfterCreateSuccess(function (e) {
  var record = e.record
  var currentNumber = record.getString('number')

  if (currentNumber && currentNumber.indexOf('PRB-') === 0 && currentNumber.length > 4) {
    try {
      var tlCol = $app.findCollectionByNameOrId('problem_timeline')
      var tl = new Record(tlCol)
      tl.set('problem', record.id)
      tl.set('stage', 'Abertura')
      tl.set('status', record.getString('status'))
      tl.set('responsible', record.getString('requester'))
      tl.set('comments', 'Problema registrado')
      tl.set('event_date', new Date().toISOString())
      $app.save(tl)
    } catch (err) {
      $app.logger().error('problem timeline create error', 'error', err.message)
    }
    return e.next()
  }

  try {
    var count = $app.countRecords('problems')
    var newNumber = 'PRB-' + String(count + 1).padStart(6, '0')
    var updated = $app.findRecordById('problems', record.id)
    updated.set('number', newNumber)
    $app.save(updated)

    var tlCol2 = $app.findCollectionByNameOrId('problem_timeline')
    var tl2 = new Record(tlCol2)
    tl2.set('problem', record.id)
    tl2.set('stage', 'Abertura')
    tl2.set('status', record.getString('status'))
    tl2.set('responsible', record.getString('requester'))
    tl2.set('comments', 'Problema registrado')
    tl2.set('event_date', new Date().toISOString())
    $app.save(tl2)
  } catch (err) {
    $app.logger().error('problem number generation error', 'error', err.message)
  }

  return e.next()
}, 'problems')
