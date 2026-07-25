onRecordAfterUpdateSuccess((e) => {
  const record = e.record
  const original = record.original()
  if (!original) return e.next()

  const userId = e.auth ? e.auth.id : ''
  if (!userId) return e.next()

  const fieldsToCheck = [
    'name',
    'type',
    'manufacturer',
    'model',
    'serial_number',
    'patrimony_number',
    'ip_address',
    'operating_system',
    'company',
    'unit',
    'department',
    'location',
    'responsible_user',
    'warranty_until',
    'supplier',
    'acquisition_date',
    'status',
    'notes',
  ]

  fieldsToCheck.forEach((field) => {
    const oldVal = original.getString(field)
    const newVal = record.getString(field)
    if (oldVal !== newVal) {
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', userId)
        audit.set('action', 'Alterou ' + field + ' de "' + oldVal + '" para "' + newVal + '"')
        audit.set('entity_type', 'equipment')
        audit.set('entity_id', record.id)
        audit.set('description', field)
        audit.set('old_values', JSON.stringify({ value: oldVal }))
        audit.set('new_values', JSON.stringify({ value: newVal }))
        $app.save(audit)
      } catch (err) {
        $app.logger().error('Error saving equipment audit log', 'error', err.message)
      }
    }
  })

  return e.next()
}, 'equipments')
