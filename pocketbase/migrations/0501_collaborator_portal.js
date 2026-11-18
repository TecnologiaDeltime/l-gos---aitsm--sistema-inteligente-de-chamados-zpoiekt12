/// <reference path="../pb_data/types.d.ts" />

// ============================================================================
// 0501 — Portal do Colaborador
// ----------------------------------------------------------------------------
// Cria:
// 1. portal_collaborators — acessos criados pelo admin (nome, e-mail, empresa,
//    senha própria do portal, ativo, session_token de login do portal).
// 2. collaborator_surveys — pesquisa de satisfação nota 1–5 + comentário,
//    por chamado e por colaborador.
// 3. Setting global de obrigatoriedade em system_settings
//    (key = 'collaborator_portal', campo collaborator_survey_required),
//    usada pelo bloqueio SERVER-SIDE na criação de chamados.
// 4. Item de permissão no catálogo (regra permanente da casa): clients /
//    clients_collaborator_portal, concedido por padrão aos perfis existentes.
// ============================================================================

migrate(
  (app) => {
    // ---------------------------------------------------------------- 1
    let collabCol = null
    try {
      collabCol = app.findCollectionByNameOrId('portal_collaborators')
    } catch (_) {
      collabCol = null
    }
    if (!collabCol) {
      const companiesColId = app.findCollectionByNameOrId('companies').id
      collabCol = new Collection({
        name: 'portal_collaborators',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")',
        viewRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")',
        createRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        updateRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'email', type: 'text', required: true },
          {
            name: 'company',
            type: 'relation',
            collectionId: companiesColId,
            maxSelect: 1,
            required: true,
          },
          { name: 'password', type: 'text' },
          { name: 'session_token', type: 'text' },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_portal_collaborators_email ON portal_collaborators (email)',
          'CREATE INDEX idx_portal_collaborators_company ON portal_collaborators (company)',
        ],
      })
      app.save(collabCol)
    }

    // ---------------------------------------------------------------- 2
    let surveyCol = null
    try {
      surveyCol = app.findCollectionByNameOrId('collaborator_surveys')
    } catch (_) {
      surveyCol = null
    }
    if (!surveyCol) {
      const ticketsColId = app.findCollectionByNameOrId('tickets').id
      const collaboratorsColId = app.findCollectionByNameOrId('portal_collaborators').id
      surveyCol = new Collection({
        name: 'collaborator_surveys',
        type: 'base',
        listRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")',
        viewRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor" || @request.auth.role = "operador" || @request.auth.role = "tecnico")',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'ticket',
            type: 'relation',
            collectionId: ticketsColId,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'collaborator',
            type: 'relation',
            collectionId: collaboratorsColId,
            maxSelect: 1,
            required: true,
          },
          { name: 'rating', type: 'number' },
          { name: 'comment', type: 'text' },
          { name: 'responded_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_collab_survey_unique ON collaborator_surveys (ticket, collaborator)',
          'CREATE INDEX idx_collab_survey_collaborator ON collaborator_surveys (collaborator)',
        ],
      })
      app.save(surveyCol)
    }

    // ---------------------------------------------------------------- 3
    const settingsCol = app.findCollectionByNameOrId('system_settings')
    if (!settingsCol.fields.getByName('collaborator_survey_required')) {
      settingsCol.fields.add(new BoolField({ name: 'collaborator_survey_required' }))
      app.save(settingsCol)
    }
    try {
      app.findFirstRecordByFilter('system_settings', "key = 'collaborator_portal'")
    } catch (_) {
      const rec = new Record(settingsCol)
      rec.set('key', 'collaborator_portal')
      rec.set('collaborator_survey_required', false)
      app.save(rec)
    }

    // ---------------------------------------------------------------- 4
    // Catálogo de permissões: módulo clients, item clients_collaborator_portal
    try {
      const profiles = app.findRecordsByFilter('profiles', '', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')
      profiles.forEach((prof) => {
        try {
          app.findFirstRecordByFilter(
            'profile_permissions',
            'profile = "' +
              prof.id +
              '" && module_key = "clients" && item_key = "clients_collaborator_portal"',
          )
        } catch (_) {
          const rec = new Record(permCol)
          rec.set('profile', prof.id)
          rec.set('module_key', 'clients')
          rec.set('item_key', 'clients_collaborator_portal')
          rec.set('granted', true)
          app.save(rec)
        }
      })
    } catch (e) {
      console.log('0501: backfill de permissões falhou: ' + e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('collaborator_surveys')
      app.delete(col)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('portal_collaborators')
      app.delete(col)
    } catch (_) {}
    try {
      const settingsCol = app.findCollectionByNameOrId('system_settings')
      const field = settingsCol.fields.getByName('collaborator_survey_required')
      if (field) {
        settingsCol.fields.remove(field)
        app.save(settingsCol)
      }
    } catch (_) {}
    try {
      app.deleteRecordsByFilter(
        'profile_permissions',
        'module_key = "clients" && item_key = "clients_collaborator_portal"',
      )
    } catch (_) {}
  },
)
