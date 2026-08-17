migrate(
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')

    // Self-relation: ticket pai -> ticket filho. maxSelect=1 (um filho tem
    // exatamente um pai); optional, assim chamados sem vínculo continuam
    // funcionando normalmente.
    if (!ticketsCol.fields.getByName('parent_ticket_id')) {
      ticketsCol.fields.add(
        new RelationField({
          name: 'parent_ticket_id',
          collectionId: ticketsCol.id,
          maxSelect: 1,
        }),
      )
    }

    // Índice para acelerar a busca de filhos de um ticket pai.
    ticketsCol.addIndex('idx_tickets_parent_ticket', false, 'parent_ticket_id', '')

    app.save(ticketsCol)
  },
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    try {
      ticketsCol.removeIndex('idx_tickets_parent_ticket')
    } catch (_) {}
    var parentField = ticketsCol.fields.getByName('parent_ticket_id')
    if (parentField) ticketsCol.fields.remove(parentField)
    app.save(ticketsCol)
  },
)
