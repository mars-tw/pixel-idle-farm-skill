const CACHE_VERSION = "r31-20260706-1";
const CACHE_PREFIX = "pixel-farm-rpg-";
const HTML_CACHE = CACHE_PREFIX + CACHE_VERSION + "-html";
const STATIC_CACHE = CACHE_PREFIX + CACHE_VERSION + "-static";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/config.js",
  "./src/game.js",
  "./src/state.js",
  "./src/atlas.js",
  "./src/ui.js",
  "./assets/generated/v4/manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

function isHtmlRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

async function networkFirst(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      if (request.mode === "navigate") cache.put("./index.html", response.clone());
    }
    return response;
  } catch (e) {
    return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && !key.includes(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(isHtmlRequest(request) ? networkFirst(request) : cacheFirst(request));
});
