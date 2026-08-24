migrate(
  (app) => {
    const profilesCollection = app.findCollectionByNameOrId('profiles')

    // 1. Qualidade
    const qualidadePermissions = {
      dashboard: { read: true, write: false, hidden: false },
      tickets: { read: true, write: false, hidden: false },
      tickets_children: { read: true, write: false, hidden: false },
      cmdb: { read: false, write: false, hidden: true },
      changes: { read: false, write: false, hidden: true },
      reports: { read: true, write: false, hidden: false },
      settings: { read: false, write: false, hidden: true },
      clients: { read: false, write: false, hidden: true },
      operators: { read: false, write: false, hidden: true },
      profiles: { read: false, write: false, hidden: true },
      sla_dashboard: { read: true, write: false, hidden: false },
      notifications: { read: true, write: false, hidden: false },
      time_tracking: { read: false, write: false, hidden: true },
    }

    // 2. Help Desk
    const helpDeskPermissions = {
      dashboard: { read: true, write: false, hidden: false },
      tickets: { read: true, write: true, hidden: false },
      tickets_children: { read: true, write: true, hidden: false },
      cmdb: { read: true, write: false, hidden: false },
      changes: { read: false, write: false, hidden: true },
      reports: { read: true, write: false, hidden: false },
      settings: { read: false, write: false, hidden: true },
      clients: { read: false, write: false, hidden: true },
      operators: { read: false, write: false, hidden: true },
      profiles: { read: false, write: false, hidden: true },
      sla_dashboard: { read: true, write: false, hidden: false },
      notifications: { read: true, write: false, hidden: false },
      time_tracking: { read: true, write: true, hidden: false },
    }

    // 3. Campo
    const campoPermissions = {
      dashboard: { read: true, write: false, hidden: false },
      tickets: { read: true, write: true, hidden: false },
      tickets_children: { read: true, write: true, hidden: false },
      cmdb: { read: true, write: false, hidden: false },
      changes: { read: false, write: false, hidden: true },
      reports: { read: false, write: false, hidden: true },
      settings: { read: false, write: false, hidden: true },
      clients: { read: false, write: false, hidden: true },
      operators: { read: false, write: false, hidden: true },
      profiles: { read: false, write: false, hidden: true },
      sla_dashboard: { read: false, write: false, hidden: true },
      notifications: { read: true, write: false, hidden: false },
      time_tracking: { read: true, write: true, hidden: false },
    }

    const targetProfiles = [
      {
        name: 'Qualidade',
        description:
          'Perfil focado em qualidade e auditoria. Pode visualizar tickets, relatórios e SLA para avaliar a qualidade do atendimento, mas não realiza alterações.',
        is_system: false,
        permissions: qualidadePermissions,
      },
      {
        name: 'Help Desk',
        description:
          'Perfil para operadores de primeiro nível (N1). Atendimento completo de tickets, consulta ao CMDB e apontamento de horas, sem acesso a configurações administrativas.',
        is_system: false,
        permissions: helpDeskPermissions,
      },
      {
        name: 'Campo',
        description:
          'Perfil para técnicos de campo. Focado em atender tickets e lançar horas em deslocamento, com acesso mínimo ao sistema.',
        is_system: false,
        permissions: campoPermissions,
      },
    ]

    targetProfiles.forEach((p) => {
      try {
        const existing = app.findFirstRecordByData('profiles', 'name', p.name)
        // If it exists and is not protected system profile, update with the specified matrix/description
        if (!existing.getBool('is_system')) {
          existing.set('description', p.description)
          existing.set('is_system', false)
          existing.set('permissions', p.permissions)
          app.save(existing)
        }
      } catch (_) {
        // Record does not exist, insert new
        const rec = new Record(profilesCollection)
        rec.set('name', p.name)
        rec.set('description', p.description)
        rec.set('is_system', p.is_system)
        rec.set('permissions', p.permissions)
        app.save(rec)
      }
    })
  },
  (app) => {
    // Revert logic: delete Campo and Help Desk if created, Qualidade might have existed before
    const toDelete = ['Help Desk', 'Campo']
    toDelete.forEach((name) => {
      try {
        const record = app.findFirstRecordByData('profiles', 'name', name)
        if (!record.getBool('is_system')) {
          app.delete(record)
        }
      } catch (_) {}
    })
  },
)
