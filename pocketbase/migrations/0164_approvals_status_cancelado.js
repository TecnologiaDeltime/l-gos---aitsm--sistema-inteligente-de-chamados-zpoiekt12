// Migração 0164 — Regra "basta um" para múltiplos aprovadores
// Lógos AITSM: quando o PRIMEIRO aprovador decide, as demais pendências do mesmo
// chamado são fechadas como "Cancelado" (resolvida por outro aprovador) — sem cascata,
// pois o hook de decisão ignora registros que já não estão "Pendente".
// Idempotente: só adiciona o valor ao select se ele ainda não existir.

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
