/// <reference path="../pb_data/types.d.ts" />

// 0137: Anexos no chat interno de operadores (áudio, foto e vídeo).
// Adiciona campo `file` (arquivo único) na coleção operator_chat_messages.
// As regras de acesso existentes (list/view = participantes da conversa, migração 0136)
// já garantem que apenas sender e recipient leiam o arquivo — a coleção tem `protected: false`
// e a regra de list/view continua sendo a porta de entrada única.
// Permissão: reutiliza o item existente `chat.chat_operadores` do catálogo (sem item novo).

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('operator_chat_messages')

    // Recriar índices antigos apontando para coluna inexistente (created não é autodate aqui)
    try {
      col.deleteIndex('idx_chat_sender_rec')
      col.deleteIndex('idx_chat_read')
      col.addIndex('idx_chat_sender_rec', ['sender', 'recipient'], '')
      col.addIndex('idx_chat_read', ['recipient', 'read'], '')
    } catch (_) {}

    if (!col.fields.getByName('file')) {
      col.fields.add(
        new FileField({
          name: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 5242880, // 5 MB (padrão do PocketBase)
          mimeTypes: [
            // Imagens
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            // Áudio
            'audio/webm',
            'audio/ogg',
            'audio/mpeg',
            'audio/mp4',
            'audio/wav',
            // Vídeo
            'video/webm',
            'video/mp4',
            'video/quicktime',
          ],
        }),
      )
    }

    app.save(col)
    console.log('0137: campo file (áudio/foto/vídeo, max 5MB) adicionado a operator_chat_messages')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('operator_chat_messages')
    const f = col.fields.getByName('file')
    if (f) {
      col.fields.removeByName('file')
      app.save(col)
    }
  },
)
