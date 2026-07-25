onRecordAfterUpdateSuccess((e) => {
  const record = e.record
  const original = record.original()
  if (!original) return e.next()

  const fieldsToCheck = ['status', 'priority', 'assigned_to', 'queue', 'impact', 'urgency']
  fieldsToCheck.forEach((field) => {
    const oldVal = original.getString(field)
    const newVal = record.getString(field)
    if (oldVal !== newVal) {
      try {
        const historyCol = $app.findCollectionByNameOrId('ticket_history')
        const history = new Record(historyCol)
        history.set('ticket', record.id)
        history.set('user', e.auth ? e.auth.id : record.getString('assigned_to') || record.id)
        history.set('action', `Alterou ${field} de "${oldVal}" para "${newVal}"`)
        history.set('field', field)
        history.set('old_value', oldVal)
        history.set('new_value', newVal)
        $app.save(history)
      } catch (err) {
        $app.logger().error('Error saving history log', 'error', err.message)
      }
    }
  })

  return e.next()
}, 'tickets')
