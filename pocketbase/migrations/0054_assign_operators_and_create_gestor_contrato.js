migrate(
  (app) => {
    // 1. Vincular operadores existentes aos perfis (idempotente)
    // Carlos Silva (tecnico@deltime.com.br, id l4pfwuzuw9f7yit) -> Técnico N2 (id fge9jwo1j6gw164)
    // Luiz Barros (luiz@deltime.com.br, id hbn52txbztxvbdg) -> Técnico N1 (id 9qv4abxragbo2te)

    // Resolve profile IDs dynamically by name or fallback to known IDs
    let tecN2ProfileId = 'fge9jwo1j6gw164'
    let tecN1ProfileId = '9qv4abxragbo2te'

    try {
      const n2 = app.findFirstRecordByData('profiles', 'name', 'Técnico N2')
      if (n2 && n2.id) tecN2ProfileId = n2.id
    } catch (_) {}

    try {
      const n1 = app.findFirstRecordByData('profiles', 'name', 'Técnico N1')
      if (n1 && n1.id) tecN1ProfileId = n1.id
    } catch (_) {}

    // Update Carlos Silva
    try {
      let carlos = null
      try {
        carlos = app.findFirstRecordByData('users', 'id', 'l4pfwuzuw9f7yit')
      } catch (_) {
        carlos = app.findFirstRecordByData('users', 'email', 'tecnico@deltime.com.br')
      }

      if (
        carlos &&
        (!carlos.getString('profile_id') || carlos.getString('profile_id') !== tecN2ProfileId)
      ) {
        carlos.set('profile_id', tecN2ProfileId)
        app.save(carlos)
      }
    } catch (_) {}

    // Update Luiz Barros
    try {
      let luiz = null
      try {
        luiz = app.findFirstRecordByData('users', 'id', 'hbn52txbztxvbdg')
      } catch (_) {
        luiz = app.findFirstRecordByData('users', 'email', 'luiz@deltime.com.br')
      }

      if (
        luiz &&
        (!luiz.getString('profile_id') || luiz.getString('profile_id') !== tecN1ProfileId)
      ) {
        luiz.set('profile_id', tecN1ProfileId)
        app.save(luiz)
      }
    } catch (_) {}

    // 2. Criar ou atualizar perfil "Gestor de Contrato" (idempotente)
    const gestorContratoPermissions = {
      dashboard: { read: true, write: false, hidden: false },
      tickets: { read: true, write: false, hidden: false },
      tickets_children: { read: true, write: false, hidden: false },
      cmdb: { read: true, write: false, hidden: false },
      changes: { read: false, write: false, hidden: true },
      reports: { read: true, write: true, hidden: false },
      settings: { read: false, write: false, hidden: true },
      clients: { read: true, write: true, hidden: false },
      operators: { read: false, write: false, hidden: true },
      profiles: { read: false, write: false, hidden: true },
      sla_dashboard: { read: true, write: false, hidden: false },
      notifications: { read: true, write: false, hidden: false },
      time_tracking: { read: true, write: false, hidden: false },
    }

    const profilesCollection = app.findCollectionByNameOrId('profiles')

    try {
      const existing = app.findFirstRecordByData('profiles', 'name', 'Gestor de Contrato')
      existing.set(
        'description',
        'Perfil para gestores de contrato. Pode visualizar chamados, gerenciar clientes e gerar relatórios de consumo e desempenho.',
      )
      existing.set('is_system', false)
      existing.set('permissions', gestorContratoPermissions)
      app.save(existing)
    } catch (_) {
      const rec = new Record(profilesCollection)
      rec.set('name', 'Gestor de Contrato')
      rec.set(
        'description',
        'Perfil para gestores de contrato. Pode visualizar chamados, gerenciar clientes e gerar relatórios de consumo e desempenho.',
      )
      rec.set('is_system', false)
      rec.set('permissions', gestorContratoPermissions)
      app.save(rec)
    }
  },
  (app) => {
    // Revert logic
    try {
      const rec = app.findFirstRecordByData('profiles', 'name', 'Gestor de Contrato')
      if (rec && !rec.getBool('is_system')) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
