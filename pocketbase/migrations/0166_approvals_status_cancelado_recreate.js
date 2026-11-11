// Migração 0166 — Garantia FINAL do valor "Cancelado" no select status de approvals.
// As migrações 0164/0165 (aplicadas) não surtiram efeito no collection ativo — o enum
// segue "Pendente | Aprovado | Reprovado" — e o hook de decisão ("basta um") gravaria
// "Cancelado" e falharia silenciosamente. Segue o padrão da 0020 (que persistiu):
// remove o campo e recria com a lista completa.
migrate(
  (app) => {
    const approvals = app.findCollectionByNameOrId('approvals')
    const statusField = approvals.fields.getByName('status')
    if (!statusField) return
    var current = statusField.values || []
    if (current.indexOf('Cancelado') >= 0) return // nada a fazer (já aplicada)
    const values = current.concat(['Cancelado'])
    approvals.fields.removeByName('status')
    approvals.fields.add(new SelectField({ name: 'status', values: values, maxSelect: 1 }))
    app.save(approvals)
    console.log('0166: campo approvals.status recriado com valores: ' + values.join(' | '))
  },
  (app) => {
    try {
      const approvals = app.findCollectionByNameOrId('approvals')
      const statusField = approvals.fields.getByName('status')
      if (!statusField) return
      const values = (statusField.values || []).filter((v) => v !== 'Cancelado')
      approvals.fields.removeByName('status')
      approvals.fields.add(new SelectField({ name: 'status', values: values, maxSelect: 1 }))
      app.save(approvals)
    } catch (_) {}
  },
)
