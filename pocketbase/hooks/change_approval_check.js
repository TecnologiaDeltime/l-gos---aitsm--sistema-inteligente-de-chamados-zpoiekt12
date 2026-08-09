onRecordAfterCreateSuccess((e) => {
  var change = e.record
  var changeTypeId = change.getString('change_type')
  if (!changeTypeId) return e.next()

  var changeType
  try {
    changeType = $app.findRecordById('change_types', changeTypeId)
  } catch (_) {
    return e.next()
  }

  if (changeType.getBool('is_standard') && !changeType.getBool('approval_required')) {
    try {
      var updated = $app.findRecordById('changes', change.id)
      updated.set('approval_status', 'Não Requerida')
      $app.save(updated)
    } catch (_) {}
    return e.next()
  }

  var requesterId = change.getString('requester')
  if (!requesterId && e.auth) requesterId = e.auth.id
  if (!requesterId) return e.next()

  try {
    var approvalsCol = $app.findCollectionByNameOrId('change_approvals')
    var approvers = $app.findRecordsByFilter(
      'users',
      'role = "admin" || role = "gestor"',
      '',
      10,
      0,
    )
    if (approvers.length === 0) return e.next()

    approvers.forEach(function (approver) {
      var approval = new Record(approvalsCol)
      approval.set('change', change.id)
      approval.set('approver', approver.id)
      approval.set('status', 'Pendente')
      $app.save(approval)
    })

    var changeRec = $app.findRecordById('changes', change.id)
    changeRec.set('approval_status', 'Pendente')
    changeRec.set('status', 'Aguardando Aprovação')
    $app.save(changeRec)

    var auditCol = $app.findCollectionByNameOrId('change_audit_logs')
    var log = new Record(auditCol)
    log.set('change', change.id)
    log.set('user', requesterId)
    log.set('action', 'Aprovação solicitada automaticamente')
    log.set('field', 'status')
    log.set('old_value', 'Solicitada')
    log.set('new_value', 'Aguardando Aprovação')
    $app.save(log)

    var notifCol = $app.findCollectionByNameOrId('notifications')
    approvers.forEach(function (approver) {
      var notif = new Record(notifCol)
      notif.set('user', approver.id)
      notif.set('title', 'Nova mudança pendente de aprovação')
      notif.set('message', 'Mudança #' + change.getString('number') + ' requer sua aprovação')
      notif.set('type', 'Aprovação')
      notif.set('read', false)
      $app.save(notif)
    })
  } catch (err) {
    $app.logger().error('change_approval_check error', 'error', err.message)
  }

  return e.next()
}, 'changes')
