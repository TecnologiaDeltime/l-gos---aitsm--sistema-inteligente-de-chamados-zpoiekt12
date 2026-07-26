routerAdd(
  'GET',
  '/backend/v1/smtp-status',
  (e) => {
    try {
      var s = $app.settings
      if (typeof s === 'function') s = s()
      if (!s || !s.smtp) return e.json(200, { configured: false })
      var smtp = s.smtp
      return e.json(200, { configured: !!smtp.enabled && !!smtp.host })
    } catch (err) {
      return e.json(200, { configured: false })
    }
  },
  $apis.requireAuth(),
)
