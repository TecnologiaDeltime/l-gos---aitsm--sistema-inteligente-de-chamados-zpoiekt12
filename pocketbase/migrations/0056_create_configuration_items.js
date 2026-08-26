migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId('companies')

    const configurationItems = new Collection({
      name: 'configuration_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'gestor' || @request.auth.role = 'tecnico')",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: [
            'Impressora',
            'Roteador',
            'Access Point',
            'Switch',
            'Servidor',
            'Storage/NAS',
            'Firewall',
            'No-Break',
            'Telefone IP',
            'Scanner',
            'Projetor',
            'Monitor',
            'Estabilizador',
            'Câmera IP',
            'Controladora',
            'Rack',
            'Outros',
          ],
          maxSelect: 1,
        },
        { name: 'brand', type: 'text' },
        { name: 'model', type: 'text' },
        { name: 'serial_number', type: 'text' },
        { name: 'location', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['Ativo', 'Inativo', 'Em Manutenção', 'Descartado', 'Reserva'],
          maxSelect: 1,
        },
        { name: 'observations', type: 'text' },
        {
          name: 'company',
          type: 'relation',
          collectionId: companies.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ci_company ON configuration_items (company)',
        'CREATE INDEX idx_ci_type ON configuration_items (type)',
        'CREATE INDEX idx_ci_status ON configuration_items (status)',
      ],
    })
    app.save(configurationItems)

    const tickets = app.findCollectionByNameOrId('tickets')
    if (!tickets.fields.getByName('configuration_item')) {
      tickets.fields.add(
        new RelationField({
          name: 'configuration_item',
          collectionId: configurationItems.id,
          maxSelect: 1,
        }),
      )
      tickets.addIndex('idx_tickets_ci', false, 'configuration_item', '')
      app.save(tickets)
    }
  },
  (app) => {
    try {
      const tickets = app.findCollectionByNameOrId('tickets')
      tickets.removeIndex('idx_tickets_ci')
      const ciField = tickets.fields.getByName('configuration_item')
      if (ciField) {
        tickets.fields.remove(ciField)
      }
      app.save(tickets)
    } catch (_) {}

    try {
      const configurationItems = app.findCollectionByNameOrId('configuration_items')
      app.delete(configurationItems)
    } catch (_) {}
  },
)
