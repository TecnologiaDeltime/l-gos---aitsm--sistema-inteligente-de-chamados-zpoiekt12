migrate(
  (app) => {
    // Campo JSON para armazenar a lista de acordos de atendimento base
    // (Nível 1, Nível 2, Nível 3, Consultoria, Backoffice, Administrativo) que o
    // usuário removeu do formulário de contrato. Cada item é a key do nível
    // (ex.: "hours_level1"). Permite que os 6 níveis fixos sejam ocultados do
    // formulário — assim como já ocorre com os acordos personalizados — sem
    // excluir as colunas físicas do banco, mantendo compatibilidade com
    // relatórios e dados históricos.
    const col = app.findCollectionByNameOrId('contracts')

    if (!col.fields.getByName('removed_levels')) {
      col.fields.add(
        new JSONField({
          name: 'removed_levels',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contracts')
    const f = col.fields.getByName('removed_levels')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
