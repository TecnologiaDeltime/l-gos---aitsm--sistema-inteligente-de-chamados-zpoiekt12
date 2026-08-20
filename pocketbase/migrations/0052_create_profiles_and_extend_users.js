migrate(
  (app) => {
    // 1. Create profiles collection
    let profilesCol
    try {
      profilesCol = app.findCollectionByNameOrId('profiles')
    } catch (_) {
      profilesCol = new Collection({
        name: 'profiles',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        updateRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule: '@request.auth.id != "" && @request.auth.role = "admin"',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'is_system', type: 'bool' },
          { name: 'permissions', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_profiles_name ON profiles (name)'],
      })
      app.save(profilesCol)
    }

    // 2. Add new operator fields to users collection
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const profilesColId = app.findCollectionByNameOrId('profiles').id

    if (!users.fields.getByName('first_name')) {
      users.fields.add(new TextField({ name: 'first_name' }))
    }
    if (!users.fields.getByName('last_name')) {
      users.fields.add(new TextField({ name: 'last_name' }))
    }
    if (!users.fields.getByName('team')) {
      users.fields.add(new TextField({ name: 'team' }))
    }
    if (!users.fields.getByName('type')) {
      users.fields.add(
        new SelectField({
          name: 'type',
          values: ['Interno', 'Externo'],
          maxSelect: 1,
        }),
      )
    }
    if (!users.fields.getByName('extension')) {
      users.fields.add(new TextField({ name: 'extension' }))
    }
    if (!users.fields.getByName('mobile')) {
      users.fields.add(new TextField({ name: 'mobile' }))
    }
    if (!users.fields.getByName('profile_id')) {
      users.fields.add(
        new RelationField({
          name: 'profile_id',
          collectionId: profilesColId,
          maxSelect: 1,
        }),
      )
    }

    app.save(users)

    // 3. Seed default profiles: Administrador, Supervisor/Gestor, Técnico N1, Técnico N2, Qualidade, Visualizador
    const defaultModules = [
      'dashboard',
      'tickets',
      'tickets_children',
      'cmdb',
      'changes',
      'reports',
      'settings',
      'clients',
      'operators',
      'profiles',
      'sla_dashboard',
      'notifications',
      'time_tracking',
    ]

    const fullPermissions = {}
    defaultModules.forEach((m) => {
      fullPermissions[m] = {
        read: true,
        write: true,
        hidden: false,
      }
    })

    const supervisorPermissions = {}
    defaultModules.forEach((m) => {
      supervisorPermissions[m] = {
        read: true,
        write: m !== 'profiles', // supervisor can manage almost everything except profiles
        hidden: false,
      }
    })

    const techPermissions = {
      dashboard: { read: true, write: true, hidden: false },
      tickets: { read: true, write: true, hidden: false },
      tickets_children: { read: true, write: true, hidden: false },
      cmdb: { read: true, write: false, hidden: false },
      changes: { read: true, write: true, hidden: false },
      reports: { read: true, write: false, hidden: false },
      settings: { read: false, write: false, hidden: true },
      clients: { read: true, write: false, hidden: false },
      operators: { read: false, write: false, hidden: true },
      profiles: { read: false, write: false, hidden: true },
      sla_dashboard: { read: true, write: false, hidden: false },
      notifications: { read: true, write: true, hidden: false },
      time_tracking: { read: true, write: true, hidden: false },
    }

    const qualityPermissions = {
      dashboard: { read: true, write: false, hidden: false },
      tickets: { read: true, write: true, hidden: false },
      tickets_children: { read: true, write: false, hidden: false },
      cmdb: { read: true, write: false, hidden: false },
      changes: { read: true, write: false, hidden: false },
      reports: { read: true, write: true, hidden: false },
      settings: { read: false, write: false, hidden: true },
      clients: { read: true, write: false, hidden: false },
      operators: { read: false, write: false, hidden: true },
      profiles: { read: false, write: false, hidden: true },
      sla_dashboard: { read: true, write: true, hidden: false },
      notifications: { read: true, write: true, hidden: false },
      time_tracking: { read: true, write: false, hidden: false },
    }

    const profilesData = [
      {
        name: 'Administrador',
        description: 'Acesso total a todos os módulos e recursos administrativos do sistema.',
        is_system: true,
        permissions: fullPermissions,
      },
      {
        name: 'Supervisor',
        description: 'Gestão de tickets, equipe, clientes, relatórios e dashboards operacionais.',
        is_system: false,
        permissions: supervisorPermissions,
      },
      {
        name: 'Técnico N1',
        description:
          'Atendimento operacional de chamados N1, apontamento de horas e consulta a clientes/ativos.',
        is_system: false,
        permissions: techPermissions,
      },
      {
        name: 'Técnico N2',
        description: 'Atendimento avançado de chamados, mudanças, CMDB e visitas técnicas.',
        is_system: false,
        permissions: techPermissions,
      },
      {
        name: 'Qualidade',
        description:
          'Acompanhamento de SLA, auditoria de chamados, pesquisas e relatórios de satisfação.',
        is_system: false,
        permissions: qualityPermissions,
      },
    ]

    const profilesCollection = app.findCollectionByNameOrId('profiles')
    let adminProfileId = ''

    profilesData.forEach((p) => {
      try {
        const existing = app.findFirstRecordByData('profiles', 'name', p.name)
        if (p.name === 'Administrador') {
          adminProfileId = existing.id
        }
      } catch (_) {
        const rec = new Record(profilesCollection)
        rec.set('name', p.name)
        rec.set('description', p.description)
        rec.set('is_system', p.is_system)
        rec.set('permissions', p.permissions)
        app.save(rec)
        if (p.name === 'Administrador') {
          adminProfileId = rec.id
        }
      }
    })

    // Link existing admin users to Administrador profile if not linked
    try {
      const adminUsers = app.findRecordsByFilter('users', 'role = "admin"', '', 0, 0)
      if (adminProfileId && adminUsers && adminUsers.length > 0) {
        adminUsers.forEach((u) => {
          if (!u.getString('profile_id')) {
            u.set('profile_id', adminProfileId)
            app.save(u)
          }
        })
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('profiles')
      app.delete(col)
    } catch (_) {}
  },
)
