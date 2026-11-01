migrate(
  (app) => {
    // 1. Adicionar campo landing_route na collection profiles
    const profilesCol = app.findCollectionByNameOrId('profiles')
    if (!profilesCol.fields.getByName('landing_route')) {
      profilesCol.fields.add(
        new TextField({
          name: 'landing_route',
          required: false,
        }),
      )
      app.save(profilesCol)
    }

    // 2. Backfill idempotente:
    // Perfis de operação (operador, atendimento, técnico, supervisor, etc.) -> /operator-dashboard
    // Administrador (e qualquer outro não-operacional) -> /dashboard
    try {
      const allProfiles = app.findRecordsByFilter('profiles', '', '', 0, 0)
      allProfiles.forEach((prof) => {
        const currentRoute = prof.get('landing_route')
        if (currentRoute && String(currentRoute).trim().length > 0) {
          return // Já preenchido, mantém
        }

        const nameLower = (prof.get('name') || '').trim().toLowerCase()
        const isOperator = nameLower !== 'administrador'

        prof.set('landing_route', isOperator ? '/operator-dashboard' : '/dashboard')
        app.save(prof)
      })
    } catch (e) {
      console.log('Error backfilling profiles landing_route:', e)
    }
  },
  (app) => {
    try {
      const profilesCol = app.findCollectionByNameOrId('profiles')
      const field = profilesCol.fields.getByName('landing_route')
      if (field) {
        profilesCol.fields.removeByName('landing_route')
        app.save(profilesCol)
      }
    } catch (_) {}
  },
)
