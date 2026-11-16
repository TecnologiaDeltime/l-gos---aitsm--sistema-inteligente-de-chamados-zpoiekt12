// ARTEFATO TEMPORÁRIO DE VALIDAÇÃO — remover após o teste.
// Alterna a subatividade do chamado 00135 (wxlpobn005lj0rw): limpa e regrava
// mvpr8qs4lq0n6qh, para disparar o after-update do ticket_approval_check.js
// em runtime real do Goja.
cronAdd('A0Z9_approval_validate_tmp', '*/1 * * * *', () => {
  var t = null
  try {
    t = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
  } catch (e) {
    console.error('[VALIDATE_TMP] ticket não encontrado: ' + e)
    return
  }
  if (t.getBool('approval_hold')) {
    console.log('[VALIDATE_TMP] já está em approval_hold — nada a fazer')
    return
  }
  console.log(
    '[VALIDATE_TMP] status antes: ' +
      t.getString('status') +
      ' | cat=' +
      t.getString('category') +
      ' | sub=' +
      t.getString('subcategory'),
  )
  t.set('subcategory', '')
  $app.save(t)
  var t2 = null
  try {
    t2 = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
  } catch (_) {}
  if (!t2) return
  t2.set('subcategory', 'mvpr8qs4lq0n6qh')
  $app.save(t2)
  var t3 = null
  try {
    t3 = $app.findRecordById('tickets', 'wxlpobn005lj0rw')
  } catch (_) {}
  console.log(
    '[VALIDATE_TMP] status depois: ' +
      (t3 ? t3.getString('status') : 'ERRO') +
      ' | hold=' +
      (t3 ? t3.getBool('approval_hold') : '?'),
  )
})
