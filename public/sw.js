const CACHE_NAME = "rider-workbench-v4";

// Service Worker 作用域即为部署目录（如 /rider-app/）
const BASE = self.registration.scope || "/";

const ASSETS = [
  BASE,
  new URL("index.html", BASE).href,
  new URL("favicon.svg", BASE).href,
  new URL("manifest.json", BASE).href,
];

// 只缓存成功的响应，避免把 401/404/500 等错误响应存进缓存
function cacheIfOk(cache, request, response) {
  if (!response || !response.ok || response.status === 206) {
    return response;
  }
  const clone = response.clone();
  cache.put(request, clone).catch(() => {});
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 逐个请求并缓存，避免某一个失败导致整批缓存失效
      await Promise.all(
        ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { credentials: "same-origin" });
            cacheIfOk(cache, url, response);
          } catch {
            // 安装时失败不要紧，activate 后会走 fetch 兜底
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源的 GET 请求；跳过浏览器内部请求（如 chrome-extension、range 请求）
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.mode === "navigate" && url.pathname.startsWith("/api/")
  ) {
    return;
  }

  const isNavigation =
    request.mode === "navigate" || request.destination === "document";

  // 导航请求：网络优先，失败再回缓存，永远不把错误响应存进缓存
  if (isNavigation) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request, { credentials: "same-origin" })
          .then((response) => cacheIfOk(cache, request, response))
          .catch(() =>
            caches
              .match(request)
              .then(
                (cached) =>
                  cached ||
                  caches.match(new URL("index.html", BASE).href)
              )
          )
      )
    );
    return;
  }

  // 核心 PWA 资源（manifest、sw.js 本身）：网络优先，避免旧缓存导致更新不生效
  const isCoreAsset =
    url.pathname.endsWith("manifest.json") ||
    url.pathname.endsWith("sw.js");

  if (isCoreAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request, { credentials: "same-origin" })
          .then((response) => cacheIfOk(cache, request, response))
          .catch(() => caches.match(request))
      )
    );
    return;
  }

  // 静态资源：先用缓存，同时后台更新（Stale-While-Revalidate）
  // 如果缓存本身是错误响应，则不使用，直接等网络请求
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = caches
        .open(CACHE_NAME)
        .then((cache) =>
          fetch(request, { credentials: "same-origin" })
            .then((response) => cacheIfOk(cache, request, response))
            .catch(() => cached)
        );

      if (cached && cached.ok) {
        return cached;
      }
      return network;
    })
  );
});
