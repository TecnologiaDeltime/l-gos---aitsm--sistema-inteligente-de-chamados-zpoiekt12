// pocketbase/hooks/brand_constants.js
// Centralização da marca oficial do sistema em todo o backend do PocketBase.
// Nenhuma notificação, template ou remetente de e-mail deve usar variações antigas.

;(function () {
  var BRAND_NAME = 'Lógos AITSM'
  var BRAND_SUBTITLE = 'Gestão Inteligente de TI'
  var BRAND_SLOGAN = 'Sistema Inteligente de Chamados e Gestão de Serviços de TI'
  var DEFAULT_SENDER_EMAIL = 'noreply@logositsm.com.br'

  globalThis.SYSTEM_BRAND_NAME = BRAND_NAME
  globalThis.SYSTEM_BRAND_SUBTITLE = BRAND_SUBTITLE
  globalThis.SYSTEM_BRAND_SLOGAN = BRAND_SLOGAN
  globalThis.SYSTEM_DEFAULT_SENDER_NAME = BRAND_NAME
  globalThis.SYSTEM_DEFAULT_SENDER_EMAIL = DEFAULT_SENDER_EMAIL

  // Sanitizador helper para garantir que nenhuma string enviada em notificações contenha AITILSM
  globalThis.sanitizeSystemBrand = function (str) {
    if (!str || typeof str !== 'string') return str
    return str.replace(/L[oó]gos\s+AITILSM/gi, BRAND_NAME).replace(/AITILSM/gi, 'AITSM')
  }
})()
