migrate(
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')

    // Campo de grupo de associação. Todos os tickets que compartilham o mesmo
    // `association_group_id` (UUID gerado na primeira associação) são
    // considerados associados entre si. A associação é bidirecional porque
    // todos os tickets do mesmo grupo enxergam os demais membros do grupo.
    if (!ticketsCol.fields.getByName('association_group_id')) {
      ticketsCol.fields.add(
        new TextField({
          name: 'association_group_id',
          required: false,
        }),
      )
    }

    // Índice para acelerar a busca de tickets do mesmo grupo de associação.
    ticketsCol.addIndex('idx_tickets_association_group', false, 'association_group_id', '')

    app.save(ticketsCol)
  },
  (app) => {
    var ticketsCol = app.findCollectionByNameOrId('tickets')
    try {
      ticketsCol.removeIndex('idx_tickets_association_group')
    } catch (_) {}
    var field = ticketsCol.fields.getByName('association_group_id')
    if (field) ticketsCol.fields.remove(field)
    app.save(ticketsCol)
  },
)
