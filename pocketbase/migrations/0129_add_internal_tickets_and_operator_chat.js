/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Tornar campo company opcional na coleção tickets e adicionar campos de chamado interno
    try {
      const tickets = app.findCollectionByNameOrId('tickets')
      if (tickets) {
        const compField = tickets.fields.getByName('company')
        if (compField) {
          compField.required = false
        }

        if (!tickets.fields.getByName('is_internal')) {
          tickets.fields.add(
            new BoolField({
              name: 'is_internal',
              required: false,
            }),
          )
        }

        if (!tickets.fields.getByName('internal_sector')) {
          tickets.fields.add(
            new TextField({
              name: 'internal_sector',
              required: false,
            }),
          )
        }

        app.save(tickets)
        console.log(
          '0129: tickets collection atualizada com suporte a chamados internos (company opcional, is_internal, internal_sector)',
        )
      }
    } catch (err) {
      console.log('0129: Erro ao atualizar tickets:', err)
    }

    // 2. Criar coleção operator_chat_messages para o chat interno entre operadores
    try {
      let chatCol = null
      try {
        chatCol = app.findCollectionByNameOrId('operator_chat_messages')
      } catch (_) {}

      if (!chatCol) {
        const users = app.findCollectionByNameOrId('_pb_users_auth_')
        chatCol = new Collection({
          name: 'operator_chat_messages',
          type: 'base',
          viewRule:
            "@request.auth.id != '' && (@request.auth.id = sender.id || @request.auth.id = recipient.id)",
          createRule: "@request.auth.id != '' && @request.auth.id = sender.id",
          updateRule:
            "@request.auth.id != '' && (@request.auth.id = sender.id || @request.auth.id = recipient.id)",
          deleteRule: "@request.auth.id != '' && @request.auth.id = sender.id",
          fields: [
            {
              name: 'sender',
              type: 'relation',
              collectionId: users.id,
              required: true,
              maxSelect: 1,
            },
            {
              name: 'recipient',
              type: 'relation',
              collectionId: users.id,
              required: true,
              maxSelect: 1,
            },
            {
              name: 'content',
              type: 'text',
              required: true,
            },
            {
              name: 'read',
              type: 'bool',
              required: false,
            },
            {
              name: 'read_at',
              type: 'date',
              required: false,
            },
          ],
          indexes: [
            'CREATE INDEX idx_chat_sender_rec ON operator_chat_messages (sender, recipient, created)',
            'CREATE INDEX idx_chat_read ON operator_chat_messages (recipient, read)',
          ],
        })
        app.save(chatCol)
        console.log('0129: Coleção operator_chat_messages criada com sucesso')
      }
    } catch (err) {
      console.log('0129: Erro ao criar operator_chat_messages:', err)
    }

    // 3. Conceder permissões para os perfis existentes
    try {
      const profPerms = app.findCollectionByNameOrId('profile_permissions')
      const profiles = app.findRecordsByFilter('profiles', '1=1', '', 100, 0)

      const newPerms = [
        { module_key: 'tickets', item_key: 'tickets_interno', level: 'configure' },
        { module_key: 'chat', item_key: 'chat_operadores', level: 'configure' },
      ]

      for (const profile of profiles) {
        for (const p of newPerms) {
          try {
            const existing = app.findFirstRecordByFilter(
              'profile_permissions',
              `profile = "${profile.id}" && module_key = "${p.module_key}" && item_key = "${p.item_key}"`,
            )
            if (!existing) {
              const rec = new Record(profPerms)
              rec.set('profile', profile.id)
              rec.set('module_key', p.module_key)
              rec.set('item_key', p.item_key)
              rec.set('granted', true)
              rec.set('level', p.level)
              app.save(rec)
            }
          } catch (_) {
            const rec = new Record(profPerms)
            rec.set('profile', profile.id)
            rec.set('module_key', p.module_key)
            rec.set('item_key', p.item_key)
            rec.set('granted', true)
            rec.set('level', p.level)
            app.save(rec)
          }
        }
      }
      console.log(
        '0129: Permissões tickets_interno e chat_operadores concedidas nos perfis existentes',
      )
    } catch (err) {
      console.log('0129: Erro ao conceder permissões em perfis:', err)
    }
  },
  (app) => {
    // Revert
    try {
      const chatCol = app.findCollectionByNameOrId('operator_chat_messages')
      if (chatCol) app.delete(chatCol)
    } catch (_) {}
  },
)
