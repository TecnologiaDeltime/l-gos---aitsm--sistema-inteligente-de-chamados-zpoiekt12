migrate(
  (app) => {
    var newValues = ['Crítica', 'Alta', 'Média', 'Baixa']

    app.db().newQuery("UPDATE tickets SET priority = 'Crítica' WHERE priority = 'P1'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'Alta' WHERE priority = 'P2'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'Média' WHERE priority = 'P3'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'Baixa' WHERE priority = 'P4'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'Baixa' WHERE priority = 'P5'").execute()

    app
      .db()
      .newQuery("UPDATE technical_visits SET priority = 'Crítica' WHERE priority = 'P1'")
      .execute()
    app
      .db()
      .newQuery("UPDATE technical_visits SET priority = 'Alta' WHERE priority = 'P2'")
      .execute()
    app
      .db()
      .newQuery("UPDATE technical_visits SET priority = 'Média' WHERE priority = 'P3'")
      .execute()
    app
      .db()
      .newQuery("UPDATE technical_visits SET priority = 'Baixa' WHERE priority = 'P4'")
      .execute()
    app
      .db()
      .newQuery("UPDATE technical_visits SET priority = 'Baixa' WHERE priority = 'P5'")
      .execute()

    app
      .db()
      .newQuery("UPDATE workflow_tasks SET priority = 'Crítica' WHERE priority = 'P1'")
      .execute()
    app.db().newQuery("UPDATE workflow_tasks SET priority = 'Alta' WHERE priority = 'P2'").execute()
    app
      .db()
      .newQuery("UPDATE workflow_tasks SET priority = 'Média' WHERE priority = 'P3'")
      .execute()
    app
      .db()
      .newQuery("UPDATE workflow_tasks SET priority = 'Baixa' WHERE priority = 'P4'")
      .execute()
    app
      .db()
      .newQuery("UPDATE workflow_tasks SET priority = 'Baixa' WHERE priority = 'P5'")
      .execute()

    app
      .db()
      .newQuery(
        'UPDATE contracts SET priorities_available = \'["Crítica","Alta","Média","Baixa"]\'',
      )
      .execute()

    var ticketsCol = app.findCollectionByNameOrId('tickets')
    ticketsCol.fields.removeByName('priority')
    ticketsCol.fields.add(new SelectField({ name: 'priority', values: newValues, maxSelect: 1 }))
    if (!ticketsCol.fields.getByName('sla_response_start')) {
      ticketsCol.fields.add(new DateField({ name: 'sla_response_start' }))
    }
    app.save(ticketsCol)

    var contractsCol = app.findCollectionByNameOrId('contracts')
    contractsCol.fields.removeByName('priorities_available')
    contractsCol.fields.add(
      new SelectField({
        name: 'priorities_available',
        values: newValues,
        maxSelect: 4,
      }),
    )
    app.save(contractsCol)

    var visitsCol = app.findCollectionByNameOrId('technical_visits')
    visitsCol.fields.removeByName('priority')
    visitsCol.fields.add(new SelectField({ name: 'priority', values: newValues, maxSelect: 1 }))
    app.save(visitsCol)

    var tasksCol = app.findCollectionByNameOrId('workflow_tasks')
    tasksCol.fields.removeByName('priority')
    tasksCol.fields.add(new SelectField({ name: 'priority', values: newValues, maxSelect: 1 }))
    app.save(tasksCol)
  },
  (app) => {
    var oldValues = ['P1', 'P2', 'P3', 'P4', 'P5']

    app.db().newQuery("UPDATE tickets SET priority = 'P1' WHERE priority = 'Crítica'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'P2' WHERE priority = 'Alta'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'P3' WHERE priority = 'Média'").execute()
    app.db().newQuery("UPDATE tickets SET priority = 'P4' WHERE priority = 'Baixa'").execute()

    var ticketsCol = app.findCollectionByNameOrId('tickets')
    ticketsCol.fields.removeByName('priority')
    ticketsCol.fields.add(new SelectField({ name: 'priority', values: oldValues, maxSelect: 1 }))
    if (ticketsCol.fields.getByName('sla_response_start')) {
      ticketsCol.fields.removeByName('sla_response_start')
    }
    app.save(ticketsCol)

    var contractsCol = app.findCollectionByNameOrId('contracts')
    contractsCol.fields.removeByName('priorities_available')
    contractsCol.fields.add(
      new SelectField({
        name: 'priorities_available',
        values: oldValues,
        maxSelect: 5,
      }),
    )
    app.save(contractsCol)

    var visitsCol = app.findCollectionByNameOrId('technical_visits')
    visitsCol.fields.removeByName('priority')
    visitsCol.fields.add(new SelectField({ name: 'priority', values: oldValues, maxSelect: 1 }))
    app.save(visitsCol)

    var tasksCol = app.findCollectionByNameOrId('workflow_tasks')
    tasksCol.fields.removeByName('priority')
    tasksCol.fields.add(new SelectField({ name: 'priority', values: oldValues, maxSelect: 1 }))
    app.save(tasksCol)
  },
)
