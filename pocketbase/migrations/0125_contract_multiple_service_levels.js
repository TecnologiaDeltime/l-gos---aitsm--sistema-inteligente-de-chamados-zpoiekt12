migrate(
  (app) => {
    // Migração 0125: permite MÚLTIPLOS níveis de atendimento por contrato.
    // O campo JSON `service_levels` guarda as chaves dos acordos de atendimento
    // base (hours_level1, hours_level2, hours_level3, hours_consultoria,
    // hours_backoffice, hours_administrativo) selecionados para o contrato.
    // Backfill idempotente: contratos antigos herdam como níveis selecionados
    // todos os acordos base que possuem horas contratadas > 0, preservando os
    // dados existentes (um contrato com um único nível continua funcionando).
    const col = app.findCollectionByNameOrId('contracts')

    if (!col.fields.getByName('service_levels')) {
      col.fields.add(
        new JSONField({
          name: 'service_levels',
          required: false,
        }),
      )
    }

    app.save(col)

    const allKeys = [
      'hours_level1',
      'hours_level2',
      'hours_level3',
      'hours_consultoria',
      'hours_backoffice',
      'hours_administrativo',
    ]

    const contracts = app.findRecordsByFilter('contracts', 'id != ""', '', 0, 0)
    contracts.forEach((c) => {
      const current = c.get('service_levels')
      if (Array.isArray(current) && current.length > 0) return
      const selected = allKeys.filter((k) => Number(c.get(k) || 0) > 0)
      c.set('service_levels', selected)
      app.save(c)
    })
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contracts')
    const f = col.fields.getByName('service_levels')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
