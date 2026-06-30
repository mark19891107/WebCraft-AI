// 精簡 service worker：讓 App 離線可用、可安裝。
// 導覽（HTML）採 network-first（避免部署後拿到舊殼）；
// 其他同源資源採 cache-first（Vite 資源有內容雜湊，可安全快取）。
// 跨來源請求（LLM/API）完全不攔截。

const CACHE = 'webcraft-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put(req, res.clone())
          return res
        } catch {
          const cache = await caches.open(CACHE)
          return (await cache.match(req)) || (await cache.match('index.html')) || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res && res.ok) cache.put(req, res.clone())
        return res
      } catch {
        return Response.error()
      }
    })(),
  )
})
