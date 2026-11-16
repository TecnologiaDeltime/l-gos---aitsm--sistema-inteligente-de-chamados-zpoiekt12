/// <reference path="../pb_data/types.d.ts" />
/**
 * TEMPORÁRIO — validação runtime do fluxo de aprovação no chamado 00135.
 * A cada tick: loga disponibilidade de globalThis._ticketApprovalRunCheck e o
 * estado do chamado; enquanto NÃO houver aprovação pendente, alterna a
 * subatividade ('' <-> 'mvpr8qs4lq0n6qh') para disparar o after-update do hook
 * ticket_approval_check.js. NÃO grava tags. REMOVER após validação.
 */
cronAdd('A0Z9_approval_validate_tmp', '* * * * *', () => {
  try {
    var t = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
    var hasFn = typeof globalThis._ticketApprovalRunCheck === 'function'
    console.log(
      '[VALIDATE_TMP] tick | status=' +
        t.getString('status') +
        ' | hold=' +
        t.getBool('approval_hold') +
        ' | cat=' +
        t.getString('category') +
        ' | sub=' +
        t.getString('subcategory') +
        ' | _g.runCheck=' +
        hasFn,
    )
    var dup = null
    try {
      dup = $app.findFirstRecordByFilter(
        'approvals',
        'ticket = "wxlpobn005lj0rw" && status = "Pendente"',
      )
    } catch (_) {}
    if (dup || t.getBool('approval_hold')) {
      console.log('[VALIDATE_TMP] aprovação já gerada — nada a fazer')
      return
    }
    var newSub = t.getString('subcategory') === 'mvpr8qs4lq0n6qh' ? '' : 'mvpr8qs4lq0n6qh'
    t.set('subcategory', newSub)
    $app.save(t)
    var t2 = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
    console.log(
      '[VALIDATE_TMP] após update | status=' +
        t2.getString('status') +
        ' | hold=' +
        t2.getBool('approval_hold') +
        ' | sub=' +
        t2.getString('subcategory'),
    )
  } catch (err) {
    console.error('[VALIDATE_TMP] erro: ' + err.message)
  }
})
