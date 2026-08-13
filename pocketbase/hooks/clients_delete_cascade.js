routerAdd(
  'DELETE',
  '/backend/v1/clients/{id}/delete-cascade',
  (e) => {
    const id = e.request.pathValue('id')
    if (!id) return e.badRequestError('ID do cliente é obrigatório')

    let company
    try {
      company = $app.findRecordById('companies', id)
    } catch (err) {
      return e.notFoundError('Cliente não encontrado')
    }

    const deleteByFilter = (collectionName, filter) => {
      try {
        const records = $app.findRecordsByFilter(collectionName, filter, '', 10000, 0)
        for (const r of records) {
          try {
            $app.delete(r)
          } catch (_) {}
        }
      } catch (_) {}
    }

    // Phase 1: Tickets and their dependents
    let tickets = []
    try {
      tickets = $app.findRecordsByFilter('tickets', 'company = "' + id + '"', '', 10000, 0)
    } catch (_) {}

    if (tickets.length > 0) {
      const ticketIds = tickets
        .map(function (t) {
          return '"' + t.id + '"'
        })
        .join(',')
      const tFilter = 'ticket IN (' + ticketIds + ')'

      // Technical visits and their children
      let visits = []
      try {
        visits = $app.findRecordsByFilter('technical_visits', tFilter, '', 10000, 0)
      } catch (_) {}

      if (visits.length > 0) {
        const visitIds = visits
          .map(function (v) {
            return '"' + v.id + '"'
          })
          .join(',')
        const vFilter = 'visit IN (' + visitIds + ')'

        let checklists = []
        try {
          checklists = $app.findRecordsByFilter('visit_checklists', vFilter, '', 10000, 0)
        } catch (_) {}
        if (checklists.length > 0) {
          const clIds = checklists
            .map(function (c) {
              return '"' + c.id + '"'
            })
            .join(',')
          deleteByFilter('visit_checklist_items', 'checklist IN (' + clIds + ')')
        }
        deleteByFilter('visit_checklist_items', vFilter)
        for (const cl of checklists) {
          try {
            $app.delete(cl)
          } catch (_) {}
        }

        deleteByFilter('service_orders', vFilter)
        deleteByFilter('client_signatures', vFilter)
        deleteByFilter('visit_time_entries', vFilter)
        deleteByFilter('travel_entries', vFilter)
        deleteByFilter('expenses', vFilter)
        deleteByFilter('reimbursements', vFilter)
      }

      // Workflow executions and their logs
      let wfExecs = []
      try {
        wfExecs = $app.findRecordsByFilter('workflow_executions', tFilter, '', 10000, 0)
      } catch (_) {}
      if (wfExecs.length > 0) {
        const execIds = wfExecs
          .map(function (ex) {
            return '"' + ex.id + '"'
          })
          .join(',')
        deleteByFilter('workflow_execution_logs', 'execution IN (' + execIds + ')')
      }
      for (const ex of wfExecs) {
        try {
          $app.delete(ex)
        } catch (_) {}
      }

      // Ticket child records
      deleteByFilter('ticket_interactions', tFilter)
      deleteByFilter('ticket_attachments', tFilter)
      deleteByFilter('ticket_history', tFilter)
      deleteByFilter('sla_pauses', tFilter)
      deleteByFilter('time_entries', tFilter)
      deleteByFilter('approvals', tFilter)
      deleteByFilter('notifications', tFilter)
      deleteByFilter('satisfaction_surveys', tFilter)
      deleteByFilter('workflow_tasks', tFilter)
      deleteByFilter('service_orders', tFilter)
      deleteByFilter('client_signatures', tFilter)
      deleteByFilter('visit_checklists', tFilter)

      for (const v of visits) {
        try {
          $app.delete(v)
        } catch (_) {}
      }
      for (const t of tickets) {
        try {
          $app.delete(t)
        } catch (_) {}
      }
    }

    // Phase 2: Problems and their children
    let problems = []
    try {
      problems = $app.findRecordsByFilter('problems', 'company = "' + id + '"', '', 10000, 0)
    } catch (_) {}
    if (problems.length === 0) {
      try {
        problems = $app.findRecordsByFilter('problems', 'client = "' + id + '"', '', 10000, 0)
      } catch (_) {}
    }
    if (problems.length > 0) {
      const pIds = problems
        .map(function (p) {
          return '"' + p.id + '"'
        })
        .join(',')
      const pFilter = 'problem IN (' + pIds + ')'
      deleteByFilter('problem_incidents', pFilter)
      deleteByFilter('problem_hypotheses', pFilter)
      deleteByFilter('problem_workarounds', pFilter)
      deleteByFilter('problem_evaluations', pFilter)
      deleteByFilter('problem_definitive_solutions', pFilter)
      deleteByFilter('problem_extensions', pFilter)
      deleteByFilter('known_errors', pFilter)
      deleteByFilter('problem_audit_logs', pFilter)
      deleteByFilter('problem_timeline', pFilter)
    }
    for (const p of problems) {
      try {
        $app.delete(p)
      } catch (_) {}
    }

    // Phase 3: Changes and their children
    let changes = []
    try {
      changes = $app.findRecordsByFilter('changes', 'company = "' + id + '"', '', 10000, 0)
    } catch (_) {}
    if (changes.length === 0) {
      try {
        changes = $app.findRecordsByFilter('changes', 'client = "' + id + '"', '', 10000, 0)
      } catch (_) {}
    }
    if (changes.length > 0) {
      const chIds = changes
        .map(function (c) {
          return '"' + c.id + '"'
        })
        .join(',')
      const chFilter = 'change IN (' + chIds + ')'
      deleteByFilter('change_approvals', chFilter)
      deleteByFilter('change_audit_logs', chFilter)
    }
    for (const c of changes) {
      try {
        $app.delete(c)
      } catch (_) {}
    }

    // Phase 4: Equipment-dependent records
    let equipments = []
    try {
      equipments = $app.findRecordsByFilter('equipments', 'company = "' + id + '"', '', 10000, 0)
    } catch (_) {}
    if (equipments.length > 0) {
      const eqIds = equipments
        .map(function (eq) {
          return '"' + eq.id + '"'
        })
        .join(',')
      deleteByFilter('ci_relationships', 'source_ci IN (' + eqIds + ')')
      deleteByFilter('ci_relationships', 'target_ci IN (' + eqIds + ')')
      deleteByFilter('ci_documents', 'equipment IN (' + eqIds + ')')
    }
    for (const eq of equipments) {
      try {
        $app.delete(eq)
      } catch (_) {}
    }

    // Phase 5: Contract-dependent records
    let contracts = []
    try {
      contracts = $app.findRecordsByFilter('contracts', 'company = "' + id + '"', '', 10000, 0)
    } catch (_) {}
    if (contracts.length > 0) {
      const cIds = contracts
        .map(function (c) {
          return '"' + c.id + '"'
        })
        .join(',')
      deleteByFilter('contract_periods', 'contract IN (' + cIds + ')')
    }
    for (const c of contracts) {
      try {
        $app.delete(c)
      } catch (_) {}
    }

    // Phase 6: Company-direct records
    deleteByFilter('company_departments', 'company = "' + id + '"')
    deleteByFilter('company_units', 'company = "' + id + '"')
    deleteByFilter('client_contacts', 'client = "' + id + '"')
    deleteByFilter('blocking_records', 'client = "' + id + '"')
    deleteByFilter('blocked_attempts', 'client = "' + id + '"')
    deleteByFilter('continuity_decisions', 'client = "' + id + '"')
    deleteByFilter('client_email_domains', 'client = "' + id + '"')
    deleteByFilter('approval_configs', 'clients = "' + id + '"')
    deleteByFilter('km_rates', 'client = "' + id + '"')
    deleteByFilter('recurring_visit_templates', 'client = "' + id + '"')
    deleteByFilter('travel_entries', 'client = "' + id + '"')
    deleteByFilter('expenses', 'client = "' + id + '"')
    deleteByFilter('reimbursements', 'client = "' + id + '"')
    deleteByFilter('service_orders', 'client = "' + id + '"')
    deleteByFilter('satisfaction_surveys', 'company = "' + id + '"')
    deleteByFilter('audit_logs', 'entity_type = "companies" && entity_id = "' + id + '"')

    // Phase 7: Delete the company itself
    try {
      $app.delete(company)
    } catch (err) {
      $app
        .logger()
        .error('cascade delete failed for company', 'companyId', id, 'error', String(err))
      return e.json(500, {
        error:
          'Não foi possível excluir o cliente. Alguns registros vinculados podem não ter sido removidos. Tente novamente ou contate o suporte.',
      })
    }

    return e.json(200, { success: true, id: id })
  },
  $apis.requireAuth(),
)
