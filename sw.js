const CACHE_VERSION = "r44-20260707-1";
const CACHE_PREFIX = "pixel-farm-rpg-";
const HTML_CACHE = CACHE_PREFIX + CACHE_VERSION + "-html";
const STATIC_CACHE = CACHE_PREFIX + CACHE_VERSION + "-static";
const OFFLINE_URL = "./offline.html";
const CORE_ASSETS = [
  "./",
  "./index.html",
  OFFLINE_URL,
  "./manifest.webmanifest",
  "./assets/manifest.json",
  "./src/config.js",
  "./src/game.js",
  "./src/state.js",
  "./src/atlas.js",
  "./src/ui.js",
  "./assets/generated/crop-growth.png",
  "./assets/generated/terrain-tileset.png",
  "./assets/generated/ui-icons.png",
  "./assets/generated/farm-actors-buildings.png",
  "./assets/generated/characters/miri-rowan-turnaround.png",
  "./assets/generated/characters/miri-rowan-farm-actions.png",
  "./assets/generated/characters/miri-rowan-farm-actions-cutout.png",
  "./assets/generated/characters/miri-rowan-walk-cycle.png",
  "./assets/generated/characters/miri-rowan-walk-cycle-cutout.png",
  "./assets/generated/v4/manifest.json",
  "./assets/generated/v4/animal-care-props-64.json",
  "./assets/generated/v4/animal-care-props-64.png",
  "./assets/generated/v4/animal-care-vfx-32.json",
  "./assets/generated/v4/animal-care-vfx-32.png",
  "./assets/generated/v4/animal-products-quality-32.json",
  "./assets/generated/v4/animal-products-quality-32.png",
  "./assets/generated/v4/animal-status-icons-32.json",
  "./assets/generated/v4/animal-status-icons-32.png",
  "./assets/generated/v4/animals-48.json",
  "./assets/generated/v4/animals-48.png",
  "./assets/generated/v4/animals-care-48.json",
  "./assets/generated/v4/animals-care-48.png",
  "./assets/generated/v4/buildings.json",
  "./assets/generated/v4/buildings.png",
  "./assets/generated/v4/crops-48.json",
  "./assets/generated/v4/crops-48.png",
  "./assets/generated/v4/max-actions-48x64.json",
  "./assets/generated/v4/max-actions-48x64.png",
  "./assets/generated/v4/max-walk-48x64.json",
  "./assets/generated/v4/max-walk-48x64.png",
  "./assets/generated/v4/miri-actions-48x64.json",
  "./assets/generated/v4/miri-actions-48x64.png",
  "./assets/generated/v4/miri-walk-48x64.json",
  "./assets/generated/v4/miri-walk-48x64.png",
  "./assets/generated/v4/npcs-48x64.json",
  "./assets/generated/v4/npcs-48x64.png",
  "./assets/generated/v4/structures-nature.json",
  "./assets/generated/v4/structures-nature.png",
  "./assets/generated/v4/terrain-organic-32.json",
  "./assets/generated/v4/terrain-organic-32.png",
  "./assets/generated/v3/action-vfx-32.json",
  "./assets/generated/v3/action-vfx-32.png",
  "./assets/generated/v3/props-stations.json",
  "./assets/generated/v3/props-stations.png",
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
    return (await cache.match(request)) || (await cache.match("./index.html")) || (await caches.match(OFFLINE_URL)) || Response.error();
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
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
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
