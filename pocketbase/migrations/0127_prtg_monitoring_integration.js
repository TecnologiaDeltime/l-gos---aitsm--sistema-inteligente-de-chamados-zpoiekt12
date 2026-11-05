migrate(
  (app) => {
    // 1. Atualizar select 'source' de tickets para incluir 'Monitoramento' e 'PRTG'
    try {
      const tickets = app.findCollectionByNameOrId('tickets')
      const sourceField = tickets.fields.getByName('source')
      if (sourceField) {
        const currentValues = sourceField.values || []
        let changed = false
        if (currentValues.indexOf('Monitoramento') === -1) {
          currentValues.push('Monitoramento')
          changed = true
        }
        if (currentValues.indexOf('PRTG') === -1) {
          currentValues.push('PRTG')
          changed = true
        }
        if (changed) {
          sourceField.values = currentValues
          app.save(tickets)
        }
      }

      // Adicionar campos auxiliares para rastreio do monitoramento
      if (!tickets.fields.getByName('monitoring_sensor_id')) {
        tickets.fields.add(
          new TextField({
            name: 'monitoring_sensor_id',
          }),
        )
      }
      if (!tickets.fields.getByName('monitoring_device')) {
        tickets.fields.add(
          new TextField({
            name: 'monitoring_device',
          }),
        )
      }
      if (!tickets.fields.getByName('monitoring_source')) {
        tickets.fields.add(
          new TextField({
            name: 'monitoring_source',
          }),
        )
      }
      app.save(tickets)
    } catch (e) {
      console.log('0127: Erro ao ajustar campos de monitoramento em tickets:', e)
    }

    // 2. Expandir coleção system_settings para suportar integração PRTG
    try {
      const sysCol = app.findCollectionByNameOrId('system_settings')
      if (sysCol) {
        if (!sysCol.fields.getByName('prtg_enabled')) {
          sysCol.fields.add(new BoolField({ name: 'prtg_enabled' }))
        }
        if (!sysCol.fields.getByName('prtg_webhook_token')) {
          sysCol.fields.add(new TextField({ name: 'prtg_webhook_token' }))
        }
        if (!sysCol.fields.getByName('prtg_default_priority')) {
          sysCol.fields.add(
            new SelectField({
              name: 'prtg_default_priority',
              values: ['Crítica', 'Alta', 'Média', 'Baixa'],
              maxSelect: 1,
            }),
          )
        }
        if (!sysCol.fields.getByName('prtg_default_queue')) {
          const queuesColId = app.findCollectionByNameOrId('queues').id
          sysCol.fields.add(
            new RelationField({
              name: 'prtg_default_queue',
              collectionId: queuesColId,
              maxSelect: 1,
            }),
          )
        }
        if (!sysCol.fields.getByName('prtg_default_activity')) {
          const actColId = app.findCollectionByNameOrId('tkt_categories').id
          sysCol.fields.add(
            new RelationField({
              name: 'prtg_default_activity',
              collectionId: actColId,
              maxSelect: 1,
            }),
          )
        }
        if (!sysCol.fields.getByName('prtg_default_company')) {
          const compColId = app.findCollectionByNameOrId('companies').id
          sysCol.fields.add(
            new RelationField({
              name: 'prtg_default_company',
              collectionId: compColId,
              maxSelect: 1,
            }),
          )
        }
        if (!sysCol.fields.getByName('prtg_dedup_hours')) {
          sysCol.fields.add(new NumberField({ name: 'prtg_dedup_hours', min: 1, max: 720 }))
        }
        if (!sysCol.fields.getByName('prtg_mapping_rules')) {
          // JSON array de regras [{ matchText: string, companyId: string, queueId?: string, activityId?: string }]
          sysCol.fields.add(new JSONField({ name: 'prtg_mapping_rules', maxSize: 524288 }))
        }
        if (!sysCol.fields.getByName('prtg_auto_resolve_on_up')) {
          sysCol.fields.add(new BoolField({ name: 'prtg_auto_resolve_on_up' }))
        }
        app.save(sysCol)

        // Seed ou update do registro global
        try {
          const globalRec = app.findFirstRecordByFilter(
            'system_settings',
            'key = "global"',
            '',
            0,
            0,
          )
          if (globalRec) {
            let shouldSave = false
            if (!globalRec.getString('prtg_webhook_token')) {
              globalRec.set('prtg_webhook_token', $security.randomString(32))
              shouldSave = true
            }
            if (globalRec.getInt('prtg_dedup_hours') === 0) {
              globalRec.set('prtg_dedup_hours', 4)
              shouldSave = true
            }
            if (!globalRec.getString('prtg_default_priority')) {
              globalRec.set('prtg_default_priority', 'Média')
              shouldSave = true
            }
            if (!globalRec.get('prtg_auto_resolve_on_up')) {
              globalRec.set('prtg_auto_resolve_on_up', true)
              shouldSave = true
            }
            if (shouldSave) {
              app.save(globalRec)
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.log('0127: Erro ao expandir system_settings para PRTG:', e)
    }

    // 3. Cadastrar permissão settings_prtg_monitoring com 3 níveis em profile_permissions
    if (app.hasTable('profile_permissions') && app.hasTable('profiles')) {
      const profiles = app.findRecordsByFilter('profiles', 'id != ""', '', 0, 0)
      const permCol = app.findCollectionByNameOrId('profile_permissions')

      const moduleKey = 'settings'
      const itemKey = 'settings_prtg_monitoring'

      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i]
        const profileId = prof.id
        const profName = (prof.getString('name') || '').toLowerCase()

        let assignedLevel = 'view'
        let granted = false

        if (profName.includes('admin') || profName.includes('gestor')) {
          assignedLevel = 'configure'
          granted = true
        } else if (profName.includes('qualidade') || profName.includes('coordenador')) {
          assignedLevel = 'edit'
          granted = true
        } else if (profName.includes('helpdesk') || profName.includes('suporte')) {
          assignedLevel = 'view'
          granted = true
        }

        const existing = app.findRecordsByFilter(
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
          const rec = new Record(permCol)
          rec.set('profile', profileId)
          rec.set('module_key', moduleKey)
          rec.set('item_key', itemKey)
          rec.set('granted', granted)
          rec.set('level', assignedLevel)
          app.save(rec)
        }
      }
    }
  },
  (app) => {
    if (app.hasTable('profile_permissions')) {
      app
        .db()
        .newQuery(
          'DELETE FROM profile_permissions WHERE module_key = "settings" AND item_key = "settings_prtg_monitoring"',
        )
        .execute()
    }
  },
)
