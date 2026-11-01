/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const profileCollection = app.findCollectionByNameOrId('profiles')
    const permissionsCollection = app.findCollectionByNameOrId('profile_permissions')

    const profiles = app.findRecordsByFilter(
      profileCollection,
      '', // todos os perfis
      '',
      100,
      0,
    )

    // Itens que foram adicionados/revisados para garantir cobertura total de 100% das telas
    const newItemsToBackfill = [
      { module_key: 'atendimento', item_key: 'atendimento_omnichannel' },
      { module_key: 'settings', item_key: 'settings_portal' },
      { module_key: 'settings', item_key: 'settings_client_notif' },
      { module_key: 'settings', item_key: 'settings_security' },
      { module_key: 'settings', item_key: 'settings_ticket_templates' },
      { module_key: 'settings', item_key: 'settings_aitsm_console' },
    ]

    for (const prof of profiles) {
      for (const item of newItemsToBackfill) {
        // Verificar se já existe registro desse item para esse perfil
        const existing = app.findRecordsByFilter(
          permissionsCollection,
          `profile = "${prof.id}" && module_key = "${item.module_key}" && item_key = "${item.item_key}"`,
          '',
          1,
          0,
        )

        if (existing.length === 0) {
          // Criar registro nascido como concedido (granted: true) para não quebrar perfis existentes
          const record = new Record(permissionsCollection)
          record.set('profile', prof.id)
          record.set('module_key', item.module_key)
          record.set('item_key', item.item_key)
          record.set('granted', true)
          app.save(record)
        }
      }
    }
  },
  (app) => {
    // Reversão segura se necessário
  },
)
