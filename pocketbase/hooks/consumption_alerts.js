onRecordAfterUpdateSuccess((e) => {
  var record = e.record
  var original = record.original()
  if (!original) return e.next()

  var oldConsumed = original.getFloat('consumed_hours') || 0
  var newConsumed = record.getFloat('consumed_hours') || 0
  if (oldConsumed === newConsumed) return e.next()

  var contracted = record.getFloat('contracted_hours') || 0
  if (contracted <= 0) return e.next()

  var pct = (newConsumed / contracted) * 100
  var oldPct = (oldConsumed / contracted) * 100
  var contractId = record.getString('contract')

  var contractNumber = ''
  try {
    var contract = $app.findRecordById('contracts', contractId)
    contractNumber = contract.getString('number')
  } catch (_) {}

  if (pct >= 80 && oldPct < 80) {
    try {
      $app.findFirstRecordByFilter(
        'notifications',
        'title = "Alerta de Consumo 80%" && message ~ "' + contractNumber + '"',
      )
    } catch (_) {
      try {
        var admins = $app.findRecordsByFilter(
          'users',
          'role = "admin" || role = "gestor"',
          '',
          0,
          0,
        )
        var notifCol = $app.findCollectionByNameOrId('notifications')
        for (var i = 0; i < admins.length; i++) {
          var notif = new Record(notifCol)
          notif.set('user', admins[i].id)
          notif.set('title', 'Alerta de Consumo 80%')
          notif.set(
            'message',
            'Contrato ' +
              contractNumber +
              ': ' +
              newConsumed.toFixed(2) +
              'h de ' +
              contracted.toFixed(2) +
              'h (80%). Saldo: ' +
              (contracted - newConsumed).toFixed(2) +
              'h.',
          )
          notif.set('type', 'Alerta')
          notif.set('read', false)
          $app.save(notif)
        }
      } catch (err) {
        $app.logger().error('Error sending 80% alert', 'error', err.message)
      }
    }
  }

  if (pct >= 100 && oldPct < 100) {
    try {
      $app.findFirstRecordByFilter(
        'notifications',
        'title = "Alerta de Consumo 100%" && message ~ "' + contractNumber + '"',
      )
    } catch (_) {
      try {
        var contract2 = $app.findRecordById('contracts', contractId)
        contract2.set('status', 'Expirado')
        $app.save(contract2)

        var admins2 = $app.findRecordsByFilter(
          'users',
          'role = "admin" || role = "gestor"',
          '',
          0,
          0,
        )
        var notifCol2 = $app.findCollectionByNameOrId('notifications')
        for (var j = 0; j < admins2.length; j++) {
          var n = new Record(notifCol2)
          n.set('user', admins2[j].id)
          n.set('title', 'Alerta de Consumo 100%')
          n.set(
            'message',
            'Contrato ' +
              contractNumber +
              ' atingiu 100% do consumo. Status alterado para Limite Atingido. Aguardando decisao de continuidade.',
          )
          n.set('type', 'Alerta')
          n.set('read', false)
          $app.save(n)
        }
      } catch (err) {
        $app.logger().error('Error sending 100% alert', 'error', err.message)
      }
    }
  }

  return e.next()
}, 'contract_periods')
