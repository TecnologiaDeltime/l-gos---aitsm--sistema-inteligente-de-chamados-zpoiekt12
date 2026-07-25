routerAdd(
  'POST',
  '/backend/v1/ask-assistente',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')
      const body = e.requestInfo().body || {}
      if (!body.message) return e.badRequestError('Mensagem é obrigatória')

      const result = $ai.agent('assistente-tecnico').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: body.message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Assistente temporariamente indisponível' })
      }
      return e.json(500, { error: err.message || 'Erro no assistente' })
    }
  },
  $apis.requireAuth(),
)
