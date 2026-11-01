migrate(
  (app) => {
    let permCol
    try {
      permCol = app.findCollectionByNameOrId('profile_permissions')
    } catch (_) {
      const profilesColId = app.findCollectionByNameOrId('profiles').id
      permCol = new Collection({
        name: 'profile_permissions',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        updateRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        deleteRule:
          '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "gestor")',
        fields: [
          {
            name: 'profile',
            type: 'relation',
            collectionId: profilesColId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'module_key', type: 'text', required: true },
          { name: 'item_key', type: 'text', required: true },
          { name: 'granted', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_profile_perm_unique ON profile_permissions (profile, module_key, item_key)',
          'CREATE INDEX idx_profile_perm_profile ON profile_permissions (profile)',
          'CREATE INDEX idx_profile_perm_module ON profile_permissions (module_key)',
        ],
      })
      app.save(permCol)
    }

    // Backfill: Ensure all existing profiles have full access granted in profile_permissions
    // Catalog of all granular items
    const granularCatalog = [
      // dashboard
      { module_key: 'dashboard', item_key: 'dashboard_gerencial' },
      { module_key: 'dashboard', item_key: 'painel_tickets' },
      { module_key: 'dashboard', item_key: 'meu_painel' },
      { module_key: 'dashboard', item_key: 'painel_gerencial' },

      // tickets
      { module_key: 'tickets', item_key: 'tickets_fila' },
      { module_key: 'tickets', item_key: 'tickets_scheduled' },
      { module_key: 'tickets', item_key: 'tickets_retained' },
      { module_key: 'tickets', item_key: 'tickets_novo' },
      { module_key: 'tickets', item_key: 'tickets_categorias' },
      { module_key: 'tickets', item_key: 'tickets_catalogo' },
      { module_key: 'tickets', item_key: 'tickets_aprovacoes' },

      // atendimento
      { module_key: 'atendimento', item_key: 'atendimento_omnichannel' },

      // clients
      { module_key: 'clients', item_key: 'clients_cadastro' },
      { module_key: 'clients', item_key: 'clients_contrato' },
      { module_key: 'clients', item_key: 'clients_horas' },
      { module_key: 'clients', item_key: 'clients_consumo' },
      { module_key: 'clients', item_key: 'clients_dashboard' },

      // cmdb
      { module_key: 'cmdb', item_key: 'cmdb_assets' },
      { module_key: 'cmdb', item_key: 'cmdb_items' },
      { module_key: 'cmdb', item_key: 'cmdb_import' },
      { module_key: 'cmdb', item_key: 'cmdb_types' },

      // vault
      { module_key: 'vault', item_key: 'vault_cofre' },

      // changes
      { module_key: 'changes', item_key: 'changes_dashboard' },
      { module_key: 'changes', item_key: 'changes_list' },
      { module_key: 'changes', item_key: 'changes_my' },
      { module_key: 'changes', item_key: 'changes_pending' },
      { module_key: 'changes', item_key: 'changes_calendar' },
      { module_key: 'changes', item_key: 'changes_committee' },
      { module_key: 'changes', item_key: 'changes_types' },
      { module_key: 'changes', item_key: 'changes_templates' },
      { module_key: 'changes', item_key: 'changes_reports' },
      { module_key: 'changes', item_key: 'changes_settings' },

      // problems
      { module_key: 'problems', item_key: 'problems_dashboard' },
      { module_key: 'problems', item_key: 'problems_list' },
      { module_key: 'problems', item_key: 'problems_new' },
      { module_key: 'problems', item_key: 'problems_my' },
      { module_key: 'problems', item_key: 'problems_investigation' },
      { module_key: 'problems', item_key: 'problems_effectiveness' },
      { module_key: 'problems', item_key: 'problems_pending' },
      { module_key: 'problems', item_key: 'problems_closed' },
      { module_key: 'problems', item_key: 'problems_known_errors' },
      { module_key: 'problems', item_key: 'problems_reports' },
      { module_key: 'problems', item_key: 'problems_settings' },

      // visits
      { module_key: 'visits', item_key: 'visits_agenda' },
      { module_key: 'visits', item_key: 'visits_list' },
      { module_key: 'visits', item_key: 'visits_dashboard' },
      { module_key: 'visits', item_key: 'visits_tech_dashboard' },
      { module_key: 'visits', item_key: 'visits_satisfaction' },
      { module_key: 'visits', item_key: 'visits_n2_dashboard' },
      { module_key: 'visits', item_key: 'visits_n2_calendar' },
      { module_key: 'visits', item_key: 'visits_n2_list' },
      { module_key: 'visits', item_key: 'visits_n2_new' },
      { module_key: 'visits', item_key: 'visits_n2_my' },
      { module_key: 'visits', item_key: 'visits_n2_expenses' },
      { module_key: 'visits', item_key: 'visits_n2_service_orders' },
      { module_key: 'visits', item_key: 'visits_n2_signatures' },
      { module_key: 'visits', item_key: 'visits_n2_checklists' },
      { module_key: 'visits', item_key: 'visits_n2_recurring' },
      { module_key: 'visits', item_key: 'visits_n2_availability' },
      { module_key: 'visits', item_key: 'visits_n2_km_rates' },
      { module_key: 'visits', item_key: 'visits_n2_reports' },

      // reports (cada relatório individual)
      { module_key: 'reports', item_key: 'rep_gerenciais' },
      { module_key: 'reports', item_key: 'rep_implemented_features' },
      { module_key: 'reports', item_key: 'rep_alert_audit' },
      { module_key: 'reports', item_key: 'rep_unit' },
      { module_key: 'reports', item_key: 'rep_sla_dashboard' },
      { module_key: 'reports', item_key: 'rep_sla_goals' },
      { module_key: 'reports', item_key: 'rep_recurrent_activities' },
      { module_key: 'reports', item_key: 'rep_scheduled_reports' },
      { module_key: 'reports', item_key: 'rep_monthly_client' },
      { module_key: 'reports', item_key: 'rep_client_extraction' },

      // knowledge
      { module_key: 'knowledge', item_key: 'knowledge_base' },

      // settings
      { module_key: 'settings', item_key: 'settings_email' },
      { module_key: 'settings', item_key: 'settings_sla' },
      { module_key: 'settings', item_key: 'settings_automations' },
      { module_key: 'settings', item_key: 'settings_queues' },
      { module_key: 'settings', item_key: 'settings_blocking' },
      { module_key: 'settings', item_key: 'settings_notifications' },
      { module_key: 'settings', item_key: 'settings_design' },
      { module_key: 'settings', item_key: 'settings_general' },
      { module_key: 'settings', item_key: 'settings_portal' },
      { module_key: 'settings', item_key: 'settings_client_notif' },
      { module_key: 'settings', item_key: 'settings_security' },

      // admin
      { module_key: 'admin', item_key: 'admin_operators' },
      { module_key: 'admin', item_key: 'admin_profiles' },
    ]

    try {
      const allProfiles = app.findRecordsByFilter('profiles', '', '', 0, 0)
      const permCollection = app.findCollectionByNameOrId('profile_permissions')

      allProfiles.forEach((prof) => {
        granularCatalog.forEach((item) => {
          try {
            app.findFirstRecordByFilter(
              'profile_permissions',
              `profile = "${prof.id}" && module_key = "${item.module_key}" && item_key = "${item.item_key}"`,
            )
          } catch (_) {
            const rec = new Record(permCollection)
            rec.set('profile', prof.id)
            rec.set('module_key', item.module_key)
            rec.set('item_key', item.item_key)
            rec.set('granted', true) // Todos os perfis existentes nascem com tudo concedido
            app.save(rec)
          }
        })
      })
    } catch (e) {
      console.log('Error backfilling profile_permissions:', e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('profile_permissions')
      app.delete(col)
    } catch (_) {}
  },
)
