/// <reference path="../pb_data/types.d.ts" />

// 0138 — Correção de raiz do chat interno "que não envia / travado".
//
// Causa raiz: a coleção operator_chat_messages (0129) foi criada com fields
// explícitos e NUNCA recebeu os campos autodate `created`/`updated`. Todo
// pedido do serviço do chat usa sort: '-created' — o PocketBase valida o
// campo de ordenação contra o schema e devolve HTTP 400 ("invalid sort
// field") para TODA listagem: histórico do chat, mensagens da conversa,
// paginação e agrupamento de conversas. Resultado: o chat não carrega nada
// e parece travado ("as mensagens não enviam").
//
// O índice idx_chat_sender_rec também referenciava a coluna inexistente
// `created`. Aqui ele é recriado sem ela.
//
// Bônus do mesmo bug (áudio não envia): o validador de mimeTypes do campo
// `file` compara o MIME DETECTADO pelo conteúdo (gabriel-vasile/mimetype),
// não o MIME informado pelo navegador. Um .ogg do Firefox é detectado como
// application/ogg e um .m4a do Safari como audio/x-m4a — nenhum estava na
// allowlist da 0137, então o upload do áudio era rejeitado. A allowlist é
// ampliada aqui para cobrir as detecções reais de cada navegador.
//
// Permissão: reutiliza o item existente `chat.chat_operadores` (sem item novo).

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('operator_chat_messages')

    // 1. Campos autodate created/updated (a ausência deles quebrava todo sort -created)
    if (!col.fields.getByName('created')) {
      col.fields.add(
        new AutodateField({
          name: 'created',
          onCreate: true,
          system: false,
        }),
      )
    }
    if (!col.fields.getByName('updated')) {
      col.fields.add(
        new AutodateField({
          name: 'updated',
          onUpdate: true,
          system: false,
        }),
      )
    }

    // 2. Índice antigo referenciava a coluna inexistente `created` — recriar sem ela
    try {
      col.deleteIndex('idx_chat_sender_rec')
    } catch (_) {}
    try {
      col.deleteIndex('idx_chat_read')
    } catch (_) {}
    col.addIndex('idx_chat_sender_rec', false, 'sender', '')
    col.addIndex('idx_chat_read', false, 'recipient', '')

    // 3. Allowlist de MIME ampliada: cobre o MIME DETECTADO do conteúdo
    //    (não o do navegador) para áudio/foto/vídeo gravados ou anexados.
    const fileField = col.fields.getByName('file')
    if (fileField) {
      fileField.mimeTypes = [
        // Imagens
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        // Áudio — inclui as detecções reais: webm do Chrome (audio/webm ou
        // video/webm), ogg do Firefox (application/ogg), m4a do Safari
        // (audio/x-m4a), wav (audio/wav | audio/x-wav | audio/wave)
        'audio/webm',
        'video/webm',
        'audio/ogg',
        'application/ogg',
        'audio/mpeg',
        'audio/mp3',
        'audio/mp4',
        'audio/x-m4a',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/aac',
        // Vídeo
        'video/mp4',
        'video/quicktime',
      ]
    }

    app.save(col)
    console.log('0138: created/updated (autodate) + índice corrigido + mimeTypes ampliados')

    // 4. Backfill idempotente: preenche created/updated das mensagens antigas
    //    (autodate só preenche automaticamente em create; registros já gravados
    //    ficariam vazios e iriam para o fim da ordenação por -created).
    try {
      const existing = app.findRecordsByFilter('operator_chat_messages', '1=1', '', 1000, 0)
      const now = new Date().toISOString().replace('T', ' ')
      for (const rec of existing) {
        if (!rec.get('created') || !rec.get('updated')) {
          const fallback = rec.get('read_at') || now
          if (!rec.get('created')) rec.set('created', fallback)
          if (!rec.get('updated')) rec.set('updated', fallback)
          app.save(rec)
        }
      }
      console.log('0138: backfill de created/updated concluído')
    } catch (err) {
      console.log('0138: aviso no backfill (não bloqueia):', err)
    }
  },
  (app) => {
    // Revert: remove os campos autodate adicionados
    const col = app.findCollectionByNameOrId('operator_chat_messages')
    const created = col.fields.getByName('created')
    const updated = col.fields.getByName('updated')
    if (created) col.fields.removeByName('created')
    if (updated) col.fields.removeByName('updated')
    app.save(col)
  },
)
