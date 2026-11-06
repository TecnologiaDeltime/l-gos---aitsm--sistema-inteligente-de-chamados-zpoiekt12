/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0134: Módulo de Projetos (Cascata, Ágil/Scrum e Lean)
 *
 * Cria coleções:
 * 1. projects: Cadastro de projetos, cliente (opcional), gestor, metodologia, status, datas, equipe (JSON)
 * 2. project_sprints: Sprints do Ágil/Scrum vinculadas ao projeto
 * 3. project_tasks: Atividades/tarefas delegadas com fase cascata, sprint, etapa lean, responsável, chamado vinculado, horas
 * 4. project_work_logs: Lançamentos de ações e horas trabalhadas (HH:MM:SS / duration_seconds)
 *
 * Registra permissões do módulo 'projects' (items: 'projects_list', 'projects_create', 'projects_manage')
 * em profile_permissions com concessão padrão para todos os perfis existentes.
 */
migrate(
  (app) => {
    // 1. Coleção 'projects'
    var usersColId = '_pb_users_auth_'
    var companiesColId = app.findCollectionByNameOrId('companies').id

    if (!app.hasTable('projects')) {
      var projects = new Collection({
        name: 'projects',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          {
            name: 'company',
            type: 'relation',
            collectionId: companiesColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'manager',
            type: 'relation',
            collectionId: usersColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'methodology',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['waterfall', 'scrum', 'lean'],
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['planning', 'active', 'completed', 'suspended', 'cancelled'],
          },
          { name: 'start_date', type: 'date' },
          { name: 'target_date', type: 'date' },
          { name: 'completed_at', type: 'date' },
          // Equipe do projeto em formato JSON: array de { user_id, role, name, email }
          // roles: 'manager' | 'assignee' | 'collaborator'
          { name: 'team_members', type: 'json' },
          // Configurações específicas da metodologia (colunas Lean, WIP limits, etc.)
          { name: 'methodology_settings', type: 'json' },
          // Total de segundos acumulados em horas trabalhadas no projeto
          { name: 'total_worked_seconds', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_projects_status ON projects (status)',
          'CREATE INDEX idx_projects_methodology ON projects (methodology)',
          'CREATE INDEX idx_projects_company ON projects (company)',
          'CREATE INDEX idx_projects_manager ON projects (manager)',
        ],
      })
      app.save(projects)
    }

    var projectsColId = app.findCollectionByNameOrId('projects').id

    // 2. Coleção 'project_sprints' (Ágil / Scrum)
    if (!app.hasTable('project_sprints')) {
      var sprints = new Collection({
        name: 'project_sprints',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'project',
            type: 'relation',
            collectionId: projectsColId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'goal', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['planned', 'active', 'completed', 'cancelled'],
          },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date' },
          // Registro textual de cerimônias (daily, review, retro)
          { name: 'daily_notes', type: 'text' },
          { name: 'review_notes', type: 'text' },
          { name: 'retrospective_notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sprints_project ON project_sprints (project)',
          'CREATE INDEX idx_sprints_status ON project_sprints (status)',
        ],
      })
      app.save(sprints)
    }

    var sprintsColId = app.findCollectionByNameOrId('project_sprints').id
    var ticketsColId = app.findCollectionByNameOrId('tickets').id

    // 3. Coleção 'project_tasks' (Atividades/tarefas de projetos)
    if (!app.hasTable('project_tasks')) {
      var tasks = new Collection({
        name: 'project_tasks',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'project',
            type: 'relation',
            collectionId: projectsColId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text' },
          // Responsável delegado (operador)
          {
            name: 'assigned_to',
            type: 'relation',
            collectionId: usersColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          // Status geral
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'],
          },
          // Prioridade
          {
            name: 'priority',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['low', 'medium', 'high', 'critical'],
          },
          // Fases Cascata: 'initiation' | 'planning' | 'execution' | 'monitoring' | 'closure'
          {
            name: 'waterfall_phase',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['initiation', 'planning', 'execution', 'monitoring', 'closure'],
          },
          { name: 'is_milestone', type: 'bool' },
          // Sprint (Scrum)
          {
            name: 'sprint',
            type: 'relation',
            collectionId: sprintsColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'story_points', type: 'number', onlyInt: true },
          // Etapa Lean (customizada ou padrão, ex: 'todo' | 'development' | 'testing' | 'deployed')
          { name: 'lean_stage', type: 'text' },
          // Datas
          { name: 'due_date', type: 'date' },
          { name: 'completed_at', type: 'date' },
          // Vínculo com Chamado gerado
          {
            name: 'ticket',
            type: 'relation',
            collectionId: ticketsColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          // Horas totais na atividade em segundos
          { name: 'worked_seconds', type: 'number', onlyInt: true },
          { name: 'order', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_tasks_project ON project_tasks (project)',
          'CREATE INDEX idx_tasks_assigned ON project_tasks (assigned_to)',
          'CREATE INDEX idx_tasks_status ON project_tasks (status)',
          'CREATE INDEX idx_tasks_waterfall ON project_tasks (waterfall_phase)',
          'CREATE INDEX idx_tasks_sprint ON project_tasks (sprint)',
          'CREATE INDEX idx_tasks_ticket ON project_tasks (ticket)',
        ],
      })
      app.save(tasks)
    }

    var tasksColId = app.findCollectionByNameOrId('project_tasks').id

    // 4. Coleção 'project_work_logs' (Lançamento de ações e horas dentro do projeto)
    if (!app.hasTable('project_work_logs')) {
      var workLogs = new Collection({
        name: 'project_work_logs',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'project',
            type: 'relation',
            collectionId: projectsColId,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'task',
            type: 'relation',
            collectionId: tasksColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'user',
            type: 'relation',
            collectionId: usersColId,
            required: true,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'description', type: 'text', required: true },
          { name: 'duration_seconds', type: 'number', onlyInt: true, required: true },
          { name: 'logged_at', type: 'date' },
          {
            name: 'ticket',
            type: 'relation',
            collectionId: ticketsColId,
            required: false,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_worklogs_project ON project_work_logs (project)',
          'CREATE INDEX idx_worklogs_task ON project_work_logs (task)',
          'CREATE INDEX idx_worklogs_user ON project_work_logs (user)',
        ],
      })
      app.save(workLogs)
    }

    // 5. Backfill de permissões no perfil de acesso
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      var permCol = app.findCollectionByNameOrId('profile_permissions')
      var profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)

      var items = [
        { module_key: 'projects', item_key: 'projects_list', level: 'view' },
        { module_key: 'projects', item_key: 'projects_create', level: 'edit' },
        { module_key: 'projects', item_key: 'projects_manage', level: 'configure' },
      ]

      for (var i = 0; i < profiles.length; i++) {
        var prof = profiles[i]
        var profileId = prof.id
        var isAdm = prof.getBool('is_system') || prof.getString('name') === 'Administrador'

        for (var j = 0; j < items.length; j++) {
          var it = items[j]
          var existing = app.findRecordsByFilter(
            'profile_permissions',
            'profile = "' +
              profileId +
              '" && module_key = "' +
              it.module_key +
              '" && item_key = "' +
              it.item_key +
              '"',
            '',
            1,
            0,
          )

          if (existing.length === 0) {
            var rec = new Record(permCol)
            rec.set('profile', profileId)
            rec.set('module_key', it.module_key)
            rec.set('item_key', it.item_key)
            rec.set('granted', true)
            rec.set('level', isAdm ? 'configure' : it.level)
            app.save(rec)
          }
        }
      }
    }
  },
  (app) => {
    // Reversão
    if (app.hasTable('project_work_logs')) {
      app.delete(app.findCollectionByNameOrId('project_work_logs'))
    }
    if (app.hasTable('project_tasks')) {
      app.delete(app.findCollectionByNameOrId('project_tasks'))
    }
    if (app.hasTable('project_sprints')) {
      app.delete(app.findCollectionByNameOrId('project_sprints'))
    }
    if (app.hasTable('projects')) {
      app.delete(app.findCollectionByNameOrId('projects'))
    }
    if (app.hasTable('profile_permissions')) {
      app.db().newQuery('DELETE FROM profile_permissions WHERE module_key = "projects"').execute()
    }
  },
)
