const CACHE_NAME = "rider-workbench-v2";

// Service Worker 作用域即为部署目录（如 /rider-app/）
const BASE = self.registration.scope || "/";

const ASSETS = [
  BASE,
  new URL("index.html", BASE).href,
  new URL("favicon.svg", BASE).href,
  new URL("manifest.json", BASE).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 网络优先：HTML/导航请求永远拿最新版本，避免旧缓存导致用户看不到更新
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源的 GET 请求
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === "navigate" || request.destination === "document";

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (cached) =>
                cached || caches.match(new URL("index.html", BASE).href)
            )
        )
    );
    return;
  }

  // 静态资源：先用缓存，同时后台更新（Stale-While-Revalidate）
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
