if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void register()
  })
}

async function register() {
  const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
  notifyUpdate(registration)
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    if (!worker) return
    worker.addEventListener('statechange', () => notifyUpdate(registration))
  })
  const checkForUpdate = () => { void registration.update() }
  // Check whenever the installed app returns to the foreground, not only once
  // per hour. updateViaCache above ensures this request bypasses HTTP caches.
  window.addEventListener('focus', checkForUpdate)
  window.addEventListener('online', checkForUpdate)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate() })
  window.setInterval(checkForUpdate, 15 * 60 * 1000)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (window.__movelyaRefreshing) return
    window.__movelyaRefreshing = true
    window.location.reload()
  })
}

function notifyUpdate(registration: ServiceWorkerRegistration) {
  if (registration.waiting) window.dispatchEvent(new CustomEvent('movelya:pwa-update', { detail: registration }))
}

declare global {
  interface Window { __movelyaRefreshing?: boolean }
}
