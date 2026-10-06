migrate(
  (app) => {
    // 1. Extender companies com campos de SLA padrão do cliente
    var companies = app.findCollectionByNameOrId('companies')
    if (!companies.fields.getByName('sla_response_minutes')) {
      companies.fields.add(new NumberField({ name: 'sla_response_minutes', min: 1 }))
    }
    if (!companies.fields.getByName('sla_solution_minutes')) {
      companies.fields.add(new NumberField({ name: 'sla_solution_minutes', min: 1 }))
    }
    app.save(companies)

    // 2. Extender tickets com campos auxiliares de SLA se não existirem
    var tickets = app.findCollectionByNameOrId('tickets')
    if (!tickets.fields.getByName('sla_source')) {
      tickets.fields.add(new TextField({ name: 'sla_source' }))
    }
    app.save(tickets)
  },
  (app) => {
    try {
      var companies = app.findCollectionByNameOrId('companies')
      if (companies.fields.getByName('sla_response_minutes')) {
        companies.fields.removeByName('sla_response_minutes')
      }
      if (companies.fields.getByName('sla_solution_minutes')) {
        companies.fields.removeByName('sla_solution_minutes')
      }
      app.save(companies)
    } catch (_) {}

    try {
      var tickets = app.findCollectionByNameOrId('tickets')
      if (tickets.fields.getByName('sla_source')) {
        tickets.fields.removeByName('sla_source')
      }
      app.save(tickets)
    } catch (_) {}
  },
)
