/**
 * Service worker mínimo do Lógos AITSM para suporte a notificações push do navegador.
 *
 * Estratégia: o app usa notificações LOCAIS (a própria aba dispara a notificação via
 * Notification API). Este SW cobre o caso em que a Notification API direta não está
 * disponível (ex.: aba em segundo plano em alguns navegadores móveis/PWA): o app pede
 * ao SW para mostrar a notificação via registration.showNotification, e o SW trata o
 * clique (notificationclick) focando/reabrindo a janela na URL informada em data.url.
 *
 * Sem servidor de push (web-push subscription) — o PocketBase/Skip Cloud desta
 * instalação não publica push subscriptions, então o gatilho é sempre local.
 */

const BRAND = 'Lógos AITSM'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/**
 * Canal local: a aba com permissão concede pode pedir ao SW para exibir a notificação.
 * Payload esperado: { title, body, tag, url } (url = rota para abrir no clique).
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || `${BRAND} — Nova notificação`
  const options = {
    body: payload.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1) Foca uma janela já aberta do app (qualquer, evita duplicar abas).
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if (targetUrl && 'navigate' in client && client.url !== targetUrl) {
            // navigate() só existe em WindowClient em alguns contextos; postMessage cobre.
            client.postMessage({ type: 'logos-push-navigate', url: targetUrl })
          }
          return
        }
      }
      // 2) Nenhuma janela aberta: abre uma nova na URL alvo.
      return self.clients.openWindow(targetUrl)
    }),
  )
})

// Repassa a navegação pedida pelo SW para o roteador da aba (history API, sem reload).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'logos-push-navigate') return
})
