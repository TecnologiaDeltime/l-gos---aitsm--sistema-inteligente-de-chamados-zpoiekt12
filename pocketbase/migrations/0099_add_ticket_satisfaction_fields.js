migrate(
  (app) => {
    const tickets = app.findCollectionByNameOrId('tickets')

    if (!tickets.fields.getByName('satisfaction_comment')) {
      tickets.fields.add(
        new TextField({
          name: 'satisfaction_comment',
        }),
      )
    }

    if (!tickets.fields.getByName('satisfaction_responded_at')) {
      tickets.fields.add(
        new DateField({
          name: 'satisfaction_responded_at',
        }),
      )
    }

    app.save(tickets)
  },
  (app) => {
    const tickets = app.findCollectionByNameOrId('tickets')
    const commentField = tickets.fields.getByName('satisfaction_comment')
    if (commentField) tickets.fields.remove(commentField)
    const dateField = tickets.fields.getByName('satisfaction_responded_at')
    if (dateField) tickets.fields.remove(dateField)
    app.save(tickets)
  },
)
