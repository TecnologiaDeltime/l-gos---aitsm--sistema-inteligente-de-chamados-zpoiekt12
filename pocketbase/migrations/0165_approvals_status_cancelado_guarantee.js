// Migração 0165 — Garantia do valor "Cancelado" no select status de approvals.
// A 0164 deveria ter adicionado o valor, mas a collection ativa está sem ele —
// o hook de decisão ("basta um") gravaria "Cancelado" e a validação falharia
// silenciosamente. Idempotente: só adiciona se ainda não existir.
migrate(
  (app) => {
    const approvals = app.findCollectionByNameOrId('approvals')
    const statusField = approvals.fields.getByName('status')
    if (statusField && statusField.type === 'select') {
      const values = statusField.values || []
      if (values.indexOf('Cancelado') === -1) {
        statusField.values = values.concat(['Cancelado'])
        app.save(approvals)
      }
    }
  },
  (app) => {
    try {
      const approvals = app.findCollectionByNameOrId('approvals')
      const statusField = approvals.fields.getByName('status')
      if (statusField && statusField.type === 'select') {
        const values = (statusField.values || []).filter((v) => v !== 'Cancelado')
        statusField.values = values
        app.save(approvals)
      }
    } catch (_) {}
  },
)
