/// <reference path="../types.d.ts" />
// mig 0175 — adiciona o status "Pendente" às opções do campo status de tickets
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('tickets')
    const statusField = collection.fields.find((f) => f.name === 'status')
    if (
      statusField &&
      Array.isArray(statusField.values) &&
      !statusField.values.includes('Pendente')
    ) {
      // "Pendente" ao lado de "Em aberto" (que é exibido para o valor "Atribuído")
      const idx = statusField.values.indexOf('Atribuído')
      if (idx >= 0) {
        statusField.values.splice(idx + 1, 0, 'Pendente')
      } else {
        statusField.values.push('Pendente')
      }
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('tickets')
    const statusField = collection.fields.find((f) => f.name === 'status')
    if (statusField && Array.isArray(statusField.values)) {
      const idx = statusField.values.indexOf('Pendente')
      if (idx >= 0) {
        statusField.values.splice(idx, 1)
        app.save(collection)
      }
    }
  },
)
