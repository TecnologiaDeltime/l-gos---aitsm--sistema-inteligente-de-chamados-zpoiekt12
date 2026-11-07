/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0135: Notificações de Prazo de Projetos
 *
 * 1. Nova permissão no catálogo: module_key='projects', item_key='projects_deadlines_notifications'
 *    (níveis view/edit/configure), concedida por padrão a todos os perfis existentes.
 * 2. Coleção 'project_deadline_settings' (registro único) com:
 *    - enabled, check_interval_minutes, advance_days
 *    - notify_manager, notify_gestors, notify_task_assignee
 *    - last_check_epoch_min (controle da janela de execução do cron)
 * 3. Campo JSON 'deadline_alerts' em projects e project_tasks (anti-duplicidade:
 *    { proximo, dia, vencido, deadline_ref } — resetado se o prazo mudar).
 */
migrate(
  (app) => {
    // ---------- 1. Permissão no catálogo ----------
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var permCol = app.findCollectionByNameOrId('profile_permissions')
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)

      var item = { module_key: 'projects', item_key: 'projects_deadlines_notifications' }

      for (var i = 0; i < profiles.length; i++) {
        var prof = profiles[i]
        var isAdm = prof.getBool('is_system') || prof.getString('name') === 'Administrador'
        var existing = app.findRecordsByFilter(
          'profile_permissions',
          'profile = "' +
            prof.id +
            '" && module_key = "' +
            item.module_key +
            '" && item_key = "' +
            item.item_key +
            '"',
          '',
          1,
          0,
        )
        if (existing.length === 0) {
          var rec = new Record(permCol)
          rec.set('profile', prof.id)
          rec.set('module_key', item.module_key)
          rec.set('item_key', item.item_key)
          rec.set('granted', true)
          rec.set('level', 'configure')
          app.save(rec)
        }
      }
    }

    // ---------- 2. Coleção de configurações ----------
    if (!app.hasTable('project_deadline_settings')) {
      var settingsCol = new Collection({
        name: 'project_deadline_settings',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: null,
        fields: [
          { name: 'enabled', type: 'bool' },
          { name: 'check_interval_minutes', type: 'number', onlyInt: true },
          { name: 'advance_days', type: 'number', onlyInt: true },
          { name: 'notify_manager', type: 'bool' },
          { name: 'notify_gestors', type: 'bool' },
          { name: 'notify_task_assignee', type: 'bool' },
          { name: 'last_check_epoch_min', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(settingsCol)

      // Registro único padrão
      var def = new Record(app.findCollectionByNameOrId('project_deadline_settings'))
      def.set('enabled', true)
      def.set('check_interval_minutes', 60)
      def.set('advance_days', 3)
      def.set('notify_manager', true)
      def.set('notify_gestors', true)
      def.set('notify_task_assignee', true)
      def.set('last_check_epoch_min', 0)
      app.save(def)
    }

    // ---------- 3. deadline_alerts (anti-duplicidade) ----------
    var projectsCol = app.findCollectionByNameOrId('projects')
    if (!projectsCol.fields.getByName('deadline_alerts')) {
      projectsCol.fields.add(new JSONField({ name: 'deadline_alerts', maxSize: 2000000 }))
      app.save(projectsCol)
    }
    var tasksCol = app.findCollectionByNameOrId('project_tasks')
    if (!tasksCol.fields.getByName('deadline_alerts')) {
      tasksCol.fields.add(new JSONField({ name: 'deadline_alerts', maxSize: 2000000 }))
      app.save(tasksCol)
    }
  },
  (app) => {
    // Reversão
    if (app.hasTable('project_deadline_settings')) {
      app.delete(app.findCollectionByNameOrId('project_deadline_settings'))
    }
    if (app.hasTable('projects')) {
      var p = app.findCollectionByNameOrId('projects')
      try {
        p.fields.removeByName('deadline_alerts')
        app.save(p)
      } catch (_) {}
    }
    if (app.hasTable('project_tasks')) {
      var t = app.findCollectionByNameOrId('project_tasks')
      try {
        t.fields.removeByName('deadline_alerts')
        app.save(t)
      } catch (_) {}
    }
    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "projects" AND item_key = "projects_deadlines_notifications"',
        )
        .execute()
    }
  },
)
