migrate(
  (app) => {
    // 1. Adicionar email_html à coleção tickets
    try {
      const ticketsCol = app.findCollectionByNameOrId('tickets')
      if (!ticketsCol.fields.getByName('email_html')) {
        ticketsCol.fields.add(new TextField({ name: 'email_html' }))
        app.save(ticketsCol)
      }
    } catch (_) {}

    // 2. Adicionar email_html à coleção ticket_interactions
    try {
      const interactionsCol = app.findCollectionByNameOrId('ticket_interactions')
      if (!interactionsCol.fields.getByName('email_html')) {
        interactionsCol.fields.add(new TextField({ name: 'email_html' }))
        app.save(interactionsCol)
      }
    } catch (_) {}

    // 3. Adicionar content_id à coleção ticket_attachments
    try {
      const attachCol = app.findCollectionByNameOrId('ticket_attachments')
      if (!attachCol.fields.getByName('content_id')) {
        attachCol.fields.add(new TextField({ name: 'content_id' }))
        app.save(attachCol)
      }
    } catch (_) {}

    // 4. Adicionar email_html à coleção retained_tickets
    try {
      const retainedCol = app.findCollectionByNameOrId('retained_tickets')
      if (!retainedCol.fields.getByName('email_html')) {
        retainedCol.fields.add(new TextField({ name: 'email_html' }))
        app.save(retainedCol)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const ticketsCol = app.findCollectionByNameOrId('tickets')
      ticketsCol.fields.removeByName('email_html')
      app.save(ticketsCol)
    } catch (_) {}

    try {
      const interactionsCol = app.findCollectionByNameOrId('ticket_interactions')
      interactionsCol.fields.removeByName('email_html')
      app.save(interactionsCol)
    } catch (_) {}

    try {
      const attachCol = app.findCollectionByNameOrId('ticket_attachments')
      attachCol.fields.removeByName('content_id')
      app.save(attachCol)
    } catch (_) {}

    try {
      const retainedCol = app.findCollectionByNameOrId('retained_tickets')
      retainedCol.fields.removeByName('email_html')
      app.save(retainedCol)
    } catch (_) {}
  },
)
