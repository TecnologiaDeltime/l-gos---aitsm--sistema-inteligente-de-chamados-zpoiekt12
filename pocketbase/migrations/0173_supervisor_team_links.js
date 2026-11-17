migrate(
  (app) => {
    // Migração 0173: Gerenciar equipes de supervisores
    // 1. Cria a coleção supervisor_team_links (vínculo supervisor ↔ equipe/fila,
    //    active por padrão, autodate created/updated).
    // 2. Registra o item 'admin_supervisor_teams' no catálogo de permissões
    //    (módulo admin), habilitado por padrão para os perfis administrativos
    //    (admin/gestor), seguindo o padrão 0169/0122.
    var usersCol = app.findCollectionByNameOrId('users')
    var queuesCol = app.findCollectionByNameOrId('queues')

    var alreadyExists = false
    try {
      alreadyExists = !!app.findCollectionByNameOrId('supervisor_team_links')
    } catch (_) {
      alreadyExists = false
    }
    if (!alreadyExists) {
      var collection = new Collection({
        name: 'supervisor_team_links',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        updateRule:
          '@request.auth.id != \'\' && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule: '@request.auth.id != \'\' && @request.auth.role = "admin"',
        fields: [
          {
            name: 'supervisor',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            minSelect: 1,
            maxSelect: 1,
          },
          {
            name: 'team',
            type: 'relation',
            required: true,
            collectionId: queuesCol.id,
            minSelect: 1,
            maxSelect: 1,
          },
          { name: 'active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_supervisor_team_links_pair ON supervisor_team_links (supervisor, team)',
        ],
      })
      app.save(collection)
    }
    console.log('[0173] coleção supervisor_team_links pronta')

    // Permissão no catálogo (padrão 0169/0122): admin/gestor configuram; demais nascem sem acesso
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      var permCol = app.findCollectionByNameOrId('profile_permissions')

      var moduleKey = 'admin'
      var itemKey = 'admin_supervisor_teams'

      for (var i = 0; i < profiles.length; i++) {
        var profileId = profiles[i].id
        var profName = (profiles[i].getString('name') || '').toLowerCase()

        var granted = false
        var assignedLevel = 'view'
        if (profName.includes('admin')) {
          granted = true
          assignedLevel = 'configure'
        } else if (profName.includes('gestor')) {
          granted = true
          assignedLevel = 'edit'
        }

        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            profileId +
            '" && module_key = "' +
            moduleKey +
            '" && item_key = "' +
            itemKey +
            '"',
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', moduleKey)
          rec.set('item_key', itemKey)
          rec.set('granted', granted)
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
    console.log('[0173] permissões admin_supervisor_teams sincronizadas')
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('supervisor_team_links')
      if (col) app.delete(col)
    } catch (_) {}

    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "admin" AND item_key = "admin_supervisor_teams"',
        )
        .execute()
    }
  },
)
