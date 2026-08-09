onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var fieldsToCheck = [
    'status',
    'priority',
    'assigned_to',
    'responsible',
    'risk_level',
    'change_type',
    'approval_status',
    'impact',
    'urgency',
  ]
  fieldsToCheck.forEach(function (field) {
    var oldVal = original.getString(field)
    var newVal = record.getString(field)
    if (oldVal !== newVal) {
      try {
        var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
        var log = new Record(auditCol)
        log.set('change', record.id)
        log.set('user', e.auth ? e.auth.id : record.getString('requester'))
        log.set('action', 'Alterou ' + field + ' de "' + oldVal + '" para "' + newVal + '"')
        log.set('field', field)
        log.set('old_value', oldVal)
        log.set('new_value', newVal)
        $app.save(log)
      } catch (err) {
        $app.logger().error('change_history_logger error', 'error', err.message)
      }
    }
  })

  return e.next()
}, 'changes')
