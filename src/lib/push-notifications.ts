import { SYSTEM_NAME } from '@/components/brand/LogosLogo'

/**
 * Notificações push do navegador (Notification API + service worker mínimo).
 *
 * Modelo: push LOCAL — a própria aba recebe o evento (realtime PocketBase) e, quando
 * está em segundo plano (document.visibilityState !== 'visible'), dispara a notificação
 * do navegador. Não há subscription de web-push no servidor: o PocketBase/Skip Cloud
 * desta instalação não publica push subscriptions, então o gatilho é sempre local.
 *
 * - A preferência "Notificações push" é individual (campo push_enabled na coleção users,
 *   migração 0140) e sobrevive a logout.
 * - Nenhuma dependência nova: Notification API + SW vanilla (public/push-sw.js).
 * - Marca: títulos usam a constante centralizada SYSTEM_NAME ("Lógos AITSM").
 */

const PUSH_PREF_KEY = 'logos_push_prompted'
let swRegistration: ServiceWorkerRegistration | null = null

/** Suporte do navegador a Notification API. */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Preferência do usuário. Fonte da verdade: campo persistido `push_enabled` na
 * coleção users (migração 0140) — o chamador injeta o valor do usuário logado.
 * O localStorage (`logos_push_prompted`) serve só como fallback quando ainda
 * não há valor persistido para este usuário (ex.: primeiro acesso pós-login).
 */
export function getPushPreference(userId?: string, userPushEnabled?: boolean): boolean {
  if (typeof userPushEnabled === 'boolean') return userPushEnabled
  try {
    const stored = localStorage.getItem(userId ? `${PUSH_PREF_KEY}:${userId}` : PUSH_PREF_KEY)
    if (stored !== null) return stored === 'true'
    // Legado: chave antiga sem sufixo de usuário.
    const legacy = localStorage.getItem(PUSH_PREF_KEY)
    if (legacy !== null) return legacy === 'true'
  } catch {
    /* intentionally ignored */
  }
  return false
}

/** Define a preferência local (o campo persistido no usuário é salvo por quem chama). */
export function setPushPreferenceLocally(enabled: boolean): void {
  try {
    localStorage.setItem(PUSH_PREF_KEY, String(enabled))
  } catch {
    /* intentionally ignored */
  }
}

/**
 * Registra o service worker mínimo (public/push-sw.js). Idempotente: chamado em
 * toda inicialização, registra apenas uma vez.
 */
export async function registerPushServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (swRegistration) return
  try {
    swRegistration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
  } catch {
    // Sem SW (ex.: file://), o fallback é a Notification API direta.
    swRegistration = null
  }
}

/**
 * Pede permissão do navegador. Nunca em loop: depois da primeira tentativa guarda
 * a marca em localStorage e só pede de novo por ação explícita do usuário (toggle).
 * Retorna 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export async function requestPushPermission(): Promise<
  'granted' | 'denied' | 'default' | 'unsupported'
> {
  if (!isPushSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    setPushPreferenceLocally(result === 'granted')
    return result
  } catch {
    return 'denied'
  }
}

/** Estado atual da permissão do navegador. */
export function getPushPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Mostra a notificação. Preferência pela via do service worker (registration
 * .showNotification) quando disponível; fallback Notification API direta.
 * O clique foca a janela e navega para `url` (rota interna do app).
 */
export async function showPushNotification(opts: {
  title: string
  body: string
  tag?: string
  url?: string
}): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  const targetUrl = opts.url || window.location.pathname + window.location.search
  const options: NotificationOptions & { data?: { url: string } } = {
    body: opts.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: opts.tag,
    data: { url: targetUrl },
  }

  // Via do service worker: suportado em desktop e PWA mobile; clique tratado no
  // notificationclick do SW (foca/reabre a janela).
  if (swRegistration && 'showNotification' in swRegistration) {
    try {
      await swRegistration.showNotification(opts.title, options)
      return
    } catch {
      // cai para a via direta abaixo
    }
  }

  // Fallback: Notification API direta (aba existe, permissão concedida).
  try {
    const notif = new Notification(opts.title, options)
    notif.onclick = () => {
      notif.close()
      focusWindowAndNavigate(targetUrl)
    }
  } catch {
    /* graceful degradation */
  }
}

/** Foca a janela do app e navega (history API) para a rota alvo. */
export function focusWindowAndNavigate(url: string): void {
  try {
    window.focus()
  } catch {
    /* intentionally ignored */
  }
  if (!url || url === '/') return
  try {
    if (window.location.pathname !== url) {
      // O BrowserRouter do app resolve a rota; history.pushState evita reload total.
      window.history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  } catch {
    window.location.href = url
  }
}

/** true quando a aba está em segundo plano/minimizada (push só dispara assim). */
export function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState !== 'visible'
}

/** Título padrão das push do sistema (marca oficial centralizada). */
export function pushBrandTitle(suffix?: string): string {
  return suffix ? `${SYSTEM_NAME} — ${suffix}` : SYSTEM_NAME
}

/** Prévia de conteúdo de mensagem de chat para o corpo da notificação. */
export function chatPushPreview(content: string, file?: string | null): string {
  if (file) {
    const name = (file || '').toLowerCase()
    if (/\.(png|jpe?g|gif|webp)$/.test(name)) return '[Foto]'
    if (/\.(webm|ogg|oga|mp3|m4a|wav)$/.test(name)) return '[Áudio]'
    if (/\.(webm|mp4|mov)$/.test(name)) return '[Vídeo]'
    return '[Anexo]'
  }
  const singleLine = (content || '').replace(/\s+/g, ' ').trim()
  if (!singleLine) return 'Nova mensagem recebida'
  return singleLine.length > 80 ? `${singleLine.slice(0, 79)}…` : singleLine
}

/**
 * Listener global: o SW (push-sw.js) posta {type:'logos-push-navigate'} quando o
 * usuário clica na notificação e não há janela aberta para focar — aqui a aba
 * recém-aberta navega para a rota alvo. Chamado uma única vez no boot do app.
 */
export function initPushNavigationListener(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'logos-push-navigate') {
        focusWindowAndNavigate(event.data.url)
      }
    })
  } catch {
    /* intentionally ignored */
  }
}
