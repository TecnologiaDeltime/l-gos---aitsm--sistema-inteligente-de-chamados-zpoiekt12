/// <reference path="../pb_data/types.d.ts" />
// TEMPORÁRIO — cron de validação do fluxo de aprovação (remover após validar).
// Executa uma vez: alterna subcategory do chamado alvo (dispara after-update real)
// e grava o resultado em tags do ticket (consultável por db_query).
cronAdd('approval_validate_tmp', '*/2 * * * *', function () {
  try {
    var rec = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
    var tags = rec.getString('tags') || ''
    if (tags.indexOf('VALIDATE_TMP') !== -1) return // já validou
    if (rec.getBool('approval_hold')) {
      rec.set('tags', tags + ' VALIDATE_TMP:hold-true')
      $app.save(rec)
      return
    }
    var sub = rec.getString('subcategory') || ''
    rec.set('subcategory', '')
    $app.save(rec)
    var rec2 = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
    rec2.set('subcategory', sub)
    $app.save(rec2)
    var t3 = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
    var pend = null
    try {
      pend = $app.findFirstRecordByFilter(
        'approvals',
        'ticket = "wxlpobn005lj0rw" && status = "Pendente"',
      )
    } catch (_) {}
    var res =
      'VALIDATE_TMP:status=' +
      t3.getString('status') +
      ',hold=' +
      t3.getBool('approval_hold') +
      ',pend=' +
      (pend ? pend.id : 'nulo')
    t3.set('tags', (t3.getString('tags') || '') + ' ' + res)
    $app.save(t3)
  } catch (err) {
    console.error('[VALIDATE_TMP] erro: ' + err.message)
  }
})
